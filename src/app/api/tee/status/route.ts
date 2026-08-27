// ============================================================
// Shiora on Aethelred — TEE Status API
// GET /api/tee/status — Current TEE enclave state
// ============================================================

import { NextRequest } from 'next/server';
import { simulatedResponse } from '@/lib/api/maturity';
import { runMiddleware } from '@/lib/api/middleware';
import { generateTEEStatus } from '@/lib/api/mock-data';

// ────────────────────────────────────────────────────────────
// GET /api/tee/status
// ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const blocked = await runMiddleware(request);
  if (blocked) return blocked;

  const status = generateTEEStatus();

  return simulatedResponse(status, 'tee_attestation', 200, {
    queriedAt: new Date().toISOString(),
  });
}
