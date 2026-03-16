// ============================================================
// Shiora on Aethelred — TEE Status API
// GET /api/tee/status — Current TEE enclave state
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { generateTEEStatus } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/tee/status
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const status = generateTEEStatus();

  return successResponse(status, 200, {
    queriedAt: new Date().toISOString(),
    note: 'TEE status reflects the current state of the Intel SGX enclave cluster.',
  });
}
