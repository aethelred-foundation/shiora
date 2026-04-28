// ============================================================
// Shiora on Aethelred — Single Compartment API
// GET   /api/vault/compartments/[id] — Get compartment details
// PATCH /api/vault/compartments/[id] — Lock/unlock compartment
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse, notFoundResponse, validationError, HTTP } from '@/lib/api/responses';
import { seededInt, seededHex, seededPick } from '@/lib/utils';

const SEED = 700;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Simple mock lookup
function findCompartmentById(id: string) {
  const categories = [
    'cycle_tracking',
    'fertility_data',
    'hormone_levels',
    'medications',
    'lab_results',
    'imaging',
    'symptoms',
    'pregnancy',
  ];
  const labels: Record<string, string> = {
    cycle_tracking: 'Cycle Tracking',
    fertility_data: 'Fertility Data',
    hormone_levels: 'Hormone Levels',
    medications: 'Medications',
    lab_results: 'Lab Results',
    imaging: 'Imaging',
    symptoms: 'Symptoms',
    pregnancy: 'Pregnancy',
  };

  for (let i = 0; i < categories.length; i++) {
    const mockId = `vault-${seededHex(SEED + i * 100, 12)}`;
    if (mockId === id) {
      const catId = categories[i];
      return {
        id: mockId,
        category: catId,
        label: labels[catId],
        description: `Encrypted ${labels[catId].toLowerCase()} compartment with TEE-verified access controls`,
        lockStatus:
          i < 3 ? 'locked' : seededPick(SEED + i * 3, ['locked', 'unlocked', 'partial'] as const),
        recordCount: seededInt(SEED + i * 7, 5, 120),
        storageUsed: seededInt(SEED + i * 13, 50, 5000) * 1024,
        lastAccessed: Date.now() - seededInt(SEED + i * 17, 1, 30) * 86400000,
        encryptionKey: `0x${seededHex(SEED + i * 50, 64)}`,
        accessListCount: seededInt(SEED + i * 11, 0, 5),
        jurisdictionFlags: ['us-ca', 'eu-gdpr'].slice(0, seededInt(SEED + i * 9, 1, 2)),
        createdAt: Date.now() - seededInt(SEED + i * 23, 60, 365) * 86400000,
      };
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// GET /api/vault/compartments/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await context.params;
  const compartment = findCompartmentById(id);

  if (!compartment) {
    return notFoundResponse('Compartment', id);
  }

  return successResponse(compartment);
}

// ────────────────────────────────────────────────────────────
// PATCH /api/vault/compartments/[id]
// ────────────────────────────────────────────────────────────

const UpdateCompartmentSchema = z.object({
  lockStatus: z.enum(['locked', 'unlocked', 'partial']).optional(),
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { id } = await context.params;
  const compartment = findCompartmentById(id);

  if (!compartment) {
    return notFoundResponse('Compartment', id);
  }

  try {
    const body = await request.json();
    const validated = UpdateCompartmentSchema.parse(body);

    const updated = {
      ...compartment,
      ...(validated.lockStatus !== undefined && { lockStatus: validated.lockStatus }),
      ...(validated.label !== undefined && { label: validated.label }),
      ...(validated.description !== undefined && { description: validated.description }),
      lastAccessed: Date.now(),
    };

    return successResponse(updated, HTTP.OK, {
      message: `Compartment ${validated.lockStatus === 'locked' ? 'locked' : validated.lockStatus === 'unlocked' ? 'unlocked' : 'updated'} successfully.`,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
