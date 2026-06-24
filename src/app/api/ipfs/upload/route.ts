// ============================================================
// Shiora on Aethelred — IPFS Upload API
// POST /api/ipfs/upload — Upload file to IPFS (mock)
// ============================================================

import { NextRequest } from 'next/server';
import {
  errorResponse,
  HTTP,
} from '@/lib/api/responses';
import { simulatedResponse } from '@/lib/api/maturity';
import { runMiddleware } from '@/lib/api/middleware';
import { generateCID, seededHex, seededInt } from '@/lib/utils';

// ────────────────────────────────────────────────────────────
// POST /api/ipfs/upload
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  try {
    // Accept multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse(
        'NO_FILE',
        'No file provided. Send a multipart form with a "file" field.',
        HTTP.BAD_REQUEST,
      );
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      return errorResponse(
        'FILE_TOO_LARGE',
        'File exceeds the 100MB size limit.',
        HTTP.BAD_REQUEST,
      );
    }

    const seed = Date.now();
    const cid = generateCID(seed);

    return simulatedResponse(
      {
        cid,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        pinStatus: 'queued',
        encryption: {
          algorithm: 'AES-256-GCM',
          keyId: `key-${seededHex(seed, 16)}`,
          encrypted: true,
        },
        ipfs: {
          cid,
          dagSize: file.size,
          nodeId: `peer-${seededHex(seed + 1, 12)}`,
          estimatedPinTime: `${seededInt(seed, 5, 30)}s`,
          replicationTarget: 3,
        },
        tee: {
          willProcess: true,
          estimatedProcessTime: `${seededInt(seed + 2, 10, 60)}s`,
          platform: 'Intel SGX',
        },
      },
      'ipfs_storage',
      HTTP.CREATED,
    );
  } catch {
    return errorResponse(
      'UPLOAD_FAILED',
      'Failed to process the upload. Ensure the request is multipart/form-data.',
      HTTP.BAD_REQUEST,
    );
  }
}
