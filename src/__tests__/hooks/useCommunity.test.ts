import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCommunity } from '@/hooks/useCommunity';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useCommunity', () => {
  it('initializes', () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    expect(result.current).toBeDefined();
    expect(result.current.circles).toEqual([]);
    expect(result.current.selectedCircleId).toBeNull();
  });

  it('loads circles and posts', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.circles.length).toBeGreaterThan(0);
    expect(result.current.posts.length).toBeGreaterThan(0);
  });

  it('loads memberships', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.memberships)).toBe(true);
  });

  it('joinCircle mutation completes successfully', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.joinCircle.mutate('circle-0005');
    });

    await waitFor(() => expect(result.current.joinCircle.isLoading).toBe(false));
    expect(result.current.joinCircle.error).toBeNull();
  });

  it('leaveCircle mutation completes successfully', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.leaveCircle.mutate('circle-0001');
    });

    await waitFor(() => expect(result.current.leaveCircle.isLoading).toBe(false));
    expect(result.current.leaveCircle.error).toBeNull();
  });

  it('createPost mutation completes successfully', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.createPost.mutate({
        circleId: 'circle-0001',
        content: 'This is a test post about my journey.',
      });
    });

    await waitFor(() => expect(result.current.createPost.isLoading).toBe(false));
    expect(result.current.createPost.error).toBeNull();
  });

  it('reactToPost mutation completes successfully', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.reactToPost.mutate({
        postId: 'post-0001',
        emoji: 'heart',
      });
    });

    await waitFor(() => expect(result.current.reactToPost.isLoading).toBe(false));
    expect(result.current.reactToPost.error).toBeNull();
  });

  it('setSelectedCircleId updates selection', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedCircleId('circle-0001');
    });

    expect(result.current.selectedCircleId).toBe('circle-0001');

    act(() => {
      result.current.setSelectedCircleId(null);
    });

    expect(result.current.selectedCircleId).toBeNull();
  });

  it('setCategoryFilter filters circles by category', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const allCount = result.current.circles.length;

    act(() => {
      result.current.setCategoryFilter('fertility');
    });

    expect(result.current.categoryFilter).toBe('fertility');
    expect(result.current.circles.length).toBeLessThanOrEqual(allCount);
  });

  it('joinedCount is computed correctly', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.joinedCount).toBe('number');
    expect(result.current.joinedCount).toBeGreaterThan(0);
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useCommunity(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
