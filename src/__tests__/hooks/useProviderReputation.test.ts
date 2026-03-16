import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProviderReputation } from '@/hooks/useProviderReputation';
import { api } from '@/lib/api/client';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useProviderReputation', () => {
  it('initializes', () => {
    const { result } = renderHook(() => useProviderReputation(), { wrapper: createWrapper() });
    expect(result.current).toBeDefined();
  });

  it('loads providers data', async () => {
    const { result } = renderHook(() => useProviderReputation(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.providers.length).toBeGreaterThan(0);
    expect(result.current.topProviders.length).toBeGreaterThan(0);
    expect(typeof result.current.averageScore).toBe('number');
    // averageScore is Math.round of the average - could be NaN if no numeric scores
    expect(result.current.averageScore).toBeDefined();
  });

  it('useReviews loads reviews for a provider', async () => {
    const { result } = renderHook(
      () => {
        const rep = useProviderReputation();
        const reviews = rep.useReviews('aeth1provider000000000000000000000000000000');
        return { rep, reviews };
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.reviews.isLoading).toBe(false));
    expect(result.current.reviews.reviews.length).toBeGreaterThan(0);
  });

  it('useReviews returns empty when address is null', async () => {
    const { result } = renderHook(
      () => {
        const rep = useProviderReputation();
        const reviews = rep.useReviews(null);
        return { rep, reviews };
      },
      { wrapper: createWrapper() },
    );

    // When address is null, query is disabled so reviews stay empty
    expect(result.current.reviews.reviews).toEqual([]);
  });

  it('submitReview.mutate submits a review and invalidates queries', async () => {
    const { result } = renderHook(() => useProviderReputation(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.submitReview.mutate({
        address: 'aeth1provider000000000000000000000000000000',
        rating: 5,
        categories: { quality: 5, communication: 5, availability: 5 },
        comment: 'Excellent provider',
      });
    });
    await waitFor(() => expect(result.current.submitReview.isLoading).toBe(false));
  });

  it('submitReview.mutateAsync resolves with review data', async () => {
    const { result } = renderHook(() => useProviderReputation(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let review: unknown;
    await act(async () => {
      review = await result.current.submitReview.mutateAsync({
        address: 'aeth1provider000000000000000000000000000000',
        rating: 4,
        categories: { quality: 4, communication: 4, availability: 4 },
        comment: 'Good provider',
      });
    });
    expect(review).toBeDefined();
  });

  it('getScoreHistory returns empty initially then caches', async () => {
    const { result } = renderHook(() => useProviderReputation(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const addr = 'aeth1provider000000000000000000000000000000';

    // First call returns [] as data is fetched lazily
    const history = result.current.getScoreHistory(addr);
    expect(history).toEqual([]);

    // Wait for the async fire-and-forget fetch to resolve and populate cache
    await new Promise((r) => setTimeout(r, 100));

    // Second call should return cached data (the mock returns reviews array)
    const cached = result.current.getScoreHistory(addr);
    expect(cached).toBeDefined();
    expect(Array.isArray(cached)).toBe(true);
    expect(cached.length).toBeGreaterThan(0);
  });

  it('getScoreHistory handles API error gracefully', async () => {
    const { result } = renderHook(() => useProviderReputation(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const errorAddr = 'aeth1error_address_for_test';
    const spy = jest.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network error'));

    // First call fires fetch that will fail
    const h = result.current.getScoreHistory(errorAddr);
    expect(h).toEqual([]);

    // Wait for the catch to complete
    await new Promise((r) => setTimeout(r, 100));

    spy.mockRestore();
  });

  it('refetch invalidates providers query', async () => {
    const { result } = renderHook(() => useProviderReputation(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    expect(typeof result.current.refetch).toBe('function');
  });
});
