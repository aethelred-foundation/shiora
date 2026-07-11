// ============================================================
// Shiora on Aethelred — Postgres WebAuthn Challenge Store
//
// Cross-instance pending-challenge state. Minting upserts the (owner,
// ceremony) slot; consumption is one atomic statement:
//
//   DELETE FROM webauthn_challenges
//    WHERE owner_key=$1 AND ceremony=$2 RETURNING challenge, expires_at
//
// Postgres serialises the delete, so exactly one caller — across replicas,
// restarts, and failovers — receives the challenge; racers get zero rows. An
// expired row is consumed but reported as null (fail-closed). Expired slots
// are also removed by prune(), scheduled with the other store maintenance.
// ============================================================

import type { SqlClient } from './sql-client';
import type { ChallengeStore, CeremonyKind } from './challenge-store';
import { WEBAUTHN_CHALLENGES_DDL, WEBAUTHN_CHALLENGES_EXPIRY_INDEX_DDL } from './schema';

export class PgChallengeStore implements ChallengeStore {
  constructor(private readonly client: SqlClient) {}

  /** Create the webauthn_challenges table and supporting index if absent. */
  async migrate(): Promise<void> {
    await this.client.query(WEBAUTHN_CHALLENGES_DDL);
    await this.client.query(WEBAUTHN_CHALLENGES_EXPIRY_INDEX_DDL);
  }

  async put(owner: string, ceremony: CeremonyKind, challenge: string, expiresAt: number): Promise<void> {
    await this.client.query(
      `INSERT INTO webauthn_challenges (owner_key, ceremony, challenge, expires_at)
         VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_key, ceremony)
         DO UPDATE SET challenge = EXCLUDED.challenge, expires_at = EXCLUDED.expires_at`,
      [owner, ceremony, challenge, expiresAt],
    );
  }

  async take(owner: string, ceremony: CeremonyKind): Promise<string | null> {
    const { rows } = await this.client.query<{ challenge: string; expires_at: string | number }>(
      `DELETE FROM webauthn_challenges
        WHERE owner_key = $1 AND ceremony = $2
       RETURNING challenge, expires_at`,
      [owner, ceremony],
    );
    if (rows.length === 0 || Number(rows[0].expires_at) <= Date.now()) {
      return null;
    }
    return rows[0].challenge;
  }

  /** Delete slots whose expiry has passed — the ceremony can no longer finish. */
  async prune(now: number = Date.now()): Promise<number> {
    const { rows } = await this.client.query<{ pruned: string | number }>(
      `WITH removed AS (
         DELETE FROM webauthn_challenges WHERE expires_at < $1 RETURNING 1
       )
       SELECT count(*)::int AS pruned FROM removed`,
      [now],
    );
    return Number(rows[0].pruned);
  }
}
