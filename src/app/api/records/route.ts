// ============================================================
// Shiora on Aethelred — Health Records API
// GET  /api/records — List records with pagination, filtering, sorting, search
// POST /api/records — Create a new health record
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  RecordCreateSchema,
  RecordListQuerySchema,
  parseSearchParams,
} from '@/lib/api/validation';
import {
  successResponse,
  paginatedResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import type { MockHealthRecord } from '@/lib/api/mock-data';
import { createRecord, listRecords } from '@/lib/api/store';
import { generateCID, generateTxHash, generateAttestation, seededHex, seededInt } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// GET /api/records
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const query = parseSearchParams(
      RecordListQuerySchema,
      request.nextUrl.searchParams,
    );

    let records = listRecords(auth.walletAddress!);

    // Filter by type
    if (query.type) {
      records = records.filter((r) => r.type === query.type);
    }

    // Filter by status
    if (query.status) {
      records = records.filter((r) => r.status === query.status);
    }

    // Search by query string
    if (query.q) {
      const q = query.q.toLowerCase();
      records = records.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.provider.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)) ||
          r.type.toLowerCase().includes(q),
      );
    }

    // Exclude deleted
    records = records.filter((r) => !r.deleted);

    // Sort
    const total = records.length;
    const mul = query.order === 'asc' ? 1 : -1;
    records = [...records].sort((a, b) => {
      if (query.sort === 'date') return mul * (a.date - b.date);
      if (query.sort === 'size') return mul * (a.size - b.size);
      return mul * a.label.localeCompare(b.label);
    });

    // Paginate
    const start = (query.page - 1) * query.limit;
    const paged = records.slice(start, start + query.limit);

    return paginatedResponse(paged, total, query.page, query.limit);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// POST /api/records
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const body = await request.json();
    const validated = RecordCreateSchema.parse(body);

    const seed = Date.now();
    const newRecord: MockHealthRecord = {
      id: `rec-${seededHex(seed, 12)}`,
      type: validated.type,
      label: validated.label,
      description: validated.description ?? `Encrypted health record uploaded at ${new Date().toISOString()}`,
      date: Date.now(),
      uploadDate: Date.now(),
      encrypted: true,
      encryption: validated.encryption,
      cid: generateCID(seed),
      txHash: generateTxHash(seed),
      attestation: generateAttestation(seed),
      size: seededInt(seed, 50, 2000) * 1024,
      provider: validated.provider,
      status: 'Processing',
      ipfsNodes: 0,
      tags: validated.tags,
      deleted: false,
      ownerAddress: auth.walletAddress!,
      blockHeight: 2847391 + seededInt(seed + 1, 1, 100),
    };

    const persistedRecord = createRecord(auth.walletAddress!, newRecord);

    return successResponse(persistedRecord, HTTP.CREATED, {
      message: 'Record created. IPFS pinning and TEE verification in progress.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
