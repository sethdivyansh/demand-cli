// use async_recursion::async_recursion;
use jemallocator::Jemalloc;
use roles_logic_sv2::utils::Mutex;
use router::Router;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use crate::shared::utils::AbortOnDrop;
use key_utils::Secp256k1PublicKey;
use lazy_static::lazy_static;
use proxy_state::{PoolState, ProxyState, TpState, TranslatorState};
use std::{net::ToSocketAddrs, sync::Arc, time::Duration};
use tokio::sync::mpsc::channel;
use tracing::{error, info};

mod ingress;
pub mod jd_client;
mod minin_pool_connection;
mod proxy_state;
mod router;
mod share_accounter;
mod shared;
mod translator;

const TRANSLATOR_BUFFER_SIZE: usize = 32;
const MIN_EXTRANONCE_SIZE: u16 = 6;
const MIN_EXTRANONCE2_SIZE: u16 = 5;
const UPSTREAM_EXTRANONCE1_SIZE: usize = 15;
const EXPECTED_SV1_HASHPOWER: f32 = 100_000_000_000.0;
//const EXPECTED_SV1_HASHPOWER: f32 = 1_000_000.0;
const SHARE_PER_MIN: f32 = 10.0;
const CHANNEL_DIFF_UPDTATE_INTERVAL: u32 = 10;
const MIN_SV1_DOWSNTREAM_HASHRATE: f32 = 1_000_000_000_000.0;
//const MIN_SV1_DOWSNTREAM_HASHRATE: f32 = 1_000_000.0;
const MAX_LEN_DOWN_MSG: u32 = 10000;
const POOL_ADDRESS: &str = "mining.dmnd.work:2000";
//const POOL_ADDRESS: &str = "0.0.0.0:20000";
//const AUTH_PUB_KEY: &str = "9bQHWXsQ2J9TRFTaxRh3KjoxdyLRfWVEy25YHtKF8y8gotLoCZZ";
const AUTH_PUB_KEY: &str = "9auqWEzQDVyd2oe1JVGFLMLHZtCo2FFqZwtKA5gd9xbuEu7PH72";
//const TP_ADDRESS: &str = "127.0.0.1:8442";
const DEFAULT_LISTEN_ADDRESS: &str = "0.0.0.0:32767";

lazy_static! {
    static ref SV1_DOWN_LISTEN_ADDR: String =
        std::env::var("SV1_DOWN_LISTEN_ADDR").unwrap_or(DEFAULT_LISTEN_ADDRESS.to_string());
}
lazy_static! {
    static ref TP_ADDRESS: Mutex<Option<String>> = Mutex::new(std::env::var("TP_ADDRESS").ok());
}
lazy_static! {
    static ref PROXY_STATE: Arc<Mutex<ProxyState>> = Arc::new(Mutex::new(ProxyState::new()));
} // Added mutex so we can modify the value to None if tp is down

#[tokio::main]
async fn main() {
    //Disable noise_connection error (for now) because:
    // 1. It produce logs that are not very user friendly and also bloth the logs
    // 2. The errors resulting from noise_connection are handled. E.g if unrecoverable error from noise connection occurs during Pool connection: We either retry connecting immediatley or we update Proxy state to Pool Down
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::new(
            "info,demand_sv2_connection::noise_connection_tokio=off",
        ))
        .init();
    std::env::var("TOKEN").expect("Missing TOKEN environment variable");
    let auth_pub_k: Secp256k1PublicKey = crate::AUTH_PUB_KEY.parse().expect("Invalid public key");
    let address = POOL_ADDRESS
        .to_socket_addrs()
        .expect("Invalid pool address")
        .next()
        .expect("Invalid pool address");

    // We will add upstream addresses here
    let pool_addresses = vec![address];

    let mut router = router::Router::new(pool_addresses, auth_pub_k, None, None);
    let epsilon = Duration::from_millis(10);
    let best_upstream = router.select_pool_connect().await;
    initialize_proxy(&mut router, best_upstream, epsilon).await;
    info!("exiting");
    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
}

// #[async_recursion]
async fn initialize_proxy(
    router: &mut Router,
    mut pool_addr: Option<std::net::SocketAddr>,
    epsilon: Duration,
) {
    loop {
        // Initial setup for the proxy
        let (send_to_pool, recv_from_pool, pool_connection_abortable) =
            match router.connect_pool(pool_addr).await {
                Ok(connection) => connection,
                Err(_) => {
                    error!("No upstream available. Retrying...");
                    let mut secs = 10;
                    while secs > 0 {
                        tracing::warn!("Retrying in {} seconds...", secs);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                        secs -= 1;
                    }
                    continue; // Restart loop, esentially restarting proxy
                }
            };

        let (downs_sv1_tx, downs_sv1_rx) = channel(10);
        let sv1_ingress_abortable = ingress::sv1_ingress::start_listen_for_downstream(downs_sv1_tx);

        let (translator_up_tx, mut translator_up_rx) = channel(10);
        let translator_abortable = match translator::start(downs_sv1_rx, translator_up_tx).await {
            Ok(abortable) => abortable,
            Err(e) => {
                error!("Impossible to initialize translathor: {e}");
                // Impossible to start the proxy so we restart proxy
                ProxyState::update_translator_state(TranslatorState::Down);
                return;
            }
        };

        let (from_jdc_to_share_accounter_send, from_jdc_to_share_accounter_recv) = channel(10);
        let (from_share_accounter_to_jdc_send, from_share_accounter_to_jdc_recv) = channel(10);
        let (jdc_to_translator_sender, jdc_from_translator_receiver, _) = translator_up_rx
            .recv()
            .await
            .expect("Translator failed before initialization");

        let jdc_abortable: Option<AbortOnDrop>;
        let share_accounter_abortable;
        let tp = match TP_ADDRESS.safe_lock(|tp| tp.clone()) {
            Ok(tp) => tp,
            Err(e) => {
                error!("TP_ADDRESS Mutex Corrupted: {e}");
                return;
            }
        };

        if let Some(_tp_addr) = tp {
            jdc_abortable = jd_client::start(
                jdc_from_translator_receiver,
                jdc_to_translator_sender,
                from_share_accounter_to_jdc_recv,
                from_jdc_to_share_accounter_send,
            )
            .await;
            if jdc_abortable.is_none() {
                ProxyState::update_tp_state(TpState::Down);
            };
            share_accounter_abortable = match share_accounter::start(
                from_jdc_to_share_accounter_recv,
                from_share_accounter_to_jdc_send,
                recv_from_pool,
                send_to_pool,
            )
            .await
            {
                Ok(abortable) => abortable,
                Err(_) => {
                    error!("Failed to start share_accounter");
                    return;
                }
            }
        } else {
            jdc_abortable = None;

            share_accounter_abortable = match share_accounter::start(
                jdc_from_translator_receiver,
                jdc_to_translator_sender,
                recv_from_pool,
                send_to_pool,
            )
            .await
            {
                Ok(abortable) => abortable,
                Err(_) => {
                    error!("Failed to start share_accounter");
                    return;
                }
            };
        };

        // Collecting all abort handles
        let mut abort_handles = vec![
            (pool_connection_abortable, "pool_connection".to_string()),
            (sv1_ingress_abortable, "sv1_ingress".to_string()),
            (translator_abortable, "translator".to_string()),
            (share_accounter_abortable, "share_accounter".to_string()),
        ];
        if let Some(jdc_handle) = jdc_abortable {
            abort_handles.push((jdc_handle, "jdc".to_string()));
        }

        match monitor(router, abort_handles, epsilon).await {
            Ok(Reconnect::NewUpstream(new_pool_addr)) => {
                ProxyState::update_proxy_state_up(); // Update global proxy state to Up before reinitializing

                // Instead of recursive calls here, we can achieve the same outcome by updating `pool_addr` and continue for the next reinitailization. This avoids stack growth, and improves memory efficiency and performance.
                pool_addr = Some(new_pool_addr);
                continue;
            }
            Ok(Reconnect::NoUpstream) => {
                ProxyState::update_proxy_state_up(); // Update global proxy state to Up before reinitializing
                pool_addr = None;
                continue;
            }
            Err(_) => {
                info!("An error occurred. Exiting...");
                return;
            }
        };
    }
}

async fn monitor(
    router: &mut Router,
    abort_handles: Vec<(AbortOnDrop, std::string::String)>,
    epsilon: Duration,
) -> Result<Reconnect, ()> {
    //let mut interval = tokio::time::interval(time::Duration::from_secs(10));
    loop {
        if let Some(new_upstream) = router.monitor_upstream(epsilon).await {
            info!("Faster upstream detected. Reinitializing proxy...");
            drop(abort_handles);
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await; // Needs a little to time to drop
            return Ok(Reconnect::NewUpstream(new_upstream));
        }

        // Monitor finished tasks
        if let Some((_handle, name)) = abort_handles
            .iter()
            .find(|(handle, _name)| handle.is_finished())
        {
            error!("Task {:?} finished, Closing connection", name);
            for (handle, _name) in abort_handles {
                drop(handle);
            }

            // Check if the proxy state is down, and if so, reinitialize the proxy.
            let is_proxy_down_result = PROXY_STATE.safe_lock(|proxy| proxy.is_proxy_down());

            match is_proxy_down_result {
                Ok(is_proxy_down) => {
                    if is_proxy_down.0 {
                        error!(
                            "{:?} is DOWN. Reinitializing proxy...",
                            is_proxy_down.1.unwrap_or("Proxy".to_string())
                        );
                        return Ok(Reconnect::NoUpstream);
                    } else {
                        return Err(()); // Proxy is up
                    }
                }
                Err(e) => {
                    error!("Global Proxy Mutex Corrupted: {e}");
                    return Err(());
                }
            }
        }

        // Check if the proxy state is down, and if so, reinitialize the proxy.
        let is_proxy_down_result = PROXY_STATE.safe_lock(|proxy| proxy.is_proxy_down());

        match is_proxy_down_result {
            Ok(is_proxy_down) => {
                if is_proxy_down.0 {
                    error!(
                        "Status: {:?}. Reinitializing proxy...",
                        is_proxy_down.1.unwrap_or_else(|| "Proxy".to_string())
                    );
                    drop(abort_handles); // Drop all abort handles
                    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await; // Needs a little time to drop
                    return Ok(Reconnect::NoUpstream);
                }
            }
            Err(e) => {
                error!("Global Proxy Mutex Corrupted: {e}");
                return Err(());
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
    }
}

pub enum Reconnect {
    NewUpstream(std::net::SocketAddr), // Reconnecting with a new upstream
    NoUpstream,                        // Reconnecting without upstream
}
