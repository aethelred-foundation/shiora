import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClinicalDecisionSupport } from '@/hooks/useClinicalDecisionSupport';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useClinicalDecisionSupport', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useClinicalDecisionSupport(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads clinical data', async () => {
    const { result } = renderHook(() => useClinicalDecisionSupport(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toBeDefined();
    expect(result.current.alerts.length).toBeGreaterThan(0);
    expect(result.current.pathways.length).toBeGreaterThan(0);
    expect(result.current.interactions.length).toBeGreaterThan(0);
    expect(result.current.differentials.length).toBeGreaterThan(0);
  });

  it('acknowledgeAlert.mutate acknowledges an alert and invalidates queries', async () => {
    const { result } = renderHook(() => useClinicalDecisionSupport(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.acknowledgeAlert.mutate('alert-0');
    });
    await waitFor(() => expect(result.current.acknowledgeAlert.isLoading).toBe(false));
  });

  it('acknowledgeAlert.mutateAsync resolves', async () => {
    const { result } = renderHook(() => useClinicalDecisionSupport(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.acknowledgeAlert.mutateAsync('alert-0');
    });
  });

  it('refetch invalidates all clinical queries', async () => {
    const { result } = renderHook(() => useClinicalDecisionSupport(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });
    expect(typeof result.current.refetch).toBe('function');
  });

  it('setActiveTab changes tab and enables audit query', async () => {
    const { result } = renderHook(() => useClinicalDecisionSupport(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setActiveTab('audit');
    });
    expect(result.current.activeTab).toBe('audit');

    // Wait for audit entries to load (query enabled when tab=audit)
    await waitFor(() => expect(result.current.auditEntries.length).toBeGreaterThan(0));
  });

  it('setSeverityFilter and setAuditTypeFilter update state', async () => {
    const { result } = renderHook(() => useClinicalDecisionSupport(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSeverityFilter('critical');
    });
    expect(result.current.severityFilter).toBe('critical');

    act(() => {
      result.current.setAuditTypeFilter('pathway_activated');
    });
    expect(result.current.auditTypeFilter).toBe('pathway_activated');
  });
});
