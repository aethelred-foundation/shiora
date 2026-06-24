// ============================================================
// Shiora on Aethelred — Employer Organizations API
// GET  /api/employer/organizations — the caller's organizations
// POST /api/employer/organizations — create an organization
//   (employer-admin audience)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import { successResponse, validationError, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireCapability } from '@/lib/api/rbac';
import { createOrganization, listOrganizations } from '@/lib/api/employer-service';

const OrgCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(100).optional(),
});

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  return successResponse(await listOrganizations(auth.walletAddress!));
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireCapability(request, 'manage_org_members');
  if ('status' in auth) return auth;

  try {
    const input = OrgCreateSchema.parse(await request.json());
    const organization = await createOrganization(auth.walletAddress!, input);
    return successResponse(organization, HTTP.CREATED);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
