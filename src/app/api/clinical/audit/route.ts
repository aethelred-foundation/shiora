// ============================================================
// Shiora on Aethelred — Clinical Decision Audit Trail API
// GET /api/clinical/audit — returns ClinicalDecisionAuditEntry[]
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt, seededHex, seededPick, generateAttestation } from '@/lib/utils';
import type { ClinicalDecisionAuditEntry } from '@/types';

const SEED = 2100;

// ---- Audit entry reference data ----

const DECISION_TYPES: ClinicalDecisionAuditEntry['decisionType'][] = [
  'pathway_step',
  'drug_check',
  'differential',
  'guideline_applied',
  'alert_generated',
];

const MODEL_IDS = [
  'clinical-pathway-llm-v3.2',
  'drug-interaction-bert-v2.1',
  'differential-dx-gpt-v4.0',
  'guideline-compliance-v2.8',
  'alert-engine-v3.5',
  'risk-stratifier-v1.9',
];

const INPUTS_BY_TYPE: Record<ClinicalDecisionAuditEntry['decisionType'], string[]> = {
  pathway_step: [
    'Patient vitals: BP 148/94, HR 78, SpO2 98%. Current medications: metformin 1000mg BID, lisinopril 20mg daily.',
    'Lab results: HbA1c 7.2%, FBG 142, eGFR 52. Pathway: Diabetes Management v4.2, Step 3.',
    'Patient reported symptoms: fatigue, increased thirst. BMI 31.4. Family Hx: T2DM mother.',
  ],
  drug_check: [
    'Drug pair: Warfarin + Aspirin. Patient: 68yo F, AF, recent TKR. INR target 2.0-3.0.',
    'Drug pair: Metformin + Iodinated Contrast. Scheduled CT angiogram. eGFR 48 mL/min.',
    'Drug pair: Sertraline 100mg + Tramadol 50mg. Patient: chronic pain + MDD.',
  ],
  differential: [
    'Symptoms: polyuria, polydipsia, fatigue. Labs: FBG 142, HbA1c 7.2%. BMI 31.4, age 52.',
    'Symptoms: fatigue, cold intolerance, weight gain. Labs: TSH 8.2, FT4 1.1. Age 45.',
    'Symptoms: fatigue, exercise intolerance. Labs: Hgb 10.2, MCV 72, Ferritin 8. Hx menorrhagia.',
  ],
  guideline_applied: [
    'ACC/AHA 2017: BP 148/94 confirmed on ABPM. 10yr ASCVD risk 14.2%. Stage 2 HTN criteria met.',
    'ADA 2024: HbA1c 7.2% on metformin monotherapy x3 months. Assessing for treatment intensification.',
    'ACOG 2024: Patient 20 weeks gestation. Anatomy scan and GDM screening due per protocol.',
  ],
  alert_generated: [
    'Trigger: Creatinine 1.8 mg/dL (rising trend, prev 1.4). eGFR decline from 52 to 42 over 3 months.',
    'Trigger: Mammography screening overdue 6 months. Last screen 2024-03-15. Risk category: average.',
    'Trigger: INR 4.2 on warfarin 5mg. Above therapeutic range. Bleeding risk elevated.',
  ],
};

const OUTPUTS_BY_TYPE: Record<ClinicalDecisionAuditEntry['decisionType'], string[]> = {
  pathway_step: [
    'Advanced pathway to Step 3: Metformin Initiation. Prescribed metformin 500mg daily with meal titration schedule.',
    'Step 2 completed: Lifestyle modification counseling delivered. Patient engaged with diabetes educator.',
    'Pathway assessment: Patient meets criteria for Step 4 (quarterly monitoring). HbA1c recheck scheduled.',
  ],
  drug_check: [
    'MAJOR interaction identified: Warfarin + Aspirin. Bleeding risk elevated. Recommended: increase INR monitoring to 2x/week.',
    'MAJOR interaction: Metformin + Contrast. Recommended: hold metformin 48h pre/post procedure. Check eGFR before resuming.',
    'MAJOR interaction: SSRI + Tramadol serotonin risk. Recommended: use alternative analgesic or reduce doses.',
  ],
  differential: [
    'Primary diagnosis: Type 2 Diabetes Mellitus (E11.9) — probability 87%. Recommended: C-peptide, GAD-65 antibodies.',
    'Primary diagnosis: Hypothyroidism (E03.9) — probability 65%. Recommended: Free T4, TPO antibodies.',
    'Primary diagnosis: Iron Deficiency Anemia (D50.9) — probability 73%. Recommended: iron studies, reticulocyte count.',
  ],
  guideline_applied: [
    'Guideline match: ACC/AHA Stage 2 HTN. Recommendation: initiate lisinopril 10mg daily. Reassess in 4 weeks.',
    'Guideline match: ADA treatment intensification criteria met. Recommendation: add empagliflozin 10mg daily.',
    'Guideline match: ACOG 20-week screening protocol. Orders placed: anatomy ultrasound, 1-hr GCT.',
  ],
  alert_generated: [
    'Alert created: Elevated Creatinine — severity CRITICAL. Notification sent. Recommended: repeat in 48h, nephrology referral.',
    'Alert created: Overdue Mammography Screening — severity WARNING. Patient notified. Scheduling assist triggered.',
    'Alert created: Supratherapeutic INR — severity CRITICAL. Provider paged. Recommended: hold warfarin, consider vitamin K.',
  ],
};

const REVIEWERS = [
  'Dr. Sarah Chen, OB-GYN',
  'Dr. James Liu, Endocrinology',
  'Dr. Maria Garcia, Primary Care',
  'Dr. Aisha Patel, Gynecology',
  'Dr. Emily Nakamura, Nephrology',
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const entries: ClinicalDecisionAuditEntry[] = Array.from({ length: 15 }, (_, i) => {
    const decisionType = seededPick(SEED + 600 + i * 3, DECISION_TYPES);
    const inputIdx = Math.floor(
      seededRandom(SEED + 600 + i * 5) * INPUTS_BY_TYPE[decisionType].length,
    );
    const outputIdx = Math.floor(
      seededRandom(SEED + 600 + i * 7) * OUTPUTS_BY_TYPE[decisionType].length,
    );

    return {
      id: `audit-${seededHex(SEED + 600 + i * 11, 12)}`,
      decisionType,
      inputs: INPUTS_BY_TYPE[decisionType][inputIdx],
      output: OUTPUTS_BY_TYPE[decisionType][outputIdx],
      modelId: seededPick(SEED + 600 + i * 13, MODEL_IDS),
      confidence: Math.round((seededRandom(SEED + 600 + i * 17) * 20 + 78) * 100) / 100,
      attestation: generateAttestation(SEED + 600 + i * 19),
      timestamp: Date.now() - seededInt(SEED + 600 + i * 23, 1, 168) * 3600000,
      reviewedBy:
        seededRandom(SEED + 600 + i * 29) > 0.4
          ? seededPick(SEED + 600 + i * 31, REVIEWERS)
          : undefined,
      reviewedAt:
        seededRandom(SEED + 600 + i * 29) > 0.4
          ? Date.now() - seededInt(SEED + 600 + i * 37, 0, 48) * 3600000
          : undefined,
    };
  });

  return successResponse(entries);
}
