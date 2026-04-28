'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  DataListing,
  DataPurchase,
  MarketplaceStats,
  MarketplaceCategory,
  ListingStatus,
  CreateListingForm,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const LISTINGS_KEY = 'marketplace-listings';
const PURCHASES_KEY = 'marketplace-purchases';
const STATS_KEY = 'marketplace-stats';

// ---------------------------------------------------------------------------
// Filter type (exported for consumers)
// ---------------------------------------------------------------------------

export interface MarketplaceFilters {
  category?: MarketplaceCategory;
  status?: ListingStatus;
  minQuality?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseMarketplaceReturn {
  listings: DataListing[];
  purchases: DataPurchase[];
  stats: MarketplaceStats | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  filters: MarketplaceFilters;
  setFilters: (f: MarketplaceFilters) => void;
  setCategoryFilter: (category: MarketplaceCategory | undefined) => void;
  setSearch: (search: string) => void;
  setQualityFilter: (min: number | undefined) => void;
  setPriceRange: (min?: number, max?: number) => void;

  create: {
    mutate: (form: CreateListingForm) => void;
    mutateAsync: (form: CreateListingForm) => Promise<DataListing>;
    isLoading: boolean;
    error: Error | null;
  };

  purchase: {
    mutate: (id: string) => void;
    mutateAsync: (id: string) => Promise<DataPurchase>;
    isLoading: boolean;
    error: Error | null;
  };

  withdraw: {
    mutate: (id: string) => void;
    mutateAsync: (id: string) => Promise<void>;
    isLoading: boolean;
    error: Error | null;
  };

  revenueData: { day: string; revenue: number; transactions: number }[];
  totalRevenue: number;
  totalTransactions: number;

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMarketplace(initialFilters?: Partial<MarketplaceFilters>): UseMarketplaceReturn {
  const queryClient = useQueryClient();

  const [filters, setFiltersRaw] = useState<MarketplaceFilters>({
    ...initialFilters,
  });

  const setFilters = useCallback((f: MarketplaceFilters) => {
    setFiltersRaw(f);
  }, []);

  const setCategoryFilter = useCallback((category: MarketplaceCategory | undefined) => {
    setFiltersRaw((prev) => ({ ...prev, category }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFiltersRaw((prev) => ({ ...prev, search: search || undefined }));
  }, []);

  const setQualityFilter = useCallback((min: number | undefined) => {
    setFiltersRaw((prev) => ({ ...prev, minQuality: min }));
  }, []);

  const setPriceRange = useCallback((min?: number, max?: number) => {
    setFiltersRaw((prev) => ({ ...prev, minPrice: min, maxPrice: max }));
  }, []);

  // ---- Queries ----

  const listingsQuery = useQuery({
    queryKey: [LISTINGS_KEY, filters],
    queryFn: () =>
      api.get<DataListing[]>('/api/marketplace', {
        category: filters.category,
        status: filters.status,
        minQuality: filters.minQuality,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        search: filters.search,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const purchasesQuery = useQuery({
    queryKey: [PURCHASES_KEY],
    queryFn: () => api.get<DataPurchase[]>('/api/marketplace', { purchases: true }),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: [STATS_KEY],
    queryFn: () => api.get<MarketplaceStats>('/api/marketplace/stats'),
    staleTime: 30_000,
  });

  // ---- Revenue data query ----

  const revenueQuery = useQuery({
    queryKey: [STATS_KEY, 'revenue'],
    queryFn: () =>
      api.get<{ day: string; revenue: number; transactions: number }[]>('/api/marketplace/stats', {
        type: 'revenue',
      }),
    staleTime: 60_000,
  });

  const revenueData = useMemo(() => revenueQuery.data ?? [], [revenueQuery.data]);

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (form: CreateListingForm) => api.post<DataListing>('/api/marketplace', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LISTINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<DataPurchase>(`/api/marketplace/${id}`, { action: 'purchase' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASES_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/marketplace/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LISTINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
    },
  });

  // ---- Computed ----

  const totalRevenue = useMemo(
    () => revenueData.reduce((sum, d) => sum + d.revenue, 0),
    [revenueData],
  );
  const totalTransactions = useMemo(
    () => revenueData.reduce((sum, d) => sum + d.transactions, 0),
    [revenueData],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [LISTINGS_KEY] });
    queryClient.invalidateQueries({ queryKey: [PURCHASES_KEY] });
    queryClient.invalidateQueries({ queryKey: [STATS_KEY] });
  }, [queryClient]);

  return {
    listings: listingsQuery.data ?? [],
    purchases: purchasesQuery.data ?? [],
    stats: statsQuery.data ?? null,
    isLoading: listingsQuery.isLoading,
    isFetching: listingsQuery.isFetching,
    error: listingsQuery.error as Error | null,

    filters,
    setFilters,
    setCategoryFilter,
    setSearch,
    setQualityFilter,
    setPriceRange,

    create: {
      mutate: createMutation.mutate,
      mutateAsync: createMutation.mutateAsync,
      isLoading: createMutation.isPending,
      error: createMutation.error as Error | null,
    },

    purchase: {
      mutate: purchaseMutation.mutate,
      mutateAsync: purchaseMutation.mutateAsync,
      isLoading: purchaseMutation.isPending,
      error: purchaseMutation.error as Error | null,
    },

    withdraw: {
      mutate: withdrawMutation.mutate,
      mutateAsync: withdrawMutation.mutateAsync,
      isLoading: withdrawMutation.isPending,
      error: withdrawMutation.error as Error | null,
    },

    revenueData,
    totalRevenue,
    totalTransactions,

    refetch,
  };
}
