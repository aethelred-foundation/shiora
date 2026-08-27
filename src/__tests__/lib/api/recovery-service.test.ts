/** @jest-environment node */

// The Postgres branch of the store selector is exercised without a live DB by
// stubbing the SQL client (mirrors webauthn-service.test.ts). An empty rowset
// is enough to prove the PgDocumentStore path is taken.
const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  recoveryCodeStatus,
  consumeRecoveryCode,
  __inspectStoredBatchForTests,
  __resetRecoveryForTests,
} from '@/lib/api/recovery-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { EncryptedDocumentRepository } from '@/lib/persistence/encrypted-documents';
import { OptimisticLockError } from '@/lib/persistence/optimistic-lock';
import { seededAddress } from '@/lib/utils';

const OWNER = seededAddress(7101);
const OTHER = seededAddress(7102);

afterEach(() => {
  __resetRecoveryForTests();
  __resetAuditLogForTests();
  delete process.env.DATABASE_URL;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('recovery-service', () => {
  it('generates a batch of well-formed, distinct one-time codes', async () => {
    const { codes, generatedAt } = await generateRecoveryCodes(OWNER);

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      // Crockford-style base32, grouped for humans: XXXXX-XXXXX.
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    }
    expect(generatedAt).toBeLessThanOrEqual(Date.now());

    const status = await recoveryCodeStatus(OWNER);
    expect(status).toEqual({ active: true, remaining: RECOVERY_CODE_COUNT, generatedAt });
  });

  it('reports an inactive status before any batch exists', async () => {
    expect(await recoveryCodeStatus(OWNER)).toEqual({
      active: false,
      remaining: 0,
      generatedAt: null,
    });
    expect(await __inspectStoredBatchForTests(OWNER)).toBeNull();
  });

  it('consumes a code exactly once', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);

    const first = await consumeRecoveryCode(OWNER, codes[3]);
    expect(first).toEqual({ consumed: true, remaining: RECOVERY_CODE_COUNT - 1 });

    // Single-use: the same code can never authenticate twice.
    expect(await consumeRecoveryCode(OWNER, codes[3])).toEqual({ consumed: false });

    // Other codes in the batch remain valid.
    expect(await consumeRecoveryCode(OWNER, codes[0])).toEqual({
      consumed: true,
      remaining: RECOVERY_CODE_COUNT - 2,
    });
  });

  it('accepts presentation-format differences (case, separators, whitespace)', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);
    const sloppy = ` ${codes[0].toLowerCase().replace('-', ' ')} `;
    expect((await consumeRecoveryCode(OWNER, sloppy)).consumed).toBe(true);
  });

  it('rejects an unknown code without consuming anything', async () => {
    await generateRecoveryCodes(OWNER);
    expect(await consumeRecoveryCode(OWNER, 'AAAAA-AAAAA')).toEqual({ consumed: false });
    expect((await recoveryCodeStatus(OWNER)).remaining).toBe(RECOVERY_CODE_COUNT);
  });

  it('rejects consumption when no batch exists', async () => {
    expect(await consumeRecoveryCode(OWNER, 'AAAAA-AAAAA')).toEqual({ consumed: false });
  });

  it('scopes codes to their owner', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);
    expect(await consumeRecoveryCode(OTHER, codes[0])).toEqual({ consumed: false });
    // The rightful owner is unaffected.
    expect((await consumeRecoveryCode(OWNER, codes[0])).consumed).toBe(true);
  });

  it('regenerating invalidates every code from the prior batch', async () => {
    const { codes: old } = await generateRecoveryCodes(OWNER);
    const { codes: fresh } = await generateRecoveryCodes(OWNER);

    for (const code of old) {
      expect((await consumeRecoveryCode(OWNER, code)).consumed).toBe(false);
    }
    expect((await consumeRecoveryCode(OWNER, fresh[0])).consumed).toBe(true);
  });

  it('stores only salted hashes — never the plaintext codes', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);

    const stored = await __inspectStoredBatchForTests(OWNER);
    expect(stored).not.toBeNull();
    const serialized = JSON.stringify(stored);
    for (const code of codes) {
      expect(serialized).not.toContain(code.replace('-', ''));
      expect(serialized).not.toContain(code);
    }
    // Each entry carries its own salt, and salts are unique.
    const salts = stored!.codes.map((entry) => entry.salt);
    expect(new Set(salts).size).toBe(RECOVERY_CODE_COUNT);
  });

  it('serializes concurrent consumption: a double-spend of one code admits exactly one winner', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);
    const results = await Promise.all([
      consumeRecoveryCode(OWNER, codes[0]),
      consumeRecoveryCode(OWNER, codes[0]),
    ]);
    expect(results.filter((r) => r.consumed)).toHaveLength(1);
    expect((await recoveryCodeStatus(OWNER)).remaining).toBe(RECOVERY_CODE_COUNT - 1);
  });

  it('treats a cross-replica optimistic-lock conflict as not consumed', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);
    jest
      .spyOn(EncryptedDocumentRepository.prototype, 'update')
      .mockRejectedValueOnce(new OptimisticLockError(1, 2));
    expect(await consumeRecoveryCode(OWNER, codes[0])).toEqual({ consumed: false });
  });

  it('surfaces non-lock storage failures instead of masking them', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);
    jest
      .spyOn(EncryptedDocumentRepository.prototype, 'update')
      .mockRejectedValueOnce(new Error('datastore down'));
    await expect(consumeRecoveryCode(OWNER, codes[0])).rejects.toThrow('datastore down');
  });

  it('audits generation and consumption on the tamper-evident chain', async () => {
    const { codes } = await generateRecoveryCodes(OWNER);
    await consumeRecoveryCode(OWNER, codes[0]);

    const generated = await getAuditLog().list({ action: 'RECOVERY_CODES_GENERATE' });
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatchObject({ actor: OWNER, subject: OWNER, resource: 'recovery-codes' });

    const consumed = await getAuditLog().list({ action: 'RECOVERY_CODE_CONSUME' });
    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toMatchObject({ actor: OWNER, subject: OWNER, success: true });
  });

  it('selects the Postgres-backed store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetRecoveryForTests();
    await recoveryCodeStatus(OWNER);
    expect(pgQuery).toHaveBeenCalled();
  });
});
