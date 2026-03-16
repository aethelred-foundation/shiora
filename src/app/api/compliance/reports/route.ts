// ============================================================
// Shiora on Aethelred — Compliance Reports API
// GET  /api/compliance/reports — List reports
// POST /api/compliance/reports — Generate new report
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededPick } from '@/lib/utils';

import type { ComplianceFrameworkId } from '@/types';

const SEED = 2420;

const FRAMEWORK_IDS: ComplianceFrameworkId[] = ['hipaa', 'gdpr', 'soc2', 'hitrust', 'fda_21cfr11'];

function generateReports() {
  const statuses = ['draft', 'final', 'archived'] as const;
  const titles = [
    'HIPAA Annual Compliance Assessment',
    'GDPR Data Protection Impact Assessment',
    'SOC 2 Type II Audit Report',
    'HITRUST CSF Certification Report',
    'FDA 21 CFR Part 11 Validation Report',
    'Cross-Framework Gap Analysis',
  ];

  return Array.from({ length: 6 }, (_, i) => ({
    id: `report-${seededHex(SEED + i * 100, 8)}`,
    frameworkId: FRAMEWORK_IDS[i % FRAMEWORK_IDS.length],
    title: titles[i],
    generatedAt: Date.now() - seededInt(SEED + i * 101, 5, 60) * 86400000,
    period: {
      start: Date.now() - 365 * 86400000,
      end: Date.now(),
    },
    overallScore: seededInt(SEED + i * 102, 82, 98),
    findings: seededInt(SEED + i * 103, 3, 18),
    criticalGaps: seededInt(SEED + i * 104, 0, 4),
    status: i === 0 ? 'draft' : seededPick(SEED + i * 105, statuses),
  }));
}

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    return successResponse(generateReports());
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch reports', HTTP.INTERNAL);
  }
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { frameworkId, period } = body;

    const seed = Date.now();
    const report = {
      id: `report-${seededHex(seed, 8)}`,
      frameworkId: frameworkId ?? 'hipaa',
      title: `Compliance Report — ${frameworkId?.toUpperCase() ?? 'HIPAA'}`,
      generatedAt: Date.now(),
      period: period ?? { start: Date.now() - 90 * 86400000, end: Date.now() },
      overallScore: seededInt(seed, 80, 98),
      findings: seededInt(seed + 1, 2, 15),
      criticalGaps: seededInt(seed + 2, 0, 3),
      status: 'draft' as const,
    };

    return successResponse(report, HTTP.CREATED);
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
