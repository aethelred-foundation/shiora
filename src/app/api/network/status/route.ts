// ============================================================
// Shiora on Aethelred — Network Status API
// GET /api/network/status — Aethelred blockchain network state
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateNetworkStatus } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/network/status
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const network = generateNetworkStatus();

  return successResponse(network, 200, {
    chain: 'Aethelred',
    chainId: 'aethelred-1',
    queriedAt: new Date().toISOString(),
  });
}
