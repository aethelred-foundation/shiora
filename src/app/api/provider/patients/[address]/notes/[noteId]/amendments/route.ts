// ============================================================
// Shiora on Aethelred — Clinical Note Amendment API
// POST /api/provider/patients/[address]/notes/[noteId]/amendments
//   — append an amendment to an existing note (append-only)
//   (provider audience; requires an active access grant from the patient)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, errorResponse, notFoundResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { AethelredAddressSchema } from '@/lib/api/validation';
import { providerHasActiveGrant } from '@/lib/api/access-service';
import { amendClinicalNote } from '@/lib/api/clinical-notes-service';

const AmendmentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

interface RouteContext {
  params: Promise<{ address: string; noteId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_clinical_notes');
  if ('status' in auth) return auth;

  const { address, noteId } = await context.params;
  if (!AethelredAddressSchema.safeParse(address).success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid patient address.', HTTP.BAD_REQUEST);
  }

  const provider = auth.walletAddress!;
  if (!(await providerHasActiveGrant(provider, address))) {
    return errorResponse('NO_ACCESS', 'No active access grant from this patient.', HTTP.FORBIDDEN);
  }

  try {
    const { body } = AmendmentSchema.parse(await request.json());
    const updated = await amendClinicalNote(address, noteId, provider, body);
    if (!updated) {
      return notFoundResponse('ClinicalNote', noteId);
    }
    return successResponse(updated, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
