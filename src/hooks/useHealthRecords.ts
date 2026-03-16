/**
 * useHealthRecords — Health record CRUD with caching and pagination.
 *
 * Uses @tanstack/react-query for data fetching, caching, and
 * optimistic updates. Backed by the API client which calls
 * server-side routes (fixes SBP-002).
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  HealthRecord,
  RecordType,
  RecordStatus,
  RecordFilters,
  RecordSortField,
  SortDirection,
  UploadRecordForm,
} from '@/types';
import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const RECORDS_KEY = 'health-records';
const RECORD_DETAIL_KEY = 'health-record-detail';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseHealthRecordsReturn {
  /** Paginated records for the current filter state. */
  records: HealthRecord[];
  /** Total record count matching current filters. */
  total: number;
  /** Current page number. */
  page: number;
  /** Total pages available. */
  totalPages: number;
  /** Whether more pages exist. */
  hasMore: boolean;
  /** Whether the record list query is loading. */
  isLoading: boolean;
  /** Whether a background re-fetch is in progress. */
  isFetching: boolean;
  /** Error from the list query, if any. */
  error: Error | null;

  /** Current filter state. */
  filters: RecordFilters;
  /** Replace the full filter state. */
  setFilters: (filters: RecordFilters) => void;
  /** Set the record type filter. */
  setTypeFilter: (type: RecordType | undefined) => void;
  /** Set the search query string. */
  setSearch: (search: string) => void;
  /** Set the status filter. */
  setStatusFilter: (status: RecordStatus | undefined) => void;
  /** Set sort field and direction. */
  setSort: (field: RecordSortField, direction?: SortDirection) => void;
  /** Go to a specific page. */
  goToPage: (page: number) => void;
  /** Go to the next page. */
  nextPage: () => void;
  /** Go to the previous page. */
  prevPage: () => void;

  /** Fetch a single record by ID (returns query result). */
  useRecordDetail: (id: string | null) => {
    record: HealthRecord | null;
    isLoading: boolean;
    error: Error | null;
  };

  /** Upload a new record (mutation). */
  upload: {
    mutate: (form: UploadRecordForm) => void;
    mutateAsync: (form: UploadRecordForm) => Promise<HealthRecord>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Delete a record by ID (mutation). */
  remove: {
    mutate: (id: string) => void;
    mutateAsync: (id: string) => Promise<void>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Force re-fetch the records list. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Full-featured health records hook with pagination, filtering,
 * sorting, upload, and deletion — all backed by react-query caching.
 *
 * @param initialFilters - Optional partial filter overrides.
 *
 * @example
 * ```tsx
 * const { records, isLoading, setSearch, nextPage } = useHealthRecords();
 * ```
 */
export function useHealthRecords(
  initialFilters?: Partial<RecordFilters>,
): UseHealthRecordsReturn {
  const queryClient = useQueryClient();

  // ---- Filters (kept as react-query queryKey params) ---------------------

  const defaultFilters: RecordFilters = {
    type: undefined,
    search: undefined,
    status: undefined,
    sortField: 'date',
    sortDirection: 'desc',
    page: 1,
    pageSize: 12,
    ...initialFilters,
  };

  // We store filters in a ref-stable object by embedding them in the query key.
  // To update filters, we just change the query key and react-query re-fetches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtersKey = useMemo(() => defaultFilters, []);
  // Use a single state object so filter changes are atomic.
  const [filters, setFiltersRaw] = useState<RecordFilters>(filtersKey);

  const setFilters = useCallback((f: RecordFilters) => {
    setFiltersRaw(f);
  }, []);

  const setTypeFilter = useCallback((type: RecordType | undefined) => {
    setFiltersRaw((prev) => ({ ...prev, type, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFiltersRaw((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  const setStatusFilter = useCallback((status: RecordStatus | undefined) => {
    setFiltersRaw((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const setSort = useCallback((field: RecordSortField, direction?: SortDirection) => {
    setFiltersRaw((prev) => ({
      ...prev,
      sortField: field,
      sortDirection: direction ?? (prev.sortField === field && prev.sortDirection === 'desc' ? 'asc' : 'desc'),
      page: 1,
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setFiltersRaw((prev) => ({ ...prev, page: Math.max(1, page) }));
  }, []);

  const nextPage = useCallback(() => {
    setFiltersRaw((prev) => ({ ...prev, page: prev.page + 1 }));
  }, []);

  const prevPage = useCallback(() => {
    setFiltersRaw((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
  }, []);

  // ---- List query --------------------------------------------------------

  const listQuery = useQuery({
    queryKey: [RECORDS_KEY, filters],
    queryFn: () =>
      api.getPaginated<HealthRecord>('/api/records', {
        page: filters.page,
        limit: filters.pageSize,
        type: filters.type,
        status: filters.status,
        q: filters.search,
        sort: filters.sortField,
        order: filters.sortDirection,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const data = listQuery.data;

  // ---- Detail query (returned as a nested hook-like function) ------------

  const useRecordDetail = useCallback(
    (id: string | null) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const query = useQuery({
        queryKey: [RECORD_DETAIL_KEY, id],
        queryFn: () => api.get<HealthRecord>(`/api/records/${id}`),
        enabled: id !== null,
        staleTime: 30_000,
      });
      return {
        record: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error as Error | null,
      };
    },
    [],
  );

  // ---- Upload mutation ---------------------------------------------------

  const uploadMutation = useMutation({
    mutationFn: (form: UploadRecordForm) =>
      api.post<HealthRecord>('/api/records', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
    },
  });

  // ---- Delete mutation ---------------------------------------------------

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
    },
  });

  // ---- Refetch -----------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [RECORDS_KEY] });
  }, [queryClient]);

  return {
    records: data?.items ?? [],
    total: data?.meta?.total ?? 0,
    page: data?.meta?.page ?? 1,
    totalPages: data?.meta?.totalPages ?? 1,
    hasMore: (data?.meta?.page ?? 1) < (data?.meta?.totalPages ?? 1),
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error as Error | null,

    filters,
    setFilters,
    setTypeFilter,
    setSearch,
    setStatusFilter,
    setSort,
    goToPage,
    nextPage,
    prevPage,

    useRecordDetail,

    upload: {
      mutate: uploadMutation.mutate,
      mutateAsync: uploadMutation.mutateAsync,
      isLoading: uploadMutation.isPending,
      error: uploadMutation.error as Error | null,
    },

    remove: {
      mutate: deleteMutation.mutate,
      mutateAsync: deleteMutation.mutateAsync,
      isLoading: deleteMutation.isPending,
      error: deleteMutation.error as Error | null,
    },

    refetch,
  };
}
