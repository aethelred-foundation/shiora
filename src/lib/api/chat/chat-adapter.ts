// ============================================================
// Shiora on Aethelred — Chat ↔ SANA adapter
//
// Maps the real SANA conversation model onto the chat UI's view types. The chat
// UI predates SANA and carries fields from the old simulated assistant
// (attestation, teePlatform, tokens); SANA produces none of those, so they are
// intentionally left empty/zero rather than fabricated — the chat surface is now
// the real, non-diagnostic SANA engine, honestly represented.
// ============================================================

import type { ChatConversation, ChatMessage } from '@/types';
import type { SanaConversation, SanaMessage } from '@/lib/api/sana/sana-service';

/** A SANA conversation as a chat-list summary (no fabricated attestation/token data). */
export function toChatConversation(conversation: SanaConversation): ChatConversation {
  const last = conversation.messages[conversation.messages.length - 1];
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    lastMessage: last ? last.content.slice(0, 80) : '',
    model: 'SANA',
    totalTokens: 0,
    attestationCount: 0,
  };
}

/** A SANA message as a chat bubble (no attestation/TEE fields — SANA is not TEE-processed). */
export function toChatMessage(
  conversationId: string,
  message: SanaMessage,
  index: number,
): ChatMessage {
  return {
    id: `${conversationId}-${index}`,
    conversationId,
    role: message.role,
    content: message.content,
    timestamp: message.createdAt,
  };
}
