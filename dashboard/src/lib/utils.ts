import { MempoolTransaction } from '@/types/mempool-transaction';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(
  bytes: number,
  opts: {
    decimals?: number;
    sizeType?: 'accurate' | 'normal';
  } = {}
) {
  const { decimals = 0, sizeType = 'normal' } = opts;

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(decimals)} ${
    sizeType === 'accurate'
      ? (accurateSizes[i] ?? 'Bytest')
      : (sizes[i] ?? 'Bytes')
  }`;
}

export function formatHashrate(hashrate: number) {
  if (hashrate >= 1000000000000) {
    return `${(hashrate / 1000000000000).toFixed(2)} TH/s`;
  } else if (hashrate >= 1000000000) {
    return `${(hashrate / 1000000000).toFixed(2)} GH/s`;
  } else if (hashrate >= 1000000) {
    return `${(hashrate / 1000000).toFixed(2)} MH/s`;
  }
  return `${hashrate.toFixed(2)} H/s`;
}

export function parseMempoolTransaction(tx: any): MempoolTransaction {
  return {
    txid: tx.txid,
    vsize: tx.vsize,
    weight: tx.weight,
    time: tx.time,
    height: tx.height,
    descendant_count: tx.descendant_count,
    descendant_size: tx.descendant_size,
    ancestor_count: tx.ancestor_count,
    ancestor_size: tx.ancestor_size,
    wtxid: tx.wtxid || tx.txid,
    fees: {
      base: tx.fees.base * 1e8,
      modified: tx.fees.modified * 1e8,
      ancestor: tx.fees.ancestor * 1e8,
      descendant: tx.fees.descendant * 1e8
    },
    feeRate: (tx.fees.base * 1e8) / tx.vsize,
    depends: tx.depends || [],
    spent_by: tx.spent_by || [],
    bip125_replaceable: tx.bip125_replaceable,
    unbroadcast: tx.unbroadcast
  };
}
