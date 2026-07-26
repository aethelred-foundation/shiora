// ============================================================
// Shiora on Aethelred — Account recovery codes (consultant P0)
//
// A patient who loses their second factor must not be locked out of their own
// health data. Each account can hold one batch of one-time recovery codes;
// presenting an unused code substitutes for the lost factor. Only salted
// scrypt hashes are stored — sealed at rest in the owner-scoped encrypted
// document repository — so neither the operator nor a datastore breach can
// read a usable code. Regenerating replaces the whole batch, and consumption
// is single-use: serialized per owner in-process and version-checked at the
// store, so a code can never authenticate twice.
// ============================================================

import crypto from 'node:crypto';

import { getAuditLog } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { InMemoryDocumentStore, type DocumentStorePort } from '@/lib/persistence/document-store';
import { PgDocumentStore } from '@/lib/persistence/pg-document-store';
import { getPgClient } from '@/lib/persistence/sql-client';
import { shouldUsePostgres } from '@/lib/persistence/datastore-mode';
import { isOptimisticLockError } from '@/lib/persistence/optimistic-lock';

const COLLECTION = 'recovery-codes';

/** Codes per batch (matches common practice: enough for years of incidents). */
export const RECOVERY_CODE_COUNT = 10;

// Crockford base32: no I, L, O or U, so codes survive being read aloud or
// retyped from paper. 10 symbols = 50 bits of entropy per code.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 10;
// Crockford base32 has exactly 2^5 symbols. Selecting the low five bits of a
// uniform random byte is therefore uniform and avoids modulo-based ambiguity.
const ALPHABET_INDEX_MASK = 0b1_1111;

interface StoredCode {
  salt: string; // hex, per-code
  hash: string; // hex scrypt(normalizedCode, salt)
  usedAt: number | null;
}

interface StoredBatch {
  id: string; // the owner address (one active batch per account)
  generatedAt: number;
  codes: StoredCode[];
}

export interface RecoveryCodeStatus {
  active: boolean;
  remaining: number;
  generatedAt: number | null;
}

export type ConsumeResult = { consumed: true; remaining: number } | { consumed: false };

let repository: EncryptedDocumentRepository<StoredBatch> | null = null;

function createStore(): DocumentStorePort {
  return shouldUsePostgres() ? new PgDocumentStore(getPgClient()) : new InMemoryDocumentStore();
}

function repo(): EncryptedDocumentRepository<StoredBatch> {
  if (!repository) {
    repository = new EncryptedDocumentRepository<StoredBatch>(
      createStore(), getAuditLog(), COLLECTION,
      { create: 'RECOVERY_CODES_GENERATE', update: 'RECOVERY_CODE_CONSUME' },
    );
  }
  return repository;
}

function randomCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let raw = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    raw += ALPHABET[bytes[i] & ALPHABET_INDEX_MASK];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Canonical form for hashing/comparison: strip separators, uppercase. */
function normalize(presented: string): string {
  return presented.replace(/[\s-]/g, '').toUpperCase();
}

function hashCode(normalized: string, saltHex: string): string {
  return crypto.scryptSync(normalized, Buffer.from(saltHex, 'hex'), 32).toString('hex');
}

function matches(normalized: string, entry: StoredCode): boolean {
  // Both sides are 32-byte scrypt digests we wrote ourselves (the envelope's
  // AAD-bound integrity guarantees that), so no length guard is needed.
  const candidate = Buffer.from(hashCode(normalized, entry.salt), 'hex');
  return crypto.timingSafeEqual(candidate, Buffer.from(entry.hash, 'hex'));
}

/**
 * Mint a fresh batch, replacing (and thereby invalidating) any prior batch.
 * The plaintext codes are returned exactly once and never stored.
 */
export async function generateRecoveryCodes(
  owner: string,
): Promise<{ codes: string[]; generatedAt: number }> {
  // 50 bits of entropy per code makes an in-batch collision (~2^-44)
  // vanishingly unlikely; no dedup pass is warranted.
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, randomCode);

  const generatedAt = Date.now();
  const batch: StoredBatch = {
    id: owner,
    generatedAt,
    codes: codes.map((code) => {
      const salt = crypto.randomBytes(16).toString('hex');
      return { salt, hash: hashCode(normalize(code), salt), usedAt: null };
    }),
  };
  await repo().create(owner, batch);
  return { codes, generatedAt };
}

/** Batch status for display — never the codes themselves. */
export async function recoveryCodeStatus(owner: string): Promise<RecoveryCodeStatus> {
  const batch = await repo().get(owner, owner);
  if (!batch) {
    return { active: false, remaining: 0, generatedAt: null };
  }
  return {
    active: true,
    remaining: batch.codes.filter((entry) => entry.usedAt === null).length,
    generatedAt: batch.generatedAt,
  };
}

// Consumption must be single-use even under concurrent presentation. Within a
// process, per-owner promise chaining serializes attempts; across replicas the
// repository's optimistic version check rejects the losing writer, which we
// report as "not consumed" rather than letting a code spend twice.
const consumeQueues = new Map<string, Promise<unknown>>();

function serialized<T>(owner: string, task: () => Promise<T>): Promise<T> {
  // The stored tail is always settled-safe (its rejection is swallowed below),
  // so chaining with a single fulfillment handler cannot skip a queued task.
  const tail = consumeQueues.get(owner) ?? Promise.resolve();
  const next = tail.then(task);
  consumeQueues.set(owner, next.catch(() => undefined));
  return next;
}

/**
 * Atomically consume one unused code. Every failure mode — unknown code,
 * already used, no batch, concurrent loser — collapses to `{ consumed: false }`
 * so callers cannot distinguish (and therefore cannot probe) why.
 */
export async function consumeRecoveryCode(owner: string, presented: string): Promise<ConsumeResult> {
  return serialized(owner, async () => {
    const normalized = normalize(presented);
    const versioned = await repo().getVersioned(owner, owner);
    if (!versioned) {
      return { consumed: false as const };
    }

    const { document: batch, version } = versioned;
    const index = batch.codes.findIndex(
      (entry) => entry.usedAt === null && matches(normalized, entry),
    );
    if (index === -1) {
      return { consumed: false as const };
    }

    const codes = batch.codes.map((entry, i) =>
      i === index ? { ...entry, usedAt: Date.now() } : entry,
    );
    try {
      await repo().update(owner, owner, { codes }, owner, version);
    } catch (err) {
      if (isOptimisticLockError(err)) {
        return { consumed: false as const };
      }
      throw err;
    }
    return {
      consumed: true as const,
      remaining: codes.filter((entry) => entry.usedAt === null).length,
    };
  });
}

/** Test-only: the stored (hashed) batch, proving no plaintext is retained. */
export async function __inspectStoredBatchForTests(owner: string): Promise<StoredBatch | null> {
  return (await repo().get(owner, owner)) ?? null;
}

/** Test-only: reset the singleton so each test starts from empty state. */
export function __resetRecoveryForTests(): void {
  repository = null;
  consumeQueues.clear();
}
