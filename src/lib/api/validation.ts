// ============================================================
// Shiora on Aethelred — API Validation Schemas (Zod)
// Reusable validation for all API input parameters
// ============================================================

import { z } from 'zod';

// ────────────────────────────────────────────────────────────
// Shared / Reusable Schemas
// ────────────────────────────────────────────────────────────

/** Pagination query parameters */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Sort direction */
export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** Aethelred-style address (aeth1...) */
export const AethelredAddressSchema = z
  .string()
  .regex(/^aeth1[a-z0-9]{38}$/, 'Invalid Aethelred address');

/** IPFS CID (mock format Qm...) */
export const CIDSchema = z
  .string()
  .regex(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[1-9A-HJ-NP-Za-km-z]{20,})$/, 'Invalid IPFS CID');

/** Hex hash (0x prefixed) */
export const HexHashSchema = z.string().regex(/^0x[0-9a-f]{64}$/, 'Invalid hex hash');

/** ISO date string */
export const ISODateSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

// ────────────────────────────────────────────────────────────
// Records
// ────────────────────────────────────────────────────────────

export const RecordTypeEnum = z.enum(['lab_result', 'imaging', 'prescription', 'vitals', 'notes']);

export const RecordStatusEnum = z.enum(['Verified', 'Pinning', 'Pinned', 'Processing']);

export const RecordCreateSchema = z.object({
  type: RecordTypeEnum,
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  provider: z.string().min(1).max(200),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
  encryption: z.enum(['AES-256-GCM', 'AES-256-CBC']).default('AES-256-GCM'),
});

export const RecordUpdateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  status: RecordStatusEnum.optional(),
});

export const RecordListQuerySchema = PaginationSchema.extend({
  type: RecordTypeEnum.optional(),
  status: RecordStatusEnum.optional(),
  sort: z.enum(['date', 'label', 'size']).default('date'),
  order: SortOrderSchema,
  q: z.string().max(200).optional(),
});

// ────────────────────────────────────────────────────────────
// Access Grants
// ────────────────────────────────────────────────────────────

export const GrantStatusEnum = z.enum(['Active', 'Expired', 'Revoked', 'Pending']);

export const DataScopeEnum = z.enum([
  'Full Records',
  'Lab Results Only',
  'Imaging Only',
  'Vitals Only',
  'Prescriptions Only',
  'Clinical Notes Only',
]);

export const GrantCreateSchema = z.object({
  provider: z.string().min(1).max(200),
  specialty: z.string().min(1).max(200),
  address: AethelredAddressSchema,
  scope: DataScopeEnum,
  durationDays: z.number().int().min(1).max(365),
  canView: z.boolean().default(true),
  canDownload: z.boolean().default(false),
  canShare: z.boolean().default(false),
});

export const GrantUpdateSchema = z.object({
  scope: DataScopeEnum.optional(),
  canView: z.boolean().optional(),
  canDownload: z.boolean().optional(),
  canShare: z.boolean().optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
});

export const GrantListQuerySchema = PaginationSchema.extend({
  status: GrantStatusEnum.optional(),
  q: z.string().max(200).optional(),
});

// ────────────────────────────────────────────────────────────
// Consent
// ────────────────────────────────────────────────────────────

export const ConsentScopeEnum = z.enum([
  'cycle_data',
  'fertility_markers',
  'lab_results',
  'imaging',
  'prescriptions',
  'vitals',
  'clinical_notes',
  'wearable_data',
  'ai_inferences',
  'full_access',
]);

export const ConsentStatusEnum = z.enum(['active', 'expired', 'revoked', 'pending']);

export const ConsentCreateSchema = z.object({
  providerAddress: AethelredAddressSchema.optional(),
  providerName: z.string().trim().min(1).max(200),
  scopes: z.array(ConsentScopeEnum).min(1).max(10),
  durationDays: z.number().int().min(1).max(365),
  autoRenew: z.boolean().default(false),
  policyId: z.string().trim().min(1).max(100).optional(),
});

export const ConsentUpdateSchema = z
  .object({
    scopes: z.array(ConsentScopeEnum).min(1).max(10).optional(),
    durationDays: z.number().int().min(1).max(365).optional(),
  })
  .refine((value) => value.scopes !== undefined || value.durationDays !== undefined, {
    message: 'At least one updatable consent field is required.',
  });

export const ConsentListQuerySchema = PaginationSchema.extend({
  status: ConsentStatusEnum.optional(),
  scope: ConsentScopeEnum.optional(),
  search: z.string().trim().max(200).optional(),
});

// ────────────────────────────────────────────────────────────
// Audit Log
// ────────────────────────────────────────────────────────────

export const AuditTypeEnum = z.enum(['access', 'grant', 'revoke', 'modify', 'download']);

export const AuditListQuerySchema = PaginationSchema.extend({
  type: AuditTypeEnum.optional(),
  startDate: ISODateSchema.optional(),
  endDate: ISODateSchema.optional(),
});

// ────────────────────────────────────────────────────────────
// Insights / Inferences
// ────────────────────────────────────────────────────────────

export const InferenceListQuerySchema = PaginationSchema.extend({
  model: z.enum(['lstm', 'anomaly', 'fertility', 'insights']).optional(),
});

export const AnomalyListQuerySchema = PaginationSchema.extend({
  severity: z.enum(['High', 'Medium', 'Low']).optional(),
  resolved: z.coerce.boolean().optional(),
});

// ────────────────────────────────────────────────────────────
// TEE
// ────────────────────────────────────────────────────────────

export const AttestationListQuerySchema = PaginationSchema.extend({
  verified: z.coerce.boolean().optional(),
});

// ────────────────────────────────────────────────────────────
// Wallet
// ────────────────────────────────────────────────────────────

export const WalletConnectSchema = z.object({
  address: AethelredAddressSchema,
  signature: z.string().min(1).max(500),
  timestamp: z.number().int().positive(),
  chainId: z.string().min(1).max(50).default('aethelred-1'),
  // Challenge fields for HMAC verification
  nonce: z.string().min(1).max(128),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  hmac: z.string().regex(/^[0-9a-f]{64}$/, 'Invalid HMAC'),
});

// ────────────────────────────────────────────────────────────
// IPFS
// ────────────────────────────────────────────────────────────

export const IPFSUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  size: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024), // 100 MB max
});

// ────────────────────────────────────────────────────────────
// Helper: parse query params from URLSearchParams
// ────────────────────────────────────────────────────────────

export function parseSearchParams<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams,
): z.infer<T> {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  return schema.parse(raw);
}
