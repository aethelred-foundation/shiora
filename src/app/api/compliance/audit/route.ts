// ============================================================
// Shiora on Aethelred — Compliance Audit Log API
// GET /api/compliance/audit — Paginated audit log
// ============================================================

import { NextRequest } from 'next/server';
import { paginatedResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededInt, seededHex, seededPick, seededAddress,
  generateAttestation,
} from '@/lib/utils';

const SEED = 2410;

const ACTIONS = [
  'Record accessed via FHIR API',
  'Access grant created for provider',
  'Encryption key rotated for vault',
  'Patient consent updated',
  'Data export request processed',
  'Audit report generated',
  'TEE enclave attestation verified',
  'Privacy policy acknowledged',
  'Emergency access override activated',
  'Data retention policy applied',
  'Access grant revoked',
  'HIPAA compliance scan completed',
  'GDPR data subject request fulfilled',
  'SOC 2 control evidence collected',
  'Backup integrity verification passed',
  'User authentication event logged',
  'API rate limit threshold reached',
  'Data anonymization pipeline executed',
  'Cross-border transfer authorization',
  'Incident response protocol triggered',
];

const RESOURCE_TYPES = [
  'HealthRecord', 'AccessGrant', 'EncryptionKey', 'ConsentPolicy',
  'AuditReport', 'TEEAttestation', 'UserSession', 'DataExport',
  'PrivacyRequest', 'ComplianceReport',
] as const;

const RESOURCES = [
  'rec-4a8bc1d2e3f4', 'grant-5b9cd2e3f4a5', 'key-6c0de3f4a5b6',
  'consent-7d1ef4a5b6c7', 'report-8e2fa5b6c7d8', 'tee-9f3ab6c7d8e9',
  'session-0a4bc7d8e9f0', 'export-1b5cd8e9f0a1', 'privacy-2c6de9f0a1b2',
  'scan-3d7ef0a1b2c3', 'vault-4e8fa1b2c3d4', 'pipeline-5f9ab2c3d4e5',
  'transfer-6a0bc3d4e5f6', 'incident-7b1cd4e5f6a7', 'backup-8c2de5f6a7b8',
  'auth-9d3ef6a7b8c9', 'rate-0e4fa7b8c9d0', 'anon-1f5ab8c9d0e1',
  'border-2a6bc9d0e1f2', 'response-3b7cd0e1f2a3',
] as const;

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10);

  try {
    const total = 200;
    const riskLevels = ['low', 'medium', 'high'] as const;

    const entries = Array.from({ length: limit }, (_, i) => {
      const idx = (page - 1) * limit + i;
      return {
        id: `audit-${seededHex(SEED + idx * 50, 12)}`,
        action: ACTIONS[idx % ACTIONS.length],
        actor: seededAddress(SEED + idx * 51),
        resource: RESOURCES[idx % RESOURCES.length],
        resourceType: RESOURCE_TYPES[idx % RESOURCE_TYPES.length],
        details: `Automated compliance event logged at block ${2847000 + seededInt(SEED + idx * 52, 0, 5000)}`,
        ipAddress: `10.${seededInt(SEED + idx * 53, 0, 255)}.${seededInt(SEED + idx * 54, 0, 255)}.${seededInt(SEED + idx * 55, 1, 254)}`,
        timestamp: Date.now() - idx * 3600000 * (1 + seededInt(SEED + idx * 56, 0, 3)),
        frameworkRelevance: [seededPick(SEED + idx * 57, ['hipaa', 'gdpr', 'soc2', 'hitrust', 'fda_21cfr11'] as const)],
        teeAttestation: generateAttestation(SEED + idx * 58),
        riskLevel: idx < 2 ? 'high' : seededPick(SEED + idx * 59, riskLevels),
      };
    });

    return paginatedResponse(entries, total, page, limit);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch audit log', HTTP.INTERNAL);
  }
}
