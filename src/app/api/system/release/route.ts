// ============================================================
// Shiora on Aethelred — Release provenance
// GET /api/system/release — public, non-PHI provenance surface
//
// The machine-readable counterpart to docs/RELEASE_PROCESS.md: version, git
// SHA, build time, migration version, and contract hashes, so an auditor can
// verify the running deployment matches the release record.
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { buildReleaseManifest } from '@/lib/api/release';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;
  return successResponse(buildReleaseManifest());
}
