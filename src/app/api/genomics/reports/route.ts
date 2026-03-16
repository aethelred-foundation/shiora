// ============================================================
// Shiora on Aethelred — Genomic Reports API
// GET  /api/genomics/reports — list 5 reports
// POST /api/genomics/reports — generate new report
// ============================================================

import { NextRequest } from 'next/server';
import { successResponse, errorResponse, HTTP } from '@/lib/api/responses';
import { runMiddleware } from '@/lib/api/middleware';
import { seededHex, seededInt, generateAttestation } from '@/lib/utils';
import type { GenomicReport } from '@/types';

const SEED = 2600;

const REPORT_DATA: Array<{
  title: string;
  category: string;
  summary: string;
  findings: number;
  actionable: number;
  status: GenomicReport['status'];
}> = [
  {
    title: 'Comprehensive Pharmacogenomic Report',
    category: 'Pharmacogenomics',
    summary: 'Full drug-gene interaction analysis across 8 key genes. Identified 3 high-priority drug modifications and 5 monitoring recommendations based on metabolizer status.',
    findings: 12,
    actionable: 5,
    status: 'reviewed',
  },
  {
    title: 'Polygenic Risk Score Assessment',
    category: 'Risk Assessment',
    summary: 'Multi-condition risk evaluation across 6 disease categories. Two elevated risk scores identified requiring lifestyle intervention and enhanced monitoring protocols.',
    findings: 6,
    actionable: 3,
    status: 'ready',
  },
  {
    title: 'Carrier Status & Hereditary Screening',
    category: 'Carrier Screening',
    summary: 'Carrier analysis for 120+ autosomal recessive conditions. Three carrier statuses identified relevant to family planning decisions and genetic counseling.',
    findings: 8,
    actionable: 2,
    status: 'shared',
  },
  {
    title: 'Biomarker Trend Analysis Report',
    category: 'Biomarkers',
    summary: 'Longitudinal analysis of 10 key biomarkers over 12-month period. Notable trends in lipid panel and inflammatory markers warrant clinical follow-up.',
    findings: 10,
    actionable: 4,
    status: 'ready',
  },
  {
    title: 'Whole Genome Variant Summary',
    category: 'Genomic Variants',
    summary: 'Summary of 4,521 variants identified across the whole genome. 12 clinically significant variants flagged for review including BRCA pathway and cardiac ion channel genes.',
    findings: 15,
    actionable: 6,
    status: 'generating',
  },
];

export async function GET(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  const reports: GenomicReport[] = REPORT_DATA.map((r, i) => ({
    id: `gr-${seededHex(SEED + 400 + i * 7, 12)}`,
    title: r.title,
    category: r.category,
    generatedAt: Date.now() - seededInt(SEED + 400 + i * 11, 1, 60) * 86400000,
    summary: r.summary,
    findings: r.findings,
    actionableItems: r.actionable,
    teeVerified: r.status !== 'generating',
    attestation: generateAttestation(SEED + 400 + i * 13),
    status: r.status,
  }));

  return successResponse(reports);
}

export async function POST(request: NextRequest) {
  const blocked = runMiddleware(request);
  if (blocked) return blocked;

  let body: { category?: string } = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_BODY', 'Invalid JSON body', HTTP.BAD_REQUEST);
  }

  const category = body.category ?? 'General';
  const newReport: GenomicReport = {
    id: `gr-${seededHex(SEED + 500 + Date.now() % 1000, 12)}`,
    title: `${category} Genomic Analysis`,
    category,
    generatedAt: Date.now(),
    summary: 'Report generation initiated. TEE enclave processing genomic data with full attestation chain. Results will be available shortly.',
    findings: 0,
    actionableItems: 0,
    teeVerified: false,
    attestation: generateAttestation(SEED + 500),
    status: 'generating',
  };

  return successResponse(newReport, HTTP.CREATED);
}
