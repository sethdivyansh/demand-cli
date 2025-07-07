use super::{utils::get_cpu_and_memory_usage, AppState};
use crate::{db::handlers::JobDeclarationHandler, proxy_state::ProxyState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Serialize;

pub struct Api {}

impl Api {
    // Retrieves connected donwnstreams stats
    pub async fn get_downstream_stats(State(state): State<AppState>) -> impl IntoResponse {
        match state.stats_sender.collect_stats().await {
            Ok(stats) => (StatusCode::OK, Json(APIResponse::success(Some(stats)))),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(APIResponse::error(Some(format!(
                    "Failed to collect stats: {}",
                    e
                )))),
            ),
        }
    }

    // Retrieves system stats (CPU and memory usage)
    pub async fn system_stats() -> impl IntoResponse {
        let (cpu, memory) = get_cpu_and_memory_usage().await;
        let cpu_usgae = format!("{:.3}", cpu);
        let data = serde_json::json!({"cpu_usage_%": cpu_usgae, "memory_usage_bytes": memory});
        Json(APIResponse::success(Some(data)))
    }

    // Returns aggregate stats of all downstream devices
    pub async fn get_aggregate_stats(State(state): State<AppState>) -> impl IntoResponse {
        let stats = match state.stats_sender.collect_stats().await {
            Ok(stats) => stats,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(APIResponse::error(Some(format!(
                        "Failed to collect stats: {}",
                        e
                    )))),
                );
            }
        };
        let mut total_connected_device = 0;
        let mut total_accepted_shares = 0;
        let mut total_rejected_shares = 0;
        let mut total_hashrate = 0.0;
        let mut total_diff = 0.0;
        for (_, downstream) in stats {
            total_connected_device += 1;
            total_accepted_shares += downstream.accepted_shares;
            total_rejected_shares += downstream.rejected_shares;
            total_hashrate += downstream.hashrate as f64;
            total_diff += downstream.current_difficulty as f64
        }
        let result = AggregateStates {
            total_connected_device,
            aggregate_hashrate: total_hashrate,
            aggregate_accepted_shares: total_accepted_shares,
            aggregate_rejected_shares: total_rejected_shares,
            aggregate_diff: total_diff,
        };
        (StatusCode::OK, Json(APIResponse::success(Some(result))))
    }

    // Retrieves the current pool information
    pub async fn get_pool_info(State(state): State<AppState>) -> impl IntoResponse {
        let current_pool_address = state.router.current_pool;
        let latency = *state.router.latency_rx.borrow();

        match (current_pool_address, latency) {
            (Some(address), Some(latency)) => {
                let response_data = serde_json::json!({
                    "address": address.to_string(),
                    "latency": latency.as_millis().to_string()
                });
                (
                    StatusCode::OK,
                    Json(APIResponse::success(Some(response_data))),
                )
            }
            (_, _) => (
                StatusCode::NOT_FOUND,
                Json(APIResponse::error(Some(
                    "Pool information unavailable".to_string(),
                ))),
            ),
        }
    }

    // Returns the status of the Proxy
    pub async fn health_check() -> impl IntoResponse {
        match ProxyState::is_proxy_down() {
            (false, None) => (
                StatusCode::OK,
                Json(APIResponse::success(Some("Proxy OK".to_string()))),
            ),
            (true, Some(states)) => (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(APIResponse::error(Some(states))),
            ),
            _ => (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(APIResponse::error(Some("Unknown proxy state".to_string()))),
            ),
        }
    }

    // API endpoint: Get job declaration history with pagination
    pub async fn get_job_history(
        State(state): State<AppState>,
        Query(params): Query<std::collections::HashMap<String, String>>,
    ) -> impl IntoResponse {
        let db = match &state.db {
            Some(db) => db,
            None => {
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(APIResponse::error(Some(
                        "Database not available".to_string(),
                    ))),
                );
            }
        };

        let page = params
            .get("page")
            .and_then(|p| p.parse::<i64>().ok())
            .unwrap_or(1);
        let per_page = params
            .get("per_page")
            .and_then(|p| p.parse::<i64>().ok())
            .unwrap_or(10);

        let handler = JobDeclarationHandler::new(db.clone());

        match handler.get_job_history(page, per_page).await {
            Ok(response) => (StatusCode::OK, Json(APIResponse::success(Some(response)))),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(APIResponse::error(Some(format!(
                    "Failed to get job history: {}",
                    e
                )))),
            ),
        }
    }

    // API endpoint: Get txids for a specific template
    pub async fn get_job_txids(
        State(state): State<AppState>,
        Path(template_id): Path<i64>,
    ) -> impl IntoResponse {
        let db = match &state.db {
            Some(db) => db,
            None => {
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(APIResponse::error(Some(
                        "Database not available".to_string(),
                    ))),
                );
            }
        };

        let handler = JobDeclarationHandler::new(db.clone());

        match handler.get_job_txids(template_id).await {
            Ok(response) => (StatusCode::OK, Json(APIResponse::success(Some(response)))),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(APIResponse::error(Some(format!(
                    "Failed to get job txids: {}",
                    e
                )))),
            ),
        }
    }
}

#[derive(Serialize)]
struct AggregateStates {
    total_connected_device: u32,
    aggregate_hashrate: f64, // f64 is used here to avoid overflow
    aggregate_accepted_shares: u64,
    aggregate_rejected_shares: u64,
    aggregate_diff: f64,
}

#[derive(Debug, Serialize)]
pub struct APIResponse<T> {
    success: bool,
    message: Option<String>,
    data: Option<T>,
}

impl<T: Serialize> APIResponse<T> {
    pub fn success(data: Option<T>) -> Self {
        APIResponse {
            success: true,
            message: None,
            data,
        }
    }

    pub fn error(message: Option<String>) -> Self {
        APIResponse {
            success: false,
            message,
            data: None,
        }
    }
}
