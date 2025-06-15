import {
  ColumnDef,
  Row,
  HeaderContext,
  CellContext
} from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Text } from 'lucide-react';
import type { MempoolTransaction } from '@/types/mempool-transaction';
import React from 'react';

const renderCell = (content: React.ReactNode) => (
  <div className='flex h-8 items-center justify-center gap-1'>{content}</div>
);

type ColumnConfig = {
  id: string;
  accessorKey: string;
  title: string;
  formatter: (v: any) => React.ReactNode;
  meta?: any;
  enableSorting: boolean;
  enableColumnFilter: boolean;
  filterFn?: (row: Row<MempoolTransaction>, id: string, value: any) => boolean;
};

const columnsConfig: ColumnConfig[] = [
  {
    id: 'txid',
    accessorKey: 'txid',
    title: 'Txid',
    formatter: (v: string) => v.slice(0, 4) + '...' + v.slice(-4),
    meta: {
      label: 'txid',
      placeholder: 'Search by txid',
      variant: 'text',
      icon: Text
    },
    enableSorting: false,
    enableColumnFilter: true
  },
  {
    id: 'feeRate',
    accessorKey: 'feeRate',
    title: 'FeeRate (sat/vB)',
    formatter: (v: number) => v.toPrecision(4),
    meta: { label: 'Fee Rate', variant: 'range', range: [0, 1000] },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'vsize',
    accessorKey: 'vsize',
    title: 'Size (vB)',
    formatter: (v: number) => v,
    meta: { label: 'vsize', variant: 'range', range: [0, 1000000] },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'fees.base',
    accessorKey: 'fees.base',
    title: 'Base Fee (sat)',
    formatter: (v: number) => v.toLocaleString(),
    meta: { label: 'Base Fee', variant: 'range', range: [0, 1000000] },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'depends',
    accessorKey: 'depends',
    title: 'Depends On',
    formatter: (v: any[]) => v.length,
    meta: { label: 'Depends On', variant: 'number' },
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: (row: Row<MempoolTransaction>, id: string, value: number) =>
      row.getValue<any[]>(id).length === value
  },
  {
    id: 'descendant_count',
    accessorKey: 'descendant_count',
    title: 'Descendant Count',
    formatter: (v: number) => v,
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'descendant_size',
    accessorKey: 'descendant_size',
    title: 'Descendant Size',
    formatter: (v: number) => v,
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'ancestor_count',
    accessorKey: 'ancestor_count',
    title: 'Ancestor Count',
    formatter: (v: number) => v,
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'ancestor_size',
    accessorKey: 'ancestor_size',
    title: 'Ancestor Size',
    formatter: (v: number) => v,
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'time',
    accessorKey: 'time',
    title: 'Time',
    formatter: (v: number) => new Date(v * 1000).toLocaleString(),
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'height',
    accessorKey: 'height',
    title: 'Height',
    formatter: (v: number) => v,
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'bip125_replaceable',
    accessorKey: 'bip125_replaceable',
    title: 'BIP125 Replaceable',
    formatter: (v: boolean) => <Checkbox checked={v} disabled />,
    meta: { label: 'BIP125 Replaceable', variant: 'boolean' },
    enableSorting: true,
    enableColumnFilter: true
  }
];

export const transactionColumns: ColumnDef<MempoolTransaction>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    meta: {
      label: 'Checkbox',
      placeholder: 'select transaction',
      variant: 'text',
      icon: Text
    },
    size: 32,
    enableHiding: false
  },

  ...columnsConfig.map((cfg) => ({
    id: cfg.id,
    accessorKey: cfg.accessorKey,
    header: ({ column }: HeaderContext<MempoolTransaction, any>) => (
      <DataTableColumnHeader
        column={column}
        title={cfg.title}
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }: CellContext<MempoolTransaction, any>) =>
      renderCell(cfg.formatter(cell.getValue())),
    ...(cfg.meta && { meta: cfg.meta }),
    enableSorting: cfg.enableSorting,
    enableColumnFilter: cfg.enableColumnFilter,
    ...(cfg.filterFn && { filterFn: cfg.filterFn })
  }))
];

export const selectedTransactionColumns: ColumnDef<MempoolTransaction>[] = [
  {
    id: 'select',
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    meta: {
      label: 'Checkbox',
      placeholder: 'deselect transaction',
      variant: 'text',
      icon: Text
    },
    size: 32,
    enableHiding: false
  },
  ...transactionColumns.slice(1, 5)
];
