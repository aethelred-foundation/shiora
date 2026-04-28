import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMarketplace } from '@/hooks/useMarketplace';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useMarketplace', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads listings and purchases', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.listings)).toBe(true);
    expect(Array.isArray(result.current.purchases)).toBe(true);
    expect(result.current.listings.length).toBeGreaterThan(0);
  });

  it('create mutation completes successfully', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.create.mutate({
        title: 'Test Dataset',
        description: 'A test dataset listing',
        category: 'menstrual_cycles',
        price: 25,
        dataPoints: 1000,
        anonymizationLevel: 'differential-privacy',
      } as any);
    });

    await waitFor(() => expect(result.current.create.isLoading).toBe(false));
    expect(result.current.create.error).toBeNull();
  });

  it('purchase mutation completes successfully', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.purchase.mutate('listing-0001');
    });

    await waitFor(() => expect(result.current.purchase.isLoading).toBe(false));
    expect(result.current.purchase.error).toBeNull();
  });

  it('withdraw mutation completes successfully', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.withdraw.mutate('listing-0002');
    });

    await waitFor(() => expect(result.current.withdraw.isLoading).toBe(false));
    expect(result.current.withdraw.error).toBeNull();
  });

  it('setCategoryFilter updates filters', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setCategoryFilter('menstrual_cycles');
    });

    expect(result.current.filters.category).toBe('menstrual_cycles');
  });

  it('setSearch updates filters', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearch('fertility');
    });

    expect(result.current.filters.search).toBe('fertility');
  });

  it('setSearch with empty string sets search to undefined', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSearch('something');
    });
    expect(result.current.filters.search).toBe('something');

    act(() => {
      result.current.setSearch('');
    });
    expect(result.current.filters.search).toBeUndefined();
  });

  it('setQualityFilter updates filters', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setQualityFilter(90);
    });

    expect(result.current.filters.minQuality).toBe(90);
  });

  it('setPriceRange updates filters', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPriceRange(10, 100);
    });

    expect(result.current.filters.minPrice).toBe(10);
    expect(result.current.filters.maxPrice).toBe(100);
  });

  it('setFilters replaces full filter state', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ category: 'lab_results', search: 'test' });
    });

    expect(result.current.filters.category).toBe('lab_results');
    expect(result.current.filters.search).toBe('test');
  });

  it('exposes revenue data and computed totals', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(Array.isArray(result.current.revenueData)).toBe(true);
    expect(typeof result.current.totalRevenue).toBe('number');
    expect(typeof result.current.totalTransactions).toBe('number');
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
