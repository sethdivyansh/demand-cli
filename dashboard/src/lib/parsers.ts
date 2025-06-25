import { createParser } from 'nuqs/server';
import { z } from 'zod';

import { dataTableConfig } from '@/config/data-table';

import type {
  ExtendedColumnFilter,
  ExtendedColumnSort
} from '@/types/data-table';
import { MempoolTransaction } from '@/types/mempool-transaction';

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean()
});

export const getSortingStateParser = <TData>(
  columnIds?: string[] | Set<string>
) => {
  const validKeys = columnIds
    ? columnIds instanceof Set
      ? columnIds
      : new Set(columnIds)
    : null;

  return createParser({
    parse: (value) => {
      try {
        const parsed = JSON.parse(value);
        const result = z.array(sortingItemSchema).safeParse(parsed);

        if (!result.success) return null;

        if (validKeys && result.data.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return result.data as ExtendedColumnSort<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every(
        (item, index) =>
          item.id === b[index]?.id && item.desc === b[index]?.desc
      )
  });
};

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(dataTableConfig.filterVariants),
  operator: z.enum(dataTableConfig.operators),
  filterId: z.string()
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

export const getFiltersStateParser = <TData>(
  columnIds?: string[] | Set<string>
) => {
  const validKeys = columnIds
    ? columnIds instanceof Set
      ? columnIds
      : new Set(columnIds)
    : null;

  return createParser({
    parse: (value) => {
      try {
        const parsed = JSON.parse(value);
        const result = z.array(filterItemSchema).safeParse(parsed);

        if (!result.success) return null;

        if (validKeys && result.data.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return result.data as ExtendedColumnFilter<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every(
        (filter, index) =>
          filter.id === b[index]?.id &&
          filter.value === b[index]?.value &&
          filter.variant === b[index]?.variant &&
          filter.operator === b[index]?.operator
      )
  });
};

export const parseMempoolTransaction = (tx: any): MempoolTransaction => {
  return {
    txid: tx.txid,
    vsize: tx.vsize,
    weight: tx.weight,
    time: tx.time,
    height: tx.height,
    descendant_count: tx.descendant_count,
    descendant_size: tx.descendant_size,
    ancestor_count: tx.ancestor_count,
    ancestor_size: tx.ancestor_size,
    wtxid: tx.wtxid || tx.txid,
    fees: {
      base: tx.fees.base * 1e8,
      modified: tx.fees.modified * 1e8,
      ancestor: tx.fees.ancestor * 1e8,
      descendant: tx.fees.descendant * 1e8
    },
    feeRate: (tx.fees.base * 1e8) / tx.vsize,
    depends: tx.depends || [],
    spent_by: tx.spent_by || [],
    bip125_replaceable: tx.bip125_replaceable,
    unbroadcast: tx.unbroadcast
  };
};
