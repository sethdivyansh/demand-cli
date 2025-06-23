export interface HealthStatus {
  status: string;
  timestamp: number;
}

export interface PoolInfo {
  address: string;
  latency: number;
}

export interface MinerStats {
  device_name: string;
  hashrate: number;
  accepted_shares: number;
  rejected_shares: number;
  current_difficulty: number;
}

export type MinerStatsMap = Record<number, MinerStats>;

export interface AggregateStats {
  total_connected_device: number;
  total_hashrate: number;
  total_accepted_shares: number;
  total_rejected_shares: number;
  aggregate_diff: number;
}

export interface SystemStats {
  cpu_usage: number; // in Percentage
  memory_usage: string;
}
