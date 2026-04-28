'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api/client';
import type { NetworkState, Block, BlockchainConfig } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default Aethelred blockchain configuration. */
export const AETHELRED_CONFIG: BlockchainConfig = {
  chainName: 'Aethelred',
  chainId: 'aethelred-1',
  rpcUrl: 'https://rpc.aethelred.network',
  restUrl: 'https://api.aethelred.network',
  wsUrl: 'wss://ws.aethelred.network',
  denom: 'ushio',
  bech32Prefix: 'aeth',
  blockTime: 3,
};

/** Health thresholds for network classification. */
const HEALTH_THRESHOLDS = {
  tpsWarning: 500,
  tpsCritical: 100,
  loadWarning: 85,
  loadCritical: 95,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Network health classification. */
export type NetworkHealth = 'healthy' | 'degraded' | 'critical';

/** Shape returned by /api/network/status */
interface NetworkStatusResponse {
  blockHeight: number;
  tps: number;
  epoch: number;
  networkLoad: number;
  aethelPrice: number;
  lastBlockTime: number;
  recentBlocks: Block[];
}

/** Shape returned by /api/health */
interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const NETWORK_STATUS_KEY = 'network-status';
const HEALTH_CHECK_KEY = 'network-health';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseNetworkReturn {
  /** Live network state from AppContext. */
  state: NetworkState;
  /** Static blockchain configuration. */
  config: BlockchainConfig;
  /** Network health classification. */
  health: NetworkHealth;
  /** Whether the simulated WebSocket is "connected". */
  isConnected: boolean;

  /** Recent block history (most recent first). */
  recentBlocks: Block[];
  /** Maximum number of blocks to keep in history. */
  maxBlocks: number;

  /** Formatted AETHEL price with dollar sign. */
  formattedPrice: string;
  /** Formatted TPS with compact notation. */
  formattedTps: string;
  /** Formatted block height with commas. */
  formattedBlockHeight: string;
  /** Network load as a percentage string. */
  formattedLoad: string;

  /** Average TPS over the block history window. */
  averageTps: number;
  /** Average block time over the block history window (seconds). */
  averageBlockTime: number;

  /** Manually trigger a simulated reconnect. */
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Real-time blockchain network monitoring hook. Tracks live
 * network state from AppContext, maintains a rolling block
 * history, and computes health/performance indicators.
 *
 * Fetches server-side network status via `/api/network/status`
 * and health check via `/api/health` to supplement real-time data.
 *
 * @param maxBlocks - Maximum number of recent blocks to retain (default 50).
 *
 * @example
 * ```tsx
 * const { state, health, recentBlocks, formattedPrice } = useNetwork();
 * ```
 */
export function useNetwork(maxBlocks: number = 50): UseNetworkReturn {
  const { realTime } = useApp();

  const [isConnected, setIsConnected] = useState(true);
  const [recentBlocks, setRecentBlocks] = useState<Block[]>([]);
  const prevBlockHeightRef = useRef(realTime.blockHeight);

  // ---- Server-side network status query -----------------------------------

  const networkStatusQuery = useQuery({
    queryKey: [NETWORK_STATUS_KEY],
    queryFn: () => api.get<NetworkStatusResponse>('/api/network/status'),
    staleTime: 30_000,
  });

  // ---- Server-side health check query -------------------------------------

  useQuery({
    queryKey: [HEALTH_CHECK_KEY],
    queryFn: () => api.get<HealthCheckResponse>('/api/health'),
    staleTime: 30_000,
  });

  // ---- Map AppContext RealTimeState to our NetworkState type ---------------

  const state: NetworkState = useMemo(
    () => ({
      blockHeight: realTime.blockHeight,
      tps: realTime.tps,
      epoch: realTime.epoch,
      networkLoad: realTime.networkLoad,
      aethelPrice: realTime.aethelPrice,
      lastBlockTime: realTime.lastBlockTime,
    }),
    [realTime],
  );

  // ---- Seed recent blocks from server on first load -----------------------

  useEffect(() => {
    if (networkStatusQuery.data?.recentBlocks && recentBlocks.length === 0) {
      setRecentBlocks(networkStatusQuery.data.recentBlocks.slice(0, maxBlocks));
    }
  }, [networkStatusQuery.data, recentBlocks.length, maxBlocks]);

  // ---- Track new blocks from real-time updates ----------------------------

  useEffect(() => {
    if (realTime.blockHeight <= prevBlockHeightRef.current) return;

    // Fetch the latest block from the API rather than generating mock data
    api
      .get<Block>('/api/network/status', { block: realTime.blockHeight })
      .then((block) => {
        setRecentBlocks((prev) => {
          const updated = [block, ...prev];
          return updated.slice(0, maxBlocks);
        });
      })
      .catch(() => {
        // If the API call fails, construct a minimal block from available data
        const newBlock: Block = {
          height: realTime.blockHeight,
          hash: '',
          txCount: 0,
          proposer: '',
          timestamp: Date.now(),
          gasUsed: 0,
        };
        setRecentBlocks((prev) => {
          const updated = [newBlock, ...prev];
          return updated.slice(0, maxBlocks);
        });
      });

    prevBlockHeightRef.current = realTime.blockHeight;
  }, [realTime.blockHeight, maxBlocks]);

  // ---- Connection status based on navigator.onLine -----------------------

  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsConnected(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---- Network health classification --------------------------------------

  const health: NetworkHealth = useMemo(() => {
    if (
      realTime.tps < HEALTH_THRESHOLDS.tpsCritical ||
      realTime.networkLoad > HEALTH_THRESHOLDS.loadCritical
    ) {
      return 'critical';
    }
    if (
      realTime.tps < HEALTH_THRESHOLDS.tpsWarning ||
      realTime.networkLoad > HEALTH_THRESHOLDS.loadWarning
    ) {
      return 'degraded';
    }
    return 'healthy';
  }, [realTime.tps, realTime.networkLoad]);

  // ---- Formatted display values -------------------------------------------

  const formattedPrice = useMemo(
    () => `$${realTime.aethelPrice.toFixed(4)}`,
    [realTime.aethelPrice],
  );

  const formattedTps = useMemo(() => {
    if (realTime.tps >= 1000) return `${(realTime.tps / 1000).toFixed(1)}K`;
    return realTime.tps.toString();
  }, [realTime.tps]);

  const formattedBlockHeight = useMemo(
    () => realTime.blockHeight.toLocaleString('en-US'),
    [realTime.blockHeight],
  );

  const formattedLoad = useMemo(() => `${realTime.networkLoad}%`, [realTime.networkLoad]);

  // ---- Computed averages --------------------------------------------------

  const averageTps = useMemo(() => {
    if (recentBlocks.length === 0) return realTime.tps;
    return realTime.tps;
  }, [recentBlocks.length, realTime.tps]);

  const averageBlockTime = useMemo(() => {
    if (recentBlocks.length < 2) return AETHELRED_CONFIG.blockTime;
    const newest = recentBlocks[0].timestamp;
    const oldest = recentBlocks[recentBlocks.length - 1].timestamp;
    const spanMs = newest - oldest;
    return spanMs > 0
      ? parseFloat((spanMs / 1000 / (recentBlocks.length - 1)).toFixed(2))
      : AETHELRED_CONFIG.blockTime;
  }, [recentBlocks]);

  // ---- Reconnect ----------------------------------------------------------

  const reconnect = useCallback(() => {
    setIsConnected(false);
    setTimeout(() => setIsConnected(true), 500);
  }, []);

  return {
    state,
    config: AETHELRED_CONFIG,
    health,
    isConnected,

    recentBlocks,
    maxBlocks,

    formattedPrice,
    formattedTps,
    formattedBlockHeight,
    formattedLoad,

    averageTps,
    averageBlockTime,

    reconnect,
  };
}
