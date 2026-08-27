// ============================================================
// Shiora on Aethelred — Role-Based Access Control
//
// Authorization helpers layered on top of requireAuth. `requireRole` gates a
// route to one or more audience roles; `requireAdmin` gates role-management
// operations to administrative authority.
//
// Administrative authority is held by:
//   1. addresses in SHIORA_ADMIN_ADDRESSES (the bootstrap allowlist), and
//   2. any address carrying the `government` role.
// The env allowlist solves the bootstrap problem (who grants the first roles)
// without baking a privileged key into code.
// ============================================================

import { type NextRequest, type NextResponse } from 'next/server';

import { requireAuth, type AuthContext } from './middleware';
import { errorResponse, HTTP } from './responses';
import { getRoles } from './roles-service';
import { capabilitiesFor, type Capability } from './capabilities';
import type { Role } from './roles';

function adminAllowlist(): Set<string> {
  const raw = process.env.SHIORA_ADMIN_ADDRESSES;
  if (!raw) {
    return new Set();
  }
  return new Set(raw.split(',').map((entry) => entry.trim()).filter(Boolean));
}

/** True when an address may manage roles (allowlist or government role). */
export async function isAdmin(address: string): Promise<boolean> {
  if (adminAllowlist().has(address)) {
    return true;
  }
  return (await getRoles(address)).includes('government');
}

/**
 * Require the caller to hold at least one of `roles`. Returns the authenticated
 * context on success, or a 401/403 response.
 */
export async function requireRole(
  request: NextRequest,
  ...roles: Role[]
): Promise<AuthContext | NextResponse> {
  const auth = requireAuth(request);
  if ('status' in auth) {
    return auth;
  }

  const held = await getRoles(auth.walletAddress!);
  if (!roles.some((role) => held.includes(role))) {
    return errorResponse(
      'FORBIDDEN',
      `This action requires one of the following roles: ${roles.join(', ')}.`,
      HTTP.FORBIDDEN,
    );
  }
  return auth;
}

/**
 * Require the caller's roles to grant `capability`. Returns the authenticated
 * context on success, or a 401/403 response.
 */
export async function requireCapability(
  request: NextRequest,
  capability: Capability,
): Promise<AuthContext | NextResponse> {
  const auth = requireAuth(request);
  if ('status' in auth) {
    return auth;
  }

  const held = await getRoles(auth.walletAddress!);
  if (!capabilitiesFor(held).includes(capability)) {
    return errorResponse(
      'FORBIDDEN',
      `This action requires the '${capability}' capability.`,
      HTTP.FORBIDDEN,
    );
  }
  return auth;
}

/** Require administrative authority (role management). */
export async function requireAdmin(
  request: NextRequest,
): Promise<AuthContext | NextResponse> {
  const auth = requireAuth(request);
  if ('status' in auth) {
    return auth;
  }

  if (!(await isAdmin(auth.walletAddress!))) {
    return errorResponse(
      'FORBIDDEN',
      'Administrative authority is required to manage roles.',
      HTTP.FORBIDDEN,
    );
  }
  return auth;
}
