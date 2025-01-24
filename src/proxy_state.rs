use std::sync::Arc;

use roles_logic_sv2::utils::Mutex;
use tracing::{error, info};

static mut PROXY_STATE: Option<Arc<Mutex<ProxyState>>> = None;

/// Main enum representing the overall state of the proxy
#[derive(Debug, Clone, PartialEq)]
pub enum ProxyStates {
    Pool(PoolState),
    Tp(TpState),
    Jd(JdState),
    ShareAccounter(ShareAccounterState),
    InternalInconsistency(u32),
    Downstream(DownstreamState),
    Upstream(UpstreamState),
    Translator(TranslatorState),
}

/// Represents the state of the pool
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PoolState {
    Up,
    Down,
}

/// Represents the state of the Tp
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TpState {
    Up,
    Down,
}

/// Represents the state of the Translator
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TranslatorState {
    Up,
    Down,
}

/// Represents the state of the JD
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum JdState {
    Up,
    Down,
}

/// Represents the state of the Share Accounter
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ShareAccounterState {
    Up,
    Down,
}

/// Represents the state of the Downstream
#[derive(Debug, Clone, PartialEq)]
pub enum DownstreamState {
    Up,
    Down(Vec<DownstreamType>), // A specific downstream is down
}

/// Represents the state of the Upstream
#[derive(Debug, Clone, PartialEq)]
pub enum UpstreamState {
    Up,
    Down(Vec<UpstreamType>), // A specific upstream is down
}

/// Represents different downstreams
#[derive(Debug, Clone, PartialEq)]
pub enum DownstreamType {
    JdClientMiningDownstream,
    TranslatorDownstream,
}

/// Represents different upstreams
#[derive(Debug, Clone, PartialEq)]
pub enum UpstreamType {
    JDCMiningUpstream,
    TranslatorUpstream,
}

/// Represents global proxy state
#[derive(Debug)]
pub struct ProxyState {
    pub pool: PoolState,
    pub tp: TpState,
    pub jd: JdState,
    pub share_accounter: ShareAccounterState,
    pub translator: TranslatorState,
    pub inconsistency: Option<u32>,
    pub downstream: DownstreamState,
    pub upstream: UpstreamState,
}

impl ProxyState {
    pub fn init() {
        unsafe {
            PROXY_STATE = Some(Arc::new(Mutex::new(ProxyState::new())));
        }
    }

    async fn get_inner() -> Arc<Mutex<ProxyState>> {
        loop {
            unsafe {
                if let Some(ps) = PROXY_STATE.as_ref() {
                    return ps.clone();
                } else {
                    error!("Global Proxy is None reinitializing...");
                    PROXY_STATE = Some(Arc::new(Mutex::new(ProxyState::new_down())));
                };
                tokio::task::yield_now().await;
            }
        }
    }
    fn get_inner_sync() -> Arc<Mutex<ProxyState>> {
        loop {
            unsafe {
                if let Some(ps) = PROXY_STATE.as_ref() {
                    return ps.clone();
                } else {
                    error!("Global Proxy is None reinitializing...");
                    PROXY_STATE = Some(Arc::new(Mutex::new(ProxyState::new_down())));
                };
                std::thread::yield_now();
            }
        }
    }
    fn reinitialize() {
        unsafe {
            PROXY_STATE = Some(Arc::new(Mutex::new(ProxyState::new_down())));
        }
    }

    pub fn new() -> Self {
        Self {
            pool: PoolState::Up,
            tp: TpState::Up,
            jd: JdState::Up,
            share_accounter: ShareAccounterState::Up,
            translator: TranslatorState::Up,
            inconsistency: None,
            downstream: DownstreamState::Up,
            upstream: UpstreamState::Up,
        }
    }
    pub fn new_down() -> Self {
        Self {
            pool: PoolState::Down,
            tp: TpState::Down,
            jd: JdState::Down,
            share_accounter: ShareAccounterState::Down,
            translator: TranslatorState::Down,
            inconsistency: None,
            downstream: DownstreamState::Down(vec![]),
            upstream: UpstreamState::Down(vec![]),
        }
    }

    pub async fn update_pool_state(pool_state: PoolState) {
        info!("Updating PoolState state to {:?}", pool_state);
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.pool = pool_state;
                // // state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_tp_state(tp_state: TpState) {
        info!("Updating TpState state to {:?}", tp_state);
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.tp = tp_state;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }
    pub fn update_tp_state_sync(tp_state: TpState) {
        info!("Updating TpState state to {:?}", tp_state);
        if Self::get_inner_sync()
            .safe_lock(|state| {
                state.tp = tp_state;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_jd_state(jd_state: JdState) {
        info!("Updating JdState state to {:?}", jd_state);
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.jd = jd_state;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }
    pub fn update_jd_state_sync(jd_state: JdState) {
        info!("Updating JdState state to {:?}", jd_state);
        if Self::get_inner_sync()
            .safe_lock(|state| {
                state.jd = jd_state;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_translator_state(translator_state: TranslatorState) {
        info!("Updating Translator state to {:?}", translator_state);
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.translator = translator_state;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_share_accounter_state(share_accounter_state: ShareAccounterState) {
        info!(
            "Updating ShareAccounterState state to {:?}",
            share_accounter_state
        );
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.share_accounter = share_accounter_state;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_inconsistency(code: Option<u32>) {
        info!("Updating Internal Inconsistency state to {:?}", code);
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.inconsistency = code;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_downstream_state(downstream_type: DownstreamType) {
        info!("Updating Downstream state to {:?}", downstream_type);
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.downstream = DownstreamState::Down(vec![downstream_type]);
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }
    pub fn update_downstream_state_sync(downstream_type: DownstreamType) {
        info!("Updating Downstream state to {:?}", downstream_type);
        if Self::get_inner_sync()
            .safe_lock(|state| {
                state.downstream = DownstreamState::Down(vec![downstream_type]);
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_upstream_state(upstream_type: UpstreamType) {
        info!("Updating Upstream state to {:?}", upstream_type);
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.upstream = UpstreamState::Down(vec![upstream_type]);
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn update_proxy_state_up() {
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                state.pool = PoolState::Up;
                state.jd = JdState::Up;
                state.translator = TranslatorState::Up;
                state.tp = TpState::Up;
                state.share_accounter = ShareAccounterState::Up;
                state.upstream = UpstreamState::Up;
                state.downstream = DownstreamState::Up;
                state.inconsistency = None;
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
        }
    }

    pub async fn is_proxy_down() -> (bool, Option<String>) {
        let errors = Self::get_errors().await;
        if errors.is_ok() && errors.as_ref().unwrap().is_empty() {
            (false, None)
        } else {
            let error_descriptions: Vec<String> =
                errors.iter().map(|e| format!("{:?}", e)).collect();
            (true, Some(error_descriptions.join(", ")))
        }
    }

    pub async fn get_errors() -> Result<Vec<ProxyStates>, ()> {
        let mut errors = Vec::new();
        if Self::get_inner()
            .await
            .safe_lock(|state| {
                if state.pool == PoolState::Down {
                    errors.push(ProxyStates::Pool(state.pool));
                }
                if state.tp == TpState::Down {
                    errors.push(ProxyStates::Tp(state.tp));
                }
                if state.jd == JdState::Down {
                    errors.push(ProxyStates::Jd(state.jd));
                }
                if state.share_accounter == ShareAccounterState::Down {
                    errors.push(ProxyStates::ShareAccounter(state.share_accounter));
                }
                if state.translator == TranslatorState::Down {
                    errors.push(ProxyStates::Translator(state.translator));
                }
                if let Some(inconsistency) = state.inconsistency {
                    errors.push(ProxyStates::InternalInconsistency(inconsistency));
                }
                if matches!(state.downstream, DownstreamState::Down(_)) {
                    errors.push(ProxyStates::Downstream(state.downstream.clone()));
                }
                if matches!(state.upstream, UpstreamState::Down(_)) {
                    errors.push(ProxyStates::Upstream(state.upstream.clone()));
                }
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
            Self::reinitialize();
            Err(())
        } else {
            Ok(errors)
        }
    }
}
