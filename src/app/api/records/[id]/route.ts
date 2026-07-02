// ============================================================
// Shiora on Aethelred — Single Record API
// GET    /api/records/[id] — Get full record with crypto details
// PATCH  /api/records/[id] — Update record metadata
// DELETE /api/records/[id] — Soft-delete a record
// ============================================================

import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { RecordUpdateSchema } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { getRecord, softDeleteRecord, updateRecord, recordVersion } from '@/lib/api/records-service';
import { isOptimisticLockError } from '@/lib/persistence/optimistic-lock';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Parse a numeric If-Match precondition (optionally quoted, e.g. `"3"`).
 * Returns undefined when absent, or NaN when malformed so the caller 400s.
 */
function parseIfMatch(request: NextRequest): number | undefined {
  const header = request.headers.get('if-match');
  if (header === null) return undefined;
  return Number(header.replace(/"/g, '').trim());
}

// ────────────────────────────────────────────────────────────
// GET /api/records/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const record = await getRecord(auth.walletAddress!, id);

  if (!record) {
    return notFoundResponse('Record', id);
  }

  // Honest crypto metadata only: the record payload is sealed at rest with
  // AES-256-GCM (96-bit IV, 128-bit auth tag). Records are NOT IPFS-pinned,
  // on-chain-anchored, or TEE-attested, so no ipfs/tee/cid/txHash/attestation
  // facts are fabricated here.
  const version = await recordVersion(auth.walletAddress!, id);
  return successResponse(
    {
      ...record,
      version,
      cryptography: {
        encryption: record.encryption,
        ivLength: 12,
        tagLength: 128,
      },
    },
    HTTP.OK,
    undefined,
    // ETag lets a client capture the version and send it back as If-Match on
    // update for optimistic concurrency (GAP-18).
    version !== undefined ? { ETag: `"${version}"` } : undefined,
  );
}

// ────────────────────────────────────────────────────────────
// PATCH /api/records/[id]
// ────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const record = await getRecord(auth.walletAddress!, id);

  if (!record) {
    return notFoundResponse('Record', id);
  }

  // Optional optimistic concurrency: an If-Match precondition rejects the
  // update (412) if another writer changed the record since the client read it.
  const expectedVersion = parseIfMatch(request);
  if (expectedVersion !== undefined && Number.isNaN(expectedVersion)) {
    return errorResponse(
      'INVALID_IF_MATCH',
      'If-Match must be the record version number (optionally quoted).',
      HTTP.BAD_REQUEST,
    );
  }

  try {
    const body = await request.json();
    const validated = RecordUpdateSchema.parse(body);

    const updated = await updateRecord(auth.walletAddress!, id, {
      ...(validated.label !== undefined && { label: validated.label }),
      ...(validated.description !== undefined && { description: validated.description }),
      ...(validated.tags !== undefined && { tags: validated.tags }),
      ...(validated.status !== undefined && { status: validated.status }),
    }, expectedVersion);

    if (!updated) {
      return notFoundResponse('Record', id);
    }

    const newVersion = await recordVersion(auth.walletAddress!, id);
    return successResponse(
      { ...updated, version: newVersion },
      HTTP.OK,
      { message: 'Record metadata updated.' },
      newVersion !== undefined ? { ETag: `"${newVersion}"` } : undefined,
    );
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    if (isOptimisticLockError(err)) {
      return errorResponse(
        'VERSION_CONFLICT',
        `This record was modified by another request (expected version ${err.expected}, current ${err.actual}). Re-read and retry.`,
        HTTP.PRECONDITION_FAILED,
      );
    }
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// DELETE /api/records/[id]
// ────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const record = await getRecord(auth.walletAddress!, id);

  if (!record) {
    return notFoundResponse('Record', id);
  }

  const deletedRecord = await softDeleteRecord(auth.walletAddress!, id);
  if (!deletedRecord) {
    return notFoundResponse('Record', id);
  }

  return successResponse(
    {
      id: deletedRecord.id,
      deleted: true,
      deletedAt: Date.now(),
      message: 'Record marked for deletion.',
    },
    HTTP.OK,
  );
}
