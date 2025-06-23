import axios from 'axios';
import type {
  HealthStatus,
  PoolInfo,
  MinerStatsMap,
  AggregateStats,
  SystemStats
} from '../types/proxy-stats';
import { formatBytes } from '@/lib/utils';

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
}

const proxyApi = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const handleApiError = (
  err: any
): never | { success: false; message: string; data: null } => {
  if (err.name === 'AbortError') throw err;
  return {
    success: false,
    message: err.code === 'ECONNABORTED' ? 'Request timeout' : err.message,
    data: null
  };
};

// API wrapper
const apiCall = async <T>(
  request: () => Promise<any>,
  transform?: (data: any) => T
): Promise<ApiResponse<T>> => {
  try {
    const res = await request();
    return {
      success: res.data.success,
      message: res.data.message ?? null,
      data: transform ? transform(res.data.data) : res.data.data
    };
  } catch (err: any) {
    return handleApiError(err);
  }
};

export const getHealth = async (
  signal?: AbortSignal
): Promise<ApiResponse<HealthStatus>> => {
  return apiCall(
    () => proxyApi.get('/api/health', { signal }),
    (data) => ({
      status: data,
      timestamp: Date.now()
    })
  );
};

export const getPoolInfo = async (
  signal?: AbortSignal
): Promise<ApiResponse<PoolInfo>> => {
  return apiCall(
    () => proxyApi.get('/api/pool/info', { signal }),
    (data) => ({
      address: data?.address ?? '',
      latency: Number(data?.latency ?? 0)
    })
  );
};

export const getMinerStats = async (
  signal?: AbortSignal
): Promise<ApiResponse<MinerStatsMap>> => {
  return apiCall(
    () => proxyApi.get('/api/stats/miners', { signal }),
    (data) => data ?? {}
  );
};

export const getAggregateStats = async (
  signal?: AbortSignal
): Promise<ApiResponse<AggregateStats | null>> => {
  return apiCall(
    () => proxyApi.get('/api/stats/aggregate', { signal }),
    (data) =>
      data
        ? {
            total_connected_device: data.total_connected_device,
            total_hashrate: data.aggregate_hashrate,
            total_accepted_shares: data.aggregate_accepted_shares,
            total_rejected_shares: data.aggregate_rejected_shares,
            aggregate_diff: data.aggregate_diff
          }
        : null
  );
};

export const getSystemStats = async (
  signal?: AbortSignal
): Promise<ApiResponse<SystemStats | null>> => {
  return apiCall(
    () => proxyApi.get('/api/stats/system', { signal }),
    (data) =>
      data
        ? {
            cpu_usage: parseFloat(data['cpu_usage_%']),
            memory_usage: formatBytes(data['memory_usage_bytes'])
          }
        : null
  );
};
