// ============================================================
// Shiora on Aethelred — Postgres issued-session index (GAP-08)
//
// Durable adapter for the session inventory. Insert is idempotent on jti;
// reads exclude expired rows; prune() removes them (called by store
// maintenance).
// ============================================================

import type { SqlClient } from './sql-client';
import type { SessionIndexStore, SessionRecord } from './session-index-store';
import { SESSIONS_DDL, SESSIONS_SUBJECT_INDEX_DDL } from './schema';

interface SessionRow {
  jti: string;
  subject: string;
  issued_at: string | number;
  expires_at: string | number;
  user_agent: string;
  ip: string;
}

function toRecord(row: SessionRow): SessionRecord {
  return {
    jti: row.jti,
    subject: row.subject,
    issuedAt: Number(row.issued_at),
    expiresAt: Number(row.expires_at),
    userAgent: row.user_agent,
    ip: row.ip,
  };
}

export class PgSessionIndexStore implements SessionIndexStore {
  constructor(private readonly client: SqlClient) {}

  async migrate(): Promise<void> {
    await this.client.query(SESSIONS_DDL);
    await this.client.query(SESSIONS_SUBJECT_INDEX_DDL);
  }

  async record(session: SessionRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO sessions (jti, subject, issued_at, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (jti) DO NOTHING`,
      [session.jti, session.subject, session.issuedAt, session.expiresAt, session.userAgent, session.ip],
    );
  }

  async listForSubject(subject: string, now: number = Date.now()): Promise<SessionRecord[]> {
    const result = await this.client.query<SessionRow>(
      `SELECT jti, subject, issued_at, expires_at, user_agent, ip
       FROM sessions
       WHERE subject = $1 AND expires_at > $2
       ORDER BY issued_at DESC`,
      [subject, now],
    );
    return result.rows.map(toRecord);
  }

  async get(jti: string, now: number = Date.now()): Promise<SessionRecord | null> {
    const result = await this.client.query<SessionRow>(
      `SELECT jti, subject, issued_at, expires_at, user_agent, ip
       FROM sessions
       WHERE jti = $1 AND expires_at > $2`,
      [jti, now],
    );
    return result.rows.length > 0 ? toRecord(result.rows[0]) : null;
  }

  /** Delete expired session rows; returns the number removed. */
  async prune(now: number = Date.now()): Promise<number> {
    const result = await this.client.query<{ jti: string }>(
      `DELETE FROM sessions WHERE expires_at <= $1 RETURNING jti`,
      [now],
    );
    return result.rows.length;
  }
}
