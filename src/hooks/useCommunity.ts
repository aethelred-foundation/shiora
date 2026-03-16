/**
 * useCommunity — Anonymous community circles, posts, and memberships.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  CommunityCircle,
  AnonymousPost,
  CircleMembership,
  CircleCategory,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const CIRCLES_KEY = 'community-circles';
const POSTS_KEY = 'community-posts';
const MEMBERSHIPS_KEY = 'community-memberships';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseCommunityReturn {
  circles: CommunityCircle[];
  posts: AnonymousPost[];
  memberships: CircleMembership[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  joinedCount: number;
  selectedCircleId: string | null;
  setSelectedCircleId: (id: string | null) => void;
  categoryFilter: CircleCategory | undefined;
  setCategoryFilter: (cat: CircleCategory | undefined) => void;

  joinCircle: {
    mutate: (id: string) => void;
    isLoading: boolean;
    error: Error | null;
  };

  leaveCircle: {
    mutate: (id: string) => void;
    isLoading: boolean;
    error: Error | null;
  };

  createPost: {
    mutate: (params: { circleId: string; content: string }) => void;
    isLoading: boolean;
    error: Error | null;
  };

  reactToPost: {
    mutate: (params: { postId: string; emoji: string }) => void;
    isLoading: boolean;
    error: Error | null;
  };

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCommunity(): UseCommunityReturn {
  const queryClient = useQueryClient();
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CircleCategory | undefined>(undefined);

  // ---- Queries ----

  const circlesQuery = useQuery({
    queryKey: [CIRCLES_KEY],
    queryFn: () => api.get<CommunityCircle[]>('/api/community/circles'),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const postsQuery = useQuery({
    queryKey: [POSTS_KEY, selectedCircleId],
    queryFn: () =>
      api.get<AnonymousPost[]>('/api/community/posts', {
        circleId: selectedCircleId ?? undefined,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const membershipsQuery = useQuery({
    queryKey: [MEMBERSHIPS_KEY],
    queryFn: () => api.get<CircleMembership[]>('/api/community/circles', { view: 'memberships' }),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const joinMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<void>(`/api/community/circles/${id}`, { action: 'join' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CIRCLES_KEY] });
      queryClient.invalidateQueries({ queryKey: [MEMBERSHIPS_KEY] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<void>(`/api/community/circles/${id}`, { action: 'leave' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CIRCLES_KEY] });
      queryClient.invalidateQueries({ queryKey: [MEMBERSHIPS_KEY] });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: (params: { circleId: string; content: string }) =>
      api.post<AnonymousPost>('/api/community/posts', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSTS_KEY] });
    },
  });

  const reactMutation = useMutation({
    mutationFn: (params: { postId: string; emoji: string }) =>
      api.post<void>(`/api/community/posts/${params.postId}/react`, { emoji: params.emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSTS_KEY] });
    },
  });

  // ---- Computed ----

  const allCircles = useMemo(() => circlesQuery.data ?? [], [circlesQuery.data]);

  const filteredCircles = useMemo(
    () => (categoryFilter ? allCircles.filter((c) => c.category === categoryFilter) : allCircles),
    [allCircles, categoryFilter],
  );

  const joinedCount = useMemo(
    () => allCircles.filter((c) => c.isJoined).length,
    [allCircles],
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CIRCLES_KEY] });
    queryClient.invalidateQueries({ queryKey: [POSTS_KEY] });
  }, [queryClient]);

  return {
    circles: filteredCircles,
    posts: postsQuery.data ?? [],
    memberships: membershipsQuery.data ?? [],
    isLoading: circlesQuery.isLoading,
    isFetching: circlesQuery.isFetching,
    error: circlesQuery.error as Error | null,
    joinedCount,
    selectedCircleId,
    setSelectedCircleId,
    categoryFilter,
    setCategoryFilter,

    joinCircle: {
      mutate: joinMutation.mutate,
      isLoading: joinMutation.isPending,
      error: joinMutation.error as Error | null,
    },

    leaveCircle: {
      mutate: leaveMutation.mutate,
      isLoading: leaveMutation.isPending,
      error: leaveMutation.error as Error | null,
    },

    createPost: {
      mutate: createPostMutation.mutate,
      isLoading: createPostMutation.isPending,
      error: createPostMutation.error as Error | null,
    },

    reactToPost: {
      mutate: reactMutation.mutate,
      isLoading: reactMutation.isPending,
      error: reactMutation.error as Error | null,
    },

    refetch,
  };
}
