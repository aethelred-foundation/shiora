/**
 * useIPFS — IPFS file upload, download/decrypt, pin status, and storage metrics.
 *
 * Provides IPFS operations with react-query caching, backed by the
 * API client which calls server-side routes (fixes SBP-002).
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { IPFSFile, PinStatus, StorageMetrics, EncryptionType } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const IPFS_FILES_KEY = 'ipfs-files';
const IPFS_METRICS_KEY = 'ipfs-metrics';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseIPFSReturn {
  /** List of IPFS files. */
  files: IPFSFile[];
  /** Whether files are loading. */
  isLoadingFiles: boolean;
  /** Files query error. */
  filesError: Error | null;

  /** Storage usage metrics. */
  metrics: StorageMetrics | null;
  /** Whether metrics are loading. */
  isLoadingMetrics: boolean;
  /** Metrics query error. */
  metricsError: Error | null;

  /** Upload a file to IPFS with encryption. */
  upload: {
    mutate: (params: { file: File; encryption: EncryptionType }) => void;
    mutateAsync: (params: { file: File; encryption: EncryptionType }) => Promise<IPFSFile>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Download and decrypt a file from IPFS. Returns a blob URL. */
  download: (cid: string) => Promise<string>;

  /** Check pin status of a specific CID. */
  checkPinStatus: (cid: string) => Promise<{ cid: string; status: PinStatus; pinCount: number }>;

  /** Storage usage as a percentage (0-100). */
  usagePercent: number;

  /** Force re-fetch all IPFS queries. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * IPFS file management hook with upload, download, pin status
 * checking, and storage metrics.
 *
 * @example
 * ```tsx
 * const { files, metrics, upload, download, usagePercent } = useIPFS();
 * ```
 */
export function useIPFS(): UseIPFSReturn {
  const queryClient = useQueryClient();
  const { addNotification } = useApp();

  // ---- Files query -------------------------------------------------------

  const filesQuery = useQuery({
    queryKey: [IPFS_FILES_KEY],
    queryFn: () => api.get<IPFSFile[]>('/api/ipfs/upload'),
    staleTime: 15_000,
  });

  // ---- Metrics query -----------------------------------------------------

  const metricsQuery = useQuery({
    queryKey: [IPFS_METRICS_KEY],
    queryFn: () => api.get<StorageMetrics>('/api/ipfs/upload', { metrics: true }),
    staleTime: 30_000,
  });

  // ---- Upload mutation ---------------------------------------------------

  const uploadMutation = useMutation({
    mutationFn: (params: { file: File; encryption: EncryptionType }) =>
      api.post<IPFSFile>('/api/ipfs/upload', {
        fileName: params.file.name,
        fileSize: params.file.size,
        mimeType: params.file.type || 'application/octet-stream',
        encryption: params.encryption,
      }),
    onSuccess: (file) => {
      queryClient.invalidateQueries({ queryKey: [IPFS_FILES_KEY] });
      queryClient.invalidateQueries({ queryKey: [IPFS_METRICS_KEY] });
      addNotification(
        'success',
        'File Uploaded',
        `${file.name} uploaded to IPFS (CID: ${file.cid.slice(0, 12)}...)`,
      );
    },
    onError: (err: Error) => {
      addNotification('error', 'Upload Failed', err.message);
    },
  });

  // ---- Download function ------------------------------------------------

  const download = useCallback(async (cid: string): Promise<string> => {
    const result = await api.get<{ url: string }>(`/api/ipfs/${cid}`);
    return result.url;
  }, []);

  // ---- Pin status check -------------------------------------------------

  const checkPinStatusFn = useCallback(
    async (cid: string): Promise<{ cid: string; status: PinStatus; pinCount: number }> => {
      return api.get<{ cid: string; status: PinStatus; pinCount: number }>(`/api/ipfs/${cid}`, {
        pinStatus: true,
      });
    },
    [],
  );

  // ---- Computed usage percent --------------------------------------------

  const usagePercent = useMemo(() => {
    if (!metricsQuery.data) return 0;
    const { totalUsed, totalQuota } = metricsQuery.data;
    return totalQuota > 0 ? parseFloat(((totalUsed / totalQuota) * 100).toFixed(1)) : 0;
  }, [metricsQuery.data]);

  // ---- Refetch -----------------------------------------------------------

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [IPFS_FILES_KEY] });
    queryClient.invalidateQueries({ queryKey: [IPFS_METRICS_KEY] });
  }, [queryClient]);

  return {
    files: filesQuery.data ?? [],
    isLoadingFiles: filesQuery.isLoading,
    filesError: filesQuery.error as Error | null,

    metrics: metricsQuery.data ?? null,
    isLoadingMetrics: metricsQuery.isLoading,
    metricsError: metricsQuery.error as Error | null,

    upload: {
      mutate: uploadMutation.mutate,
      mutateAsync: uploadMutation.mutateAsync,
      isLoading: uploadMutation.isPending,
      error: uploadMutation.error as Error | null,
    },

    download,
    checkPinStatus: checkPinStatusFn,

    usagePercent,

    refetch,
  };
}
