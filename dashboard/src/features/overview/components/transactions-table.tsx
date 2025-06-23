'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableSortList } from '@/components/ui/table/data-table-sort-list';
import { useDataTable } from '@/hooks/use-data-table';
import type { MempoolTransaction } from '@/types/mempool-transaction';
import { transactionColumns } from './transaction-columns';
import { SelectedTransactionsModal } from '../../../components/modal/selected-transactions-modal';
import React from 'react';

interface Props {
  data: MempoolTransaction[];
  isFetching: boolean;
  onToggle: () => void;
}

export function TransactionsTable({ data, isFetching, onToggle }: Props) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const { table } = useDataTable<MempoolTransaction>({
    data,
    columns: transactionColumns,
    getRowId: (r) => r.txid
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedData = React.useMemo(
    () => selectedRows.map((row) => row.original),
    [selectedRows]
  );

  const handleModal = (open: boolean) => {
    if (open) {
      setIsModalOpen(true);
      if (isFetching) onToggle();
    } else {
      setIsModalOpen(false);
      if (!isFetching) onToggle();
    }
  };

  return (
    <>
      <Card>
        <div className='px-4'>
          <DataTable table={table}>
            <div className='flex items-center gap-2'>
              <DataTableToolbar table={table} />
              <Button
                variant='outline'
                size='sm'
                onClick={() => handleModal(true)}
                disabled={selectedRows.length === 0}
              >
                View Selected ({selectedRows.length})
              </Button>
              <Button
                variant={isFetching ? 'destructive' : 'default'}
                size='sm'
                onClick={onToggle}
              >
                {isFetching ? 'Pause' : 'Resume'}
              </Button>
              <DataTableSortList table={table} />
            </div>
          </DataTable>
        </div>
      </Card>
      <SelectedTransactionsModal
        isOpen={isModalOpen}
        selectedData={selectedData}
        parentTable={table}
        handleModal={handleModal}
      />
    </>
  );
}
