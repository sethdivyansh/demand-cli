use tracing::{error, info};

use crate::PROXY_STATE;

/// Main enum representing the overall state of the proxy
#[derive(Debug, Clone, PartialEq)]
pub enum ProxyStateEnum {
    Up, // Everything is ok
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
    Down(DownstreamType), // A specific downstream is down
}

/// Represents the state of the Upstream
#[derive(Debug, Clone, PartialEq)]
pub enum UpstreamState {
    Up,
    Down(UpstreamType), // A specific upstream is down
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
    pub proxy_state: ProxyStateEnum,
}

impl ProxyState {
    /// Creates a new ProxyState with all states set to "Up"
    pub fn new() -> Self {
        let mut state = Self {
            pool: PoolState::Up,
            tp: TpState::Up,
            jd: JdState::Up,
            share_accounter: ShareAccounterState::Up,
            translator: TranslatorState::Up,
            inconsistency: None,
            downstream: DownstreamState::Up,
            upstream: UpstreamState::Up,
            proxy_state: ProxyStateEnum::Up,
        };
        state.update_proxy_state(); // Ensure proxy_state is consistent
        state
    }

    /// Updates the global proxy state based on the individual sub states.
    fn update_proxy_state(&mut self) {
        // Update proxy state based on individual substates
        self.proxy_state = if self.pool == PoolState::Down {
            ProxyStateEnum::Pool(self.pool)
        } else if self.tp == TpState::Down {
            ProxyStateEnum::Tp(self.tp)
        } else if let Some(code) = self.inconsistency {
            ProxyStateEnum::InternalInconsistency(code)
        } else if matches!(self.downstream, DownstreamState::Down(_)) {
            ProxyStateEnum::Downstream(self.downstream.clone())
        } else if matches!(self.upstream, UpstreamState::Down(_)) {
            ProxyStateEnum::Upstream(self.upstream.clone())
        } else if self.translator == TranslatorState::Down {
            ProxyStateEnum::Translator(self.translator)
        } else if self.jd == JdState::Down {
            ProxyStateEnum::Jd(JdState::Down)
        } else if self.share_accounter == ShareAccounterState::Down {
            ProxyStateEnum::ShareAccounter(ShareAccounterState::Down)
        } else {
            // If all states are Up, the proxy state is Up
            ProxyStateEnum::Up
        };
    }

    ///  Function to update pool state
    pub fn update_pool_state(pool_state: PoolState) {
        info!("Updating PoolState state to {:?}", pool_state);
        if PROXY_STATE
            .safe_lock(|state| {
                state.pool = pool_state;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update TP state
    pub fn update_tp_state(tp_state: TpState) {
        info!("Updating TpState state to {:?}", tp_state);
        if PROXY_STATE
            .safe_lock(|state| {
                state.tp = tp_state;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update Jd state
    pub fn update_jd_state(jd_state: JdState) {
        info!("Updating JdState state to {:?}", jd_state);
        if PROXY_STATE
            .safe_lock(|state| {
                state.jd = jd_state;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update Translator state
    pub fn update_translator_state(translator_state: TranslatorState) {
        info!("Updating Translator state to {:?}", translator_state);
        if PROXY_STATE
            .safe_lock(|state| {
                state.translator = translator_state;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update ShareAccounter state
    pub fn update_share_accounter_state(share_accounter_state: ShareAccounterState) {
        info!(
            "Updating ShareAccounterState state to {:?}",
            share_accounter_state
        );
        if PROXY_STATE
            .safe_lock(|state| {
                state.share_accounter = share_accounter_state;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update inconsistency
    pub fn update_inconsistency(code: Option<u32>) {
        info!("Updating Internal Inconsistency state to {:?}", code);
        if PROXY_STATE
            .safe_lock(|state| {
                state.inconsistency = code;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update a downstream state
    pub fn update_downstream_state(downstream_state: DownstreamState) {
        info!("Updating Downstream state to {:?}", downstream_state);
        if PROXY_STATE
            .safe_lock(|state| {
                state.downstream = downstream_state;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update a downstream state
    pub fn update_upstream_state(upstream_state: UpstreamState) {
        info!("Updating Upstream state to {:?}", upstream_state);
        if PROXY_STATE
            .safe_lock(|state| {
                state.upstream = upstream_state;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to update a the global state to Up
    pub fn update_proxy_state_up() {
        if PROXY_STATE
            .safe_lock(|state| {
                state.pool = PoolState::Up;
                state.jd = JdState::Up;
                state.translator = TranslatorState::Up;
                state.tp = TpState::Up;
                state.share_accounter = ShareAccounterState::Up;
                state.upstream = UpstreamState::Up;
                state.downstream = DownstreamState::Up;
                state.inconsistency = None;
                state.proxy_state = ProxyStateEnum::Up;
                state.update_proxy_state();
            })
            .is_err()
        {
            error!("Global Proxy Mutex Corrupted");
        }
    }

    /// Function to check if any state is down and identifies which one
    pub fn is_proxy_down(&self) -> (bool, Option<String>) {
        if self.pool == PoolState::Down {
            (true, Some("Pool".to_string()))
        } else if self.tp == TpState::Down {
            (true, Some("TP".to_string()))
        } else if self.translator == TranslatorState::Down {
            (true, Some("Translator".to_string()))
        } else if self.jd == JdState::Down {
            (true, Some("JD".to_string()))
        } else if let DownstreamState::Down(down) = &self.downstream {
            (true, Some(format!("{down:?}")))
        } else if let UpstreamState::Down(up) = &self.upstream {
            (true, Some(format!(" {up:?}")))
        } else {
            (false, None)
        }
    }
}
