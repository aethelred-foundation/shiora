// ============================================================
// Shiora on Aethelred — Secure Multi-Party Computation Service
//
// Runs REAL secure aggregations over the Shamir secret-sharing primitive (see
// crypto/secret-sharing) and stores only the aggregate result — never the
// individual contributions. This replaces the simulation where session/result
// data was seededRandom. A computation takes each party's private contribution,
// secret-shares it, sums the shares, and reconstructs only the total, so the
// stored/returned output reveals the sum/mean/count and nothing else.
//
// HONEST SCOPE: the protocol is real and sound, and the platform persists only
// the aggregate. True input privacy additionally requires the shares to be held
// by non-colluding parties; multi-party deployment is the trust model above.
// See the `secure_mpc` maturity entry.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { secureSum } from '@/lib/crypto/secret-sharing';

const COLLECTION = 'mpc-session';

/** The supported secure-computation protocols. */
export const MPC_PROTOCOLS = {
  secure_sum: 'Securely sums each party\'s private contribution, revealing only the total.',
  federated_averaging: 'Securely averages each party\'s private contribution, revealing only the mean.',
  secure_count: 'Securely counts the participating parties, revealing only the count.',
} as const;

export type MpcProtocol = keyof typeof MPC_PROTOCOLS;

export const MAX_PARTIES = 64;

export interface MpcSession {
  id: string;
  ownerAddress: string;
  name: string;
  description: string;
  protocol: MpcProtocol;
  threshold: number;
  participantCount: number;
  result: number;
  status: 'completed';
  createdAt: number;
}

export interface ComputationInput {
  name: string;
  description?: string;
  protocol: MpcProtocol;
  threshold: number;
  contributions: number[];
}

let repository: EncryptedDocumentRepository<MpcSession> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<MpcSession> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<MpcSession>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'MPC_COMPUTE', update: 'MPC_COMPUTE' },
    );
  }
  return repository;
}

/**
 * Run one secure aggregation over the given contributions and persist only the
 * aggregate. The contributions are used transiently to compute shares and are
 * never stored.
 */
export async function runComputation(
  ownerAddress: string,
  input: ComputationInput,
): Promise<MpcSession> {
  const parties = input.contributions.length;
  // For a count, every party contributes 1; for sum/mean, their actual value.
  const values = input.protocol === 'secure_count'
    ? input.contributions.map(() => BigInt(1))
    : input.contributions.map((value) => BigInt(Math.trunc(value)));

  const aggregate = secureSum(values, input.threshold);
  const result = input.protocol === 'federated_averaging'
    ? Number(aggregate) / parties
    : Number(aggregate);

  const session: MpcSession = {
    id: `mpc-${randomUUID().replace(/-/g, '')}`,
    ownerAddress,
    name: input.name,
    description: input.description ?? '',
    protocol: input.protocol,
    threshold: input.threshold,
    participantCount: parties,
    result,
    status: 'completed',
    createdAt: Date.now(),
  };

  await repo().create(ownerAddress, session); // records the MPC_COMPUTE audit
  return session;
}

export function listSessions(ownerAddress: string): Promise<MpcSession[]> {
  return repo().list(ownerAddress);
}

export function getSession(ownerAddress: string, id: string): Promise<MpcSession | undefined> {
  return repo().get(ownerAddress, id);
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetMpcForTests(): void {
  repository = null;
}
