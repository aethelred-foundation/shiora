// ============================================================
// Shiora on Aethelred — SANA Conversation Service
//
// Owner-scoped, encrypted SANA conversations plus the guarded orchestration of
// each turn. Every turn runs the guardrails (see ./guardrails): input screening
// can short-circuit to a fixed crisis/emergency response WITHOUT calling the
// model; otherwise the model reply is post-screened and disclaimed before it is
// stored or returned. Conversations are sealed at rest and each turn is audited.
//
// HONEST SCOPE: SANA is a non-diagnostic informational/navigational assistant,
// not a medical device. Without ANTHROPIC_API_KEY the LLM seam serves a
// deterministic offline stub. See the `sana_assistant` maturity entry.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { screenInput, screenOutput, buildSystemPrompt, type Intervention } from '@/lib/api/sana/guardrails';
import { getLLMProvider } from '@/lib/api/sana/llm-provider';

const COLLECTION = 'sana-conversation';

const REFUSAL_REPLY = 'I\'m not able to help with that particular request. If it concerns your '
  + 'health, please consult a licensed clinician.';

export interface SanaMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  flags?: string[];
  intervention?: Intervention;
}

export interface SanaConversation {
  id: string;
  ownerAddress: string;
  title: string;
  messages: SanaMessage[];
  createdAt: number;
  updatedAt: number;
}

let repository: EncryptedDocumentRepository<SanaConversation> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<SanaConversation> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<SanaConversation>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'SANA_MESSAGE', update: 'SANA_MESSAGE' },
    );
  }
  return repository;
}

/**
 * Run one guarded SANA turn against a conversation (creating it when no id is
 * given), persist the user message and assistant reply, and return both.
 */
export async function sendMessage(
  ownerAddress: string,
  conversationId: string | null,
  text: string,
): Promise<{ conversation: SanaConversation; reply: SanaMessage }> {
  const now = Date.now();
  const existing = conversationId ? await repo().get(ownerAddress, conversationId) : undefined;
  const conversation: SanaConversation = existing ?? {
    id: `sana-${randomUUID().replace(/-/g, '')}`,
    ownerAddress,
    title: text.slice(0, 60),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const userMessage: SanaMessage = { role: 'user', content: text, createdAt: now };
  const reply = await produceReply(conversation, text, now);

  const messages = [...conversation.messages, userMessage, reply];
  const saved: SanaConversation = { ...conversation, messages, updatedAt: now };

  if (existing) {
    await repo().update(ownerAddress, conversation.id, { messages, updatedAt: now });
  } else {
    await repo().create(ownerAddress, saved);
  }

  await getAuditLog().record({
    action: 'SANA_MESSAGE',
    actor: ownerAddress,
    subject: ownerAddress,
    resource: 'sana',
    resourceId: conversation.id,
    success: true,
  });

  return { conversation: saved, reply };
}

/** Apply the guardrails and (when allowed) the model to produce one reply. */
async function produceReply(
  conversation: SanaConversation,
  text: string,
  now: number,
): Promise<SanaMessage> {
  const screen = screenInput(text);
  if (!screen.allowed) {
    // A crisis/emergency is answered with a fixed safety response — never the LLM.
    return { role: 'assistant', content: screen.response!, createdAt: now, intervention: screen.intervention };
  }

  const result = await getLLMProvider().generate({
    system: buildSystemPrompt(),
    messages: [
      ...conversation.messages.map((message) => ({ role: message.role, content: message.content })),
      { role: 'user' as const, content: text },
    ],
  });

  if (result.refused) {
    return { role: 'assistant', content: REFUSAL_REPLY, createdAt: now };
  }

  const screened = screenOutput(result.text);
  return { role: 'assistant', content: screened.text, createdAt: now, flags: screened.flags };
}

export function listConversations(ownerAddress: string): Promise<SanaConversation[]> {
  return repo().list(ownerAddress);
}

export function getConversation(
  ownerAddress: string,
  id: string,
): Promise<SanaConversation | undefined> {
  return repo().get(ownerAddress, id);
}

/** Create a new empty conversation for the owner (the chat UI's "new chat"). */
export async function createEmptyConversation(
  ownerAddress: string,
  now: number = Date.now(),
): Promise<SanaConversation> {
  const conversation: SanaConversation = {
    id: `sana-${randomUUID().replace(/-/g, '')}`,
    ownerAddress,
    title: 'New conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  await repo().create(ownerAddress, conversation);
  return conversation;
}

/** Soft-delete a single conversation; false when it does not exist. */
export function deleteConversation(ownerAddress: string, id: string): Promise<boolean> {
  return repo().softDelete(ownerAddress, id);
}

/** Soft-delete all of an owner's SANA conversations (right to erasure). */
export async function eraseSanaConversations(ownerAddress: string): Promise<number> {
  const conversations = await repo().list(ownerAddress);
  await Promise.all(conversations.map((conversation) => repo().softDelete(ownerAddress, conversation.id)));
  return conversations.length;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetSanaForTests(): void {
  repository = null;
}
