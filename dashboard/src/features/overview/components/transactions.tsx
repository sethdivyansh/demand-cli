'use client';

import { useMempoolTransactions } from '@/hooks/use-mempool-transactions';
import { parseAsString, useQueryState } from 'nuqs';
import React from 'react';
import { TransactionsTable } from './transactions-table';

export function Transactions() {
  const { transactions, isFetching, toggle } = useMempoolTransactions();
  const [txid] = useQueryState('txid', parseAsString.withDefault(''));
  const filtered = React.useMemo(
    () =>
      transactions.filter(
        (t) => !txid || t.txid.toLowerCase().includes(txid.toLowerCase())
      ),
    [transactions, txid]
  );

  return (
    <div className='data-table-container'>
      <TransactionsTable
        data={filtered}
        isFetching={isFetching}
        onToggle={toggle}
      />
    </div>
  );
}
