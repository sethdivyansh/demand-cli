'use client';

import {
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import {
  type Parser,
  type UseQueryStateOptions,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryState,
  useQueryStates
} from 'nuqs';
import * as React from 'react';

import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import type { ExtendedColumnSort } from '@/types/data-table';

const PAGE_KEY = 'page';
const PER_PAGE_KEY = 'perPage';
const SORT_KEY = 'sort';
const ARRAY_SEPARATOR = ',';
const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;

interface UseDataTableProps<TData>
  extends Omit<
    TableOptions<TData>,
    | 'state'
    | 'getCoreRowModel'
    | 'manualFiltering'
    | 'manualPagination'
    | 'manualSorting'
    | 'pageCount'
  > {
  initialState?: Omit<Partial<TableState>, 'sorting'> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  history?: 'push' | 'replace';
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  enableAdvancedFilter?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
}

export function useDataTable<TData>(props: UseDataTableProps<TData>) {
  const {
    columns,
    initialState,
    history = 'replace',
    debounceMs = DEBOUNCE_MS,
    throttleMs = THROTTLE_MS,
    clearOnDefault = true,
    enableAdvancedFilter = false,
    scroll = false,
    shallow = true,
    startTransition,
    ...tableProps
  } = props;

  const queryStateOptions = React.useMemo<
    Omit<UseQueryStateOptions<string>, 'parse'>
  >(
    () => ({
      history,
      scroll,
      shallow,
      throttleMs,
      debounceMs,
      clearOnDefault,
      startTransition
    }),
    [
      history,
      scroll,
      shallow,
      throttleMs,
      debounceMs,
      clearOnDefault,
      startTransition
    ]
  );

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {});

  const [page, setPage] = useQueryState(
    PAGE_KEY,
    parseAsInteger
      .withOptions({
        ...queryStateOptions,
        clearOnDefault: true
      })
      .withDefault(1)
  );

  const defaultPerPage = initialState?.pagination?.pageSize ?? 10;
  const [perPage, setPerPage] = useQueryState(
    PER_PAGE_KEY,
    parseAsInteger
      .withOptions({
        ...queryStateOptions,
        clearOnDefault: true
      })
      .withDefault(defaultPerPage)
  );

  const pagination: PaginationState = React.useMemo(() => {
    return {
      pageIndex: Math.max(0, page - 1),
      pageSize: Math.max(1, perPage)
    };
  }, [page, perPage]);

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === 'function') {
        const newPagination = updaterOrValue(pagination);
        void setPage(Math.max(1, newPagination.pageIndex + 1));
        void setPerPage(Math.max(1, newPagination.pageSize));
      } else {
        void setPage(Math.max(1, updaterOrValue.pageIndex + 1));
        void setPerPage(Math.max(1, updaterOrValue.pageSize));
      }
    },
    [pagination, setPage, setPerPage]
  );

  const columnIds = React.useMemo(() => {
    return new Set(
      columns.map((column) => column.id).filter(Boolean) as string[]
    );
  }, [columns]);

  const [sortingFromUrl, setSortingFromUrl] = useQueryState(
    SORT_KEY,
    parseAsString
      .withOptions({
        ...queryStateOptions,
        clearOnDefault: true
      })
      .withDefault('')
  );

  const sorting = React.useMemo((): ExtendedColumnSort<TData>[] => {
    if (!sortingFromUrl || sortingFromUrl.trim() === '') {
      return initialState?.sorting ?? [];
    }

    try {
      const decoded = decodeURIComponent(sortingFromUrl);
      const parsed = JSON.parse(decoded);

      if (!Array.isArray(parsed)) return initialState?.sorting ?? [];

      const validSorts = parsed.filter(
        (sort: any) =>
          sort &&
          typeof sort === 'object' &&
          typeof sort.id === 'string' &&
          columnIds.has(sort.id) &&
          typeof sort.desc === 'boolean'
      );

      return validSorts.length > 0 ? validSorts : (initialState?.sorting ?? []);
    } catch {
      return initialState?.sorting ?? [];
    }
  }, [sortingFromUrl, columnIds, initialState?.sorting]);

  const setSorting = React.useCallback(
    (newSorting: ExtendedColumnSort<TData>[]) => {
      if (!Array.isArray(newSorting) || newSorting.length === 0) {
        void setSortingFromUrl('');
        return;
      }

      const validSorts = newSorting.filter(
        (sort) =>
          sort &&
          typeof sort.id === 'string' &&
          columnIds.has(sort.id) &&
          typeof sort.desc === 'boolean'
      );

      if (validSorts.length === 0) {
        void setSortingFromUrl('');
      } else {
        const serialized = encodeURIComponent(JSON.stringify(validSorts));
        void setSortingFromUrl(serialized);
      }
    },
    [setSortingFromUrl, columnIds]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      if (typeof updaterOrValue === 'function') {
        const newSorting = updaterOrValue(sorting);
        setSorting(newSorting as ExtendedColumnSort<TData>[]);
      } else {
        setSorting(updaterOrValue as ExtendedColumnSort<TData>[]);
      }
    },
    [sorting, setSorting]
  );

  const filterableColumns = React.useMemo(() => {
    if (enableAdvancedFilter) return [];

    return columns.filter((column) => column.enableColumnFilter);
  }, [columns, enableAdvancedFilter]);

  const filterParsers = React.useMemo(() => {
    if (enableAdvancedFilter) return {};

    return filterableColumns.reduce<
      Record<string, Parser<string> | Parser<string[]>>
    >((acc, column) => {
      const columnId = column.id ?? '';
      if (column.meta?.options) {
        acc[columnId] = parseAsArrayOf(
          parseAsString,
          ARRAY_SEPARATOR
        ).withOptions({
          ...queryStateOptions,
          clearOnDefault: true
        });
      } else {
        acc[columnId] = parseAsString.withOptions({
          ...queryStateOptions,
          clearOnDefault: true
        });
      }
      return acc;
    }, {});
  }, [filterableColumns, queryStateOptions, enableAdvancedFilter]);

  const [filterValues, setFilterValues] = useQueryStates(filterParsers);

  const debouncedSetFilterValues = useDebouncedCallback(
    (values: typeof filterValues) => {
      if (page !== 1) {
        void setPage(1);
      }
      void setFilterValues(values);
    },
    debounceMs
  );

  const initialColumnFilters: ColumnFiltersState = React.useMemo(() => {
    if (enableAdvancedFilter) return [];

    return Object.entries(filterValues).reduce<ColumnFiltersState>(
      (filters, [key, value]) => {
        if (value !== null && value !== undefined) {
          const processedValue = Array.isArray(value)
            ? value.filter(Boolean)
            : typeof value === 'string' && /[^a-zA-Z0-9]/.test(value)
              ? value.split(/[^a-zA-Z0-9]+/).filter(Boolean)
              : [value].filter(Boolean);

          if (processedValue.length > 0) {
            filters.push({
              id: key,
              value: processedValue
            });
          }
        }
        return filters;
      },
      []
    );
  }, [filterValues, enableAdvancedFilter]);

  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters);

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      if (enableAdvancedFilter) return;

      setColumnFilters((prev) => {
        const next =
          typeof updaterOrValue === 'function'
            ? updaterOrValue(prev)
            : updaterOrValue;

        const filterUpdates = next.reduce<
          Record<string, string | string[] | null>
        >((acc, filter) => {
          if (filterableColumns.find((column) => column.id === filter.id)) {
            const value = filter.value as string | string[];
            if (Array.isArray(value) ? value.length > 0 : value) {
              acc[filter.id] = value;
            } else {
              acc[filter.id] = null;
            }
          }
          return acc;
        }, {});

        for (const prevFilter of prev) {
          if (!next.some((filter) => filter.id === prevFilter.id)) {
            filterUpdates[prevFilter.id] = null;
          }
        }

        debouncedSetFilterValues(filterUpdates);
        return next;
      });
    },
    [debouncedSetFilterValues, filterableColumns, enableAdvancedFilter]
  );

  const table = useReactTable({
    ...tableProps,
    columns,
    initialState,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters
    },
    defaultColumn: {
      ...tableProps.defaultColumn,
      enableColumnFilter: false
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false
  });

  return { table, shallow, debounceMs, throttleMs };
}
