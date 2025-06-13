'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableSortList } from '@/components/ui/table/data-table-sort-list';
import { DataTableActionBar } from '@/components/ui/table/data-table-action-bar';
import { useDataTable } from '@/hooks/use-data-table';
import type { MempoolTransaction } from '@/types/mempool-transaction';
import { transactionColumns } from './transaction-columns';

interface Props {
  data: MempoolTransaction[];
  isFetching: boolean;
  onToggle: () => void;
}

export function TransactionsTable({ data, isFetching, onToggle }: Props) {
  const { table } = useDataTable<MempoolTransaction>({
    data,
    columns: transactionColumns,
    getRowId: (r) => r.txid
  });

  return (
    <Card>
      <div className='px-4'>
        <DataTable table={table}>
          <div className='flex items-center gap-2'>
            <DataTableToolbar table={table} />
            <Button
              variant={isFetching ? 'destructive' : 'default'}
              size='sm'
              onClick={onToggle}
            >
              {isFetching ? 'Pause' : 'Resume'}
            </Button>
            <DataTableSortList table={table} />
            <DataTableActionBar table={table} />
          </div>
        </DataTable>
      </div>
    </Card>
  );
}
