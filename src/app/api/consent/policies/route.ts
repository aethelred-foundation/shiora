/**
 * Shiora on Aethelred — Consent Policies API Route
 *
 * GET /api/consent/policies — List all consent policy templates
 */

import { NextResponse } from 'next/server';

import type { ConsentPolicy, ConsentScope, ApiResponse } from '@/types';

// ---------------------------------------------------------------------------
// Static policy data
// ---------------------------------------------------------------------------

const policies: ConsentPolicy[] = [
  {
    id: 'policy-0',
    name: 'Standard Clinical',
    description: 'Standard clinical access for primary care providers with essential health data scopes',
    scopes: ['lab_results', 'vitals', 'prescriptions', 'clinical_notes'] as ConsentScope[],
    maxDurationDays: 365,
    requiresAttestation: true,
    jurisdictions: ['us-ca', 'eu-gdpr'],
    createdAt: Date.now() - 180 * 86400000,
  },
  {
    id: 'policy-1',
    name: 'Research Only',
    description: 'Limited access for approved research institutions — anonymized aggregate data only',
    scopes: ['cycle_data', 'fertility_markers', 'lab_results'] as ConsentScope[],
    maxDurationDays: 180,
    requiresAttestation: true,
    jurisdictions: ['us-ca', 'eu-gdpr', 'uk'],
    createdAt: Date.now() - 120 * 86400000,
  },
  {
    id: 'policy-2',
    name: 'Emergency Access',
    description: 'Broad emergency access for critical care situations with full record visibility',
    scopes: ['full_access'] as ConsentScope[],
    maxDurationDays: 7,
    requiresAttestation: true,
    jurisdictions: ['us-ca'],
    createdAt: Date.now() - 90 * 86400000,
  },
  {
    id: 'policy-3',
    name: 'Specialist Referral',
    description: 'Scoped access for referred specialists such as endocrinologists or fertility experts',
    scopes: ['lab_results', 'imaging', 'clinical_notes', 'fertility_markers'] as ConsentScope[],
    maxDurationDays: 90,
    requiresAttestation: true,
    jurisdictions: ['us-ny', 'eu-gdpr'],
    createdAt: Date.now() - 60 * 86400000,
  },
  {
    id: 'policy-4',
    name: 'Full Records',
    description: 'Complete access to all health records for trusted long-term providers',
    scopes: [
      'cycle_data', 'fertility_markers', 'lab_results', 'imaging',
      'prescriptions', 'vitals', 'clinical_notes', 'wearable_data', 'ai_inferences',
    ] as ConsentScope[],
    maxDurationDays: 365,
    requiresAttestation: true,
    jurisdictions: ['us-ca', 'us-ny', 'eu-gdpr', 'uk'],
    createdAt: Date.now() - 30 * 86400000,
  },
];

// ---------------------------------------------------------------------------
// GET /api/consent/policies
// ---------------------------------------------------------------------------

export async function GET() {
  const body: ApiResponse<ConsentPolicy[]> = {
    success: true,
    data: policies,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
