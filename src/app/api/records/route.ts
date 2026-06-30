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
import { randomUUID } from 'node:crypto';
import { createRecord, listRecords } from '@/lib/api/records-service';

// ────────────────────────────────────────────────────────────
// GET /api/records
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const query = parseSearchParams(
      RecordListQuerySchema,
      request.nextUrl.searchParams,
    );

    let records = await listRecords(auth.walletAddress!);

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
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    const auth = requireAuth(request);
    if ('status' in auth) return auth;

    const body = await request.json();
    const validated = RecordCreateSchema.parse(body);

    const description =
      validated.description ?? `Health record created at ${new Date().toISOString()}`;
    // A record stores only its encrypted metadata — no file blob — so "size"
    // reflects that metadata payload rather than a fabricated file size.
    const contentBytes = Buffer.byteLength(
      JSON.stringify({ label: validated.label, description, tags: validated.tags }),
      'utf8',
    );
    const newRecord: MockHealthRecord = {
      id: `rec-${randomUUID().replace(/-/g, '')}`,
      type: validated.type,
      label: validated.label,
      description,
      date: Date.now(),
      uploadDate: Date.now(),
      encrypted: true,
      encryption: validated.encryption,
      // Records are encrypted at rest and integrity-tracked via the tamper-
      // evident audit chain. They are NOT IPFS-pinned, on-chain-anchored, or
      // TEE-attested, so these fields are left empty rather than fabricated.
      cid: '',
      txHash: '',
      attestation: '',
      size: contentBytes,
      provider: validated.provider,
      status: 'Verified',
      ipfsNodes: 0,
      tags: validated.tags,
      deleted: false,
      ownerAddress: auth.walletAddress!,
      blockHeight: 0,
    };

    const persistedRecord = await createRecord(auth.walletAddress!, newRecord);

    return successResponse(persistedRecord, HTTP.CREATED, {
      message: 'Record created and encrypted at rest.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
