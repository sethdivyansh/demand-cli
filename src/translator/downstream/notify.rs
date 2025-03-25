use crate::proxy_state::{DownstreamType, ProxyState};
use crate::translator::downstream::SUBSCRIBE_TIMEOUT_SECS;
use crate::translator::error::Error;

use super::{downstream::Downstream, task_manager::TaskManager};
use roles_logic_sv2::utils::Mutex;
use std::sync::Arc;
use sv1_api::json_rpc;
use sv1_api::server_to_client;
use tokio::sync::broadcast;
use tokio::task;
use tracing::{error, warn};

pub async fn start_notify(
    task_manager: Arc<Mutex<TaskManager>>,
    downstream: Arc<Mutex<Downstream>>,
    mut rx_sv1_notify: broadcast::Receiver<server_to_client::Notify<'static>>,
    last_notify: Option<server_to_client::Notify<'static>>,
    host: String,
    connection_id: u32,
) -> Result<(), Error<'static>> {
    let handle = {
        let task_manager = task_manager.clone();
        task::spawn(async move {
            let timeout_timer = std::time::Instant::now();
            let mut first_sent = false;
            loop {
                let is_a = match downstream.safe_lock(|d| !d.authorized_names.is_empty()) {
                    Ok(is_a) => is_a,
                    Err(e) => {
                        error!("{e}");
                        ProxyState::update_downstream_state(DownstreamType::TranslatorDownstream);
                        break;
                    }
                };
                if is_a && !first_sent && last_notify.is_some() {
                    if let Err(e) = Downstream::init_difficulty_management(&downstream).await {
                        error!("Failed to initailize difficulty managemant {e}")
                    };

                    let sv1_mining_notify_msg = match last_notify.clone() {
                        Some(sv1_mining_notify_msg) => sv1_mining_notify_msg,
                        None => {
                            error!("sv1_mining_notify_msg is None");
                            ProxyState::update_downstream_state(
                                DownstreamType::TranslatorDownstream,
                            );
                            break;
                        }
                    };
                    let message: json_rpc::Message = sv1_mining_notify_msg.into();
                    Downstream::send_message_downstream(downstream.clone(), message).await;
                    if downstream
                        .clone()
                        .safe_lock(|s| {
                            s.first_job_received = true;
                        })
                        .is_err()
                    {
                        error!("Translator Downstream Mutex Poisoned");
                        ProxyState::update_downstream_state(DownstreamType::TranslatorDownstream);
                        break;
                    }
                    first_sent = true;
                } else if is_a && last_notify.is_some() {
                    if let Err(e) = start_update(task_manager.clone(), downstream.clone()).await {
                        warn!("Translator impossible to start update task: {e}");
                        break;
                    };

                    while let Ok(sv1_mining_notify_msg) = rx_sv1_notify.recv().await {
                        if downstream
                            .safe_lock(|d| d.last_notify = Some(sv1_mining_notify_msg.clone()))
                            .is_err()
                        {
                            error!("Translator Downstream Mutex Poisoned");
                            ProxyState::update_downstream_state(
                                DownstreamType::TranslatorDownstream,
                            );
                            break;
                        }

                        let message: json_rpc::Message = sv1_mining_notify_msg.into();
                        Downstream::send_message_downstream(downstream.clone(), message).await;
                    }
                    break;
                } else {
                    // timeout connection if miner does not send the authorize message after sending a subscribe
                    if timeout_timer.elapsed().as_secs() > SUBSCRIBE_TIMEOUT_SECS {
                        warn!(
                            "Downstream: miner.subscribe/miner.authorize TIMEOUT for {} {}",
                            &host, connection_id
                        );
                        break;
                    }
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
            // TODO here we want to be sure that on drop this is called
            let _ = Downstream::remove_downstream_hashrate_from_channel(&downstream);
            warn!(
                "Downstream: Shutting down sv1 downstream job notifier for {}",
                &host
            );
            // Remove the notify task from TaskManager on disconnect.
            let _ = task_manager.safe_lock(|tm| {
                tm.remove_notify(connection_id);
            });
        })
    };
    TaskManager::add_notify(task_manager, connection_id, handle.into())
        .await
        .map_err(|_| Error::TranslatorTaskManagerFailed)
}

async fn start_update(
    task_manager: Arc<Mutex<TaskManager>>,
    downstream: Arc<Mutex<Downstream>>,
) -> Result<(), Error<'static>> {
    let handle = task::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
            let ln = match downstream.safe_lock(|d| d.last_notify.clone()) {
                Ok(ln) => ln,
                Err(e) => {
                    error!("{e}");
                    return;
                }
            };
            assert!(ln.is_some());
            // if hashrate has changed, update difficulty management, and send new
            // mining.set_difficulty
            if let Err(e) = Downstream::try_update_difficulty_settings(&downstream, ln).await {
                error!("{e}");
                return;
            };
        }
    });
    TaskManager::add_update(task_manager, handle.into())
        .await
        .map_err(|_| Error::TranslatorTaskManagerFailed)
}
