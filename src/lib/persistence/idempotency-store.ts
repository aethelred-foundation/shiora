// ============================================================
// Shiora on Aethelred — Idempotency-key store (GAP-17)
//
// A retried mutating request (client timeout, network blip) must not act
// twice. Clients send an `Idempotency-Key`; the FIRST request reserves the key
// and, on completion, records its response. A retry either replays that stored
// response, is told the original is still in flight, or — if the same key is
// reused for a different endpoint — is rejected. Reservation is atomic so two
// concurrent retries can never both execute.
// ============================================================

import { PgIdempotencyStore } from './pg-idempotency-store';
import { getPgClient } from './sql-client';

/** A recorded response, replayed on retry. */
export interface IdempotentResponse {
  status: number;
  body: string;
}

/** Outcome of reserving an idempotency key. */
export type BeginResult =
  | { kind: 'started' }
  | { kind: 'in_flight' }
  | { kind: 'mismatch' }
  | { kind: 'replay'; response: IdempotentResponse };

export interface IdempotencyStore {
  /** Atomically reserve a key, or report why it cannot proceed. */
  begin(key: string, fingerprint: string, expiresAt: number): Promise<BeginResult>;
  /** Record the response for a reserved key so retries can replay it. */
  complete(key: string, status: number, body: string): Promise<void>;
}

interface Entry {
  fingerprint: string;
  status: number | null; // null = in-flight (the sole in-flight discriminator)
  body: string; // '' until completed
  expiresAt: number;
}

const SWEEP_INTERVAL_MS = 60_000;

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, Entry>();
  private lastSweep = 0;

  async begin(key: string, fingerprint: string, expiresAt: number): Promise<BeginResult> {
    const now = Date.now();
    this.sweep(now);

    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > now) {
      if (existing.fingerprint !== fingerprint) {
        return { kind: 'mismatch' };
      }
      if (existing.status === null) {
        return { kind: 'in_flight' };
      }
      return { kind: 'replay', response: { status: existing.status, body: existing.body } };
    }

    this.entries.set(key, { fingerprint, status: null, body: '', expiresAt });
    return { kind: 'started' };
  }

  async complete(key: string, status: number, body: string): Promise<void> {
    const existing = this.entries.get(key);
    if (existing) {
      existing.status = status;
      existing.body = body;
    }
  }

  /** Remove expired reservations; returns how many were dropped. */
  async prune(now: number = Date.now()): Promise<number> {
    let removed = 0;
    for (const [key, entry] of Array.from(this.entries.entries())) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) {
      return;
    }
    this.lastSweep = now;
    for (const [key, entry] of Array.from(this.entries.entries())) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

function shouldUsePostgres(): boolean {
  return !!process.env.DATABASE_URL;
}

let cachedStore: IdempotencyStore | null = null;

export function getIdempotencyStore(): IdempotencyStore {
  if (!cachedStore) {
    cachedStore = shouldUsePostgres()
      ? new PgIdempotencyStore(getPgClient())
      : new InMemoryIdempotencyStore();
  }
  return cachedStore;
}

export function __resetIdempotencyStoreForTests(): void {
  cachedStore = null;
}
