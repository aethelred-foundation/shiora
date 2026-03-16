// ============================================================
// Shiora on Aethelred — Emergency Card API
// GET /api/emergency — Get emergency card data
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededAddress, generateAttestation } from '@/lib/utils';

const SEED = 2500;

function generateEmergencyCard() {
  return {
    id: `ecard-${seededHex(SEED, 12)}`,
    ownerAddress: seededAddress(SEED + 1),
    bloodType: 'A+',
    allergies: ['Penicillin', 'Sulfa drugs', 'Latex'],
    currentMedications: [
      { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
      { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily' },
      { name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily at bedtime' },
      { name: 'Aspirin', dosage: '81mg', frequency: 'Once daily' },
      { name: 'Metoprolol', dosage: '25mg', frequency: 'Twice daily' },
    ],
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    emergencyContacts: [
      {
        id: `ec-${seededHex(SEED + 10, 8)}`,
        name: 'Maria Santos',
        relationship: 'Spouse',
        phone: '+1 (555) 234-5678',
        email: 'maria.santos@email.com',
        isPrimary: true,
        notifyOnEmergency: true,
      },
      {
        id: `ec-${seededHex(SEED + 20, 8)}`,
        name: 'Robert Chen',
        relationship: 'Parent',
        phone: '+1 (555) 345-6789',
        email: 'robert.chen@email.com',
        isPrimary: false,
        notifyOnEmergency: true,
      },
      {
        id: `ec-${seededHex(SEED + 30, 8)}`,
        name: 'Lisa Park',
        relationship: 'Sibling',
        phone: '+1 (555) 456-7890',
        email: 'lisa.park@email.com',
        isPrimary: false,
        notifyOnEmergency: false,
      },
    ],
    advanceDirectives: 'Full Code — All life-sustaining measures authorized',
    organDonor: true,
    insuranceInfo: 'Blue Cross Blue Shield PPO — Member ID: BCB-928471-A',
    primaryPhysician: 'Dr. Sarah Chen, MD — Metro Health Internal Medicine',
    lastVerified: Date.now() - 2 * 86400000,
    teeAttestation: generateAttestation(SEED + 100),
  };
}

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    return successResponse(generateEmergencyCard());
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch emergency card', HTTP.INTERNAL);
  }
}
