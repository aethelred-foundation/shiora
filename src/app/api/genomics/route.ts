// ============================================================
// Shiora on Aethelred — Genomics API
// GET /api/genomics?view=overview|pharmacogenomics|risk-scores
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededRandom, seededInt, seededHex, generateAttestation } from '@/lib/utils';
import { GENOMIC_RISK_CATEGORIES } from '@/lib/constants';
import type {
  GenomicsOverview,
  GenomicProfile,
  PharmacogenomicResult,
  PolygenicRiskScore,
  MetabolismRate,
} from '@/types';

const SEED = 2600;

// ---- Pharmacogenomic reference data (8 drug-gene interactions) ----

const PGX_DATA: Array<{
  gene: string;
  variant: string;
  rsId: string;
  drug: string;
  category: string;
  rate: MetabolismRate;
  recommendation: string;
  evidence: PharmacogenomicResult['evidenceLevel'];
  guideline: string;
}> = [
  {
    gene: 'CYP2D6',
    variant: '*4/*4',
    rsId: 'rs3892097',
    drug: 'Codeine',
    category: 'Analgesic',
    rate: 'poor',
    recommendation:
      'Avoid codeine — use alternative analgesics such as acetaminophen or NSAIDs. Patient cannot convert codeine to morphine.',
    evidence: 'Level 1A',
    guideline: 'CPIC',
  },
  {
    gene: 'CYP2C19',
    variant: '*2/*2',
    rsId: 'rs4244285',
    drug: 'Clopidogrel',
    category: 'Antiplatelet',
    rate: 'intermediate',
    recommendation:
      'Consider prasugrel or ticagrelor. Reduced anti-platelet effect expected with clopidogrel.',
    evidence: 'Level 1A',
    guideline: 'CPIC',
  },
  {
    gene: 'CYP3A4',
    variant: '*1/*3',
    rsId: 'rs35599367',
    drug: 'Simvastatin',
    category: 'Statin',
    rate: 'intermediate',
    recommendation:
      'Reduce simvastatin dose or consider alternative statin. Monitor for myopathy symptoms.',
    evidence: 'Level 1B',
    guideline: 'DPWG',
  },
  {
    gene: 'SLCO1B1',
    variant: '*5/*5',
    rsId: 'rs4149056',
    drug: 'Simvastatin',
    category: 'Statin',
    rate: 'poor',
    recommendation:
      'Avoid simvastatin or limit to 20mg/day maximum. High myopathy risk. Consider rosuvastatin.',
    evidence: 'Level 1A',
    guideline: 'CPIC',
  },
  {
    gene: 'VKORC1',
    variant: '-1639 A/A',
    rsId: 'rs9923231',
    drug: 'Warfarin',
    category: 'Anticoagulant',
    rate: 'rapid',
    recommendation:
      'Reduce warfarin dose by 25-50%. Increased sensitivity to warfarin expected. Monitor INR closely.',
    evidence: 'Level 1A',
    guideline: 'CPIC',
  },
  {
    gene: 'DPYD',
    variant: '*2A/*1',
    rsId: 'rs3918290',
    drug: 'Fluorouracil',
    category: 'Chemotherapy',
    rate: 'intermediate',
    recommendation:
      'Reduce fluorouracil dose by 50%. Monitor for severe toxicity including myelosuppression.',
    evidence: 'Level 1A',
    guideline: 'CPIC',
  },
  {
    gene: 'HLA-B',
    variant: '*57:01 positive',
    rsId: 'rs2395029',
    drug: 'Abacavir',
    category: 'Antiretroviral',
    rate: 'poor',
    recommendation:
      'Contraindicated — do NOT prescribe abacavir. High risk of hypersensitivity reaction.',
    evidence: 'Level 1A',
    guideline: 'CPIC',
  },
  {
    gene: 'UGT1A1',
    variant: '*28/*28',
    rsId: 'rs8175347',
    drug: 'Irinotecan',
    category: 'Chemotherapy',
    rate: 'ultra_rapid',
    recommendation:
      'Reduce irinotecan starting dose by at least 30%. Monitor for severe neutropenia and diarrhea.',
    evidence: 'Level 1B',
    guideline: 'DPWG',
  },
];

// ---- Risk score reference data ----

const RISK_MODIFIABLE_FACTORS: Record<string, string[]> = {
  cardiovascular: ['Diet & exercise', 'Blood pressure management', 'Cholesterol control'],
  type2_diabetes: ['Weight management', 'Physical activity', 'Dietary changes'],
  breast_cancer: ['Regular screening', 'Alcohol reduction', 'Physical activity'],
  alzheimers: ['Cognitive stimulation', 'Physical exercise', 'Cardiovascular health'],
  colorectal_cancer: ['Dietary fiber intake', 'Regular screening', 'Physical activity'],
  autoimmune: ['Stress management', 'Vitamin D levels', 'Gut microbiome health'],
};

const RISK_INTERVENTIONS: Record<string, string[]> = {
  cardiovascular: [
    'Annual cardiac screening',
    'Statin evaluation',
    'Lifestyle modification program',
  ],
  type2_diabetes: ['HbA1c monitoring quarterly', 'Metformin evaluation', 'Nutritional counseling'],
  breast_cancer: ['Mammography annually', 'Genetic counseling', 'BRCA risk assessment'],
  alzheimers: ['Cognitive baseline testing', 'Amyloid monitoring', 'Neuroprotective supplements'],
  colorectal_cancer: [
    'Colonoscopy every 5 years',
    'Fecal immunochemical test',
    'Diet optimization',
  ],
  autoimmune: ['Autoantibody panel annually', 'Anti-inflammatory diet', 'Immune modulation review'],
};

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') ?? 'overview';

  // ---- Overview ----
  if (view === 'overview') {
    const profile: GenomicProfile = {
      id: `gp-${seededHex(SEED, 12)}`,
      ownerAddress: `aeth1${seededHex(SEED + 1, 38)}`,
      sequencingStatus: 'completed',
      sequencingDate: Date.now() - seededInt(SEED + 2, 30, 180) * 86400000,
      totalVariants: 4521,
      clinicallySignificant: 12,
      pharmacogenomicFlags: 5,
      riskScoresGenerated: 6,
      dataEncrypted: true,
      teeProcessed: true,
      attestation: generateAttestation(SEED + 3),
      lastUpdated: Date.now() - seededInt(SEED + 4, 1, 48) * 3600000,
    };

    const overview: GenomicsOverview = {
      profile,
      pharmacogenomicCount: 8,
      biomarkerCount: 10,
      riskScoreCount: 6,
      reportCount: 5,
      highRiskConditions: [
        'Cardiovascular (elevated)',
        'Type 2 Diabetes (elevated)',
        'Breast Cancer (average-high)',
      ],
      actionableFindings: 5,
    };

    return successResponse(overview);
  }

  // ---- Pharmacogenomics ----
  if (view === 'pharmacogenomics') {
    const results: PharmacogenomicResult[] = PGX_DATA.map((pgx, i) => ({
      id: `pgx-${seededHex(SEED + 100 + i * 7, 12)}`,
      gene: pgx.gene,
      variant: pgx.variant,
      rsId: pgx.rsId,
      drugName: pgx.drug,
      drugCategory: pgx.category,
      metabolismRate: pgx.rate,
      clinicalRecommendation: pgx.recommendation,
      evidenceLevel: pgx.evidence,
      guidelineSource: pgx.guideline,
      teeVerified: true,
      attestation: generateAttestation(SEED + 100 + i * 11),
    }));

    return successResponse(results);
  }

  // ---- Risk Scores ----
  if (view === 'risk-scores') {
    const scores: PolygenicRiskScore[] = GENOMIC_RISK_CATEGORIES.map((cat, i) => {
      const score = Math.round(seededRandom(SEED + 200 + i * 13) * 60 + 20);
      const percentile = Math.round(seededRandom(SEED + 200 + i * 17) * 80 + 10);
      const riskLevel: PolygenicRiskScore['riskLevel'] =
        score >= 75 ? 'high' : score >= 55 ? 'elevated' : score >= 35 ? 'average' : 'low';

      return {
        id: `prs-${seededHex(SEED + 200 + i * 7, 12)}`,
        category: cat.id,
        condition: cat.label,
        score,
        percentile,
        riskLevel,
        variantsAnalyzed: seededInt(SEED + 200 + i * 19, 50, 500),
        modifiableFactors: RISK_MODIFIABLE_FACTORS[cat.id] ?? [],
        nonModifiableFactors: ['Age', 'Family history', 'Ethnicity'],
        recommendedInterventions: RISK_INTERVENTIONS[cat.id] ?? [],
        attestation: generateAttestation(SEED + 200 + i * 23),
        calculatedAt: Date.now() - seededInt(SEED + 200 + i * 29, 1, 30) * 86400000,
      };
    });

    return successResponse(scores);
  }

  return errorResponse('INVALID_VIEW', `Unknown view: ${view}`, 400);
}
