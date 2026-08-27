// ============================================================
// Shiora on Aethelred — Webhook subscriptions + delivery (GAP-21)
//
// Partners can subscribe an https endpoint to platform events instead of
// polling. Subscriptions are owner-scoped and stored encrypted (the signing
// secret is sensitive). Deliveries are HMAC-signed and retried with
// exponential backoff; the SSRF guard runs at subscribe time AND before each
// send. The delivery engine takes an injectable fetch so it is fully testable.
// ============================================================

import crypto from 'node:crypto';

import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { getAuditLog } from '@/lib/api/audit-log';
import { assertSafeWebhookUrl, signWebhookPayload } from '@/lib/api/webhook-security';
import { createLogger } from '@/lib/observability/logger';
import { counter } from '@/lib/observability/metrics';

const COLLECTION = 'webhook-subscription';
const log = createLogger({ subsystem: 'webhook' });

const deliveriesTotal = counter(
  'shiora_webhook_deliveries_total',
  'Webhook delivery attempts by outcome',
);

export interface WebhookSubscription {
  id: string;
  url: string;
  /** HMAC signing secret shown once on create; sealed at rest thereafter. */
  secret: string;
  /** Event types to receive, or ['*'] for all. */
  events: string[];
  active: boolean;
  createdAt: number;
}

/** Public view of a subscription (secret redacted). */
export type WebhookSubscriptionView = Omit<WebhookSubscription, 'secret'> & { secretPreview: string };

let repository: EncryptedDocumentRepository<WebhookSubscription> | null = null;

function createStore(): DocumentStorePort {
  return shouldUsePostgres() ? new PgDocumentStore(getPgClient()) : new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<WebhookSubscription> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<WebhookSubscription>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'WEBHOOK_CREATE', update: 'WEBHOOK_CREATE' },
    );
  }
  return repository;
}

function toView(sub: WebhookSubscription): WebhookSubscriptionView {
  const { secret, ...rest } = sub;
  return { ...rest, secretPreview: `${secret.slice(0, 6)}…` };
}

/** Create a subscription. Throws if the URL fails the SSRF guard. */
export async function createSubscription(
  owner: string,
  input: { url: string; events?: string[] },
): Promise<WebhookSubscription> {
  assertSafeWebhookUrl(input.url);
  const subscription: WebhookSubscription = {
    id: `wh-${crypto.randomUUID().replace(/-/g, '')}`,
    url: input.url,
    secret: `whsec_${crypto.randomBytes(24).toString('base64url')}`,
    events: input.events && input.events.length > 0 ? input.events : ['*'],
    active: true,
    createdAt: Date.now(),
  };
  await repo().create(owner, subscription);
  return subscription; // secret returned ONCE, in full
}

export async function listSubscriptions(owner: string): Promise<WebhookSubscriptionView[]> {
  return (await repo().list(owner)).map(toView);
}

export async function getSubscription(owner: string, id: string): Promise<WebhookSubscription | undefined> {
  return repo().get(owner, id);
}

export async function deleteSubscription(owner: string, id: string): Promise<boolean> {
  return repo().softDelete(owner, id);
}

export interface DeliveryResult {
  delivered: boolean;
  status?: number;
  attempts: number;
}

export interface DeliveryOptions {
  attempts?: number;
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Deliver a signed event to a subscription with exponential backoff. Re-checks
 * the SSRF guard before sending (the stored URL is trusted-on-write, but the
 * check is cheap and defends against a URL that became unsafe).
 */
export async function deliverWebhook(
  subscription: Pick<WebhookSubscription, 'url' | 'secret'>,
  event: { type: string; data: unknown },
  options: DeliveryOptions = {},
): Promise<DeliveryResult> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  assertSafeWebhookUrl(subscription.url);
  const body = JSON.stringify({ type: event.type, data: event.data, sentAt: now() });
  const signature = signWebhookPayload(subscription.secret, body, now());

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shiora-Event': event.type,
          'X-Shiora-Signature': signature,
        },
        body,
      });
      if (res.ok) {
        deliveriesTotal.inc({ outcome: 'ok' });
        return { delivered: true, status: res.status, attempts: attempt };
      }
      // Non-2xx: retry (server-side hiccup) unless it was the last attempt.
    } catch {
      // Network error: retry.
    }
    if (attempt < attempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1)); // 500, 1000, 2000…
    }
  }

  deliveriesTotal.inc({ outcome: 'failed' });
  log.warn('webhook delivery failed after retries', { event: event.type, attempts });
  return { delivered: false, attempts };
}

export function __resetWebhooksForTests(): void {
  repository = null;
}
