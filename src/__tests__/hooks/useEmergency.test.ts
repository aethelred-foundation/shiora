import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmergency } from '@/hooks/useEmergency';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useEmergency', () => {
  it('initializes with loading', () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('loads emergency card data', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.emergencyCard).not.toBeNull();
    expect(result.current.emergencyCard?.bloodType).toBeDefined();
  });

  it('loads care team', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isCareTeamLoading).toBe(false));
    expect(result.current.careTeam.length).toBeGreaterThan(0);
  });

  it('loads protocols', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isProtocolsLoading).toBe(false));
    expect(result.current.protocols.length).toBeGreaterThan(0);
  });

  it('loads triage history', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isTriageHistoryLoading).toBe(false));
    expect(result.current.triageHistory.length).toBeGreaterThan(0);
  });

  it('loads handoffs', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isHandoffsLoading).toBe(false));
    expect(result.current.handoffs.length).toBeGreaterThan(0);
  });

  it('runTriage mutation completes successfully', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.runTriage.mutate({
        symptoms: ['chest_pain', 'shortness_of_breath'],
        severity: 'urgent',
        notes: 'Experiencing sharp chest pain',
      } as any);
    });

    await waitFor(() => expect(result.current.runTriage.isLoading).toBe(false));
    expect(result.current.runTriage.error).toBeNull();
  });

  it('addCareTeamMember mutation completes successfully', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.addCareTeamMember.mutate({
        name: 'Dr. New Member',
        role: 'specialist',
        specialty: 'Cardiology',
        phone: '555-9999',
      });
    });

    await waitFor(() => expect(result.current.addCareTeamMember.isLoading).toBe(false));
    expect(result.current.addCareTeamMember.error).toBeNull();
  });

  it('initiateHandoff mutation completes successfully', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.initiateHandoff.mutate({
        fromProvider: 'Dr. A',
        toProvider: 'Dr. B',
        patientSummary: 'Patient handoff summary',
      });
    });

    await waitFor(() => expect(result.current.initiateHandoff.isLoading).toBe(false));
    expect(result.current.initiateHandoff.error).toBeNull();
  });

  it('refetch triggers without error', async () => {
    const { result } = renderHook(() => useEmergency(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});
