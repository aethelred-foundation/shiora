// ============================================================
// Shiora on Aethelred — Audit Anchoring API (admin only)
// GET  /api/anchors — outbox jobs + the WORM anchor series, re-verified
// POST /api/anchors — run one outbox pass now (cut + work due jobs)
//
// Anchoring is asynchronous (transactional outbox): POST answers 202 with
// the pass report rather than pretending a synchronous anchor happened. The
// scheduler runs the same pass periodically; this endpoint exists for
// ops-triggered runs. Job rows expose the off-chain salt — this route is
// admin-only, and the salt is exactly what an admin hands an auditor
// together with the signed segment export.
// ============================================================

import { NextRequest } from 'next/server';

import { successResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { requireAdmin } from '@/lib/api/rbac';
import { listAnchors, verifyAnchors } from '@/lib/api/anchoring/anchor-service';
import { listAnchorJobs, runAnchorOutbox } from '@/lib/api/anchoring/anchor-outbox';

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  const jobs = await listAnchorJobs();
  const anchors = await listAnchors();
  const verification = await verifyAnchors();
  return successResponse({ jobs, anchors, verification });
}

export async function POST(request: NextRequest) {
  const blocked = await runMiddleware(request, { requireAuth: true });
  if (blocked) return blocked;

  const auth = await requireAdmin(request);
  if ('status' in auth) return auth;

  const report = await runAnchorOutbox();
  const jobs = await listAnchorJobs();
  return successResponse({ report, jobs }, HTTP.ACCEPTED);
}
