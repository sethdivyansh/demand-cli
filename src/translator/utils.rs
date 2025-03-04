use std::{collections::VecDeque, sync::Arc};

use crate::{proxy_state::ProxyState, translator::error::Error};
use lazy_static::lazy_static;
use roles_logic_sv2::utils::Mutex;
use tracing::error;
lazy_static! {
    pub static ref SHARE_TIMESTAMPS: Arc<Mutex<VecDeque<tokio::time::Instant>>> =
        Arc::new(Mutex::new(VecDeque::with_capacity(70)));
    pub static ref IS_RATE_LIMITED: Mutex<bool> = Mutex::new(false);
}

/// Checks if a share can be sent upstream based on a rate limit of 70 shares per minute.
/// Returns `true` if the share can be sent, `false` if the limit is exceeded.
pub async fn check_share_rate_limit() {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));
    loop {
        interval.tick().await;
        let now = tokio::time::Instant::now();
        let count = SHARE_TIMESTAMPS
            .safe_lock(|timestamps| {
                while let Some(&front) = timestamps.front() {
                    if now.duration_since(front).as_secs() >= 60 {
                        timestamps.pop_front();
                    } else {
                        break;
                    }
                }
                timestamps.len()
            })
            .unwrap_or_else(|e| {
                error!("Failed to lock SHARE_TIMESTAMPS: {:?}", e);
                ProxyState::update_inconsistency(Some(1)); // restart proxy
                0
            });

        IS_RATE_LIMITED
            .safe_lock(|adjusting_diff| {
                *adjusting_diff = count >= 70;
            })
            .unwrap_or_else(|e| {
                error!("Failed to lock IS_RATE_LIMITED: {:?}", e);
                ProxyState::update_inconsistency(Some(1)); // restart proxy
            });
    }
}

/// Checks if a share can be sent by checking if rate is limited
pub fn allow_submit_share() -> crate::translator::error::ProxyResult<'static, bool> {
    // Check if rate-limited
    let is_rate_limited = IS_RATE_LIMITED.safe_lock(|t| *t).map_err(|e| {
        error!("Failed to lock IS_RATE_LIMITED: {:?}", e);
        Error::TranslatorDiffConfigMutexPoisoned
    })?;

    if is_rate_limited {
        return Ok(false); // Rate limit exceeded, don’t send
    }

    // Not rate-limited, record the timestamp
    SHARE_TIMESTAMPS
        .safe_lock(|timestamps| {
            timestamps.push_back(tokio::time::Instant::now());
        })
        .map_err(|e| {
            error!("Failed to lock SHARE_TIMESTAMPS: {:?}", e);
            Error::TranslatorDiffConfigMutexPoisoned
        })?;

    Ok(true) // Share can be sent
}

// /// currently the pool only supports 16 bytes exactly for its channels
// /// to use but that may change
// pub fn proxy_extranonce1_len(
//     channel_extranonce2_size: usize,
//     downstream_extranonce2_len: usize,
// ) -> usize {
//     // full_extranonce_len - pool_extranonce1_len - miner_extranonce2 = tproxy_extranonce1_len
//     channel_extranonce2_size - downstream_extranonce2_len
// }
