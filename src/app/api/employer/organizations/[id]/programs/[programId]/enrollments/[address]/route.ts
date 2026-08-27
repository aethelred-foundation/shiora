// ============================================================
// Shiora on Aethelred — Wellness Enrollment Management API
// PATCH  .../enrollments/[address] — record a member's progress (0–100)
// DELETE .../enrollments/[address] — withdraw a member
//   (employer-admin audience; caller must own the organization)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, notFoundResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { AethelredAddressSchema } from '@/lib/api/validation';
import { getOrganization } from '@/lib/api/employer-service';
import { getProgram, updateProgress, withdrawMember } from '@/lib/api/wellness-service';

const ProgressSchema = z.object({ progress: z.number().int().min(0).max(100) });

interface RouteContext {
  params: Promise<{ id: string; programId: string; address: string }>;
}

async function authorize(
  request: NextRequest,
  context: RouteContext,
): Promise<{ programId: string; address: string } | Response> {
  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  const { id, programId, address } = await context.params;
  if (!AethelredAddressSchema.safeParse(address).success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid member address.', HTTP.BAD_REQUEST);
  }

  const organization = await getOrganization(auth.walletAddress!, id);
  if (!organization) {
    return notFoundResponse('Organization', id);
  }

  const program = await getProgram(id, programId);
  if (!program) {
    return notFoundResponse('WellnessProgram', programId);
  }

  return { programId, address };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const authorized = await authorize(request, context);
  if (authorized instanceof Response) return authorized;

  try {
    const { progress } = ProgressSchema.parse(await request.json());
    const updated = await updateProgress(authorized.programId, authorized.address, progress);
    if (!updated) {
      return notFoundResponse('ProgramEnrollment', authorized.address);
    }
    return successResponse(updated);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const authorized = await authorize(request, context);
  if (authorized instanceof Response) return authorized;

  const withdrawn = await withdrawMember(authorized.programId, authorized.address);
  if (!withdrawn) {
    return notFoundResponse('ProgramEnrollment', authorized.address);
  }
  return successResponse(withdrawn);
}
