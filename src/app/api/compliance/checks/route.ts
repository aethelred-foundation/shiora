// ============================================================
// Shiora on Aethelred — Compliance Checks API
// GET /api/compliance/checks?framework=hipaa — Controls for framework
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededInt, seededHex, seededPick, generateAttestation } from '@/lib/utils';

import type { ComplianceFrameworkId, ComplianceCheckStatus } from '@/types';

const SEED = 2430;

const CONTROL_NAMES: Record<string, string[]> = {
  hipaa: [
    'Access Control Policy', 'Audit Logging', 'Encryption at Rest', 'Encryption in Transit',
    'Incident Response Plan', 'Risk Assessment', 'Workforce Training', 'Business Associate Agreements',
    'Data Backup Procedures', 'Facility Access Controls', 'Workstation Security', 'Device Media Controls',
    'Unique User Identification', 'Emergency Access Procedure', 'Automatic Logoff',
  ],
  gdpr: [
    'Lawful Basis for Processing', 'Data Subject Rights', 'Data Protection Impact Assessment',
    'Records of Processing Activities', 'Data Breach Notification', 'Data Protection Officer',
    'International Data Transfers', 'Privacy by Design', 'Consent Management', 'Right to Erasure',
    'Data Portability', 'Automated Decision-Making', 'Children Data Protection', 'Processor Agreements',
    'Supervisory Authority Communication',
  ],
  soc2: [
    'Logical Access Controls', 'Change Management', 'System Monitoring', 'Incident Management',
    'Risk Management', 'Vendor Management', 'Data Classification', 'Encryption Standards',
    'Network Security', 'Vulnerability Management', 'Penetration Testing', 'Business Continuity',
    'Disaster Recovery', 'Security Awareness', 'Access Reviews',
  ],
  hitrust: [
    'Information Protection Program', 'Endpoint Protection', 'Portable Media Security',
    'Mobile Device Security', 'Wireless Security', 'Configuration Management', 'Vulnerability Remediation',
    'Network Protection', 'Transmission Protection', 'Password Management', 'Access Authorization',
    'Audit Logging and Monitoring', 'Education and Awareness', 'Third Party Assurance',
    'Incident Management Program',
  ],
  fda_21cfr11: [
    'Electronic Signature Controls', 'Audit Trail Requirements', 'System Validation',
    'Authority Checks', 'Device Checks', 'Operational System Checks', 'Personnel Qualification',
    'Record Integrity', 'Open System Controls', 'Closed System Controls', 'Signature Manifestation',
    'Signature/Record Linking', 'Digital Signature Standards', 'Biometric Controls',
    'Document Control Procedures',
  ],
};

const CATEGORIES = ['Administrative', 'Technical', 'Physical', 'Organizational', 'Operational'];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const framework = request.nextUrl.searchParams.get('framework') as ComplianceFrameworkId | null;

  if (!framework || !CONTROL_NAMES[framework]) {
    return errorResponse(
      'INVALID_FRAMEWORK',
      'A valid framework query parameter is required (hipaa, gdpr, soc2, hitrust, fda_21cfr11)',
      HTTP.BAD_REQUEST,
    );
  }

  try {
    const controlNames = CONTROL_NAMES[framework];
    const statuses: ComplianceCheckStatus[] = ['pass', 'fail', 'na', 'partial', 'not_assessed'];

    const checks = controlNames.map((name, i) => ({
      id: `check-${seededHex(SEED + i * 70, 8)}`,
      frameworkId: framework,
      controlId: `${framework.toUpperCase().replace('_', '-')}-${String(i + 1).padStart(3, '0')}`,
      controlName: name,
      description: `Verifies ${name.toLowerCase()} compliance requirements for ${framework.toUpperCase()} framework`,
      category: seededPick(SEED + i * 71, CATEGORIES),
      status: i < 10 ? seededPick(SEED + i * 72, ['pass', 'pass', 'pass', 'partial'] as const) : seededPick(SEED + i * 72, statuses),
      evidence: [`Evidence document ${i + 1}`, `TEE attestation log ${i + 1}`],
      remediation: seededPick(SEED + i * 73, statuses) === 'fail' ? `Apply corrective controls per ${framework.toUpperCase()} guidelines` : undefined,
      lastCheckedAt: Date.now() - seededInt(SEED + i * 74, 1, 30) * 86400000,
      teeVerified: seededInt(SEED + i * 75, 0, 10) > 2,
      attestation: seededInt(SEED + i * 76, 0, 10) > 3 ? generateAttestation(SEED + i * 77) : undefined,
    }));

    return successResponse(checks);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch compliance checks', HTTP.INTERNAL);
  }
}
