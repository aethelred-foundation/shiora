// ============================================================
// Shiora on Aethelred — Care Handoffs API
// GET  /api/emergency/handoffs — List handoffs
// POST /api/emergency/handoffs — Initiate handoff
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateAttestation, generateTxHash } from '@/lib/utils';

const SEED = 2540;

const HANDOFFS = [
  {
    fromProvider: 'Dr. Sarah Chen',
    toProvider: 'Dr. James Liu',
    patientSummary: 'Patient with Type 2 Diabetes and Hypertension requiring cardiology evaluation after elevated troponin detected during routine labs',
    outstandingIssues: ['Cardiology stress test needed', 'Adjust antihypertensive regimen', 'Schedule follow-up echocardiogram'],
    medications: ['Metformin 500mg BID', 'Lisinopril 10mg daily', 'Atorvastatin 20mg daily', 'Aspirin 81mg daily', 'Metoprolol 25mg BID'],
  },
  {
    fromProvider: 'Dr. James Liu',
    toProvider: 'Dr. Aisha Patel',
    patientSummary: 'Post-cardiac evaluation — stress test normal, HbA1c elevated at 8.2% requiring endocrine specialist for diabetes optimization',
    outstandingIssues: ['Optimize insulin sensitizer therapy', 'Consider GLP-1 receptor agonist', 'Recheck HbA1c in 3 months'],
    medications: ['Metformin 500mg BID', 'Lisinopril 10mg daily', 'Atorvastatin 20mg daily', 'Aspirin 81mg daily', 'Metoprolol 25mg BID'],
  },
  {
    fromProvider: 'Dr. Aisha Patel',
    toProvider: 'Nurse Emily Rodriguez',
    patientSummary: 'Endocrine adjustment complete — added Semaglutide for improved glycemic control. Requires regular monitoring and patient education on injection technique',
    outstandingIssues: ['Monitor for GI side effects', 'Weekly injection adherence check', 'Schedule follow-up labs in 6 weeks'],
    medications: ['Metformin 500mg BID', 'Semaglutide 0.25mg weekly', 'Lisinopril 10mg daily', 'Atorvastatin 20mg daily', 'Metoprolol 25mg BID'],
  },
  {
    fromProvider: 'Dr. Michael Torres',
    toProvider: 'Dr. Sarah Chen',
    patientSummary: 'ER visit for hypoglycemic episode — blood glucose 48 mg/dL, treated with IV dextrose. Patient stabilized and discharged with follow-up instructions',
    outstandingIssues: ['Review glucose monitoring frequency', 'Evaluate medication dosing', 'Assess for hypoglycemia unawareness', 'Follow up within 48 hours'],
    medications: ['Metformin 500mg BID', 'Semaglutide 0.25mg weekly', 'Lisinopril 10mg daily', 'Atorvastatin 20mg daily'],
  },
  {
    fromProvider: 'Nurse Emily Rodriguez',
    toProvider: 'Dr. Rachel Kim',
    patientSummary: 'Routine monitoring reveals declining renal function — eGFR dropped from 72 to 58 mL/min. Referral to nephrology for evaluation of chronic kidney disease staging',
    outstandingIssues: ['Complete renal panel', 'Urine albumin-to-creatinine ratio', 'Assess need for medication dose adjustments'],
    medications: ['Metformin 500mg BID', 'Semaglutide 0.25mg weekly', 'Lisinopril 10mg daily', 'Atorvastatin 20mg daily', 'Metoprolol 25mg BID'],
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const handoffs = HANDOFFS.map((h, i) => ({
      ...h,
      id: `handoff-${seededHex(SEED + i * 90, 8)}`,
      qualityScore: seededInt(SEED + i * 91, 75, 99),
      completenessScore: seededInt(SEED + i * 92, 80, 100),
      handoffAt: Date.now() - seededInt(SEED + i * 93, 1, 45) * 86400000,
      acknowledgedAt: i < 4 ? Date.now() - seededInt(SEED + i * 94, 0, 5) * 86400000 : undefined,
      teeAttestation: generateAttestation(SEED + i * 95),
      txHash: generateTxHash(SEED + i * 96),
    }));

    return successResponse(handoffs);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch handoffs', HTTP.INTERNAL);
  }
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { fromProvider, toProvider, patientSummary } = body;

    if (!fromProvider || !toProvider || !patientSummary) {
      return errorResponse('VALIDATION_ERROR', 'fromProvider, toProvider, and patientSummary are required', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();
    const handoff = {
      id: `handoff-${seededHex(seed, 8)}`,
      fromProvider,
      toProvider,
      patientSummary,
      outstandingIssues: body.outstandingIssues ?? [],
      medications: body.medications ?? [],
      qualityScore: 0,
      completenessScore: 0,
      handoffAt: Date.now(),
      acknowledgedAt: undefined,
      teeAttestation: generateAttestation(seed + 10),
      txHash: generateTxHash(seed + 20),
    };

    return successResponse(handoff, HTTP.CREATED);
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
