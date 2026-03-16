// ============================================================
// Shiora on Aethelred — Clinical Pathways API
// GET /api/clinical/pathways — returns ClinicalPathway[]
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import {
  seededRandom,
  seededInt,
  seededHex,
  generateAttestation,
} from '@/lib/utils';
import type { ClinicalPathway, ClinicalPathwayStep, PathwayStepStatus } from '@/types';

const SEED = 2100;

// ---- Pathway reference data ----

interface PathwayDef {
  name: string;
  category: string;
  description: string;
  conditions: string[];
  source: string;
  version: string;
  steps: Array<{
    title: string;
    description: string;
    action: string;
    status: PathwayStepStatus;
    criteria: string[];
  }>;
}

const PATHWAY_DEFS: PathwayDef[] = [
  {
    name: 'Diabetes Management Protocol',
    category: 'diabetes_management',
    description: 'Comprehensive Type 2 Diabetes management pathway based on ADA Standards of Care 2024, covering initial evaluation through ongoing monitoring and treatment intensification.',
    conditions: ['Type 2 Diabetes', 'Prediabetes', 'Insulin Resistance'],
    source: 'ADA Standards of Medical Care 2024',
    version: '4.2',
    steps: [
      {
        title: 'Initial Assessment & HbA1c',
        description: 'Obtain baseline HbA1c, fasting glucose, lipid panel, and comprehensive metabolic panel. Assess BMI, blood pressure, and comorbidities.',
        action: 'Order lab panel: HbA1c, FBG, CMP, Lipid Panel',
        status: 'completed',
        criteria: ['HbA1c >= 6.5% or FBG >= 126 mg/dL', 'Patient age >= 18', 'No active DKA'],
      },
      {
        title: 'Lifestyle Modification Counseling',
        description: 'Prescribe medical nutrition therapy and structured exercise program. Target 150 min/week moderate-intensity activity and 5-7% weight loss.',
        action: 'Refer to certified diabetes educator and dietitian',
        status: 'completed',
        criteria: ['Initial assessment completed', 'Patient willing to engage', 'No exercise contraindications'],
      },
      {
        title: 'Metformin Initiation',
        description: 'Start metformin 500mg daily with meals. Titrate to 1000mg BID over 4 weeks if tolerated. Monitor GI side effects and renal function.',
        action: 'Prescribe metformin 500mg daily, titrate per protocol',
        status: 'active',
        criteria: ['eGFR >= 30 mL/min', 'No lactic acidosis history', 'Lifestyle modification initiated'],
      },
      {
        title: 'Quarterly HbA1c Monitoring',
        description: 'Repeat HbA1c every 3 months until stable at target (< 7.0%). Adjust therapy if HbA1c not at goal after 3 months of current regimen.',
        action: 'Order HbA1c and review treatment response',
        status: 'pending',
        criteria: ['On current therapy >= 3 months', 'Adherence confirmed'],
      },
      {
        title: 'Treatment Intensification',
        description: 'If HbA1c remains above target, add second agent (SGLT2i or GLP-1 RA preferred for cardiovascular benefit). Consider insulin if HbA1c > 10%.',
        action: 'Evaluate for add-on therapy per ADA algorithm',
        status: 'pending',
        criteria: ['HbA1c above target after 3 months', 'Adherence verified', 'Renal function adequate'],
      },
    ],
  },
  {
    name: 'Hypertension Control Protocol',
    category: 'hypertension_protocol',
    description: 'Evidence-based hypertension management pathway aligned with ACC/AHA 2017 guidelines, targeting BP < 130/80 mmHg for high-risk patients.',
    conditions: ['Essential Hypertension', 'Resistant Hypertension', 'White Coat Hypertension'],
    source: 'ACC/AHA Hypertension Guideline 2017',
    version: '3.1',
    steps: [
      {
        title: 'Blood Pressure Confirmation',
        description: 'Confirm elevated BP with ambulatory blood pressure monitoring (ABPM) or home BP monitoring over 2 weeks. Rule out white coat effect.',
        action: 'Order 24-hour ABPM or prescribe home BP monitoring',
        status: 'completed',
        criteria: ['BP >= 130/80 on 2+ office visits', 'Patient able to perform home monitoring'],
      },
      {
        title: 'Cardiovascular Risk Assessment',
        description: 'Calculate 10-year ASCVD risk score. Obtain ECG, renal function, lipid panel, and fasting glucose. Screen for secondary causes if age < 30.',
        action: 'Calculate ASCVD risk and order baseline labs',
        status: 'completed',
        criteria: ['Hypertension confirmed by ABPM/HBPM', 'No secondary hypertension suspected'],
      },
      {
        title: 'First-Line Pharmacotherapy',
        description: 'Initiate ACE inhibitor (lisinopril 10mg) or ARB (losartan 50mg) if ACEi intolerant. For Black patients, prefer CCB (amlodipine 5mg) or thiazide.',
        action: 'Prescribe lisinopril 10mg daily or appropriate alternative',
        status: 'active',
        criteria: ['Stage 1 HTN with ASCVD risk >= 10%', 'Or Stage 2 HTN (BP >= 140/90)', 'No contraindications to ACEi'],
      },
      {
        title: 'Follow-Up Titration',
        description: 'Reassess BP in 4 weeks. If not at goal, uptitrate current agent or add second agent from different class. Target < 130/80.',
        action: 'Titrate medication and reassess in 4 weeks',
        status: 'pending',
        criteria: ['On first-line agent >= 4 weeks', 'BP still above target'],
      },
      {
        title: 'Combination Therapy Optimization',
        description: 'If BP not controlled on dual therapy, add third agent. Consider referral to hypertension specialist if resistant (BP uncontrolled on 3 agents).',
        action: 'Add third agent or refer to specialist',
        status: 'pending',
        criteria: ['On dual therapy >= 4 weeks', 'BP above target', 'Adherence confirmed'],
      },
    ],
  },
  {
    name: 'Prenatal Care Pathway',
    category: 'prenatal_care',
    description: 'Comprehensive prenatal care protocol following ACOG guidelines, covering initial booking visit through delivery planning with integrated risk assessment.',
    conditions: ['Pregnancy', 'High-Risk Pregnancy', 'Gestational Diabetes'],
    source: 'ACOG Practice Bulletins 2024',
    version: '5.0',
    steps: [
      {
        title: 'Initial Booking Visit (8-10 weeks)',
        description: 'Complete medical history, physical examination, and baseline labs. Order CBC, blood type/Rh, rubella immunity, hepatitis B, HIV, urinalysis, and dating ultrasound.',
        action: 'Schedule comprehensive first visit with full lab panel',
        status: 'completed',
        criteria: ['Positive pregnancy test', 'Estimated 8-10 weeks gestation', 'First prenatal visit'],
      },
      {
        title: 'First Trimester Screening (11-14 weeks)',
        description: 'Offer combined first-trimester screening (nuchal translucency ultrasound + serum markers) or cell-free DNA screening for chromosomal abnormalities.',
        action: 'Order NT scan and serum screening or cfDNA test',
        status: 'completed',
        criteria: ['Gestational age 11-14 weeks', 'Patient counseled on screening options'],
      },
      {
        title: 'Anatomy Scan & GDM Screen (18-22 weeks)',
        description: 'Perform detailed fetal anatomy ultrasound. Screen for gestational diabetes with 1-hour glucose challenge test. Assess placental position.',
        action: 'Schedule anatomy scan and order glucose challenge test',
        status: 'active',
        criteria: ['Gestational age 18-22 weeks', 'Previous screenings completed'],
      },
      {
        title: 'Third Trimester Monitoring (28-36 weeks)',
        description: 'Administer Rh immunoglobulin if Rh-negative. Initiate biweekly visits. Screen for Group B Streptococcus at 36 weeks. Monitor fetal growth.',
        action: 'Increase visit frequency and order GBS culture',
        status: 'pending',
        criteria: ['Gestational age >= 28 weeks', 'No preterm labor signs'],
      },
      {
        title: 'Delivery Planning (36-40 weeks)',
        description: 'Develop birth plan with patient. Assess fetal presentation and cervical status. Discuss induction indications and timing. Schedule delivery if indicated.',
        action: 'Complete delivery planning and schedule follow-up',
        status: 'pending',
        criteria: ['Gestational age >= 36 weeks', 'GBS status known', 'Fetal presentation assessed'],
      },
    ],
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const pathways: ClinicalPathway[] = PATHWAY_DEFS.map((def, i) => ({
    id: `pw-${seededHex(SEED + 300 + i * 7, 12)}`,
    name: def.name,
    category: def.category,
    description: def.description,
    steps: def.steps.map((step, j) => ({
      id: `step-${seededHex(SEED + 300 + i * 100 + j * 7, 12)}`,
      order: j + 1,
      title: step.title,
      description: step.description,
      actionRequired: step.action,
      status: step.status,
      completedAt: step.status === 'completed'
        ? Date.now() - seededInt(SEED + 300 + i * 100 + j * 11, 3, 60) * 86400000
        : undefined,
      attestation: step.status === 'completed' || step.status === 'active'
        ? generateAttestation(SEED + 300 + i * 100 + j * 13)
        : undefined,
      criteria: step.criteria,
    })),
    applicableConditions: def.conditions,
    guidelineSource: def.source,
    version: def.version,
    lastUpdated: Date.now() - seededInt(SEED + 300 + i * 17, 1, 14) * 86400000,
    teeVerified: true,
    attestation: generateAttestation(SEED + 300 + i * 19),
  }));

  return successResponse(pathways);
}
