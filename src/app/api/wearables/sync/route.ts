// ============================================================
// Shiora on Aethelred — Wearable Sync API
// POST /api/wearables/sync — Trigger a data sync
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateAttestation } from '@/lib/utils';

const SyncRequestSchema = z.object({
  deviceId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
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

  return successResponse(batches);
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
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
      message: 'Sync completed. Data verified via TEE attestation.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
