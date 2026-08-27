// ============================================================
// Shiora on Aethelred — Employer Wellness Programs API
// GET  /api/employer/organizations/[id]/programs — list an org's programs
// POST /api/employer/organizations/[id]/programs — create a program
//   (employer-admin audience; caller must own the organization)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, notFoundResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { getOrganization } from '@/lib/api/employer-service';
import { createProgram, listPrograms } from '@/lib/api/wellness-service';

const ProgramSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(['fitness', 'mental_health', 'nutrition', 'preventive', 'chronic_care']),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const organization = await getOrganization(auth.walletAddress!, id);
  if (!organization) {
    return notFoundResponse('Organization', id);
  }

  return successResponse(await listPrograms(id));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  const { id } = await context.params;
  const organization = await getOrganization(auth.walletAddress!, id);
  if (!organization) {
    return notFoundResponse('Organization', id);
  }

  try {
    const input = ProgramSchema.parse(await request.json());
    const program = await createProgram(id, input);
    return successResponse(program, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
