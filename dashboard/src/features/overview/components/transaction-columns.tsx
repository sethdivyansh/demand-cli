import { Column, ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Text } from 'lucide-react';
import type { MempoolTransaction } from '@/types/mempool-transaction';
import React from 'react';

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
  {
    id: 'txid',
    accessorKey: 'txid',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Txid'
        className='flex justify-center'
      />
    ),
    cell: ({ cell }) => {
      const txid = cell.getValue<MempoolTransaction['txid']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          {txid.slice(0, 4) + '...' + txid.slice(-4)}
        </div>
      );
    },
    meta: {
      label: 'txid',
      placeholder: 'Search by txid',
      variant: 'text',
      icon: Text
    },
    enableHiding: false,
    enableColumnFilter: true,
    enableSorting: false
  },
  {
    id: 'feeRate',
    accessorKey: 'feeRate',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='FeeRate (sat/vB)'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const feeRate = cell.getValue<MempoolTransaction['feeRate']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          {feeRate.toPrecision(4)}
        </div>
      );
    },
    meta: {
      label: 'Fee Rate',
      variant: 'range',
      range: [0, 1000],
      unit: 'sat/vB'
    },
    enableColumnFilter: true,
    enableSorting: true
  },
  {
    id: 'vsize',
    accessorKey: 'vsize',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Size (vB)'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const size = cell.getValue<MempoolTransaction['vsize']>();

      return (
        <div className='flex h-8 items-center justify-center gap-1'>{size}</div>
      );
    },
    meta: {
      label: 'vsize',
      variant: 'range',
      range: [0, 1000],
      unit: 'vB'
    },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'depends',
    accessorKey: 'depends',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Depends On'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const dependsOn = cell.getValue<MempoolTransaction['depends']>();

      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          {dependsOn.length}
        </div>
      );
    },
    meta: {
      label: 'Depends On',
      variant: 'number'
    },
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      const dependsOn = row.getValue<MempoolTransaction['depends']>(id);
      return dependsOn.length == value;
    }
  },
  {
    id: 'descendant_count',
    accessorKey: 'descendant_count',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Descendant Count'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const count = cell.getValue<MempoolTransaction['descendant_count']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          {count}
        </div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'descendant_size',
    accessorKey: 'descendant_size',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Descendant Size'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const size = cell.getValue<MempoolTransaction['descendant_size']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>{size}</div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'ancestor_count',
    accessorKey: 'ancestor_count',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Ancestor Count'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const count = cell.getValue<MempoolTransaction['ancestor_count']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          {count}
        </div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'ancestor_size',
    accessorKey: 'ancestor_size',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Ancestor Size'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const size = cell.getValue<MempoolTransaction['ancestor_size']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>{size}</div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'time',
    accessorKey: 'time',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Time'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const time = cell.getValue<MempoolTransaction['time']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          {new Date(time * 1000).toLocaleString()}
        </div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'height',
    accessorKey: 'height',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='Height'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const height = cell.getValue<MempoolTransaction['height']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          {height}
        </div>
      );
    },
    enableSorting: true,
    enableColumnFilter: true
  },
  {
    id: 'bip125_replaceable',
    accessorKey: 'bip125_replaceable',
    header: ({ column }: { column: Column<MempoolTransaction, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title='BIP125 Replaceable'
        className='w-full justify-center'
      />
    ),
    cell: ({ cell }) => {
      const bip125 = cell.getValue<MempoolTransaction['bip125_replaceable']>();
      return (
        <div className='flex h-8 items-center justify-center gap-1'>
          <Checkbox checked={bip125} disabled />
        </div>
      );
    },
    meta: {
      label: 'BIP125 Replaceable',
      variant: 'boolean'
    },
    enableSorting: true,
    enableColumnFilter: true
  }
];
