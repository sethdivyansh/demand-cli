export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch (_err) {
    return '';
  }
}

export function formatDateTime(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      hour: opts.hour ?? 'numeric',
      minute: opts.minute ?? '2-digit',
      second: opts.second,
      hour12: opts.hour12 ?? true,
      ...opts
    }).format(new Date(date));
  } catch (_err) {
    return '';
  }
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

export function formatHashrate(hashrate: number, decimals: number = 2) {
  if (hashrate >= 1000000000000) {
    return `${(hashrate / 1000000000000).toFixed(decimals)} TH/s`;
  } else if (hashrate >= 1000000000) {
    return `${(hashrate / 1000000000).toFixed(decimals)} GH/s`;
  } else if (hashrate >= 1000000) {
    return `${(hashrate / 1000000).toFixed(decimals)} MH/s`;
  }
  return `${hashrate.toFixed(decimals)} H/s`;
}
