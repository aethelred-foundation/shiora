/**
 * useWearables — Wearable device integration with sync and data points.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  WearableDevice,
  WearableDataPoint,
  WearableSyncBatch,
  WearableProvider,
  WearableMetricType,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const DEVICES_KEY = 'wearable-devices';
const DATA_POINTS_KEY = 'wearable-data-points';
const SYNC_BATCHES_KEY = 'wearable-sync-batches';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseWearablesReturn {
  devices: WearableDevice[];
  dataPoints: WearableDataPoint[];
  syncBatches: WearableSyncBatch[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string | null) => void;
  selectedMetric: WearableMetricType;
  setSelectedMetric: (metric: WearableMetricType) => void;

  connect: {
    mutate: (provider: WearableProvider) => void;
    mutateAsync: (provider: WearableProvider) => Promise<WearableDevice>;
    isLoading: boolean;
    error: Error | null;
  };

  disconnect: {
    mutate: (deviceId: string) => void;
    mutateAsync: (deviceId: string) => Promise<void>;
    isLoading: boolean;
    error: Error | null;
  };

  sync: {
    mutate: (deviceId: string) => void;
    mutateAsync: (deviceId: string) => Promise<WearableSyncBatch>;
    isLoading: boolean;
    error: Error | null;
  };

  syncAllDevices: () => void;
  connectedDeviceCount: number;
  totalDataPoints: number;

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWearables(): UseWearablesReturn {
  const queryClient = useQueryClient();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<WearableMetricType>('heart_rate');

  // ---- Queries ----

  const devicesQuery = useQuery({
    queryKey: [DEVICES_KEY],
    queryFn: () => api.get<WearableDevice[]>('/api/wearables'),
    staleTime: 30_000,
  });

  const dataPointsQuery = useQuery({
    queryKey: [DATA_POINTS_KEY, selectedDeviceId, selectedMetric],
    queryFn: () =>
      api.get<WearableDataPoint[]>('/api/wearables', {
        deviceId: selectedDeviceId ?? undefined,
        metric: selectedMetric,
        view: 'data-points',
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const syncBatchesQuery = useQuery({
    queryKey: [SYNC_BATCHES_KEY],
    queryFn: () => api.get<WearableSyncBatch[]>('/api/wearables/sync'),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const connectMutation = useMutation({
    mutationFn: (provider: WearableProvider) =>
      api.post<WearableDevice>(`/api/wearables/${provider}`, { action: 'connect' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (deviceId: string) =>
      api.post<void>(`/api/wearables/${deviceId}`, { action: 'disconnect' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (deviceId: string) =>
      api.post<WearableSyncBatch>('/api/wearables/sync', { deviceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
      queryClient.invalidateQueries({ queryKey: [SYNC_BATCHES_KEY] });
      queryClient.invalidateQueries({ queryKey: [DATA_POINTS_KEY] });
    },
  });

  // ---- Computed ----

  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);
  const connectedDeviceCount = devices.filter(
    (d) => d.status === 'connected' || d.status === 'syncing',
  ).length;
  const totalDataPoints = devices.reduce((sum, d) => sum + d.dataPointsSynced, 0);

  const syncAllDevices = useCallback(() => {
    devices.filter((d) => d.status === 'connected').forEach((d) => syncMutation.mutate(d.id));
  }, [devices, syncMutation]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    queryClient.invalidateQueries({ queryKey: [DATA_POINTS_KEY] });
    queryClient.invalidateQueries({ queryKey: [SYNC_BATCHES_KEY] });
  }, [queryClient]);

  return {
    devices,
    dataPoints: dataPointsQuery.data ?? [],
    syncBatches: syncBatchesQuery.data ?? [],
    isLoading: devicesQuery.isLoading,
    isFetching: devicesQuery.isFetching,
    error: devicesQuery.error as Error | null,

    selectedDeviceId,
    setSelectedDeviceId,
    selectedMetric,
    setSelectedMetric,

    connect: {
      mutate: connectMutation.mutate,
      mutateAsync: connectMutation.mutateAsync,
      isLoading: connectMutation.isPending,
      error: connectMutation.error as Error | null,
    },

    disconnect: {
      mutate: disconnectMutation.mutate,
      mutateAsync: disconnectMutation.mutateAsync,
      isLoading: disconnectMutation.isPending,
      error: disconnectMutation.error as Error | null,
    },

    sync: {
      mutate: syncMutation.mutate,
      mutateAsync: syncMutation.mutateAsync,
      isLoading: syncMutation.isPending,
      error: syncMutation.error as Error | null,
    },

    syncAllDevices,
    connectedDeviceCount,
    totalDataPoints,

    refetch,
  };
}
