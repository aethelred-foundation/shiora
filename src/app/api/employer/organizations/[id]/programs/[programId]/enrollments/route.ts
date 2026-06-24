// ============================================================
// Shiora on Aethelred — Employer Wellness Enrollment API
// GET  /api/employer/organizations/[id]/programs/[programId]/enrollments
//        — active enrollments + participation summary
// POST .../enrollments — enroll a member into the program
//   (employer-admin audience; caller must own the organization)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, notFoundResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { AethelredAddressSchema } from '@/lib/api/validation';
import { getOrganization } from '@/lib/api/employer-service';
import {
  enrollMember,
  listEnrollments,
  participationSummary,
  getProgram,
} from '@/lib/api/wellness-service';

const EnrollSchema = z.object({ address: AethelredAddressSchema });

interface RouteContext {
  params: Promise<{ id: string; programId: string }>;
}

/** Confirm the caller owns the org and the program exists within it. */
async function authorizeProgram(
  request: NextRequest,
  context: RouteContext,
): Promise<{ programId: string } | Response> {
  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  const { id, programId } = await context.params;
  const organization = await getOrganization(auth.walletAddress!, id);
  if (!organization) {
    return notFoundResponse('Organization', id);
  }

  const program = await getProgram(id, programId);
  if (!program) {
    return notFoundResponse('WellnessProgram', programId);
  }

  return { programId };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const authorized = await authorizeProgram(request, context);
  if (authorized instanceof Response) return authorized;

  const [enrolled, participation] = await Promise.all([
    listEnrollments(authorized.programId),
    participationSummary(authorized.programId),
  ]);
  return successResponse({ enrollments: enrolled, participation });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const authorized = await authorizeProgram(request, context);
  if (authorized instanceof Response) return authorized;

  try {
    const { address } = EnrollSchema.parse(await request.json());
    const enrollment = await enrollMember(authorized.programId, address);
    return successResponse(enrollment, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
