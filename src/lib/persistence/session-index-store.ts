// ============================================================
// Shiora on Aethelred — Issued-session index (GAP-08)
//
// One record per issued session token, so a wallet owner can SEE their
// active sessions and revoke a single device (the revocation store enforces;
// this index makes revocation targetable). Records carry only what the
// login request itself presented — jti, timestamps, user agent, client IP —
// and expire with the token.
// ============================================================

import { PgSessionIndexStore } from './pg-session-index-store';
import { getPgClient } from './sql-client';

export interface SessionRecord {
  jti: string;
  subject: string;
  issuedAt: number;
  expiresAt: number;
  userAgent: string;
  ip: string;
}

export interface SessionIndexStore {
  /** Persist an issued session (idempotent on jti). */
  record(session: SessionRecord): Promise<void>;
  /** Unexpired sessions for a subject, newest first. */
  listForSubject(subject: string, now?: number): Promise<SessionRecord[]>;
  /** A single session by id, or null (expired records excluded). */
  get(jti: string, now?: number): Promise<SessionRecord | null>;
}

const SWEEP_INTERVAL_MS = 60_000;

export class InMemorySessionIndexStore implements SessionIndexStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private lastSweep = 0;

  async record(session: SessionRecord): Promise<void> {
    this.sweep(Date.now());
    if (!this.sessions.has(session.jti)) {
      this.sessions.set(session.jti, { ...session });
    }
  }

  async listForSubject(subject: string, now: number = Date.now()): Promise<SessionRecord[]> {
    return Array.from(this.sessions.values())
      .filter((s) => s.subject === subject && s.expiresAt > now)
      .sort((a, b) => b.issuedAt - a.issuedAt);
  }

  async get(jti: string, now: number = Date.now()): Promise<SessionRecord | null> {
    const session = this.sessions.get(jti);
    if (!session || session.expiresAt <= now) {
      return null;
    }
    return session;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) {
      return;
    }
    this.lastSweep = now;
    for (const [jti, session] of Array.from(this.sessions.entries())) {
      if (session.expiresAt <= now) {
        this.sessions.delete(jti);
      }
    }
  }
}

function shouldUsePostgres(): boolean {
  return !!process.env.DATABASE_URL;
}

let cachedStore: SessionIndexStore | null = null;

export function getSessionIndexStore(): SessionIndexStore {
  if (!cachedStore) {
    cachedStore = shouldUsePostgres()
      ? new PgSessionIndexStore(getPgClient())
      : new InMemorySessionIndexStore();
  }
  return cachedStore;
}

export function __resetSessionIndexStoreForTests(): void {
  cachedStore = null;
}
