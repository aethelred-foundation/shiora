// ============================================================
// Shiora on Aethelred — Vault Compartments API
// GET  /api/vault/compartments — List all compartments
// POST /api/vault/compartments — Create a new compartment
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { runMiddleware } from '@/lib/api/middleware';
import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { seededInt, seededHex, seededPick, seededRandom, generateAttestation } from '@/lib/utils';

const SEED = 700;

const VAULT_CATEGORY_IDS = [
  'cycle_tracking', 'fertility_data', 'hormone_levels',
  'medications', 'lab_results', 'imaging', 'symptoms', 'pregnancy',
] as const;

const VAULT_CATEGORY_LABELS: Record<string, string> = {
  cycle_tracking: 'Cycle Tracking',
  fertility_data: 'Fertility Data',
  hormone_levels: 'Hormone Levels',
  medications: 'Medications',
  lab_results: 'Lab Results',
  imaging: 'Imaging',
  symptoms: 'Symptoms',
  pregnancy: 'Pregnancy',
};

function generateMockCompartments() {
  return VAULT_CATEGORY_IDS.map((catId, i) => ({
    id: `vault-${seededHex(SEED + i * 100, 12)}`,
    category: catId,
    label: VAULT_CATEGORY_LABELS[catId],
    description: `Encrypted ${VAULT_CATEGORY_LABELS[catId].toLowerCase()} compartment with TEE-verified access controls`,
    lockStatus: i < 3 ? 'locked' : seededPick(SEED + i * 3, ['locked', 'unlocked', 'partial'] as const),
    recordCount: seededInt(SEED + i * 7, 5, 120),
    storageUsed: seededInt(SEED + i * 13, 50, 5000) * 1024,
    lastAccessed: Date.now() - seededInt(SEED + i * 17, 1, 30) * 86400000,
    encryptionKey: `0x${seededHex(SEED + i * 50, 64)}`,
    accessListCount: seededInt(SEED + i * 11, 0, 5),
    jurisdictionFlags: ['us-ca', 'eu-gdpr'].slice(0, seededInt(SEED + i * 9, 1, 2)),
    createdAt: Date.now() - seededInt(SEED + i * 23, 60, 365) * 86400000,
  }));
}

// ────────────────────────────────────────────────────────────
// GET /api/vault/compartments
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const compartments = generateMockCompartments();

  return successResponse({
    compartments,
    total: compartments.length,
  });
}

// ────────────────────────────────────────────────────────────
// POST /api/vault/compartments
// ────────────────────────────────────────────────────────────

const CreateCompartmentSchema = z.object({
  category: z.enum(VAULT_CATEGORY_IDS),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const validated = CreateCompartmentSchema.parse(body);

    const seed = Date.now();
    const newCompartment = {
      id: `vault-${seededHex(seed, 12)}`,
      category: validated.category,
      label: validated.label,
      description: validated.description ?? `Encrypted ${validated.label.toLowerCase()} compartment`,
      lockStatus: 'locked',
      recordCount: 0,
      storageUsed: 0,
      lastAccessed: Date.now(),
      encryptionKey: `0x${seededHex(seed + 1, 64)}`,
      accessListCount: 0,
      jurisdictionFlags: ['us-ca'],
      createdAt: Date.now(),
    };

    return successResponse(newCompartment, HTTP.CREATED, {
      message: 'Compartment created with AES-256-GCM encryption.',
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
