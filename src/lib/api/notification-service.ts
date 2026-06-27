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
  | 'wellness'
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

const PREFS_COLLECTION = 'notification-prefs';

interface StoredPreferences {
  id: string; // the owner address
  ownerAddress: string;
  mutedTypes: NotificationType[];
  updatedAt: number;
}

export interface NotificationPreferences {
  mutedTypes: NotificationType[];
}

let repository: EncryptedDocumentRepository<Notification> | null = null;
let prefsRepository: EncryptedDocumentRepository<StoredPreferences> | null = null;

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

function prefsRepo(): EncryptedDocumentRepository<StoredPreferences> {
  if (!prefsRepository) {
    prefsRepository = new EncryptedDocumentRepository<StoredPreferences>(
      createStore(),
      getAuditLog(),
      PREFS_COLLECTION,
      { create: 'NOTIFICATION_PREFS_UPDATE', update: 'NOTIFICATION_PREFS_UPDATE' },
    );
  }
  return prefsRepository;
}

/** A recipient's notification preferences; nothing muted by default. */
export async function getNotificationPreferences(ownerAddress: string): Promise<NotificationPreferences> {
  const stored = await prefsRepo().get(ownerAddress, ownerAddress);
  return { mutedTypes: stored ? stored.mutedTypes : [] };
}

/** Set the notification types a recipient has muted. */
export async function setMutedNotificationTypes(
  ownerAddress: string,
  mutedTypes: NotificationType[],
): Promise<NotificationPreferences> {
  await prefsRepo().create(ownerAddress, {
    id: ownerAddress,
    ownerAddress,
    mutedTypes,
    updatedAt: Date.now(),
  });
  return { mutedTypes };
}

/** Emit a notification, unless the recipient has muted its type. */
export async function notify(
  ownerAddress: string,
  input: NotificationInput,
): Promise<Notification | null> {
  const { mutedTypes } = await getNotificationPreferences(ownerAddress);
  if (mutedTypes.includes(input.type)) {
    return null;
  }
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

/** Soft-delete all of an owner's notifications (right to erasure). */
export async function eraseNotifications(ownerAddress: string): Promise<number> {
  const list = await listNotifications(ownerAddress);
  await Promise.all(list.map((notification) => repo().softDelete(ownerAddress, notification.id)));
  return list.length;
}

/** Test-only: reset the singletons so each test starts from empty state. */
export function __resetNotificationsForTests(): void {
  repository = null;
  prefsRepository = null;
}
