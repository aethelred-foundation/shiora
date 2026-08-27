'use client';

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { NetworkState, Block, BlockchainConfig } from '@/types';

export const AETHELRED_CONFIG: BlockchainConfig = {
  chainName: 'Aethelred Testnet',
  chainId: '7332',
  rpcUrl: '',
  restUrl: '',
  wsUrl: '',
  denom: 'ushio',
  bech32Prefix: 'aeth',
  blockTime: 0,
};

const HEALTH_THRESHOLDS = {
  tpsWarning: 500,
  tpsCritical: 100,
  loadWarning: 85,
  loadCritical: 95,
} as const;

export type NetworkHealth = 'healthy' | 'degraded' | 'critical' | 'unavailable';

interface NetworkStatusResponse {
  blockHeight: number;
  tps: number;
  epoch: null;
  networkLoad: number;
  aethelPrice: null;
  lastBlockTime: number;
  recentBlocks: Block[];
  chainId: string;
  source: 'evm-json-rpc';
}

export interface UseNetworkReturn {
  state: NetworkState;
  config: BlockchainConfig;
  health: NetworkHealth;
  isConnected: boolean;
  error: Error | null;
  recentBlocks: Block[];
  maxBlocks: number;
  formattedPrice: string;
  formattedTps: string;
  formattedBlockHeight: string;
  formattedLoad: string;
  averageTps: number;
  averageBlockTime: number;
  reconnect: () => void;
}

const EMPTY_NETWORK_STATE: NetworkState = {
  blockHeight: null,
  tps: null,
  epoch: null,
  networkLoad: null,
  aethelPrice: null,
  lastBlockTime: null,
};

const standaloneNetworkQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

export function useNetwork(maxBlocks: number = 50): UseNetworkReturn {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  const providedQueryClient = useContext(QueryClientContext);
  const networkQuery = useQuery(
    {
      queryKey: ['network-status'],
      queryFn: () => api.get<NetworkStatusResponse>('/api/network/status'),
      staleTime: 10_000,
      refetchInterval: 15_000,
    },
    providedQueryClient ?? standaloneNetworkQueryClient,
  );

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const state: NetworkState = useMemo(() => {
    const data = networkQuery.data;
    if (!data) return EMPTY_NETWORK_STATE;
    return {
      blockHeight: data.blockHeight,
      tps: data.tps,
      epoch: data.epoch,
      networkLoad: data.networkLoad,
      aethelPrice: data.aethelPrice,
      lastBlockTime: data.lastBlockTime,
    };
  }, [networkQuery.data]);

  const recentBlocks = useMemo(
    () => (networkQuery.data?.recentBlocks ?? []).slice(0, maxBlocks),
    [networkQuery.data?.recentBlocks, maxBlocks],
  );

  const health: NetworkHealth = useMemo(() => {
    if (state.tps === null || state.networkLoad === null || networkQuery.isError) {
      return 'unavailable';
    }
    if (
      state.tps < HEALTH_THRESHOLDS.tpsCritical ||
      state.networkLoad > HEALTH_THRESHOLDS.loadCritical
    ) {
      return 'critical';
    }
    if (
      state.tps < HEALTH_THRESHOLDS.tpsWarning ||
      state.networkLoad > HEALTH_THRESHOLDS.loadWarning
    ) {
      return 'degraded';
    }
    return 'healthy';
  }, [networkQuery.isError, state.networkLoad, state.tps]);

  const formattedPrice =
    state.aethelPrice === null ? 'Unavailable' : `$${state.aethelPrice.toFixed(4)}`;
  const formattedTps =
    state.tps === null
      ? 'Unavailable'
      : state.tps >= 1000
        ? `${(state.tps / 1000).toFixed(1)}K`
        : state.tps.toString();
  const formattedBlockHeight =
    state.blockHeight === null ? 'Unavailable' : state.blockHeight.toLocaleString('en-US');
  const formattedLoad = state.networkLoad === null ? 'Unavailable' : `${state.networkLoad}%`;

  const averageBlockTime = useMemo(() => {
    if (recentBlocks.length < 2) return 0;
    const newest = recentBlocks[0].timestamp;
    const oldest = recentBlocks[recentBlocks.length - 1].timestamp;
    const elapsed = newest - oldest;
    return elapsed > 0 ? Number((elapsed / 1000 / (recentBlocks.length - 1)).toFixed(2)) : 0;
  }, [recentBlocks]);

  const reconnect = useCallback(() => {
    void networkQuery.refetch();
  }, [networkQuery]);

  return {
    state,
    config: AETHELRED_CONFIG,
    health,
    isConnected: browserOnline && networkQuery.isSuccess && !networkQuery.isFetching,
    error: networkQuery.error instanceof Error ? networkQuery.error : null,
    recentBlocks,
    maxBlocks,
    formattedPrice,
    formattedTps,
    formattedBlockHeight,
    formattedLoad,
    averageTps: state.tps ?? 0,
    averageBlockTime,
    reconnect,
  };
}
