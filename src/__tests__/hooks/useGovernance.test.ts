import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGovernance } from '@/hooks/useGovernance';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useGovernance', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads data', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Array.isArray(result.current.proposals)).toBe(true);
    expect(Array.isArray(result.current.votes)).toBe(true);
    expect(Array.isArray(result.current.delegations)).toBe(true);
    expect(result.current.stats).toBeDefined();
  });

  it('createProposal mutation completes successfully', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.createProposal.mutate({
        title: 'Test Proposal',
        description: 'A test proposal',
        type: 'feature',
      } as any);
    });

    await waitFor(() => expect(result.current.createProposal.isLoading).toBe(false));
    expect(result.current.createProposal.error).toBeNull();
  });

  it('vote mutation completes successfully', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.vote.mutate({
        proposalId: 'prop-0001',
        support: 'for',
        reason: 'Good proposal',
      });
    });

    await waitFor(() => expect(result.current.vote.isLoading).toBe(false));
    expect(result.current.vote.error).toBeNull();
  });

  it('delegate mutation completes successfully', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.delegate.mutate('aeth1delegatee');
    });

    await waitFor(() => expect(result.current.delegate.isLoading).toBe(false));
    expect(result.current.delegate.error).toBeNull();
  });

  it('undelegate mutation completes successfully', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.undelegate.mutate();
    });

    await waitFor(() => expect(result.current.undelegate.isLoading).toBe(false));
    expect(result.current.undelegate.error).toBeNull();
  });

  it('setStatusFilter updates filter', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setStatusFilter('active');
    });

    expect(result.current.statusFilter).toBe('active');
  });

  it('exposes userVotingPower', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.userVotingPower).toBe('number');
    expect(result.current.userVotingPower).toBe(5000);
  });

  it('fetchVotes calls API and returns votes', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let votes: any;
    await act(async () => {
      votes = await result.current.fetchVotes('prop-0001');
    });

    expect(votes).toBeDefined();
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useGovernance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
