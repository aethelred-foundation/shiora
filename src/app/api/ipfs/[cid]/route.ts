// ============================================================
// Shiora on Aethelred — IPFS Object Resolution API
// GET /api/ipfs/[cid] — resolve a CID the caller owns: integrity-check the
//   stored bytes against the CID, then return the decrypted content
//   (all audiences; owner-scoped)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, errorResponse, notFoundResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { CIDSchema } from '@/lib/api/validation';
import { resolveObject } from '@/lib/api/ipfs/ipfs-service';

interface RouteContext {
  params: Promise<{ cid: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { cid } = await context.params;
  if (!CIDSchema.safeParse(cid).success) {
    return errorResponse('INVALID_CID', 'Invalid IPFS CID format.', HTTP.BAD_REQUEST);
  }

  const resolved = await resolveObject(auth.walletAddress!, cid);
  if (!resolved) {
    return notFoundResponse('IpfsObject', cid);
  }
  if (!resolved.integrityVerified) {
    return errorResponse(
      'INTEGRITY_FAILED',
      'The stored content does not match its CID — it may have been tampered with.',
      HTTP.UNPROCESSABLE,
    );
  }

  const { object, content } = resolved;
  return successResponse({
    cid: object.cid,
    filename: object.filename,
    contentType: object.contentType,
    size: object.size,
    createdAt: object.createdAt,
    integrityVerified: true,
    content, // base64 of the decrypted content
  });
}
