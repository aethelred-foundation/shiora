// ============================================================
// Shiora on Aethelred — Compliance API
// GET /api/compliance?view=overview|frameworks|violations
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom, seededInt, seededHex, seededPick,
} from '@/lib/utils';

import type { ComplianceFrameworkId } from '@/types';

const SEED = 2400;

const FRAMEWORK_IDS: ComplianceFrameworkId[] = ['hipaa', 'gdpr', 'soc2', 'hitrust', 'fda_21cfr11'];
const FRAMEWORK_META: Record<ComplianceFrameworkId, { name: string; version: string; description: string }> = {
  hipaa: { name: 'HIPAA', version: '2024 Rev', description: 'Health Insurance Portability and Accountability Act — privacy and security standards for PHI' },
  gdpr: { name: 'GDPR', version: 'Art. 9', description: 'General Data Protection Regulation — EU data protection and privacy framework' },
  soc2: { name: 'SOC 2', version: 'Type II', description: 'Service Organization Control 2 — trust services criteria for security and availability' },
  hitrust: { name: 'HITRUST', version: 'CSF v11', description: 'Health Information Trust Alliance Common Security Framework' },
  fda_21cfr11: { name: 'FDA 21 CFR 11', version: '2024', description: 'Electronic records and electronic signatures regulation' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function generateOverview() {
  const frameworks = FRAMEWORK_IDS.map((id, i) => {
    const totalControls = seededInt(SEED + i * 100, 40, 120);
    const passedControls = seededInt(SEED + i * 101, Math.round(totalControls * 0.7), totalControls);
    const failedControls = seededInt(SEED + i * 102, 0, totalControls - passedControls);
    const notAssessedControls = totalControls - passedControls - failedControls;
    return {
      id,
      name: FRAMEWORK_META[id].name,
      description: FRAMEWORK_META[id].description,
      version: FRAMEWORK_META[id].version,
      totalControls,
      passedControls,
      failedControls,
      notAssessedControls,
      overallScore: Math.round((passedControls / totalControls) * 100),
      lastAssessedAt: Date.now() - seededInt(SEED + i * 103, 5, 45) * 86400000,
      nextAssessmentDue: Date.now() + seededInt(SEED + i * 104, 10, 90) * 86400000,
    };
  });

  const complianceTrend = MONTHS.map((month, i) => ({
    month,
    score: Math.round(85 + seededRandom(SEED + i * 200) * 12),
  }));

  return {
    frameworks,
    overallComplianceScore: Math.round(frameworks.reduce((s, f) => s + f.overallScore, 0) / frameworks.length),
    activeViolations: seededInt(SEED + 500, 2, 8),
    daysSinceLastAudit: seededInt(SEED + 501, 5, 30),
    upcomingAssessments: frameworks.slice(0, 3).map((f) => ({
      frameworkId: f.id,
      dueDate: f.nextAssessmentDue,
    })),
    complianceTrend,
  };
}

function generateViolations() {
  const severities = ['critical', 'high', 'medium', 'low'] as const;
  const titles = [
    'Unencrypted PHI found in audit log metadata',
    'Access control policy not enforced on FHIR endpoint',
    'Missing data retention schedule for EU subjects',
    'Incomplete audit trail for record deletion events',
    'Weak encryption on backup storage volumes',
    'Missing consent verification for data sharing',
    'Insufficient monitoring of privileged access',
    'Expired SSL certificate on data exchange endpoint',
  ];

  return Array.from({ length: 8 }, (_, i) => ({
    id: `viol-${seededHex(SEED + i * 300, 8)}`,
    frameworkId: seededPick(SEED + i * 301, FRAMEWORK_IDS),
    controlId: `${seededPick(SEED + i * 302, ['AC', 'AU', 'SC', 'IR', 'RA', 'PE'] as const)}-${seededInt(SEED + i * 303, 1, 20)}`,
    severity: i < 2 ? 'critical' : seededPick(SEED + i * 304, severities),
    title: titles[i],
    description: `Detected non-compliance during automated TEE-verified assessment scan at block ${2850000 + i * 12}`,
    detectedAt: Date.now() - seededInt(SEED + i * 305, 1, 60) * 86400000,
    resolvedAt: i >= 5 ? Date.now() - seededInt(SEED + i * 306, 1, 10) * 86400000 : undefined,
    assignedTo: seededPick(SEED + i * 307, ['Dr. Sarah Chen', 'Security Team', 'Compliance Officer', 'DevOps Lead', 'Privacy Officer'] as const),
    remediationPlan: `Implement corrective action per ${seededPick(SEED + i * 308, ['NIST SP 800-53', 'ISO 27001', 'HITRUST CSF'] as const)} control requirements`,
    status: (i >= 6 ? 'resolved' : i >= 4 ? 'in_progress' : seededPick(SEED + i * 309, ['open', 'in_progress'] as const)) as 'open' | 'in_progress' | 'resolved' | 'accepted_risk',
  }));
}

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const view = request.nextUrl.searchParams.get('view') ?? 'overview';

  try {
    switch (view) {
      case 'overview':
        return successResponse(generateOverview());
      case 'frameworks':
        return successResponse(generateOverview().frameworks);
      case 'violations':
        return successResponse(generateViolations());
      default:
        return errorResponse('INVALID_VIEW', `Unknown view: ${view}`, HTTP.BAD_REQUEST);
    }
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch compliance data', HTTP.INTERNAL);
  }
}
