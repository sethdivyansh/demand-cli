import type { MempoolTransaction } from '@/types/mempool-transaction';
import { formatDateTime } from './format';

export interface ExportOptions {
  filename?: string;
  includeHeaders?: boolean;
}

/**
 * Exports transaction data to CSV format and triggers download
 */
export async function exportTransactionsToCSV(
  transactions: MempoolTransaction[],
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = `transactions-${new Date().toISOString().split('T')[0]}.csv`,
    includeHeaders = true
  } = options;

  try {
    const csvContent = generateTransactionCSV(transactions, includeHeaders);
    await downloadCSV(csvContent, filename);
  } catch (error) {
    throw new Error('Export failed');
  }
}

/**
 * Generates CSV content from transaction data
 */
export function generateTransactionCSV(
  transactions: MempoolTransaction[],
  includeHeaders: boolean = true
): string {
  const headers = ['Transaction ID', 'Fee Rate', 'Base Fee', 'Size', 'Time'];

  const rows = transactions.map((tx) => [
    tx.txid,
    `${tx.feeRate} sat/vB`,
    `${tx.fees.base} sat`,
    `${tx.vsize} vB`,
    formatDateTime(tx.time)
  ]);

  const csvRows = includeHeaders ? [headers, ...rows] : rows;

  return csvRows
    .map((row) => row.map((field) => `"${field}"`).join(','))
    .join('\n');
}

/**
 * Triggers CSV file download in the browser
 */
export async function downloadCSV(
  content: string,
  filename: string
): Promise<void> {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Copies transaction IDs to clipboard
 */
export async function copyTransactionIds(
  transactions: MempoolTransaction[]
): Promise<void> {
  const txids = transactions.map((tx) => tx.txid).join('\n');

  if (!navigator.clipboard) {
    throw new Error('Clipboard API not available');
  }

  await navigator.clipboard.writeText(txids);
}
