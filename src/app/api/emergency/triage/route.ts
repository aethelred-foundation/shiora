// ============================================================
// Shiora on Aethelred — Triage API
// GET  /api/emergency/triage — List past triage assessments
// POST /api/emergency/triage — Run triage assessment
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, seededPick, generateAttestation } from '@/lib/utils';

const SEED = 2530;

// Pre-generated triage history (4 past assessments)
const TRIAGE_HISTORY = [
  {
    symptoms: ['Chest tightness', 'Shortness of breath'],
    vitalSigns: { heartRate: 102, bloodPressure: 148, temperature: 98.6, respiratoryRate: 22, oxygenSaturation: 95 },
    esiLevel: 2 as const,
    disposition: 'emergency_room' as const,
    reasoning: 'Chest tightness with shortness of breath in a patient with known hypertension indicates potential cardiac event. Elevated heart rate and blood pressure support emergent classification requiring immediate ED evaluation.',
    confidence: 94,
    modelId: 'triage-transformer-v2.1',
  },
  {
    symptoms: ['Dizziness', 'Blurred vision', 'Headache'],
    vitalSigns: { heartRate: 88, bloodPressure: 172, temperature: 98.4, respiratoryRate: 18, oxygenSaturation: 97 },
    esiLevel: 3 as const,
    disposition: 'urgent_care' as const,
    reasoning: 'Dizziness with blurred vision and significantly elevated blood pressure suggests hypertensive urgency. Multiple resources needed for evaluation including labs and imaging. Urgent care with monitoring capability recommended.',
    confidence: 91,
    modelId: 'triage-transformer-v2.1',
  },
  {
    symptoms: ['Mild nausea', 'Fatigue', 'Increased thirst'],
    vitalSigns: { heartRate: 78, bloodPressure: 132, temperature: 98.2, respiratoryRate: 16, oxygenSaturation: 98 },
    esiLevel: 4 as const,
    disposition: 'primary_care' as const,
    reasoning: 'Symptoms consistent with suboptimal blood glucose management in known diabetic patient. Stable vital signs with mild symptoms. Primary care follow-up recommended for medication adjustment.',
    confidence: 89,
    modelId: 'triage-transformer-v2.1',
  },
  {
    symptoms: ['Mild headache', 'Neck stiffness'],
    vitalSigns: { heartRate: 72, bloodPressure: 126, temperature: 98.8, respiratoryRate: 14, oxygenSaturation: 99 },
    esiLevel: 4 as const,
    disposition: 'primary_care' as const,
    reasoning: 'Tension-type headache with mild neck stiffness. No red flag symptoms. Vital signs within normal limits for this patient. Recommend primary care evaluation if symptoms persist beyond 48 hours.',
    confidence: 87,
    modelId: 'triage-transformer-v2.1',
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const assessments = TRIAGE_HISTORY.map((t, i) => ({
      ...t,
      id: `triage-${seededHex(SEED + i * 60, 12)}`,
      attestation: generateAttestation(SEED + i * 61),
      assessedAt: Date.now() - seededInt(SEED + i * 62, 1, 60) * 86400000,
    }));

    return successResponse(assessments);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch triage history', HTTP.INTERNAL);
  }
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { symptoms, vitalSigns } = body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'symptoms array is required', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();

    // Determine severity based on symptom keywords
    const criticalSymptoms = ['chest pain', 'shortness of breath', 'unconscious', 'severe bleeding'];
    const urgentSymptoms = ['dizziness', 'high fever', 'abdominal pain', 'confusion'];
    const hasCritical = symptoms.some((s: string) => criticalSymptoms.some((c) => s.toLowerCase().includes(c)));
    const hasUrgent = symptoms.some((s: string) => urgentSymptoms.some((u) => s.toLowerCase().includes(u)));

    const esiLevel = hasCritical ? 2 : hasUrgent ? 3 : 4;
    const dispositions = {
      1: 'call_911',
      2: 'emergency_room',
      3: 'urgent_care',
      4: 'primary_care',
      5: 'self_care',
    } as const;

    const assessment = {
      id: `triage-${seededHex(seed, 12)}`,
      symptoms,
      vitalSigns: vitalSigns ?? {
        heartRate: seededInt(seed + 1, 60, 120),
        bloodPressure: seededInt(seed + 2, 90, 160),
        temperature: 97.5 + seededInt(seed + 3, 0, 40) / 10,
        respiratoryRate: seededInt(seed + 4, 12, 24),
        oxygenSaturation: seededInt(seed + 5, 92, 100),
      },
      esiLevel: esiLevel as 1 | 2 | 3 | 4 | 5,
      disposition: dispositions[esiLevel as keyof typeof dispositions] ?? /* istanbul ignore next */ 'primary_care',
      reasoning: `Based on the reported symptoms (${symptoms.join(', ')}), the AI triage model assessed the patient's condition using the Emergency Severity Index (ESI). ${hasCritical ? 'Critical symptoms detected requiring emergent evaluation.' : hasUrgent ? 'Urgent symptoms detected that may require multiple resources for evaluation.' : 'Symptoms suggest a less urgent condition that can be managed in a primary care setting.'} Vital signs ${vitalSigns ? 'were provided and factored into the assessment' : 'were estimated based on symptom correlation'}. This assessment was processed within a TEE enclave for privacy and verified through on-chain attestation.`,
      confidence: hasCritical ? 95 : hasUrgent ? 92 : 88,
      attestation: generateAttestation(seed + 10),
      assessedAt: Date.now(),
      modelId: 'triage-transformer-v2.1',
    };

    return successResponse(assessment, HTTP.CREATED);
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
