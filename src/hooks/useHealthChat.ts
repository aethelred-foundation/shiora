'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { CHAT_SUGGESTED_PROMPTS } from '@/lib/constants';

import type {
  ChatMessage,
  ChatConversation,
  ChatModelConfig,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const CONVERSATIONS_KEY = 'chat-conversations';
const MESSAGES_KEY = 'chat-messages';

// ---------------------------------------------------------------------------
// Active model config
// ---------------------------------------------------------------------------

const ACTIVE_MODEL: ChatModelConfig = {
  id: 'health-transformer',
  name: 'Health Transformer',
  version: 'v3.0',
  maxTokens: 4096,
  teePlatform: 'Intel SGX',
  capabilities: [
    'cycle-analysis',
    'lab-interpretation',
    'medication-review',
    'wellness-summary',
    'fertility-prediction',
    'anomaly-explanation',
  ],
};

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseHealthChatReturn {
  /** All conversations. */
  conversations: ChatConversation[];
  /** Currently active conversation. */
  activeConversation: ChatConversation | null;
  /** Messages in the active conversation. */
  messages: ChatMessage[];
  /** Loading state for conversation list. */
  isLoadingConversations: boolean;
  /** Loading state for messages. */
  isLoadingMessages: boolean;
  /** Whether a message is being sent. */
  isSending: boolean;
  /** Error from any query. */
  error: Error | null;
  /** Suggested prompts for empty state. */
  suggestedPrompts: typeof CHAT_SUGGESTED_PROMPTS;
  /** Currently active AI model config. */
  activeModel: ChatModelConfig;
  /** Set the active conversation by ID (null to deselect). */
  setActiveConversation: (id: string | null) => void;
  /** Send a message mutation. */
  sendMessage: {
    mutate: (content: string) => void;
    mutateAsync: (content: string) => Promise<ChatMessage>;
    isLoading: boolean;
  };
  /** Create a new conversation mutation. */
  createConversation: {
    mutate: () => void;
    mutateAsync: () => Promise<ChatConversation>;
  };
  /** Delete a conversation mutation. */
  deleteConversation: {
    mutate: (id: string) => void;
  };
  /** Total attestation count across all conversations. */
  totalAttestations: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHealthChat(): UseHealthChatReturn {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  // ---- Conversations query ------------------------------------------------

  const convQuery = useQuery({
    queryKey: [CONVERSATIONS_KEY],
    queryFn: () => api.get<ChatConversation[]>('/api/chat/conversations'),
    staleTime: 30_000,
  });

  const conversations = useMemo(() => convQuery.data ?? [], [convQuery.data]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // ---- Messages query -----------------------------------------------------

  const msgQuery = useQuery({
    queryKey: [MESSAGES_KEY, activeId],
    queryFn: () => api.get<ChatMessage[]>(`/api/chat/${activeId}`),
    enabled: activeId !== null,
    staleTime: 30_000,
  });

  const messages = msgQuery.data ?? [];

  // ---- Send message mutation ----------------------------------------------

  const sendMutation = useMutation({
    mutationFn: (content: string) => {
      if (!activeId) throw new Error('No active conversation');
      return api.post<ChatMessage>(`/api/chat/${activeId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MESSAGES_KEY, activeId] });
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
    },
  });

  // ---- Create conversation mutation ---------------------------------------

  const createMutation = useMutation({
    mutationFn: () => api.post<ChatConversation>('/api/chat/conversations'),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
      setActiveId(newConv.id);
    },
  });

  // ---- Delete conversation mutation ---------------------------------------

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/chat/${id}`),
    onSuccess: (_: void, deletedId: string) => {
      if (activeId === deletedId) setActiveId(null);
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
    },
  });

  // ---- Set active conversation --------------------------------------------

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  // ---- Total attestations -------------------------------------------------

  const totalAttestations = useMemo(
    () => conversations.reduce((sum, c) => sum + c.attestationCount, 0),
    [conversations],
  );

  // ---- Error aggregation --------------------------------------------------

  const error = (convQuery.error ?? msgQuery.error ?? sendMutation.error ?? null) as Error | null;

  return {
    conversations,
    activeConversation,
    messages,
    isLoadingConversations: convQuery.isLoading,
    isLoadingMessages: msgQuery.isLoading,
    isSending: sendMutation.isPending,
    error,
    suggestedPrompts: CHAT_SUGGESTED_PROMPTS,
    activeModel: ACTIVE_MODEL,
    setActiveConversation,
    sendMessage: {
      mutate: sendMutation.mutate,
      mutateAsync: sendMutation.mutateAsync,
      isLoading: sendMutation.isPending,
    },
    createConversation: {
      mutate: () => createMutation.mutate(),
      mutateAsync: createMutation.mutateAsync,
    },
    deleteConversation: {
      mutate: deleteMutation.mutate,
    },
    totalAttestations,
  };
}
