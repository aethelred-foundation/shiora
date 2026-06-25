// ============================================================
// Shiora on Aethelred — Provider Clinical Notes API
// GET  /api/provider/patients/[address]/notes — the provider's notes for a patient
// POST /api/provider/patients/[address]/notes — record a clinical note
//   (provider audience; requires an active access grant from the patient)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { AethelredAddressSchema } from '@/lib/api/validation';
import { providerHasActiveGrant } from '@/lib/api/access-service';
import {
  createClinicalNote,
  listClinicalNotesByProvider,
} from '@/lib/api/clinical-notes-service';

const NoteSchema = z.object({
  type: z.enum(['observation', 'assessment', 'plan', 'progress']),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

interface RouteContext {
  params: Promise<{ address: string }>;
}

/**
 * Resolve the provider identity and confirm an active grant from the patient.
 * Returns the verified pair, or an error NextResponse to return directly.
 */
async function authorizeForPatient(
  request: NextRequest,
  context: RouteContext,
): Promise<{ provider: string; patient: string } | Response> {
  const auth = await requireCapability(request, 'manage_clinical_notes');
  if ('status' in auth) return auth;

  const { address } = await context.params;
  if (!AethelredAddressSchema.safeParse(address).success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid patient address.', HTTP.BAD_REQUEST);
  }

  const provider = auth.walletAddress!;
  if (!(await providerHasActiveGrant(provider, address))) {
    return errorResponse(
      'NO_ACCESS',
      'No active access grant from this patient.',
      HTTP.FORBIDDEN,
    );
  }

  return { provider, patient: address };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const authorized = await authorizeForPatient(request, context);
  if (authorized instanceof Response) return authorized;

  let notes = await listClinicalNotesByProvider(authorized.patient, authorized.provider);
  const type = request.nextUrl.searchParams.get('type');
  if (type) {
    notes = notes.filter((note) => note.type === type);
  }
  return successResponse({ patientAddress: authorized.patient, total: notes.length, notes });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const authorized = await authorizeForPatient(request, context);
  if (authorized instanceof Response) return authorized;

  try {
    const input = NoteSchema.parse(await request.json());
    const note = await createClinicalNote(authorized.patient, authorized.provider, input);
    return successResponse(note, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
