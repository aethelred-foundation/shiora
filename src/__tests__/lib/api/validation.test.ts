/** @jest-environment node */

import { z } from 'zod';
import {
  PaginationSchema,
  AethelredAddressSchema,
  RecordCreateSchema,
  RecordTypeEnum,
  GrantCreateSchema,
  WalletConnectSchema,
  IPFSUploadSchema,
  ConsentCreateSchema,
  parseSearchParams,
} from '@/lib/api/validation';

describe('PaginationSchema', () => {
  it('uses defaults for missing params', () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces string numbers', () => {
    const result = PaginationSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects page < 1', () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
  });

  it('rejects limit > 100', () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
  });
});

describe('AethelredAddressSchema', () => {
  it('accepts valid aeth1 address (39 chars after aeth1)', () => {
    // aeth1 + 38 lowercase alphanumeric
    const addr = 'aeth1' + 'a'.repeat(38);
    expect(() => AethelredAddressSchema.parse(addr)).not.toThrow();
  });

  it('rejects address with wrong prefix', () => {
    expect(() => AethelredAddressSchema.parse('cosmos1abc')).toThrow();
  });

  it('rejects too-short address', () => {
    expect(() => AethelredAddressSchema.parse('aeth1short')).toThrow();
  });

  it('rejects address with uppercase', () => {
    expect(() => AethelredAddressSchema.parse('aeth1' + 'A'.repeat(38))).toThrow();
  });
});

describe('RecordCreateSchema', () => {
  it('validates a complete record', () => {
    const result = RecordCreateSchema.parse({
      type: 'lab_result',
      label: 'Blood Work',
      provider: 'Lab Corp',
    });
    expect(result.type).toBe('lab_result');
    expect(result.encryption).toBe('AES-256-GCM');
    expect(result.tags).toEqual([]);
  });

  it('rejects invalid type', () => {
    expect(() =>
      RecordCreateSchema.parse({ type: 'invalid', label: 'Test', provider: 'P' }),
    ).toThrow();
  });

  it('rejects empty label', () => {
    expect(() =>
      RecordCreateSchema.parse({ type: 'vitals', label: '', provider: 'P' }),
    ).toThrow();
  });
});

describe('RecordTypeEnum', () => {
  it('accepts all valid types', () => {
    ['lab_result', 'imaging', 'prescription', 'vitals', 'notes'].forEach((t) => {
      expect(RecordTypeEnum.parse(t)).toBe(t);
    });
  });
});

describe('WalletConnectSchema', () => {
  it('validates a complete connect request', () => {
    const result = WalletConnectSchema.parse({
      address: 'aeth1' + 'a'.repeat(38),
      signature: 'abc123',
      timestamp: Date.now(),
      nonce: 'nonce123',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 300000,
      hmac: 'a'.repeat(64),
    });
    expect(result.chainId).toBe('aethelred-1');
  });

  it('rejects invalid HMAC format', () => {
    expect(() =>
      WalletConnectSchema.parse({
        address: 'aeth1' + 'a'.repeat(38),
        signature: 'sig',
        timestamp: Date.now(),
        nonce: 'n',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 300000,
        hmac: 'not-hex',
      }),
    ).toThrow();
  });
});

describe('IPFSUploadSchema', () => {
  it('validates upload metadata', () => {
    const result = IPFSUploadSchema.parse({
      filename: 'test.pdf',
      contentType: 'application/pdf',
      size: 1024,
    });
    expect(result.filename).toBe('test.pdf');
  });

  it('rejects file over 100MB', () => {
    expect(() =>
      IPFSUploadSchema.parse({
        filename: 'big.bin',
        contentType: 'application/octet-stream',
        size: 200 * 1024 * 1024,
      }),
    ).toThrow();
  });
});

describe('ConsentCreateSchema', () => {
  it('validates consent creation', () => {
    const result = ConsentCreateSchema.parse({
      providerName: 'Dr. Smith',
      scopes: ['lab_results'],
      durationDays: 30,
    });
    expect(result.providerName).toBe('Dr. Smith');
    expect(result.autoRenew).toBe(false);
  });

  it('rejects empty scopes', () => {
    expect(() =>
      ConsentCreateSchema.parse({
        providerName: 'Dr. Smith',
        scopes: [],
        durationDays: 30,
      }),
    ).toThrow();
  });
});

describe('GrantCreateSchema', () => {
  it('validates grant creation', () => {
    const result = GrantCreateSchema.parse({
      provider: 'Hospital',
      specialty: 'Cardiology',
      address: 'aeth1' + 'a'.repeat(38),
      scope: 'Full Records',
      durationDays: 30,
    });
    expect(result.canView).toBe(true);
    expect(result.canDownload).toBe(false);
    expect(result.canShare).toBe(false);
  });
});

describe('ConsentUpdateSchema', () => {
  const { ConsentUpdateSchema } = require('@/lib/api/validation');

  it('validates with scopes update', () => {
    const result = ConsentUpdateSchema.parse({ scopes: ['lab_results'] });
    expect(result.scopes).toEqual(['lab_results']);
  });

  it('validates with durationDays update', () => {
    const result = ConsentUpdateSchema.parse({ durationDays: 60 });
    expect(result.durationDays).toBe(60);
  });

  it('rejects when neither scopes nor durationDays is provided', () => {
    expect(() => ConsentUpdateSchema.parse({})).toThrow();
  });
});

describe('Additional schema coverage', () => {
  const {
    RecordListQuerySchema,
    RecordUpdateSchema,
    GrantListQuerySchema,
    GrantUpdateSchema,
    ConsentListQuerySchema,
    AuditListQuerySchema,
    InferenceListQuerySchema,
    AnomalyListQuerySchema,
    AttestationListQuerySchema,
    SortOrderSchema,
    CIDSchema,
    HexHashSchema,
    ISODateSchema,
    GrantStatusEnum,
    RecordStatusEnum,
    DataScopeEnum,
    ConsentScopeEnum,
    ConsentStatusEnum,
    AuditTypeEnum,
  } = require('@/lib/api/validation');

  it('RecordListQuerySchema accepts valid input', () => {
    const result = RecordListQuerySchema.parse({ type: 'lab_result', sort: 'date', order: 'asc', q: 'blood' });
    expect(result.type).toBe('lab_result');
    expect(result.sort).toBe('date');
  });

  it('RecordUpdateSchema validates partial updates', () => {
    const result = RecordUpdateSchema.parse({ label: 'New Label', status: 'Verified' });
    expect(result.label).toBe('New Label');
  });

  it('GrantListQuerySchema accepts valid input', () => {
    const result = GrantListQuerySchema.parse({ status: 'Active', q: 'doctor' });
    expect(result.status).toBe('Active');
  });

  it('GrantUpdateSchema validates partial updates', () => {
    const result = GrantUpdateSchema.parse({ scope: 'Full Records', canView: true });
    expect(result.scope).toBe('Full Records');
  });

  it('ConsentListQuerySchema accepts valid input', () => {
    const result = ConsentListQuerySchema.parse({ status: 'active', scope: 'lab_results' });
    expect(result.status).toBe('active');
  });

  it('AuditListQuerySchema accepts valid input', () => {
    const result = AuditListQuerySchema.parse({ type: 'access' });
    expect(result.type).toBe('access');
  });

  it('InferenceListQuerySchema accepts model filter', () => {
    const result = InferenceListQuerySchema.parse({ model: 'lstm' });
    expect(result.model).toBe('lstm');
  });

  it('AnomalyListQuerySchema accepts severity filter', () => {
    const result = AnomalyListQuerySchema.parse({ severity: 'High', resolved: 'true' });
    expect(result.severity).toBe('High');
  });

  it('AttestationListQuerySchema accepts verified filter', () => {
    const result = AttestationListQuerySchema.parse({ verified: 'true' });
    expect(result.verified).toBe(true);
  });

  it('SortOrderSchema defaults to desc', () => {
    expect(SortOrderSchema.parse(undefined)).toBe('desc');
  });

  it('CIDSchema validates valid CIDs', () => {
    // CID regex: /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy...)$/
    // Use base58 characters only (excludes 0, I, O, l)
    const validCid = 'Qm' + 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRS123';
    expect(() => CIDSchema.parse(validCid)).not.toThrow();
  });

  it('HexHashSchema validates valid hex hashes', () => {
    expect(() => HexHashSchema.parse('0x' + 'a'.repeat(64))).not.toThrow();
  });

  it('ISODateSchema accepts date strings', () => {
    expect(() => ISODateSchema.parse('2024-01-15')).not.toThrow();
  });

  it('GrantStatusEnum validates all statuses', () => {
    ['Active', 'Expired', 'Revoked', 'Pending'].forEach((s) => {
      expect(GrantStatusEnum.parse(s)).toBe(s);
    });
  });

  it('RecordStatusEnum validates all statuses', () => {
    ['Verified', 'Pinning', 'Pinned', 'Processing'].forEach((s) => {
      expect(RecordStatusEnum.parse(s)).toBe(s);
    });
  });

  it('DataScopeEnum validates all scopes', () => {
    expect(DataScopeEnum.parse('Full Records')).toBe('Full Records');
  });

  it('ConsentScopeEnum validates all scopes', () => {
    expect(ConsentScopeEnum.parse('lab_results')).toBe('lab_results');
  });

  it('ConsentStatusEnum validates all statuses', () => {
    ['active', 'expired', 'revoked', 'pending'].forEach((s) => {
      expect(ConsentStatusEnum.parse(s)).toBe(s);
    });
  });

  it('AuditTypeEnum validates all types', () => {
    ['access', 'grant', 'revoke', 'modify', 'download'].forEach((t) => {
      expect(AuditTypeEnum.parse(t)).toBe(t);
    });
  });
});

describe('parseSearchParams', () => {
  it('parses URLSearchParams through a schema', () => {
    const params = new URLSearchParams({ page: '2', limit: '10' });
    const result = parseSearchParams(PaginationSchema, params);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it('uses defaults for missing params', () => {
    const params = new URLSearchParams();
    const result = parseSearchParams(PaginationSchema, params);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});
