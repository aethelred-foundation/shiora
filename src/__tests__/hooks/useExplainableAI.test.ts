import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useExplainableAI } from '@/hooks/useExplainableAI';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useExplainableAI', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useExplainableAI(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads data', async () => {
    const { result } = renderHook(() => useExplainableAI(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
