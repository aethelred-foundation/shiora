// ============================================================
// Shiora on Aethelred — IPFS Upload API
// POST /api/ipfs/upload — encrypt a file and store it content-addressed,
//   returning its REAL content-derived CID (all audiences; owner-scoped)
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { storeObject } from '@/lib/api/ipfs/ipfs-service';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse('NO_FILE', 'No file provided. Send a multipart form with a "file" field.', HTTP.BAD_REQUEST);
    }
    if (file.size > MAX_BYTES) {
      return errorResponse('FILE_TOO_LARGE', 'File exceeds the 100MB size limit.', HTTP.BAD_REQUEST);
    }

    const content = new Uint8Array(await file.arrayBuffer());
    // A multipart part always carries a content type (defaults to octet-stream).
    const object = await storeObject(auth.walletAddress!, content, file.name, file.type);

    return successResponse({
      cid: object.cid, // real, content-derived (encrypt-then-address)
      filename: object.filename,
      contentType: object.contentType,
      size: object.size,
      createdAt: object.createdAt,
      pinStatus: 'stored',
    }, HTTP.CREATED);
  } catch {
    return errorResponse('UPLOAD_FAILED', 'Failed to process the upload. Ensure the request is multipart/form-data.', HTTP.BAD_REQUEST);
  }
}
