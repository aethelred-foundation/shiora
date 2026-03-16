// ============================================================
// Shiora on Aethelred — Wearable Provider API
// POST   /api/wearables/[provider] — Connect a device
// DELETE /api/wearables/[provider] — Disconnect a device
// ============================================================

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  HTTP,
} from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateAttestation } from '@/lib/utils';
import { WEARABLE_PROVIDERS } from '@/lib/constants';

interface RouteContext {
  params: Promise<{ provider: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { provider } = await context.params;
  const providerMeta = WEARABLE_PROVIDERS.find((p) => p.id === provider);

  if (!providerMeta) {
    return errorResponse('INVALID_PROVIDER', `Unknown wearable provider: ${provider}`, HTTP.BAD_REQUEST);
  }

  const seed = Date.now();

  return successResponse(
    {
      id: `device-${seededHex(seed, 12)}`,
      provider: providerMeta.id,
      deviceName: providerMeta.name,
      status: 'connected',
      lastSync: Date.now(),
      dataPointsSynced: 0,
      batteryLevel: seededInt(seed, 50, 100),
      connectedAt: Date.now(),
      attestation: generateAttestation(seed),
    },
    HTTP.CREATED,
    { message: `${providerMeta.name} connected successfully.` },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { provider } = await context.params;

  return successResponse(
    {
      provider,
      status: 'disconnected',
      disconnectedAt: Date.now(),
      message: `Device disconnected. Data remains encrypted on IPFS.`,
    },
    HTTP.OK,
  );
}
