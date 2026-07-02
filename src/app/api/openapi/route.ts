// ============================================================
// Shiora on Aethelred — OpenAPI document (GAP-19)
// GET /api/openapi — the machine-readable API contract (OpenAPI 3.1)
//
// Public and unauthenticated: a spec is meant to be fetched by client
// generators and API explorers. It describes only the supported surface.
// ============================================================

import { NextResponse } from 'next/server';

import { HTTP } from '@/lib/api/responses';
import { buildOpenApiSpec } from '@/lib/api/openapi';

export function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    status: HTTP.OK,
    headers: {
      'Content-Type': 'application/json',
      // The contract is stable within a version; allow brief caching.
      'Cache-Control': 'public, max-age=300',
    },
  });
}
