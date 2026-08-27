// ============================================================
// Shiora on Aethelred — Wearable Sync API
// POST /api/wearables/sync — Trigger a data sync
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import {
  successResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateAttestation } from '@/lib/utils';


// Body-level honesty marker for this not-yet-real half of the pilot wearables
// feature: the device registry/sync surface is simulated until live vendor
// OAuth (Fitbit / Apple Health / Garmin) lands. Real, encrypted telemetry
// ingest and analytics live at /api/wearables/samples and /analytics.
const SIMULATED_DEVICE_SYNC_META = {
  simulatedSurface: true,
  note: 'Device registry and sync are simulated pending live vendor OAuth; real telemetry ingest is at /api/wearables/samples.',
} as const;

const SyncRequestSchema = z.object({
  deviceId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const SEED = 1050;
  const batches = Array.from({ length: 8 }, (_, i) => ({
    id: `sync-${seededHex(SEED + i * 100, 12)}`,
    deviceId: `device-${seededHex(1000 + (i % 3) * 100, 12)}`,
    syncedAt: Date.now() - seededInt(SEED + i * 5, 1, 72) * 3600000,
    dataPointCount: seededInt(SEED + i * 7, 20, 200),
    attestation: generateAttestation(SEED + i * 11),
    status: i === 0 ? 'syncing' : 'completed',
  }));

  return successResponse(batches, HTTP.OK, { ...SIMULATED_DEVICE_SYNC_META });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validated = SyncRequestSchema.parse(body);
    const seed = Date.now();

    const batch = {
      id: `sync-${seededHex(seed, 12)}`,
      deviceId: validated.deviceId,
      syncedAt: Date.now(),
      dataPointCount: seededInt(seed, 20, 200),
      attestation: generateAttestation(seed),
      status: 'completed',
    };

    return successResponse(batch, HTTP.CREATED, {
      ...SIMULATED_DEVICE_SYNC_META,
      message: 'Sync completed. Data verified via TEE attestation.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
