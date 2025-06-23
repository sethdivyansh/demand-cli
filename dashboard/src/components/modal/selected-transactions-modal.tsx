import React from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableSortList } from '@/components/ui/table/data-table-sort-list';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  ColumnDef,
  Row,
  Table as ReactTable
} from '@tanstack/react-table';
import type { MempoolTransaction } from '@/types/mempool-transaction';
import { selectedTransactionColumns } from '../../features/overview/components/transaction-columns';

interface SelectedTransactionsModalProps {
  isOpen: boolean;
  selectedData: MempoolTransaction[];
  parentTable: ReactTable<MempoolTransaction>;
  handleModal: (open: boolean) => void;
}

export function SelectedTransactionsModal({
  isOpen,
  selectedData,
  parentTable,
  handleModal
}: SelectedTransactionsModalProps) {
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const customizedColumns = React.useMemo<ColumnDef<MempoolTransaction>[]>(
    () =>
      selectedTransactionColumns.map((col) => {
        if (col.id === 'select') {
          return {
            ...col,
            cell: ({ row }: { row: Row<MempoolTransaction> }) => (
              <Checkbox
                checked={parentTable.getRow(row.original.txid)?.getIsSelected()}
                onCheckedChange={(value) =>
                  parentTable.getRow(row.original.txid)?.toggleSelected(!!value)
                }
                aria-label='Select row'
              />
            )
          } as ColumnDef<MempoolTransaction>;
        }
        return col;
      }),
    [parentTable]
  );

  const table = useReactTable({
    data: selectedData,
    columns: customizedColumns,
    state: {
      pagination: { pageIndex, pageSize },
      sorting
    },
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const next = updater({ pageIndex, pageSize });
        setPageIndex(next.pageIndex);
        setPageSize(next.pageSize);
      } else {
        setPageIndex(updater.pageIndex);
        setPageSize(updater.pageSize);
      }
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <Modal
      title='Selected Transactions'
      description='Review the selected transactions'
      isOpen={isOpen}
      onClose={() => handleModal(false)}
      className='w-full max-w-6xl overflow-scroll sm:max-w-6xl'
    >
      <div className='max-h-[75vh] overflow-auto'>
        <DataTable table={table}>
          <div className='flex items-center gap-2 px-4 py-2'>
            <DataTableToolbar table={table} />
            <DataTableSortList table={table} />
            {selectedData.length > 0 && (
              <Button
                variant='destructive'
                size='sm'
                onClick={() => {
                  parentTable.toggleAllRowsSelected(false);
                  setTimeout(() => handleModal(false), 800);
                }}
              >
                Deselect All
              </Button>
            )}
          </div>
        </DataTable>
      </div>
    </Modal>
  );
}
