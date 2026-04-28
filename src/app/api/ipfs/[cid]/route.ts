// ============================================================
// Shiora on Aethelred — IPFS File Metadata API
// GET /api/ipfs/[cid] — Get pin status and node information
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { CIDSchema } from '@/lib/api/validation';
import { seededInt, seededHex, seededRandom, seededPick } from '@/lib/utils';
import { TEE_PLATFORMS } from '@/lib/constants';

interface RouteContext {
  params: Promise<{ cid: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/ipfs/[cid]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const { cid } = await context.params;

  // Validate CID format
  if (!CIDSchema.safeParse(cid).success) {
    return errorResponse('INVALID_CID', 'Invalid IPFS CID format.', HTTP.BAD_REQUEST);
  }

  // Generate deterministic metadata from the CID
  const seed = cid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const nodeCount = seededInt(seed, 12, 64);
  const pinned = seededRandom(seed) > 0.1; // 90% chance pinned

  return successResponse({
    cid,
    pinStatus: pinned ? 'pinned' : 'pinning',
    dagSize: seededInt(seed * 2, 20, 2000) * 1024,
    created: Date.now() - seededInt(seed * 3, 1, 90) * 86400000,
    replication: {
      current: nodeCount,
      target: 3,
      satisfied: nodeCount >= 3,
    },
    nodes: Array.from({ length: Math.min(nodeCount, 5) }, (_, i) => ({
      peerId: `12D3KooW${seededHex(seed + i * 100, 44)}`,
      region: seededPick(seed + i, [
        'us-east-1',
        'us-west-2',
        'eu-west-1',
        'eu-central-1',
        'ap-southeast-1',
      ] as const),
      latency: `${seededInt(seed + i * 50, 10, 200)}ms`,
    })),
    encryption: {
      encrypted: true,
      algorithm: 'AES-256-GCM',
      keyDerivation: 'HKDF-SHA256',
    },
    tee: {
      processed: pinned,
      platform: seededPick(seed * 7, TEE_PLATFORMS),
      attestationHash: pinned ? `0x${seededHex(seed * 5, 64)}` : null,
    },
  });
}
