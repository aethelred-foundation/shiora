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
import { seededHex, seededInt } from '@/lib/utils';
import { WEARABLE_PROVIDERS } from '@/lib/constants';


// Body-level honesty marker for this not-yet-real half of the pilot wearables
// feature: the device registry/sync surface is simulated until live vendor
// OAuth (Fitbit / Apple Health / Garmin) lands. Real, encrypted telemetry
// ingest and analytics live at /api/wearables/samples and /analytics.
const SIMULATED_DEVICE_SYNC_META = {
  simulatedSurface: true,
  note: 'Device registry and sync are simulated pending live vendor OAuth; real telemetry ingest is at /api/wearables/samples.',
} as const;

interface RouteContext {
  params: Promise<{ provider: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request);
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
    },
    HTTP.CREATED,
    { ...SIMULATED_DEVICE_SYNC_META, message: `${providerMeta.name} connected (simulated).` },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const { provider } = await context.params;

  return successResponse(
    {
      provider,
      status: 'disconnected',
      disconnectedAt: Date.now(),
      message: 'Device disconnected (simulated). Ingested telemetry remains encrypted at rest.',
    },
    HTTP.OK,
    { ...SIMULATED_DEVICE_SYNC_META },
  );
}
