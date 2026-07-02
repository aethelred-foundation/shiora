// ============================================================
// Shiora on Aethelred — Roles API
// GET    /api/roles — the authenticated caller's own roles
// POST   /api/roles — assign a role to an address (admin only)
// DELETE /api/roles — revoke a role from an address (admin only)
// ============================================================

import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';

import {
  successResponse,
  notFoundResponse,
  validationError,
  HTTP,
} from '@/lib/api/responses';
import { requireAuth, runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { AethelredAddressSchema } from '@/lib/api/validation';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/api/roles';
import { assignRole, getRoles, revokeRole } from '@/lib/api/roles-service';
import { audit } from '@/lib/api/audit';
import { requireStepUp } from '@/lib/api/step-up';

const RoleMutationSchema = z.object({
  address: AethelredAddressSchema,
  role: z.enum(ROLES),
});

function describeRoles(address: string, roles: Role[]) {
  return {
    address,
    roles,
    labels: roles.map((role) => ROLE_LABELS[role]),
  };
}

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if ('status' in auth) return auth;

  const roles = await getRoles(auth.walletAddress!);
  return successResponse(describeRoles(auth.walletAddress!, roles));
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  // Sensitive operation: accounts with MFA enabled must present a fresh
  // step-up assertion (GAP-07).
  const stepUp = await requireStepUp(request, auth.walletAddress!);
  if (stepUp) return stepUp;

  try {
    const body = await request.json();
    const { address, role } = RoleMutationSchema.parse(body);

    const assignment = await assignRole(address, role);
    audit({
      action: 'ROLE_ASSIGN',
      actor: auth.walletAddress!,
      resource: 'role',
      resourceId: address,
      success: true,
      metadata: { role },
    });

    return successResponse(assignment, HTTP.CREATED, {
      message: `Role '${role}' assigned to ${address}.`,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}

export async function DELETE(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  // Sensitive operation: accounts with MFA enabled must present a fresh
  // step-up assertion (GAP-07).
  const stepUp = await requireStepUp(request, auth.walletAddress!);
  if (stepUp) return stepUp;

  try {
    const body = await request.json();
    const { address, role } = RoleMutationSchema.parse(body);

    const assignment = await revokeRole(address, role);
    if (!assignment) {
      return notFoundResponse('RoleAssignment', address);
    }

    audit({
      action: 'ROLE_REVOKE',
      actor: auth.walletAddress!,
      resource: 'role',
      resourceId: address,
      success: true,
      metadata: { role },
    });

    return successResponse(assignment, HTTP.OK, {
      message: `Role '${role}' revoked from ${address}.`,
    });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
