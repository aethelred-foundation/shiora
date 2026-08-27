// ============================================================
// Shiora on Aethelred — Zero-Knowledge Proof Service
//
// Turns the platform's selective-disclosure claims into REAL zero-knowledge
// proofs over the transparent set-membership primitive (see
// crypto/zk-membership). A user commits to a private value (their age, a
// condition code, a quality score, …) and proves it lies in a public set — the
// proof reveals nothing else. Proofs are owner-scoped, encrypted at rest, and
// audited; the stored record holds only the PUBLIC proof (never the value or
// blinding), so the platform is zero-knowledge by construction.
//
// HONEST SCOPE: this proves the committed value is in the set. Binding the
// commitment to an issuer-attested attribute (anonymous credentials) is the
// trust layer above — see the `zk_proofs` maturity entry.
// ============================================================

import { randomUUID } from 'crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import {
  randomScalar,
  proveMembership,
  verifyMembership,
  type MembershipProof,
} from '@/lib/crypto/zk-membership';

const COLLECTION = 'zk-proof';
const NINETY_DAYS = 90 * 86400000;

/** The supported claim predicates and what each proves. */
export const CLAIM_TYPES = {
  age_range: 'Proves your age falls within an allowed range without revealing your exact age.',
  condition_present: 'Proves a condition code is among an allowed set without revealing which one.',
  medication_active: 'Proves an active medication is among an allowed set without revealing which one.',
  data_quality: 'Proves your data-quality score meets a threshold without revealing the score.',
  provider_verified: 'Proves your verifying provider is in a registry without revealing which one.',
  fertility_window: 'Proves your cycle day falls within a predicted fertile window without revealing the day.',
} as const;

export type ClaimType = keyof typeof CLAIM_TYPES;

export const MAX_SET = 64;

export interface StoredProof {
  id: string;
  ownerAddress: string;
  claimType: ClaimType;
  proof: MembershipProof;
  context: string;
  createdAt: number;
  expiresAt: number;
}

let repository: EncryptedDocumentRepository<StoredProof> | null = null;

function createStore(): DocumentStorePort {
  if (shouldUsePostgres()) {
    return new PgDocumentStore(getPgClient());
  }
  return new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<StoredProof> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<StoredProof>(
      createStore(),
      getAuditLog(),
      COLLECTION,
      { create: 'PROOF_GENERATE', update: 'PROOF_GENERATE' },
    );
  }
  return repository;
}

/**
 * Generate and store a real zero-knowledge proof that the caller's private
 * `value` is a member of the public `set`. Throws if the value is not in the
 * set (a false statement cannot be proven). The value and blinding are never
 * stored — only the public proof.
 */
export async function generateProof(
  ownerAddress: string,
  claimType: ClaimType,
  value: number,
  set: number[],
): Promise<StoredProof> {
  const id = `zkp-${randomUUID().replace(/-/g, '')}`;
  const context = `${claimType}:${id}`;
  const blinding = randomScalar();
  const proof = proveMembership(BigInt(value), blinding, set, context);

  const now = Date.now();
  const record: StoredProof = {
    id,
    ownerAddress,
    claimType,
    proof,
    context,
    createdAt: now,
    expiresAt: now + NINETY_DAYS,
  };

  // The repository create records the PROOF_GENERATE audit (actor = owner).
  await repo().create(ownerAddress, record);
  return record;
}

/** Verify a proof. Returns false for any cryptographically invalid or malformed proof. */
export function verifyProof(proof: MembershipProof, context: string): boolean {
  try {
    return verifyMembership(proof, context);
  } catch {
    return false;
  }
}

export function listProofs(ownerAddress: string): Promise<StoredProof[]> {
  return repo().list(ownerAddress);
}

export function getProof(ownerAddress: string, id: string): Promise<StoredProof | undefined> {
  return repo().get(ownerAddress, id);
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetZkpForTests(): void {
  repository = null;
}
