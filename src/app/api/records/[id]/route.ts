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
  notFoundResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { getRecord, softDeleteRecord, updateRecord } from '@/lib/api/store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/records/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const record = getRecord(auth.walletAddress!, id);

  if (!record) {
    return notFoundResponse('Record', id);
  }

  return successResponse({
    ...record,
    cryptography: {
      encryption: record.encryption,
      keyDerivation: 'HKDF-SHA256',
      ivLength: 12,
      tagLength: 128,
      cid: record.cid,
      txHash: record.txHash,
      attestation: record.attestation,
    },
    ipfs: {
      cid: record.cid,
      nodeCount: record.ipfsNodes,
      pinStatus: record.status === 'Pinned' || record.status === 'Verified' ? 'pinned' : 'pinning',
      replicationFactor: 3,
    },
    tee: {
      attestation: record.attestation,
      platform: 'Intel SGX',
      verified: record.status === 'Verified',
      enclaveId: `enclave-${record.id.replace('rec-', '')}`,
    },
  });
}

// ────────────────────────────────────────────────────────────
// PATCH /api/records/[id]
// ────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const record = getRecord(auth.walletAddress!, id);

  if (!record) {
    return notFoundResponse('Record', id);
  }

  try {
    const body = await request.json();
    const validated = RecordUpdateSchema.parse(body);

    // Build updated record (mock — not persisted)
    const updated = updateRecord(auth.walletAddress!, id, {
      ...(validated.label !== undefined && { label: validated.label }),
      ...(validated.description !== undefined && { description: validated.description }),
      ...(validated.tags !== undefined && { tags: validated.tags }),
      ...(validated.status !== undefined && { status: validated.status }),
    });

    if (!updated) {
      return notFoundResponse('Record', id);
    }

    return successResponse(updated, HTTP.OK, {
      message: 'Record metadata updated.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// DELETE /api/records/[id]
// ────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const record = getRecord(auth.walletAddress!, id);

  if (!record) {
    return notFoundResponse('Record', id);
  }

  const deletedRecord = softDeleteRecord(auth.walletAddress!, id);
  if (!deletedRecord) {
    return notFoundResponse('Record', id);
  }

  return successResponse(
    {
      id: deletedRecord.id,
      deleted: true,
      deletedAt: Date.now(),
      message: 'Record marked for deletion. IPFS content will be unpinned after the retention period.',
    },
    HTTP.OK,
  );
}
