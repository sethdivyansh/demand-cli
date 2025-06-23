'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getHealth,
  getPoolInfo,
  getMinerStats,
  getAggregateStats,
  getSystemStats,
  type ApiResponse
} from '@/api/proxy-api';

function useApiPolling<T>(
  fetchFn: (signal: AbortSignal) => Promise<ApiResponse<T>>,
  intervalMs: number,
  errorMessage: string = 'Failed to fetch data'
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(
    async (signal: AbortSignal) => {
      try {
        const res = await fetchFn(signal);
        if (res.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.message || errorMessage);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message);
      }
    },
    [fetchFn, errorMessage]
  );

  useEffect(() => {
    const abortController = new AbortController();

    fetch(abortController.signal).finally(() => {
      setLoading(false);
    });

    const id = setInterval(() => fetch(abortController.signal), intervalMs);

    return () => {
      abortController.abort();
      clearInterval(id);
    };
  }, [fetch, intervalMs]);

  return { data, loading, error };
}

export function useHealth(intervalMs: number = 2000) {
  return useApiPolling(getHealth, intervalMs, 'Failed to fetch health');
}

export function usePoolInfo(intervalMs: number = 2000) {
  return useApiPolling(getPoolInfo, intervalMs, 'Failed to fetch pool info');
}

export function useMinerStats(intervalMs: number = 2000) {
  return useApiPolling(
    getMinerStats,
    intervalMs,
    'Failed to fetch miner stats'
  );
}

export function useAggregateStats(intervalMs: number = 2000) {
  return useApiPolling(
    getAggregateStats,
    intervalMs,
    'Failed to fetch aggregate stats'
  );
}

export function useSystemStats(intervalMs: number = 2000) {
  return useApiPolling(
    getSystemStats,
    intervalMs,
    'Failed to fetch system stats'
  );
}
