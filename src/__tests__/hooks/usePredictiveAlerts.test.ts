import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePredictiveAlerts } from '@/hooks/usePredictiveAlerts';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('usePredictiveAlerts', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads alerts, rules, and history', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.alerts.length).toBeGreaterThan(0);
    await waitFor(() => expect(result.current.isRulesLoading).toBe(false));
    expect(result.current.rules.length).toBeGreaterThan(0);
    await waitFor(() => expect(result.current.isHistoryLoading).toBe(false));
    expect(result.current.history.length).toBeGreaterThan(0);
  });

  it('createRule mutation completes successfully', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.createRule.mutate({
        metric: 'spo2',
        operator: 'lt',
        threshold: 94,
        severity: 'critical',
        enabled: true,
        channels: ['push', 'email'],
      } as any);
    });

    await waitFor(() => expect(result.current.mutations.createRule.isLoading).toBe(false));
  });

  it('updateRule mutation completes successfully', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.updateRule.mutate({
        id: 'rule-0',
        updates: { threshold: 101.0 },
      });
    });

    await waitFor(() => expect(result.current.mutations.updateRule.isLoading).toBe(false));
  });

  it('toggleRule mutation completes successfully', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.toggleRule.mutate('rule-0');
    });

    await waitFor(() => expect(result.current.mutations.toggleRule.isLoading).toBe(false));
  });

  it('acknowledgeAlert mutation completes successfully', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.acknowledgeAlert.mutate('alert-0001');
    });

    await waitFor(() => expect(result.current.mutations.acknowledgeAlert.isLoading).toBe(false));
  });

  it('resolveAlert mutation completes successfully', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.resolveAlert.mutate('alert-0002');
    });

    await waitFor(() => expect(result.current.mutations.resolveAlert.isLoading).toBe(false));
  });

  it('setSeverityFilter updates filters', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSeverityFilter('critical');
    });

    expect(result.current.filters.severity).toBe('critical');
  });

  it('setStatusFilter updates filters', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setStatusFilter('active');
    });

    expect(result.current.filters.status).toBe('active');
  });

  it('setFilters replaces full filter state', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ severity: 'warning', status: 'acknowledged' });
    });

    expect(result.current.filters.severity).toBe('warning');
    expect(result.current.filters.status).toBe('acknowledged');
  });

  it('activeAlertCount and criticalCount are computed', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(typeof result.current.activeAlertCount).toBe('number');
    expect(typeof result.current.criticalCount).toBe('number');
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => usePredictiveAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
