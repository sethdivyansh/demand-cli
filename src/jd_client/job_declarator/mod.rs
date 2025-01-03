pub mod message_handler;
mod task_manager;
use binary_sv2::{Seq0255, Seq064K, Sv2DataType, B016M, B064K, U256};
use bitcoin::{util::psbt::serialize::Deserialize, Transaction};
use codec_sv2::{HandshakeRole, Initiator, StandardEitherFrame, StandardSv2Frame};
use demand_sv2_connection::noise_connection_tokio::Connection;
use roles_logic_sv2::{
    handlers::SendTo_,
    job_declaration_sv2::{AllocateMiningJobTokenSuccess, SubmitSolutionJd},
    mining_sv2::SubmitSharesExtended,
    parsers::{JobDeclaration, PoolMessages},
    template_distribution_sv2::SetNewPrevHash,
    utils::Mutex,
};
use std::{collections::HashMap, convert::TryInto};
use task_manager::TaskManager;
use tokio::sync::mpsc::{Receiver as TReceiver, Sender as TSender};
use tracing::{error, info};

use async_recursion::async_recursion;
use nohash_hasher::BuildNoHashHasher;
use roles_logic_sv2::{
    handlers::job_declaration::ParseServerJobDeclarationMessages,
    job_declaration_sv2::{AllocateMiningJobToken, DeclareMiningJob},
    template_distribution_sv2::NewTemplate,
    utils::Id,
};
use std::{net::SocketAddr, sync::Arc};

pub type Message = PoolMessages<'static>;
pub type SendTo = SendTo_<JobDeclaration<'static>, ()>;
pub type StdFrame = StandardSv2Frame<Message>;

pub mod setup_connection;
use setup_connection::SetupConnectionHandler;

use crate::shared::utils::AbortOnDrop;

use super::{error::Error, mining_upstream::Upstream};

#[derive(Debug, Clone)]
pub struct LastDeclareJob {
    declare_job: DeclareMiningJob<'static>,
    template: NewTemplate<'static>,
    coinbase_pool_output: Vec<u8>,
    tx_list: Seq064K<'static, B016M<'static>>,
}

#[derive(Debug)]
pub struct JobDeclarator {
    sender: TSender<StandardEitherFrame<PoolMessages<'static>>>,
    allocated_tokens: Vec<AllocateMiningJobTokenSuccess<'static>>,
    req_ids: Id,
    min_extranonce_size: u16,
    // (Sent DeclareMiningJob, is future, template id, merkle path)
    last_declare_mining_jobs_sent: HashMap<u32, Option<LastDeclareJob>>,
    last_set_new_prev_hash: Option<SetNewPrevHash<'static>>,
    set_new_prev_hash_counter: u8,
    #[allow(clippy::type_complexity)]
    future_jobs: HashMap<
        u64,
        (
            DeclareMiningJob<'static>,
            Seq0255<'static, U256<'static>>,
            NewTemplate<'static>,
            // pool's outputs
            Vec<u8>,
        ),
        BuildNoHashHasher<u64>,
    >,
    up: Arc<Mutex<Upstream>>,
    pub coinbase_tx_prefix: B064K<'static>,
    pub coinbase_tx_suffix: B064K<'static>,
    pub task_manager: Arc<Mutex<TaskManager>>,
}

impl JobDeclarator {
    pub async fn new(
        address: SocketAddr,
        authority_public_key: [u8; 32],
        up: Arc<Mutex<Upstream>>,
    ) -> Result<(Arc<Mutex<Self>>, AbortOnDrop), Error> {
        let stream = tokio::net::TcpStream::connect(address).await?;
        let initiator = Initiator::from_raw_k(authority_public_key)?;
        let (mut receiver, mut sender, _, _) =
            Connection::new(stream, HandshakeRole::Initiator(initiator))
                .await
                .expect("impossible to connect");

        SetupConnectionHandler::setup(&mut receiver, &mut sender, address).await?;

        info!("JD CONNECTED");

        let min_extranonce_size = crate::MIN_EXTRANONCE_SIZE;

        let task_manager = TaskManager::initialize();
        let abortable = task_manager
            .safe_lock(|t| t.get_aborter())
            .map_err(|_| Error::PoisonLock)?
            .ok_or(Error::Unrecoverable)?; // Better Error to return here ?
        let self_ = Arc::new(Mutex::new(JobDeclarator {
            sender,
            allocated_tokens: vec![],
            req_ids: Id::new(),
            min_extranonce_size,
            last_declare_mining_jobs_sent: HashMap::with_capacity(2),
            last_set_new_prev_hash: None,
            future_jobs: HashMap::with_hasher(BuildNoHashHasher::default()),
            up,
            coinbase_tx_prefix: vec![].try_into().expect("Internal error: this operation can not fail because the Vec can always be converted into Inner"),
            coinbase_tx_suffix: vec![].try_into().expect("Internal error: this operation can not fail because the Vec can always be converted into Inner"),
            set_new_prev_hash_counter: 0,
            task_manager,
        }));

        Self::allocate_tokens(&self_, 2).await;
        Self::on_upstream_message(self_.clone(), receiver).await;
        Ok((self_, abortable))
    }

    fn get_last_declare_job_sent(
        self_mutex: &Arc<Mutex<Self>>,
        request_id: u32,
    ) -> Result<LastDeclareJob, ()> {
        let id = self_mutex
            .safe_lock(|s| s.last_declare_mining_jobs_sent.remove(&request_id).clone())
            .map_err(|_| ())?;
        Ok(id
            .expect("Impossible to get last declare job sent")
            .clone()
            .expect("This is ok"))
    }

    fn update_last_declare_job_sent(
        self_mutex: &Arc<Mutex<Self>>,
        request_id: u32,
        j: LastDeclareJob,
    ) {
        if self_mutex
            .safe_lock(|s| {
                //check hashmap size in order to not let it grow indefinetely
                if s.last_declare_mining_jobs_sent.len() < 10 {
                    s.last_declare_mining_jobs_sent.insert(request_id, Some(j));
                } else if let Some(min_key) = s.last_declare_mining_jobs_sent.keys().min().cloned()
                {
                    s.last_declare_mining_jobs_sent.remove(&min_key);
                    s.last_declare_mining_jobs_sent.insert(request_id, Some(j));
                }
            })
            .is_err()
        {
            error!("Failed to acquire lock");
        }
    }

    #[async_recursion]
    pub async fn get_last_token(
        self_mutex: &Arc<Mutex<Self>>,
    ) -> Result<AllocateMiningJobTokenSuccess<'static>, ()> {
        let mut token_len = self_mutex
            .safe_lock(|s| s.allocated_tokens.len())
            .map_err(|_| ())?;
        let task_manager = self_mutex
            .safe_lock(|s| s.task_manager.clone())
            .map_err(|_| ())?;
        match token_len {
            0 => {
                {
                    let task = {
                        let self_mutex = self_mutex.clone();
                        tokio::task::spawn(async move {
                            Self::allocate_tokens(&self_mutex, 2).await;
                        })
                    };
                    TaskManager::add_allocate_tokens(task_manager, task.into()).await?;
                }

                // we wait for token allocation to avoid infinite recursion
                while token_len == 0 {
                    tokio::task::yield_now().await;
                    token_len = self_mutex
                        .safe_lock(|s| s.allocated_tokens.len())
                        .map_err(|_| ())?;
                }

                Self::get_last_token(self_mutex).await
            }
            1 => {
                {
                    let task = {
                        let self_mutex = self_mutex.clone();
                        tokio::task::spawn(async move {
                            Self::allocate_tokens(&self_mutex, 1).await;
                        })
                    };
                    TaskManager::add_allocate_tokens(task_manager, task.into()).await?;
                }
                // There is a token, unwrap is safe
                Ok(self_mutex
                    .safe_lock(|s| s.allocated_tokens.pop())
                    .map_err(|_| ())?
                    .unwrap())
            }
            // There are tokens, unwrap is safe
            _ => Ok(self_mutex
                .safe_lock(|s| s.allocated_tokens.pop())
                .map_err(|_| ())?
                .unwrap()),
        }
    }

    pub async fn on_new_template(
        self_mutex: &Arc<Mutex<Self>>,
        template: NewTemplate<'static>,
        token: Vec<u8>,
        tx_list_: Seq064K<'static, B016M<'static>>,
        excess_data: B064K<'static>,
        coinbase_pool_output: Vec<u8>,
    ) {
        let (id, _, sender) = match self_mutex
            .safe_lock(|s| (s.req_ids.next(), s.min_extranonce_size, s.sender.clone()))
        {
            Ok((id, extranounce_size, sender)) => (id, extranounce_size, sender),
            Err(_) => {
                error!("Failed to acquire lock");
                return;
            }
        };

        let mut tx_list: Vec<Transaction> = Vec::new();
        for tx in tx_list_.to_vec() {
            match Transaction::deserialize(&tx) {
                Ok(tx) => tx_list.push(tx),
                Err(_) => {
                    error!("Failed to deserailize transaction");
                    return;
                }
            }
        }
        let coinbase_prefix =
            if let Ok(coinbase_prefix) = self_mutex.safe_lock(|s| s.coinbase_tx_prefix.clone()) {
                coinbase_prefix
            } else {
                error!("Failed to acquire lock");
                return;
            };
        let coinbase_suffix =
            if let Ok(coinbase_prefix) = self_mutex.safe_lock(|s| s.coinbase_tx_suffix.clone()) {
                coinbase_prefix
            } else {
                error!("Failed to acquire lock");
                return;
            };
        let tx_list_seq064k = if let Some(inner) = Some(tx_list_.clone().into_inner()) {
            let inner_vec = inner
                .into_iter()
                .filter_map(|item| {
                    let item_vec = item.to_vec();
                    U256::from_vec_(item_vec).ok()
                })
                .collect();
            match Seq064K::new(inner_vec) {
                Ok(seq) => seq,
                Err(_) => return,
            }
        } else {
            return;
        };

        let declare_job = DeclareMiningJob {
            request_id: id,
            mining_job_token: token.try_into().expect("Internal error: this operation can not fail because the Vec<U8> can always be converted into Inner"),
            version: template.version,
            coinbase_prefix,
            coinbase_suffix,
            tx_list: tx_list_seq064k,
            excess_data, // request transaction data
        };
        let last_declare = LastDeclareJob {
            declare_job: declare_job.clone(),
            template,
            coinbase_pool_output,
            tx_list: tx_list_.clone(),
        };
        Self::update_last_declare_job_sent(self_mutex, id, last_declare);
        let frame: StdFrame =
            match PoolMessages::JobDeclaration(JobDeclaration::DeclareMiningJob(declare_job))
                .try_into()
            {
                Ok(frame) => frame,
                Err(_) => return,
            };
        if sender.send(frame.into()).await.is_err() {
            error!("Failed to send StdFrame");
        }
    }

    pub async fn on_upstream_message(
        self_mutex: Arc<Mutex<Self>>,
        mut receiver: TReceiver<StandardEitherFrame<PoolMessages<'static>>>,
    ) {
        let up = match self_mutex.safe_lock(|s| s.up.clone()) {
            Ok(up) => up,
            Err(_) => {
                error!("Failed to acquire lock");
                return;
            }
        };
        let task_manager = match self_mutex.safe_lock(|s| s.task_manager.clone()) {
            Ok(task_manager) => task_manager,
            Err(_) => {
                error!("Failed to acquire lock");
                return;
            }
        };
        let main_task = tokio::task::spawn(async move {
            loop {
                let mut incoming: StdFrame = match receiver.recv().await {
                    Some(msg) => msg.try_into().unwrap_or_else(|_| std::process::abort()),
                    None => break,
                };
                let message_type = match incoming.get_header() {
                    Some(header) => header.msg_type(),
                    None => break,
                };
                let payload = incoming.payload();
                let next_message_to_send =
                    ParseServerJobDeclarationMessages::handle_message_job_declaration(
                        self_mutex.clone(),
                        message_type,
                        payload,
                    );
                match next_message_to_send {
                    Ok(SendTo::None(Some(JobDeclaration::DeclareMiningJobSuccess(m)))) => {
                        let new_token = m.new_mining_job_token;
                        let last_declare =
                            match Self::get_last_declare_job_sent(&self_mutex, m.request_id) {
                                Ok(last_declare) => last_declare,
                                Err(_) => break,
                            };
                        let mut last_declare_mining_job_sent = last_declare.declare_job;
                        let is_future = last_declare.template.future_template;
                        let id = last_declare.template.template_id;
                        let merkle_path = last_declare.template.merkle_path.clone();
                        let template = last_declare.template;

                        // TODO where we should have a sort of signaling that is green after
                        // that the token has been updated so that on_set_new_prev_hash know it
                        // and can decide if send the set_custom_job or not
                        if is_future {
                            last_declare_mining_job_sent.mining_job_token = new_token;
                            if self_mutex
                                .safe_lock(|s| {
                                    s.future_jobs.insert(
                                        id,
                                        (
                                            last_declare_mining_job_sent,
                                            merkle_path,
                                            template,
                                            last_declare.coinbase_pool_output,
                                        ),
                                    );
                                })
                                .is_err()
                            {
                                error!("Failed to acquire lock");
                                return;
                            };
                        } else {
                            let set_new_prev_hash =
                                match self_mutex.safe_lock(|s| s.last_set_new_prev_hash.clone()) {
                                    Ok(set_new_prev_hash) => set_new_prev_hash,
                                    Err(_) => {
                                        error!("Failed to acquire lock");
                                        return;
                                    }
                                };
                            let mut template_outs = template.coinbase_tx_outputs.to_vec();
                            let mut pool_outs = last_declare.coinbase_pool_output;
                            pool_outs.append(&mut template_outs);
                            match set_new_prev_hash {
                                Some(p) => match Upstream::set_custom_jobs(
                                    &up,
                                    last_declare_mining_job_sent,
                                    p,
                                    merkle_path,
                                    new_token,
                                    template.coinbase_tx_version,
                                    template.coinbase_prefix,
                                    template.coinbase_tx_input_sequence,
                                    template.coinbase_tx_value_remaining,
                                    pool_outs,
                                    template.coinbase_tx_locktime,
                                    template.template_id
                                    ).await {
                                        Ok(_) => {},
                                        Err(e) => {
                                            error!("{}", e);
                                            break;
                                        }
                                    },
                                None => panic!("Invalid state we received a NewTemplate not future, without having received a set new prev hash")
                            }
                        }
                    }
                    Ok(SendTo::None(Some(JobDeclaration::DeclareMiningJobError(m)))) => {
                        error!("Job is not verified: {:?}", m);
                    }
                    Ok(SendTo::None(None)) => (),
                    Ok(SendTo::Respond(m)) => {
                        let sv2_frame: StdFrame = match PoolMessages::JobDeclaration(m).try_into() {
                            Ok(sv2_frame) => sv2_frame,
                            Err(e) => {
                                error!("{}", e);
                                break;
                            }
                        };
                        let sender = match self_mutex.safe_lock(|self_| self_.sender.clone()) {
                            Ok(sender) => sender,
                            Err(_) => return,
                        };
                        if sender.send(sv2_frame.into()).await.is_err() {
                            error!("Failed to send sv2_frame");
                            break;
                        };
                    }
                    Ok(_) => unreachable!(),
                    Err(_) => todo!(),
                }
            }
        });
        if TaskManager::add_allocate_tokens(task_manager, main_task.into())
            .await
            .is_err()
        {
            error!("Failed to add allocate tokens task to task manager");
        }
    }

    pub async fn on_set_new_prev_hash(
        self_mutex: Arc<Mutex<Self>>,
        set_new_prev_hash: SetNewPrevHash<'static>,
    ) {
        let task_manager = match self_mutex.safe_lock(|s| s.task_manager.clone()) {
            Ok(task_manager) => task_manager,
            Err(_) => {
                error!("Failed to acquire lock");
                return;
            }
        };
        let task = tokio::task::spawn(async move {
            let id = set_new_prev_hash.template_id;
            let _ = self_mutex.safe_lock(|s| {
                s.last_set_new_prev_hash = Some(set_new_prev_hash.clone());
                s.set_new_prev_hash_counter += 1;
            });
            let (job, up, merkle_path, template, mut pool_outs) = loop {
                match self_mutex.safe_lock(|s| {
                    if s.set_new_prev_hash_counter > 1
                        && s.last_set_new_prev_hash != Some(set_new_prev_hash.clone())
                    //it means that a new prev_hash is arrived while the previous hasn't exited the loop yet
                    {
                        s.set_new_prev_hash_counter -= 1;
                        Some(None)
                    } else {
                        s.future_jobs
                            .remove(&id)
                            .map(|(job, merkle_path, template, pool_outs)| {
                                s.future_jobs = HashMap::with_hasher(BuildNoHashHasher::default());
                                s.set_new_prev_hash_counter -= 1;
                                Some((job, s.up.clone(), merkle_path, template, pool_outs))
                            })
                    }
                }) {
                    Ok(Some(Some(future_job_tuple))) => break future_job_tuple,
                    Ok(Some(None)) => return,
                    Ok(None) => {}
                    Err(_) => {
                        error!("Failed to acquire lock");
                        return;
                    }
                };
                tokio::task::yield_now().await;
            };
            let signed_token = job.mining_job_token.clone();
            let mut template_outs = template.coinbase_tx_outputs.to_vec();
            pool_outs.append(&mut template_outs);
            match Upstream::set_custom_jobs(
                &up,
                job,
                set_new_prev_hash,
                merkle_path,
                signed_token,
                template.coinbase_tx_version,
                template.coinbase_prefix,
                template.coinbase_tx_input_sequence,
                template.coinbase_tx_value_remaining,
                pool_outs,
                template.coinbase_tx_locktime,
                template.template_id,
            )
            .await
            {
                Ok(_) => {}
                Err(e) => {
                    error!("{}", e);
                }
            }
        });
        if TaskManager::add_allocate_tokens(task_manager, task.into())
            .await
            .is_err()
        {
            error!("Failed to add allocate tokens task to task manager");
        }
    }

    async fn allocate_tokens(self_mutex: &Arc<Mutex<Self>>, token_to_allocate: u32) {
        for i in 0..token_to_allocate {
            let message = JobDeclaration::AllocateMiningJobToken(AllocateMiningJobToken {
                user_identifier: "todo".to_string().try_into().expect("Infallible operation"),
                request_id: i,
            });
            let sender = match self_mutex.safe_lock(|s| s.sender.clone()) {
                Ok(sender) => sender,
                Err(_) => {
                    error!("Failed to acquire lock");
                    return;
                }
            };
            // Safe unwrap message is build above and is valid, below can never panic
            let frame: StdFrame = match PoolMessages::JobDeclaration(message).try_into() {
                Ok(frame) => frame,
                Err(e) => {
                    error!("{e}");
                    return;
                }
            };
            // TODO join re
            if sender.send(frame.into()).await.is_err() {
                error!("Failed to send StdFrame");
                return;
            };
        }
    }
    pub async fn on_solution(
        self_mutex: &Arc<Mutex<Self>>,
        solution: SubmitSharesExtended<'static>,
    ) {
        let prev_hash = self_mutex
            .safe_lock(|s| s.last_set_new_prev_hash.clone())
            .expect("Poison lock error")
            .expect("Impossible to get last p hash");
        let solution = SubmitSolutionJd {
            extranonce: solution.extranonce,
            prev_hash: prev_hash.prev_hash,
            ntime: solution.ntime,
            nonce: solution.nonce,
            nbits: prev_hash.n_bits,
            version: solution.version,
        };
        let frame: StdFrame =
            PoolMessages::JobDeclaration(JobDeclaration::SubmitSolution(solution))
                .try_into()
                .expect("Infallible operation");
        let sender = self_mutex
            .safe_lock(|s| s.sender.clone())
            .expect("Poison lock error");
        sender
            .send(frame.into())
            .await
            .expect("JDC Sub solution receiver unavailable");
    }
}
