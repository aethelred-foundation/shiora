// ============================================================
// Shiora on Aethelred — Vault Compartments API
// GET   /api/vault/compartments — the owner's real compartment set
// PATCH /api/vault/compartments — lock or unlock a compartment
//
// Compartments are real, persisted, owner-scoped vault state (encrypted at
// rest, lock changes audited). Record counts and storage are derived live
// from the user's actual entries — nothing is fabricated.
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse, notFoundResponse, validationError } from '@/lib/api/responses';
import { listCompartments, setCompartmentLock } from '@/lib/api/vault-service';

// ────────────────────────────────────────────────────────────
// GET /api/vault/compartments
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  return successResponse(await listCompartments(auth.walletAddress!));
}

// ────────────────────────────────────────────────────────────
// PATCH /api/vault/compartments — { id, action: 'lock' | 'unlock' }
// ────────────────────────────────────────────────────────────

const LockSchema = z.object({
  id: z.string().min(1).max(80),
  action: z.enum(['lock', 'unlock']),
});

export async function PATCH(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  try {
    const { id, action } = LockSchema.parse(await request.json());
    const updated = await setCompartmentLock(auth.walletAddress!, id, action);
    if (!updated) {
      return notFoundResponse('Compartment', id);
    }
    return successResponse(updated);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
