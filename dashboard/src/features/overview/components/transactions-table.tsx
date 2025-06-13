'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableSortList } from '@/components/ui/table/data-table-sort-list';
import { useDataTable } from '@/hooks/use-data-table';
import type { MempoolTransaction } from '@/types/mempool-transaction';
import {
  transactionColumns,
  selectedTransactionColumns
} from './transaction-columns';
import { ColumnDef, Row } from '@tanstack/react-table';
import React from 'react';
import { Modal } from '@/components/ui/modal';
import { Checkbox } from '@/components/ui/checkbox';

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

  // Build customized columns for the modal's table to sync selection with the main table
  const customizedSelectedColumns = React.useMemo<
    ColumnDef<MempoolTransaction>[]
  >(
    () =>
      selectedTransactionColumns.map((col) => {
        if (col.id === 'select') {
          return {
            ...col,
            cell: ({ row }: { row: Row<MempoolTransaction> }) => (
              <Checkbox
                checked={table.getRow(row.id)?.getIsSelected()}
                onCheckedChange={(value) =>
                  table.getRow(row.id)?.toggleSelected(!!value)
                }
                aria-label='Select row'
              />
            )
          } as ColumnDef<MempoolTransaction>;
        }
        return col;
      }),
    [table]
  );

  const { table: selectedTxTable } = useDataTable<MempoolTransaction>({
    data: selectedRows.map((row) => row.original),
    columns: customizedSelectedColumns,
    getRowId: (r) => r.txid
  });

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
                onClick={() => setIsModalOpen(true)}
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
      <Modal
        title='Selected Transactions'
        description='Review the selected transactions'
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className='w-full max-w-6xl overflow-scroll sm:max-w-6xl'
      >
        <div className='max-h-[75vh] overflow-auto'>
          <DataTable table={selectedTxTable}>
            <div className='flex items-center gap-2 px-4 py-2'>
              <DataTableToolbar table={selectedTxTable} />
              <DataTableSortList table={selectedTxTable} />
              {selectedRows.length > 0 && (
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={() => table.toggleAllRowsSelected(false)}
                >
                  Deselect All
                </Button>
              )}
            </div>
          </DataTable>
        </div>
      </Modal>
    </>
  );
}
