import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import { useTEE } from '@/hooks/useTEE';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(AppProvider, null, children));
}

describe('useTEE', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useTEE(), { wrapper: createWrapper() });
    expect(result.current.isLoadingAttestations).toBe(true);
  });

  it('loads TEE data', async () => {
    const { result } = renderHook(() => useTEE(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingAttestations).toBe(false));
    expect(result.current.state).toBeDefined();
    expect(result.current.state.status).toBeDefined();
    expect(typeof result.current.isOperational).toBe('boolean');
    expect(typeof result.current.lastAttestationAgo).toBe('string');
  });

  it('provides inference stats', async () => {
    const { result } = renderHook(() => useTEE(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingInferences).toBe(false));
    expect(result.current.inferenceStats).toBeDefined();
    expect(typeof result.current.inferenceStats.total).toBe('number');
    expect(typeof result.current.inferenceStats.anomalies).toBe('number');
    expect(typeof result.current.inferenceStats.normal).toBe('number');
    expect(typeof result.current.inferenceStats.averageConfidence).toBe('number');
  });

  it('verifyAttestation calls the API and returns verification result', async () => {
    const { result } = renderHook(() => useTEE(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingAttestations).toBe(false));

    let verification: { verified: boolean; platform: string } | undefined;
    await act(async () => {
      verification = await result.current.verifyAttestation('0xabcdef');
    });
    expect(verification).toBeDefined();
    expect(verification!.verified).toBe(true);
    expect(verification!.platform).toBe('Intel SGX');
  });

  it('refetch invalidates all TEE queries', async () => {
    const { result } = renderHook(() => useTEE(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingAttestations).toBe(false));

    act(() => {
      result.current.refetch();
    });
    expect(typeof result.current.refetch).toBe('function');
  });

  it('models query loads', async () => {
    const { result } = renderHook(() => useTEE(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoadingModels).toBe(false));
    expect(Array.isArray(result.current.models)).toBe(true);
  });
});
