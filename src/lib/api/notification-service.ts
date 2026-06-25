// ============================================================
// Shiora on Aethelred — Notification Service (cross-audience)
//
// A real, encrypted, owner-scoped notification inbox. Any platform flow can
// emit a notification to a wallet address (e.g., a data-access decision, a
// closed care gap, a consent change); the recipient reads it from their inbox.
// Notifications are sealed at rest and every emit/read is appended to the
// tamper-evident audit chain. Postgres when DATABASE_URL is set, else in-memory.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';

const COLLECTION = 'notification';

export type NotificationType =
  | 'data_request_decision'
  | 'care_gap'
  | 'consent'
  | 'clinical_note'
  | 'system';

export interface Notification {
  id: string;
  ownerAddress: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
}

let repository: EncryptedDocumentRepository<Notification> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<Notification> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<Notification>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'NOTIFICATION_CREATE', update: 'NOTIFICATION_UPDATE' },
    );
  }
  return repository;
}

/** Emit a notification to a recipient's inbox. */
export function notify(ownerAddress: string, input: NotificationInput): Promise<Notification> {
  const notification: Notification = {
    id: `ntf-${randomUUID().replace(/-/g, '')}`,
    ownerAddress,
    type: input.type,
    title: input.title,
    body: input.body,
    read: false,
    createdAt: Date.now(),
  };
  return repo().create(ownerAddress, notification);
}

/** A recipient's notifications, most recent first; optionally unread only. */
export async function listNotifications(
  ownerAddress: string,
  options: { unreadOnly?: boolean } = {},
): Promise<Notification[]> {
  const notifications = await repo().list(ownerAddress);
  const filtered = options.unreadOnly
    ? notifications.filter((notification) => !notification.read)
    : notifications;
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}

export async function unreadCount(ownerAddress: string): Promise<number> {
  return (await listNotifications(ownerAddress, { unreadOnly: true })).length;
}

/** Mark one notification read. Returns undefined when it does not exist. */
export async function markRead(
  ownerAddress: string,
  id: string,
): Promise<Notification | undefined> {
  const existing = await repo().get(ownerAddress, id);
  if (!existing) {
    return undefined;
  }
  return repo().update(ownerAddress, id, { read: true });
}

/** Mark every unread notification read; returns the number updated. */
export async function markAllRead(ownerAddress: string): Promise<number> {
  const unread = await listNotifications(ownerAddress, { unreadOnly: true });
  for (const notification of unread) {
    await repo().update(ownerAddress, notification.id, { read: true });
  }
  return unread.length;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetNotificationsForTests(): void {
  repository = null;
}
