// ============================================================
// Shiora on Aethelred — Single Compartment API
// GET   /api/vault/compartments/[id] — compartment detail (real, derived stats)
// PATCH /api/vault/compartments/[id] — lock or unlock the compartment
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { runMiddleware, requireAuth } from '@/lib/api/middleware';
import { successResponse, notFoundResponse, validationError } from '@/lib/api/responses';
import { getCompartment, setCompartmentLock } from '@/lib/api/vault-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/vault/compartments/[id]
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const compartment = await getCompartment(auth.walletAddress!, id);
  if (!compartment) {
    return notFoundResponse('Compartment', id);
  }
  return successResponse(compartment);
}

// ────────────────────────────────────────────────────────────
// PATCH /api/vault/compartments/[id] — { action: 'lock' | 'unlock' }
// ────────────────────────────────────────────────────────────

const LockSchema = z.object({
  action: z.enum(['lock', 'unlock']),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const { id } = await context.params;
  try {
    const { action } = LockSchema.parse(await request.json());
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
