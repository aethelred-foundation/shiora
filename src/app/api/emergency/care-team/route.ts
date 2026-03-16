// ============================================================
// Shiora on Aethelred — Care Team API
// GET  /api/emergency/care-team — List care team members
// POST /api/emergency/care-team — Add a member
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt } from '@/lib/utils';

const SEED = 2510;

const MEMBERS = [
  {
    name: 'Dr. Sarah Chen',
    role: 'Primary Care',
    institution: 'Metro Health Internal Medicine',
    specialty: 'Internal Medicine',
    phone: '+1 (555) 111-2222',
    email: 'sarah.chen@metrohealth.com',
    accessLevel: 'full' as const,
    isActive: true,
  },
  {
    name: 'Dr. James Liu',
    role: 'Cardiologist',
    institution: 'Bay Area Cardiology Center',
    specialty: 'Cardiology',
    phone: '+1 (555) 222-3333',
    email: 'james.liu@baycard.com',
    accessLevel: 'full' as const,
    isActive: true,
  },
  {
    name: 'Dr. Aisha Patel',
    role: 'Endocrinologist',
    institution: 'Pacific Endocrine Associates',
    specialty: 'Endocrinology',
    phone: '+1 (555) 333-4444',
    email: 'aisha.patel@pacificendo.com',
    accessLevel: 'full' as const,
    isActive: true,
  },
  {
    name: 'Nurse Emily Rodriguez',
    role: 'Care Coordinator',
    institution: 'Metro Health Internal Medicine',
    specialty: 'Chronic Disease Management',
    phone: '+1 (555) 444-5555',
    email: 'emily.rodriguez@metrohealth.com',
    accessLevel: 'partial' as const,
    isActive: true,
  },
  {
    name: 'Dr. Michael Torres',
    role: 'Emergency Physician',
    institution: 'Stanford Emergency Medicine',
    specialty: 'Emergency Medicine',
    phone: '+1 (555) 555-6666',
    email: 'michael.torres@stanford.edu',
    accessLevel: 'emergency_only' as const,
    isActive: true,
  },
  {
    name: 'Dr. Rachel Kim',
    role: 'Nephrologist',
    institution: 'Kidney Care Specialists',
    specialty: 'Nephrology',
    phone: '+1 (555) 666-7777',
    email: 'rachel.kim@kidneycare.com',
    accessLevel: 'partial' as const,
    isActive: false,
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const team = MEMBERS.map((m, i) => ({
      ...m,
      id: `ctm-${seededHex(SEED + i * 50, 8)}`,
      lastInteraction: Date.now() - seededInt(SEED + i * 51, 1, 90) * 86400000,
    }));

    return successResponse(team);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch care team', HTTP.INTERNAL);
  }
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { name, role, institution, specialty, phone, email, accessLevel } = body;

    if (!name || !role) {
      return errorResponse('VALIDATION_ERROR', 'name and role are required', HTTP.UNPROCESSABLE);
    }

    const seed = Date.now();
    const member = {
      id: `ctm-${seededHex(seed, 8)}`,
      name,
      role,
      institution: institution ?? '',
      specialty: specialty ?? '',
      phone: phone ?? '',
      email: email ?? '',
      accessLevel: accessLevel ?? 'partial',
      lastInteraction: Date.now(),
      isActive: true,
    };

    return successResponse(member, HTTP.CREATED);
  } catch {
    return errorResponse('INVALID_REQUEST', 'Invalid request body', HTTP.BAD_REQUEST);
  }
}
