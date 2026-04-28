/**
 * Shiora on Aethelred — Research Studies API Route
 *
 * GET  /api/research/studies — List research studies (with optional status filter)
 * POST /api/research/studies — Enroll in a study
 */

import { NextRequest, NextResponse } from 'next/server';

import type {
  ResearchStudy,
  DataContribution,
  StudyStatus,
  RecordType,
  ApiResponse,
} from '@/types';
import { seededRandom, seededInt, seededHex, seededPick } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SEED = 1900;

const STUDY_TITLES = [
  'Impact of Cycle Tracking on Reproductive Outcomes',
  'Wearable Data Patterns in Endometriosis Patients',
  'AI-Assisted Fertility Window Prediction Accuracy',
  'Longitudinal Hormone Level Monitoring Study',
  'Menstrual Health and Sleep Quality Correlation',
  'PCOS Biomarker Discovery Through Decentralized Data',
  'Prenatal Health Optimization Using Digital Biomarkers',
  'Privacy-Preserving Genetic Variant Analysis',
];

const INSTITUTIONS = [
  'Stanford School of Medicine',
  'MIT Computational Health Lab',
  "Johns Hopkins Women's Health Center",
  'Harvard T.H. Chan School of Public Health',
  'Mayo Clinic Research Division',
  'Oxford Reproductive Health Institute',
  'UC San Francisco Medical Center',
  'Karolinska Institute',
];

const PIS = [
  'Dr. Sarah Chen',
  'Dr. Michael Torres',
  'Dr. Aisha Patel',
  'Dr. James Liu',
  'Dr. Emily Nakamura',
  'Dr. Rachel Anderson',
  'Dr. David Kim',
  'Dr. Maria Garcia',
];

const DATA_TYPE_OPTIONS: RecordType[][] = [
  ['vitals', 'lab_result'],
  ['vitals', 'notes'],
  ['lab_result', 'imaging'],
  ['lab_result', 'vitals'],
  ['vitals', 'notes'],
  ['lab_result', 'vitals', 'imaging'],
  ['vitals', 'lab_result', 'notes'],
  ['lab_result', 'imaging'],
];

function generateStudies(): ResearchStudy[] {
  return Array.from({ length: 8 }, (_, i) => {
    const status: StudyStatus =
      i < 3 ? 'recruiting' : i < 5 ? 'active' : i < 7 ? 'completed' : 'suspended';
    const target = seededInt(SEED + i * 17, 50, 500);
    const participants =
      status === 'completed' ? target : Math.floor(target * seededRandom(SEED + i * 19) * 0.9);

    return {
      id: `study-${seededHex(SEED + i * 100, 12)}`,
      title: STUDY_TITLES[i],
      description: `Research study conducted by ${INSTITUTIONS[i]}`,
      institution: INSTITUTIONS[i],
      principalInvestigator: PIS[i],
      status,
      participantCount: participants,
      targetParticipants: target,
      dataTypesRequired: DATA_TYPE_OPTIONS[i],
      compensationShio: seededInt(SEED + i * 21, 25, 200),
      irbApprovalId: `IRB-${2024 + Math.floor(i / 4)}-${seededHex(SEED + i * 30, 6).toUpperCase()}`,
      startDate: Date.now() - seededInt(SEED + i * 23, 30, 365) * 86400000,
      endDate: Date.now() + seededInt(SEED + i * 25, 30, 365) * 86400000,
      zkpRequired: seededRandom(SEED + i * 27) > 0.4,
    };
  });
}

const studies = generateStudies();
const contributions: DataContribution[] = [];

// ---------------------------------------------------------------------------
// GET /api/research/studies
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') as StudyStatus | null;
  const search = searchParams.get('search');
  const include = searchParams.get('include');

  // Return user contributions when requested
  if (include === 'contributions') {
    // Generate mock contributions
    const mockContributions: DataContribution[] = Array.from({ length: 5 }, (_, i) => ({
      id: `contrib-${seededHex(SEED + 3000 + i * 100, 12)}`,
      studyId:
        studies[i]?.id ?? /* istanbul ignore next */ `study-${seededHex(SEED + i * 100, 12)}`,
      contributorAnonymousId: `anon-${seededHex(SEED + 3000 + i * 7, 8)}`,
      dataTypes: DATA_TYPE_OPTIONS[i] ?? /* istanbul ignore next */ ['vitals'],
      contributedAt: Date.now() - seededInt(SEED + 3000 + i * 11, 1, 60) * 86400000,
      compensation: seededInt(SEED + 3000 + i * 13, 25, 200),
      consentId: `consent-${seededHex(SEED + 3000 + i * 17, 8)}`,
      status: i < 3 ? 'accepted' : i < 4 ? 'pending' : 'rejected',
    }));
    const body: ApiResponse<DataContribution[]> = {
      success: true,
      data: mockContributions,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(body);
  }

  let filtered = [...studies];

  if (status) {
    filtered = filtered.filter((s) => s.status === status);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.institution.toLowerCase().includes(q) ||
        s.principalInvestigator.toLowerCase().includes(q),
    );
  }

  const body: ApiResponse<ResearchStudy[]> = {
    success: true,
    data: filtered,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}

// ---------------------------------------------------------------------------
// POST /api/research/studies — Enroll in a study
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { studyId, dataTypes } = await request.json();

    if (!studyId || !dataTypes?.length) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'studyId and dataTypes are required' },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 400 },
      );
    }

    const study = studies.find((s) => s.id === studyId);
    if (!study) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Study not found' },
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<never>,
        { status: 404 },
      );
    }

    const seed = Date.now();
    const contribution: DataContribution = {
      id: `contrib-${seededHex(seed, 12)}`,
      studyId,
      contributorAnonymousId: `anon-${seededHex(seed + 1, 8)}`,
      dataTypes,
      contributedAt: Date.now(),
      compensation: study.compensationShio,
      consentId: `consent-${seededHex(seed + 2, 8)}`,
      status: 'pending',
    };

    contributions.unshift(contribution);
    study.participantCount += 1;

    const body: ApiResponse<DataContribution> = {
      success: true,
      data: contribution,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(body, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to enroll' },
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse<never>,
      { status: 500 },
    );
  }
}
