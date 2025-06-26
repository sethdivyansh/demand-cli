use clap::Parser;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::{
    net::{SocketAddr, ToSocketAddrs},
    path::PathBuf,
};
use tracing::{debug, error, info, warn};

use crate::{HashUnit, DEFAULT_SV1_HASHPOWER};
lazy_static! {
    pub static ref CONFIG: Configuration = Configuration::load_config();
}
#[derive(Parser)]
struct Args {
    #[clap(long)]
    test: bool,
    #[clap(long = "d", short = 'd', value_parser = parse_hashrate)]
    downstream_hashrate: Option<f32>,
    #[clap(long = "loglevel", short = 'l')]
    loglevel: Option<String>,
    #[clap(long = "nc", short = 'n')]
    noise_connection_log: Option<String>,
    #[clap(long = "sv1_loglevel")]
    sv1_loglevel: bool,
    #[clap(long = "delay")]
    delay: Option<u64>,
    #[clap(long = "interval", short = 'i')]
    adjustment_interval: Option<u64>,
    #[clap(long = "pool", short = 'p', value_delimiter = ',')]
    pool_addresses: Option<Vec<String>>,
    #[clap(long = "test-pool", value_delimiter = ',')]
    test_pool_addresses: Option<Vec<String>>,
    #[clap(long)]
    token: Option<String>,
    #[clap(long)]
    tp_address: Option<String>,
    #[clap(long)]
    listening_addr: Option<String>,
    #[clap(long = "config", short = 'c')]
    config_file: Option<PathBuf>,
    #[clap(long = "api-server-port", short = 's')]
    api_server_port: Option<String>,
    #[clap(long, short = 'm')]
    monitor: bool,
    #[clap(long, short = 'u')]
    auto_update: bool,
    #[clap(long = "custom-job-timeout")]
    custom_job_timeout: Option<u64>,
}

#[derive(Serialize, Deserialize)]
struct ConfigFile {
    token: Option<String>,
    tp_address: Option<String>,
    pool_addresses: Option<Vec<String>>,
    test_pool_addresses: Option<Vec<String>>,
    interval: Option<u64>,
    delay: Option<u64>,
    downstream_hashrate: Option<String>,
    loglevel: Option<String>,
    nc_loglevel: Option<String>,
    sv1_log: Option<bool>,
    test: Option<bool>,
    listening_addr: Option<String>,
    api_server_port: Option<String>,
    monitor: Option<bool>,
    auto_update: Option<bool>,
    custom_job_timeout: Option<u64>,
}

pub struct Configuration {
    token: Option<String>,
    tp_address: Option<String>,
    pool_addresses: Option<Vec<SocketAddr>>,
    test_pool_addresses: Option<Vec<SocketAddr>>,
    interval: u64,
    delay: u64,
    downstream_hashrate: f32,
    loglevel: String,
    nc_loglevel: String,
    sv1_log: bool,
    test: bool,
    listening_addr: Option<String>,
    api_server_port: String,
    monitor: bool,
    auto_update: bool,
    custom_job_timeout: u64,
}
impl Configuration {
    pub fn token() -> Option<String> {
        CONFIG.token.clone()
    }

    pub fn tp_address() -> Option<String> {
        CONFIG.tp_address.clone()
    }

    pub fn pool_address() -> Option<Vec<SocketAddr>> {
        if CONFIG.test {
            CONFIG.test_pool_addresses.clone() // Return test pool addresses in test mode
        } else {
            CONFIG.pool_addresses.clone()
        }
    }

    pub fn adjustment_interval() -> u64 {
        CONFIG.interval
    }

    pub fn delay() -> u64 {
        CONFIG.delay
    }

    pub fn downstream_hashrate() -> f32 {
        CONFIG.downstream_hashrate
    }

    pub fn downstream_listening_addr() -> Option<String> {
        CONFIG.listening_addr.clone()
    }

    pub fn api_server_port() -> String {
        CONFIG.api_server_port.clone()
    }

    pub fn loglevel() -> &'static str {
        match CONFIG.loglevel.to_lowercase().as_str() {
            "trace" | "debug" | "info" | "warn" | "error" | "off" => &CONFIG.loglevel,
            _ => {
                eprintln!(
                    "Invalid log level '{}'. Defaulting to 'info'.",
                    CONFIG.loglevel
                );
                "info"
            }
        }
    }

    pub fn nc_loglevel() -> &'static str {
        match CONFIG.nc_loglevel.as_str() {
            "trace" | "debug" | "info" | "warn" | "error" | "off" => &CONFIG.nc_loglevel,
            _ => {
                eprintln!(
                    "Invalid log level for noise_connection '{}' Defaulting to 'off'.",
                    &CONFIG.nc_loglevel
                );
                "off"
            }
        }
    }
    pub fn sv1_ingress_log() -> bool {
        CONFIG.sv1_log
    }

    pub fn test() -> bool {
        CONFIG.test
    }

    pub fn monitor() -> bool {
        CONFIG.monitor
    }

    pub fn auto_update() -> bool {
        CONFIG.auto_update
    }

    pub fn custom_job_timeout() -> u64 {
        CONFIG.custom_job_timeout
    }

    // Loads config from CLI, file, or env vars with precedence: CLI > file > env.
    fn load_config() -> Self {
        let args = Args::parse();
        let config_path: PathBuf = args.config_file.unwrap_or("config.toml".into());
        let config: ConfigFile = std::fs::read_to_string(&config_path)
            .ok()
            .and_then(|content| toml::from_str(&content).ok())
            .unwrap_or(ConfigFile {
                token: None,
                tp_address: None,
                pool_addresses: None,
                test_pool_addresses: None,
                interval: None,
                delay: None,
                downstream_hashrate: None,
                loglevel: None,
                nc_loglevel: None,
                sv1_log: None,
                test: None,
                listening_addr: None,
                api_server_port: None,
                monitor: None,
                auto_update: None,
                custom_job_timeout: None,
            });

        let token = args
            .token
            .or(config.token)
            .or_else(|| std::env::var("TOKEN").ok());
        debug!("User Token: {:?}", token);

        let tp_address = args
            .tp_address
            .or(config.tp_address)
            .or_else(|| std::env::var("TP_ADDRESS").ok());

        let pool_addresses: Option<Vec<SocketAddr>> = args
            .pool_addresses
            .map(|addresses| {
                addresses
                    .into_iter()
                    .map(parse_address)
                    .collect::<Vec<SocketAddr>>()
            })
            .or_else(|| {
                config.pool_addresses.map(|addresses| {
                    addresses
                        .into_iter()
                        .map(parse_address)
                        .collect::<Vec<SocketAddr>>()
                })
            })
            .or_else(|| {
                std::env::var("POOL_ADDRESSES").ok().map(|s| {
                    s.split(',')
                        .map(|s| parse_address(s.trim().to_string()))
                        .collect::<Vec<SocketAddr>>()
                })
            });

        let test_pool_addresses: Option<Vec<SocketAddr>> = args
            .test_pool_addresses
            .map(|addresses| {
                addresses
                    .into_iter()
                    .map(parse_address)
                    .collect::<Vec<SocketAddr>>()
            })
            .or_else(|| {
                config.test_pool_addresses.map(|addresses| {
                    addresses
                        .into_iter()
                        .map(parse_address)
                        .collect::<Vec<SocketAddr>>()
                })
            })
            .or_else(|| {
                std::env::var("TEST_POOL_ADDRESSES").ok().map(|s| {
                    s.split(',')
                        .map(|s| parse_address(s.trim().to_string()))
                        .collect::<Vec<SocketAddr>>()
                })
            });

        let interval = args
            .adjustment_interval
            .or(config.interval)
            .or_else(|| std::env::var("INTERVAL").ok().and_then(|s| s.parse().ok()))
            .unwrap_or(120_000);

        let delay = args
            .delay
            .or(config.delay)
            .or_else(|| std::env::var("DELAY").ok().and_then(|s| s.parse().ok()))
            .unwrap_or(0);

        let expected_hashrate = args
            .downstream_hashrate
            .or_else(|| {
                config
                    .downstream_hashrate
                    .as_deref()
                    .and_then(|d| parse_hashrate(d).ok())
            })
            .or_else(|| {
                std::env::var("DOWNSTREAM_HASHRATE")
                    .ok()
                    .and_then(|s| s.parse().ok())
            });
        let downstream_hashrate;
        if let Some(hashpower) = expected_hashrate {
            downstream_hashrate = hashpower;
            info!(
                "Using downstream hashrate: {}h/s",
                HashUnit::format_value(hashpower)
            );
        } else {
            downstream_hashrate = DEFAULT_SV1_HASHPOWER;
            warn!(
                "No downstream hashrate provided, using default value: {}h/s",
                HashUnit::format_value(DEFAULT_SV1_HASHPOWER)
            );
        }

        let listening_addr = args.listening_addr.or(config.listening_addr).or_else(|| {
            std::env::var("DOWNSTREAM_HASHRATE")
                .ok()
                .and_then(|s| s.parse().ok())
        });
        let api_server_port = args
            .api_server_port
            .or(config.api_server_port)
            .or_else(|| {
                std::env::var("API_SERVER_PORT")
                    .ok()
                    .and_then(|s| s.parse().ok())
            })
            .unwrap_or("3001".to_string());

        let loglevel = args
            .loglevel
            .or(config.loglevel)
            .or_else(|| std::env::var("LOGLEVEL").ok())
            .unwrap_or("info".to_string());

        let nc_loglevel = args
            .noise_connection_log
            .or(config.nc_loglevel)
            .or_else(|| std::env::var("NC_LOGLEVEL").ok())
            .unwrap_or("off".to_string());

        let sv1_log = args.sv1_loglevel
            || config.sv1_log.unwrap_or(false)
            || std::env::var("SV1_LOGLEVEL").is_ok();

        let test = args.test || config.test.unwrap_or(false) || std::env::var("TEST").is_ok();

        let monitor =
            args.monitor || config.monitor.unwrap_or(false) || std::env::var("MONITOR").is_ok();

        let auto_update = args.auto_update
            || config.auto_update.unwrap_or(true)
            || std::env::var("AUTO_UPDATE").is_ok();

        let custom_job_timeout = args
            .custom_job_timeout
            .or(config.custom_job_timeout)
            .or_else(|| {
                std::env::var("CUSTOM_JOB_TIMEOUT")
                    .ok()
                    .and_then(|s| s.parse().ok())
            })
            .unwrap_or(30);

        Configuration {
            token,
            tp_address,
            pool_addresses,
            test_pool_addresses,
            interval,
            delay,
            downstream_hashrate,
            loglevel,
            nc_loglevel,
            sv1_log,
            test,
            listening_addr,
            api_server_port,
            monitor,
            auto_update,
            custom_job_timeout,
        }
    }
}

/// Parses a hashrate string (e.g., "10T", "2.5P", "500E") into an f32 value in h/s.
fn parse_hashrate(hashrate_str: &str) -> Result<f32, String> {
    let hashrate_str = hashrate_str.trim();
    if hashrate_str.is_empty() {
        return Err("Hashrate cannot be empty. Expected format: '<number><unit>' (e.g., '10T', '2.5P', '5E'".to_string());
    }

    let unit = hashrate_str.chars().last().unwrap_or(' ').to_string();
    let num = &hashrate_str[..hashrate_str.len().saturating_sub(1)];

    let num: f32 = num.parse().map_err(|_| {
        format!(
            "Invalid number '{}'. Expected format: '<number><unit>' (e.g., '10T', '2.5P', '5E')",
            num
        )
    })?;

    let multiplier = HashUnit::from_str(&unit)
        .map(|unit| unit.multiplier())
        .ok_or_else(|| format!(
            "Invalid unit '{}'. Expected 'T' (Terahash), 'P' (Petahash), or 'E' (Exahash). Example: '10T', '2.5P', '5E'",
            unit
        ))?;

    let hashrate = num * multiplier;

    if hashrate.is_infinite() || hashrate.is_nan() {
        return Err("Hashrate too large or invalid".to_string());
    }

    Ok(hashrate)
}

fn parse_address(addr: String) -> SocketAddr {
    addr.to_socket_addrs()
        .map_err(|e| error!("Invalid socket address: {}", e))
        .expect("Failed to parse socket address")
        .next()
        .expect("No socket address resolved")
}
