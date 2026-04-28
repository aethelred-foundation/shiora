// ============================================================
// Tests for src/hooks/useZKP.ts
// ============================================================

import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// We test the hook's mock data generation logic and return shape.
// Since the hook uses react-query, we need a wrapper.

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// Dynamic import to work around potential module-level issues
let useZKP: typeof import('@/hooks/useZKP').useZKP;

beforeAll(async () => {
  const mod = await import('@/hooks/useZKP');
  useZKP = mod.useZKP;
});

describe('useZKP', () => {
  it('returns claims array after loading', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(Array.isArray(result.current.claims)).toBe(true);
    expect(result.current.claims.length).toBeGreaterThan(0);
  });

  it('returns proofs array after loading', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isProofsLoading).toBe(false);
    });
    expect(Array.isArray(result.current.proofs)).toBe(true);
    expect(result.current.proofs.length).toBeGreaterThan(0);
  });

  it('computes verifiedCount correctly', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    const manualCount = result.current.claims.filter((c) => c.status === 'verified').length;
    expect(result.current.verifiedCount).toBe(manualCount);
  });

  it('computes pendingCount correctly', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    const manualCount = result.current.claims.filter((c) => c.status === 'proving').length;
    expect(result.current.pendingCount).toBe(manualCount);
  });

  it('each claim has a valid claimType', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    const validTypes = [
      'age_range',
      'condition_present',
      'medication_active',
      'data_quality',
      'provider_verified',
      'fertility_window',
    ];
    result.current.claims.forEach((claim) => {
      expect(validTypes).toContain(claim.claimType);
    });
  });

  it('each claim has required fields', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    result.current.claims.forEach((claim) => {
      expect(claim.id).toBeDefined();
      expect(claim.claimType).toBeDefined();
      expect(claim.description).toBeDefined();
      expect(claim.status).toBeDefined();
      expect(claim.createdAt).toBeDefined();
    });
  });

  it('verified claims have a proof object', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    const verifiedClaims = result.current.claims.filter((c) => c.status === 'verified');
    verifiedClaims.forEach((claim) => {
      expect(claim.proof).toBeDefined();
      expect(claim.proof?.verified).toBe(true);
      expect(claim.proof?.proofHash).toBeDefined();
    });
  });

  it('submitClaim mutation completes successfully', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.submitClaim.mutate({
        type: 'age_range',
        description: 'Age is within 25-35 range',
      });
    });

    await waitFor(() => expect(result.current.mutations.submitClaim.isLoading).toBe(false));
  });

  it('generateProof mutation completes successfully', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.generateProof.mutate('claim-0002');
    });

    await waitFor(() => expect(result.current.mutations.generateProof.isLoading).toBe(false));
  });

  it('verifyProof mutation completes successfully', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.mutations.verifyProof.mutate('proof-0');
    });

    await waitFor(() => expect(result.current.mutations.verifyProof.isLoading).toBe(false));
  });

  it('exposes refetch function', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    expect(typeof result.current.refetch).toBe('function');

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });

  it('proofs have valid structure', async () => {
    const { result } = renderHook(() => useZKP(), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(result.current.isProofsLoading).toBe(false);
    });
    result.current.proofs.forEach((proof) => {
      expect(proof.id).toBeDefined();
      expect(proof.claimType).toBeDefined();
      expect(proof.proofHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(proof.createdAt).toBeGreaterThan(0);
    });
  });
});
