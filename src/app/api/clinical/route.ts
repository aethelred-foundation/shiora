// ============================================================
// Shiora on Aethelred — Clinical Decision Support API
// GET /api/clinical?view=stats|alerts
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  seededPick,
  generateAttestation,
} from '@/lib/utils';
import type { ClinicalStats, ClinicalAlert, AlertSeverity } from '@/types';

const SEED = 2100;

// ---- Alert reference data ----

const ALERT_TYPES: ClinicalAlert['type'][] = [
  'drug_interaction',
  'overdue_screening',
  'lab_abnormal',
  'guideline_deviation',
  'contraindication',
];

const ALERT_TITLES: Record<ClinicalAlert['type'], string[]> = {
  drug_interaction: [
    'Warfarin-Aspirin Interaction Detected',
    'Metformin-Contrast Dye Warning',
    'SSRI-Triptan Serotonin Risk',
  ],
  overdue_screening: [
    'Mammography Screening Overdue',
    'HbA1c Test Due — 90 Days Past',
    'Cervical Cancer Screening Overdue',
  ],
  lab_abnormal: [
    'Elevated Creatinine Level',
    'Low Hemoglobin — Anemia Risk',
    'Abnormal Thyroid Panel (TSH Elevated)',
  ],
  guideline_deviation: [
    'Statin Not Prescribed per ACC/AHA Guideline',
    'BP Target Not Met per JNC-8',
    'Diabetes A1c Above AACE Threshold',
  ],
  contraindication: [
    'ACE Inhibitor Contraindicated — History of Angioedema',
    'Methotrexate Contraindicated — Active Hepatic Disease',
    'NSAIDs Contraindicated — CKD Stage 4',
  ],
};

const ALERT_MESSAGES: Record<ClinicalAlert['type'], string[]> = {
  drug_interaction: [
    'Concurrent use of warfarin and aspirin increases bleeding risk significantly. INR monitoring frequency should be increased.',
    'Metformin should be held 48 hours before and after iodinated contrast dye administration to reduce lactic acidosis risk.',
    'Concurrent SSRI and triptan use may increase serotonin syndrome risk. Monitor for agitation, tremor, and hyperthermia.',
  ],
  overdue_screening: [
    'Patient is 6 months overdue for recommended mammography screening based on age and risk profile.',
    'HbA1c test has not been performed in 90 days. Current diabetes management protocol requires quarterly monitoring.',
    'Cervical cancer screening is overdue by 14 months per USPSTF guidelines for this age group.',
  ],
  lab_abnormal: [
    'Serum creatinine at 1.8 mg/dL (reference: 0.7-1.3). GFR estimated at 42 mL/min — consider nephrology referral.',
    'Hemoglobin at 10.2 g/dL (reference: 12.0-15.5). Iron studies recommended to evaluate etiology.',
    'TSH elevated at 8.2 mIU/L (reference: 0.4-4.0). Repeat TSH with free T4 in 6-8 weeks.',
  ],
  guideline_deviation: [
    'Patient meets criteria for statin therapy per ACC/AHA 2018 guidelines but no active statin prescription found.',
    'Blood pressure consistently above 140/90 mmHg. JNC-8 recommends treatment intensification.',
    'HbA1c at 8.7% exceeds AACE target of 6.5%. Consider adding second oral hypoglycemic or insulin initiation.',
  ],
  contraindication: [
    'ACE inhibitor ordered but patient has documented history of angioedema with enalapril. Use ARB instead.',
    'Methotrexate is contraindicated with current ALT elevation (3x upper limit). Defer until liver function normalizes.',
    'NSAIDs should be avoided in CKD stage 4. Consider acetaminophen or topical alternatives for pain management.',
  ],
};

const ALERT_RECOMMENDATIONS: Record<ClinicalAlert['type'], string[]> = {
  drug_interaction: [
    'Consider switching to clopidogrel or increase INR monitoring to twice weekly.',
    'Hold metformin 48h pre-procedure. Resume 48h post-procedure after confirming stable renal function.',
    'Consider sumatriptan dose reduction or switch to non-serotonergic migraine therapy.',
  ],
  overdue_screening: [
    'Schedule mammography appointment within 2 weeks. Flag for follow-up.',
    'Order HbA1c stat and schedule patient for diabetes management review.',
    'Schedule cervical screening appointment and send patient reminder.',
  ],
  lab_abnormal: [
    'Repeat creatinine in 48h. If trend continues, refer to nephrology. Adjust renally-cleared medications.',
    'Order iron panel, reticulocyte count, and peripheral blood smear. Consider iron supplementation.',
    'Order free T4 and TPO antibodies. Repeat TSH in 6-8 weeks. Refer to endocrinology if persistent.',
  ],
  guideline_deviation: [
    'Initiate atorvastatin 20mg daily per ACC/AHA guidelines. Recheck lipids in 4-6 weeks.',
    'Add amlodipine 5mg or increase current antihypertensive dose. Recheck BP in 2 weeks.',
    'Add empagliflozin 10mg or initiate basal insulin. Schedule diabetes education appointment.',
  ],
  contraindication: [
    'Discontinue ACE inhibitor immediately. Prescribe losartan 50mg as ARB alternative.',
    'Defer methotrexate. Recheck LFTs in 2 weeks. Consider alternative DMARD such as hydroxychloroquine.',
    'Discontinue NSAID. Prescribe acetaminophen 650mg TID and consider topical diclofenac gel.',
  ],
};

const ALERT_SEVERITIES: AlertSeverity[] = ['critical', 'warning', 'info'];

const ALERT_DRUGS = [
  ['Warfarin', 'Aspirin'],
  ['Metformin'],
  ['Sertraline', 'Sumatriptan'],
  [],
  ['Lisinopril'],
];

const ALERT_CONDITIONS = [
  ['Atrial Fibrillation', 'Osteoarthritis'],
  ['Type 2 Diabetes'],
  ['Major Depression', 'Migraine'],
  [],
  ['Hypertension', 'Angioedema'],
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') ?? 'stats';

  // ---- Stats view ----
  if (view === 'stats') {
    const stats: ClinicalStats = {
      totalDecisions: seededInt(SEED, 1200, 1800),
      activePathways: 3,
      activeClinicalAlerts: 5,
      drugChecksToday: seededInt(SEED + 1, 20, 45),
      guidelineComplianceScore: Math.round(seededRandom(SEED + 2) * 12 + 87),
      teeVerifiedDecisions: seededInt(SEED + 3, 1100, 1700),
    };

    return successResponse(stats);
  }

  // ---- Alerts view ----
  if (view === 'alerts') {
    const alerts: ClinicalAlert[] = Array.from({ length: 5 }, (_, i) => {
      const type = ALERT_TYPES[i % ALERT_TYPES.length];
      const titleIdx = Math.floor(seededRandom(SEED + 10 + i * 3) * ALERT_TITLES[type].length);
      const msgIdx = Math.floor(seededRandom(SEED + 10 + i * 5) * ALERT_MESSAGES[type].length);
      const recIdx = Math.floor(seededRandom(SEED + 10 + i * 7) * ALERT_RECOMMENDATIONS[type].length);

      return {
        id: `alert-${seededHex(SEED + 100 + i * 13, 12)}`,
        type,
        severity: seededPick(SEED + 10 + i * 11, ALERT_SEVERITIES),
        title: ALERT_TITLES[type][titleIdx],
        message: ALERT_MESSAGES[type][msgIdx],
        relatedDrugs: ALERT_DRUGS[i % ALERT_DRUGS.length].length > 0 ? ALERT_DRUGS[i % ALERT_DRUGS.length] : undefined,
        relatedConditions: ALERT_CONDITIONS[i % ALERT_CONDITIONS.length].length > 0 ? ALERT_CONDITIONS[i % ALERT_CONDITIONS.length] : undefined,
        recommendation: ALERT_RECOMMENDATIONS[type][recIdx],
        triggeredAt: Date.now() - seededInt(SEED + 10 + i * 17, 1, 72) * 3600000,
        attestation: generateAttestation(SEED + 100 + i * 19),
      };
    });

    return successResponse(alerts);
  }

  return errorResponse('INVALID_VIEW', `Unknown view: ${view}`, 400);
}
