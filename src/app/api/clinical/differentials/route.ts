// ============================================================
// Shiora on Aethelred — Differential Diagnosis API
// GET /api/clinical/differentials — returns DifferentialDiagnosis[]
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededRandom, generateAttestation } from '@/lib/utils';
import type { DifferentialDiagnosis } from '@/types';

const SEED = 2100;

// ---- Differential diagnosis reference data ----

interface DifferentialDef {
  condition: string;
  icdCode: string;
  probability: number;
  supporting: string[];
  contradicting: string[];
  tests: string[];
  urgency: DifferentialDiagnosis['urgency'];
}

const DIFFERENTIAL_DEFS: DifferentialDef[] = [
  {
    condition: 'Type 2 Diabetes Mellitus',
    icdCode: 'E11.9',
    probability: 0.87,
    supporting: [
      'Fasting glucose 142 mg/dL (elevated)',
      'HbA1c 7.2% (above diagnostic threshold)',
      'BMI 31.4 (obese)',
      'Family history of diabetes (mother, maternal grandmother)',
      'Polyuria and polydipsia reported',
    ],
    contradicting: [
      'No ketones in urine (argues against Type 1)',
      'Age of onset 52 (typical for T2DM)',
    ],
    tests: [
      'Fasting insulin level',
      'C-peptide',
      'GAD-65 antibodies',
      'Oral glucose tolerance test',
    ],
    urgency: 'urgent',
  },
  {
    condition: 'Essential Hypertension',
    icdCode: 'I10',
    probability: 0.82,
    supporting: [
      'BP 148/94 mmHg on 3 separate visits',
      'Ambulatory BP average 142/88 mmHg',
      'Family history of hypertension',
      'Sedentary lifestyle and high sodium diet',
    ],
    contradicting: [
      'No evidence of secondary causes',
      'Normal renal artery duplex',
      'Normal aldosterone-renin ratio',
    ],
    tests: [
      '24-hour ABPM',
      'Renal artery duplex ultrasound',
      'Aldosterone/renin ratio',
      'Echocardiogram',
    ],
    urgency: 'routine',
  },
  {
    condition: 'Iron Deficiency Anemia',
    icdCode: 'D50.9',
    probability: 0.73,
    supporting: [
      'Hemoglobin 10.2 g/dL (low)',
      'MCV 72 fL (microcytic)',
      'Ferritin 8 ng/mL (depleted)',
      'History of heavy menstrual bleeding',
      'Fatigue and exercise intolerance',
    ],
    contradicting: [
      'No evidence of GI bleeding on history',
      'Normal peripheral smear (no target cells)',
    ],
    tests: [
      'Iron studies (TIBC, transferrin saturation)',
      'Reticulocyte count',
      'Stool occult blood test',
      'Upper/lower endoscopy if occult positive',
    ],
    urgency: 'routine',
  },
  {
    condition: 'Hypothyroidism',
    icdCode: 'E03.9',
    probability: 0.65,
    supporting: [
      'TSH 8.2 mIU/L (elevated)',
      'Cold intolerance and weight gain',
      'Dry skin and constipation',
      'Family history of autoimmune thyroid disease',
    ],
    contradicting: [
      'Free T4 still within normal range (subclinical)',
      'No goiter on physical exam',
    ],
    tests: ['Free T4', 'TPO antibodies', 'Thyroglobulin antibodies', 'Thyroid ultrasound'],
    urgency: 'routine',
  },
  {
    condition: 'Chronic Kidney Disease Stage 3a',
    icdCode: 'N18.31',
    probability: 0.58,
    supporting: [
      'eGFR 52 mL/min (two consecutive readings)',
      'Creatinine 1.4 mg/dL (mildly elevated)',
      'Microalbuminuria detected (ACR 45 mg/g)',
      'History of hypertension and diabetes',
    ],
    contradicting: [
      'No hematuria on urinalysis',
      'Normal kidney size on ultrasound',
      'No proteinuria in nephrotic range',
    ],
    tests: [
      'Cystatin C-based eGFR',
      'Urine protein-creatinine ratio',
      'Renal ultrasound',
      'Serum phosphorus and calcium',
    ],
    urgency: 'urgent',
  },
  {
    condition: 'Metabolic Syndrome',
    icdCode: 'E88.81',
    probability: 0.45,
    supporting: [
      'Waist circumference 102 cm (elevated)',
      'Triglycerides 185 mg/dL (elevated)',
      'HDL 38 mg/dL (low)',
      'Fasting glucose 112 mg/dL (impaired)',
    ],
    contradicting: ['Blood pressure controlled on medication', 'Regular physical activity 3x/week'],
    tests: [
      'Fasting lipid panel',
      'Fasting insulin',
      'HOMA-IR calculation',
      'Liver ultrasound for NAFLD screening',
    ],
    urgency: 'elective',
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const differentials: DifferentialDiagnosis[] = DIFFERENTIAL_DEFS.map((def, i) => ({
    id: `dx-${seededHex(SEED + 500 + i * 7, 12)}`,
    condition: def.condition,
    icdCode: def.icdCode,
    probability: def.probability,
    supportingEvidence: def.supporting,
    contradictingEvidence: def.contradicting,
    recommendedTests: def.tests,
    urgency: def.urgency,
    teeVerified: true,
    attestation: generateAttestation(SEED + 500 + i * 13),
  }));

  return successResponse(differentials);
}
