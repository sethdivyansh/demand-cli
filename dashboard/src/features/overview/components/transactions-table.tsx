'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableSortList } from '@/components/ui/table/data-table-sort-list';
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection
} from '@/components/ui/table/data-table-action-bar';
import { useDataTable } from '@/hooks/use-data-table';
import type { MempoolTransaction } from '@/types/mempool-transaction';
import { transactionColumns } from './transaction-columns';
import { SelectedTransactionsModal } from '../../../components/modal/selected-transactions-modal';
import React from 'react';
import { TransactionSummaryModal } from '@/components/modal/transaction-summary-modal';
import { Download, Eye, BarChart3, Copy } from 'lucide-react';
import { exportTransactionsToCSV, copyTransactionIds } from '@/lib/export';
import { toast } from 'sonner';

interface Props {
  data: MempoolTransaction[];
  isFetching: boolean;
  onToggle: () => void;
}

export function TransactionsTable({ data, isFetching, onToggle }: Props) {
  const [isSelectedModalOpen, setIsSelectedModalOpen] = React.useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isCopying, setIsCopying] = React.useState(false);

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

  const handleSelectedModal = (open: boolean) => {
    if (open) {
      setIsSelectedModalOpen(true);
      if (isFetching) onToggle();
    } else {
      setIsSelectedModalOpen(false);
      if (!isFetching) onToggle();
    }
  };

  const handleExportSelected = async () => {
    setIsExporting(true);
    try {
      await exportTransactionsToCSV(selectedData);
    } catch (error) {
      toast.error(
        'Export failed: There was an error exporting the selected transactions.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySelected = async () => {
    setIsCopying(true);
    try {
      await copyTransactionIds(selectedData);
    } catch (error) {
      toast.error(
        'Copy failed: There was an error copying the selected transaction IDs.'
      );
    } finally {
      setIsCopying(false);
    }
  };

  const actionBar = (
    <DataTableActionBar table={table} className='rounded-xl p-4'>
      <DataTableActionBarSelection table={table} />
      <DataTableActionBarAction
        tooltip='View selected transactions'
        onClick={() => handleSelectedModal(true)}
      >
        <Eye />
        View Selected
      </DataTableActionBarAction>
      <DataTableActionBarAction
        tooltip='Show summary of selected transactions'
        onClick={() => setIsSummaryModalOpen(true)}
      >
        <BarChart3 />
        Summary
      </DataTableActionBarAction>
      <DataTableActionBarAction
        tooltip='Copy transaction IDs to clipboard'
        onClick={handleCopySelected}
        isPending={isCopying}
      >
        <Copy />
        Copy IDs
      </DataTableActionBarAction>
      <DataTableActionBarAction
        tooltip='Export selected transactions to CSV'
        onClick={handleExportSelected}
        isPending={isExporting}
      >
        <Download />
        Export
      </DataTableActionBarAction>
    </DataTableActionBar>
  );

  return (
    <>
      <Card>
        <div className='px-4'>
          <DataTable table={table} actionBar={actionBar}>
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
            </div>
          </DataTable>
        </div>
      </Card>
      <TransactionSummaryModal
        isOpen={isSummaryModalOpen}
        selectedData={selectedData}
        handleModal={setIsSummaryModalOpen}
      />
      <SelectedTransactionsModal
        isOpen={isSelectedModalOpen}
        selectedData={selectedData}
        parentTable={table}
        handleModal={handleSelectedModal}
      />
    </>
  );
}
