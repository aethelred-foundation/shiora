// ============================================================
// Shiora on Aethelred — Emergency Protocols API
// GET /api/emergency/protocols — List emergency protocols
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateAttestation } from '@/lib/utils';

const SEED = 2520;

const PROTOCOLS = [
  {
    name: 'Anaphylaxis Response',
    category: 'anaphylaxis',
    severity: 'critical' as const,
    steps: [
      {
        order: 1,
        instruction: 'Administer epinephrine auto-injector immediately',
        medication: 'Epinephrine',
        dosage: '0.3mg IM',
        timeLimit: '< 2 min',
      },
      {
        order: 2,
        instruction: 'Call 911 and position patient supine with legs elevated',
        timeLimit: '< 1 min',
      },
      {
        order: 3,
        instruction: 'Monitor airway, breathing, and circulation',
        timeLimit: 'Continuous',
      },
      {
        order: 4,
        instruction: 'Administer second epinephrine dose if no improvement',
        medication: 'Epinephrine',
        dosage: '0.3mg IM',
        timeLimit: '5-15 min',
      },
      {
        order: 5,
        instruction: 'Administer antihistamine once stable',
        medication: 'Diphenhydramine',
        dosage: '50mg PO/IV',
      },
    ],
    autoNotifyTeam: true,
    teeVerifiedDoses: true,
  },
  {
    name: 'Cardiac Arrest Protocol',
    category: 'cardiac_arrest',
    severity: 'critical' as const,
    steps: [
      { order: 1, instruction: 'Call 911 immediately', timeLimit: '< 30 sec' },
      { order: 2, instruction: 'Begin CPR — 30 compressions to 2 breaths', timeLimit: '< 1 min' },
      {
        order: 3,
        instruction: 'Apply AED if available and follow device prompts',
        timeLimit: '< 3 min',
      },
      {
        order: 4,
        instruction: 'Continue CPR until emergency services arrive',
        timeLimit: 'Continuous',
      },
    ],
    autoNotifyTeam: true,
    teeVerifiedDoses: false,
  },
  {
    name: 'Stroke Response (FAST)',
    category: 'stroke',
    severity: 'critical' as const,
    steps: [
      {
        order: 1,
        instruction:
          'Assess FAST — Face drooping, Arm weakness, Speech difficulty, Time to call 911',
        timeLimit: '< 1 min',
      },
      { order: 2, instruction: 'Call 911 and note symptom onset time', timeLimit: '< 2 min' },
      {
        order: 3,
        instruction: 'Keep patient comfortable, do NOT administer food or water',
        timeLimit: 'Continuous',
      },
      {
        order: 4,
        instruction: 'Monitor consciousness level and vital signs',
        timeLimit: 'Continuous',
      },
    ],
    autoNotifyTeam: true,
    teeVerifiedDoses: false,
  },
  {
    name: 'Severe Hypoglycemia Protocol',
    category: 'severe_hypoglycemia',
    severity: 'critical' as const,
    steps: [
      { order: 1, instruction: 'Check blood glucose level immediately', timeLimit: '< 1 min' },
      {
        order: 2,
        instruction: 'If conscious: give 15g fast-acting carbohydrate',
        medication: 'Glucose tablets',
        dosage: '15g',
        timeLimit: '< 2 min',
      },
      {
        order: 3,
        instruction: 'If unconscious: administer glucagon injection',
        medication: 'Glucagon',
        dosage: '1mg IM/SC',
        timeLimit: '< 3 min',
      },
      { order: 4, instruction: 'Recheck glucose in 15 minutes', timeLimit: '15 min' },
      { order: 5, instruction: 'Call 911 if not responding to treatment', timeLimit: '< 5 min' },
    ],
    autoNotifyTeam: true,
    teeVerifiedDoses: true,
  },
  {
    name: 'Asthma Attack Protocol',
    category: 'asthma_attack',
    severity: 'warning' as const,
    steps: [
      {
        order: 1,
        instruction: 'Administer rescue inhaler — 2 puffs with spacer',
        medication: 'Albuterol',
        dosage: '90mcg x 2 puffs',
        timeLimit: '< 1 min',
      },
      {
        order: 2,
        instruction: 'Sit upright and remain calm, practice pursed-lip breathing',
        timeLimit: 'Continuous',
      },
      {
        order: 3,
        instruction: 'Repeat inhaler every 20 minutes up to 3 times if needed',
        medication: 'Albuterol',
        dosage: '90mcg x 2 puffs',
        timeLimit: '20 min intervals',
      },
      { order: 4, instruction: 'Call 911 if no improvement after 3 treatments or severe distress' },
      {
        order: 5,
        instruction: 'Consider oral corticosteroid if prolonged episode',
        medication: 'Prednisone',
        dosage: '40mg PO',
      },
    ],
    autoNotifyTeam: false,
    teeVerifiedDoses: true,
  },
  {
    name: 'Seizure Management',
    category: 'seizure',
    severity: 'warning' as const,
    steps: [
      { order: 1, instruction: 'Clear area of hazards, protect head', timeLimit: '< 30 sec' },
      { order: 2, instruction: 'Time the seizure duration', timeLimit: 'Continuous' },
      {
        order: 3,
        instruction: 'Position on side (recovery position) after seizure ends',
        timeLimit: 'Post-seizure',
      },
      { order: 4, instruction: 'Call 911 if seizure lasts > 5 minutes', timeLimit: '5 min' },
      {
        order: 5,
        instruction: 'Administer emergency rescue medication if prescribed',
        medication: 'Diazepam',
        dosage: '10mg rectal',
        timeLimit: '> 5 min',
      },
    ],
    autoNotifyTeam: true,
    teeVerifiedDoses: true,
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const protocols = PROTOCOLS.map((p, i) => ({
      ...p,
      id: `proto-${seededHex(SEED + i * 80, 8)}`,
      attestation: generateAttestation(SEED + i * 81),
      lastReviewed: Date.now() - seededInt(SEED + i * 82, 10, 120) * 86400000,
    }));

    return successResponse(protocols);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch protocols', HTTP.INTERNAL);
  }
}
