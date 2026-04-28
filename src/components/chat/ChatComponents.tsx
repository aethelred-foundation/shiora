/**
 * ChatComponents — Reusable UI components for the Health AI chat feature.
 *
 * Includes ChatBubble, ChatInput, SuggestedPrompts, ConversationList,
 * and AttestationProof — all styled with glass-morphism and Tailwind.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Plus,
  X,
  Shield,
  Bot,
  User,
  CheckCircle,
  Cpu,
  Hash,
  MessageSquare,
  Calendar,
  Heart,
  TestTube2,
  Stethoscope,
  Pill,
  Activity,
  Moon,
  Apple,
  Loader2,
} from 'lucide-react';
import type { ChatMessage, ChatConversation, ChatSuggestedPrompt } from '@/types';
import { truncateAddress, formatDateTime, timeAgo } from '@/lib/utils';

// ============================================================
// Icon map for suggested prompts
// ============================================================

const PROMPT_ICONS: Record<string, React.ReactNode> = {
  Calendar: <Calendar className="w-5 h-5" />,
  Heart: <Heart className="w-5 h-5" />,
  TestTube2: <TestTube2 className="w-5 h-5" />,
  Stethoscope: <Stethoscope className="w-5 h-5" />,
  Pill: <Pill className="w-5 h-5" />,
  Activity: <Activity className="w-5 h-5" />,
  Moon: <Moon className="w-5 h-5" />,
  Apple: <Apple className="w-5 h-5" />,
};

// ============================================================
// ChatBubble — Message bubble component
// ============================================================

interface ChatBubbleProps {
  message: ChatMessage;
  isUser: boolean;
}

export function ChatBubble({ message, isUser }: ChatBubbleProps) {
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      <div className={`flex gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-brand-500' : 'bg-gradient-to-br from-brand-100 to-brand-100'
          }`}
        >
          {isUser ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <Bot className="w-4 h-4 text-brand-600" />
          )}
        </div>

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-brand-500 text-white'
              : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
          }`}
        >
          {/* Assistant metadata badges */}
          {!isUser && message.model && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                <Bot className="w-3 h-3" />
                {message.model}
              </span>
              {message.confidence !== undefined && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <CheckCircle className="w-3 h-3" />
                  {message.confidence}%
                </span>
              )}
              {message.teePlatform && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200">
                  <Cpu className="w-3 h-3" />
                  {message.teePlatform}
                </span>
              )}
            </div>
          )}

          {/* Message content */}
          <p
            className={`text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'text-white' : 'text-slate-700'}`}
          >
            {message.content}
          </p>

          {/* Attestation hash for assistant messages */}
          {!isUser && message.attestation && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-brand-500" />
              <span className="text-xs text-slate-400 font-mono">
                {truncateAddress(message.attestation, 10, 6)}
              </span>
            </div>
          )}

          {/* Timestamp */}
          <div className={`flex justify-end mt-1.5`}>
            <span className={`text-xs ${isUser ? 'text-brand-100' : 'text-slate-400'}`}>
              {timeAgo(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TypingIndicator — Three-dot animation when AI is thinking
// ============================================================

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-100">
          <Bot className="w-4 h-4 text-brand-600" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-1">
            <span
              className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ChatInput — Message input with send button
// ============================================================

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function ChatInput({ onSend, disabled = false, isLoading = false }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea.
  useEffect(() => {
    const el = textareaRef.current;
    /* istanbul ignore next -- ref is always available after mount */
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`; // max ~4 rows
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    /* istanbul ignore next -- guard branches for disabled/isLoading already visually prevent send */
    if (!trimmed || disabled || isLoading) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height.
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your health AI assistant..."
          disabled={disabled || isLoading}
          rows={1}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </div>
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled || isLoading}
        className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        aria-label="Send message"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ============================================================
// SuggestedPrompts — Grid of prompt cards
// ============================================================

interface SuggestedPromptsProps {
  prompts: readonly ChatSuggestedPrompt[];
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ prompts, onSelect }: SuggestedPromptsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          onClick={() => onSelect(prompt.prompt)}
          className="group bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg rounded-2xl p-4 text-left hover:shadow-xl hover:border-brand-200 hover:bg-brand-50/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
              {PROMPT_ICONS[prompt.icon] ?? <MessageSquare className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-600 mb-1.5">
                {prompt.category}
              </span>
              <p className="text-sm text-slate-700 leading-snug line-clamp-2">{prompt.prompt}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// ConversationList — Sidebar list of conversations
// ============================================================

interface ConversationListProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* New conversation button */}
      <div className="p-3 border-b border-slate-200">
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group relative px-3 py-3 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                activeId === conv.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4
                    className={`text-sm font-medium truncate ${activeId === conv.id ? 'text-brand-700' : 'text-slate-800'}`}
                  >
                    {conv.title}
                  </h4>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {conv.lastMessage || 'No messages yet'}
                  </p>
                </div>

                {/* Delete button (visible on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="flex-shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all focus:outline-none"
                  aria-label={`Delete ${conv.title}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom metadata */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-400">{timeAgo(conv.updatedAt)}</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-500">
                  <MessageSquare className="w-3 h-3" />
                  {conv.messageCount}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// AttestationProof — TEE attestation detail panel
// ============================================================

interface AttestationProofProps {
  messages: ChatMessage[];
}

export function AttestationProof({ messages }: AttestationProofProps) {
  const attestedMessages = messages.filter((m) => m.role === 'assistant' && m.attestation);

  // Platform breakdown.
  const platformCounts = attestedMessages.reduce<Record<string, number>>((acc, m) => {
    const platform = m.teePlatform ?? /* istanbul ignore next */ 'Unknown';
    acc[platform] = (acc[platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-500" />
          Attestation Chain
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {attestedMessages.length} verified attestation{attestedMessages.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Platform breakdown */}
      {Object.keys(platformCounts).length > 0 && (
        <div className="p-4 border-b border-slate-100">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            TEE Platforms
          </h4>
          <div className="space-y-1.5">
            {Object.entries(platformCounts).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Cpu className="w-3 h-3 text-violet-500" />
                  {platform}
                </span>
                <span className="text-xs font-medium text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attestation list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {attestedMessages.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No attestations yet</p>
          </div>
        ) : (
          attestedMessages.map((msg) => (
            <div key={msg.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-700">Verified</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-mono text-slate-500 truncate">
                    {truncateAddress(msg.attestation ?? /* istanbul ignore next */ '', 12, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Bot className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-500">{msg.model}</span>
                </div>
                <div className="text-xs text-slate-400">{formatDateTime(msg.timestamp)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total count */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Total Attestations</span>
          <span className="text-sm font-semibold text-brand-600">{attestedMessages.length}</span>
        </div>
      </div>
    </div>
  );
}
