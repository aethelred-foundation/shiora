// ============================================================
// Shiora on Aethelred — Network Status API
// GET /api/network/status — Aethelred blockchain network state
// ============================================================

import { NextRequest } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { errorResponse, HTTP, successResponse } from '@/lib/api/responses';
import { getLiveNetworkStatus, NetworkRpcError } from '@/lib/api/network-status';

// ────────────────────────────────────────────────────────────
// GET /api/network/status
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const endpoint = process.env.SHIORA_L1_RPC_URL;
  if (!endpoint) {
    return errorResponse(
      'NETWORK_RPC_NOT_CONFIGURED',
      'Live Aethelred network telemetry is not configured.',
      HTTP.SERVICE_UNAVAILABLE,
    );
  }

  const blockParam = request.nextUrl.searchParams.get('block');
  const requestedBlock = blockParam === null ? undefined : Number(blockParam);

  try {
    const network = await getLiveNetworkStatus(endpoint, requestedBlock);
    return successResponse(network, HTTP.OK, {
      chain: 'Aethelred',
      queriedAt: new Date().toISOString(),
      source: 'evm-json-rpc',
    });
  } catch (error) {
    if (error instanceof NetworkRpcError) {
      return errorResponse('NETWORK_RPC_UNAVAILABLE', error.message, 502);
    }
    throw error;
  }
}
