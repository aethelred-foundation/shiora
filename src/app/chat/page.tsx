/**
 * Shiora on Aethelred — TEE-Verified Health Chat
 *
 * Three-panel layout: conversation sidebar | chat area | attestation proof.
 * Responsive: collapses to two-panel on tablet, single on mobile.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Bot,
  Shield,
  Brain,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  Cpu,
} from 'lucide-react';

import { TopNav, Footer, ToastContainer, SearchOverlay } from '@/components/ui/SharedComponents';
import {
  ChatBubble,
  ChatInput,
  SuggestedPrompts,
  ConversationList,
  AttestationProof,
  TypingIndicator,
} from '@/components/chat/ChatComponents';
import { useHealthChat } from '@/hooks/useHealthChat';

// ============================================================
// Chat Page
// ============================================================

export default function ChatPage() {
  const {
    conversations,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    suggestedPrompts,
    activeModel,
    setActiveConversation,
    sendMessage,
    createConversation,
    deleteConversation,
    totalAttestations,
  } = useHealthChat();

  // Panel visibility toggles.
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAttestation, setShowAttestation] = useState(true);

  // Auto-scroll to bottom on new messages.
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Handle send message.
  const handleSend = useCallback(
    (content: string) => {
      if (!activeConversation) {
        // Create a new conversation, then send.
        createConversation.mutateAsync().then(() => {
          // Small delay to allow state to update.
          setTimeout(() => sendMessage.mutate(content), 100);
        });
      } else {
        sendMessage.mutate(content);
      }
    },
    [activeConversation, createConversation, sendMessage],
  );

  // Handle suggested prompt selection.
  const handlePromptSelect = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-surface-100 flex flex-col">
      <TopNav />

      <main className="flex-1 flex overflow-hidden">
        {/* ─── Left Sidebar (Conversation List) ─── */}
        {showSidebar && (
          <aside className="w-80 border-r border-slate-200 bg-white flex-shrink-0 hidden lg:flex flex-col">
            {/* Sidebar header */}
            <div className="p-4 border-b border-slate-200 bg-white/70 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-500" />
                  Conversations
                </h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors lg:hidden"
                  aria-label="Close sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation list */}
            {isLoadingConversations ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-brand-100" />
                  <div className="w-32 h-3 bg-brand-100 rounded" />
                </div>
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                activeId={activeConversation?.id ?? null}
                onSelect={setActiveConversation}
                onCreate={() => createConversation.mutate()}
                onDelete={(id) => deleteConversation.mutate(id)}
              />
            )}
          </aside>
        )}

        {/* Sidebar toggle (when hidden) */}
        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            className="hidden lg:flex flex-shrink-0 items-center justify-center w-8 border-r border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Open sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* ─── Center (Chat Area) ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 bg-white/70 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile sidebar toggle */}
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                  aria-label="Toggle sidebar"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>

                <div>
                  <h1 className="text-base font-semibold text-slate-800">
                    {activeConversation?.title ?? 'Health AI'}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Brain className="w-3 h-3" />
                      {activeModel.name} {activeModel.version}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Shield className="w-3 h-3 text-emerald-500" />
                      {totalAttestations} attestations
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <Lock className="w-3 h-3" />
                  E2E Encrypted
                </span>
                <button
                  onClick={() => setShowAttestation(!showAttestation)}
                  className="hidden xl:flex p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                  aria-label="Toggle attestation panel"
                >
                  <Shield className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6">
            {isLoadingMessages && activeConversation ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-brand-100" />
                  <div className="w-40 h-3 bg-brand-100 rounded" />
                </div>
              </div>
            ) : messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-100 to-brand-100 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-brand-400" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Shiora on Aethelred</h2>
                <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
                  Ask me anything about your health data. All responses are verified through TEE
                  attestation for tamper-proof analysis.
                </p>
                <div className="flex items-center gap-4 mb-8">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                    <Cpu className="w-3 h-3" />
                    {activeModel.teePlatform}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <Shield className="w-3 h-3" />
                    TEE Verified
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200">
                    <Sparkles className="w-3 h-3" />
                    {activeModel.name}
                  </span>
                </div>
                <SuggestedPrompts prompts={suggestedPrompts} onSelect={handlePromptSelect} />
              </div>
            ) : (
              /* Message list */
              <div>
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} isUser={msg.role === 'user'} />
                ))}
                {isSending && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-slate-200 p-4 bg-white/70 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto">
              <ChatInput onSend={handleSend} disabled={false} isLoading={isSending} />
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Responses verified via TEE attestation
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right Panel (Attestation Chain) ─── */}
        {showAttestation && (
          <aside className="w-80 border-l border-slate-200 bg-white flex-shrink-0 hidden xl:flex flex-col">
            <AttestationProof messages={messages} />
          </aside>
        )}
      </main>

      <Footer />
      <ToastContainer />
      <SearchOverlay />
    </div>
  );
}
