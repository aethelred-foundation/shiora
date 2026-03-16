/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

const mockRunMiddleware = jest.fn().mockReturnValue(null);
jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) => mockRunMiddleware(...args),
}));

const actualUtils = jest.requireActual('@/lib/utils');
const mockSeededRandom = jest.fn(actualUtils.seededRandom);
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  seededRandom: (...args: unknown[]) => mockSeededRandom(...args),
}));

const actualConstants = jest.requireActual('@/lib/constants');
const mockGenomicRiskCategories = jest.fn(() => actualConstants.GENOMIC_RISK_CATEGORIES);
jest.mock('@/lib/constants', () => ({
  ...jest.requireActual('@/lib/constants'),
  get GENOMIC_RISK_CATEGORIES() {
    return mockGenomicRiskCategories();
  },
}));

import { GET as getGenomics } from '@/app/api/genomics/route';
import { GET as getBiomarkers } from '@/app/api/genomics/biomarkers/route';
import { GET as getReports, POST as postReport } from '@/app/api/genomics/reports/route';

afterEach(() => {
  mockRunMiddleware.mockReturnValue(null);
  mockSeededRandom.mockImplementation(actualUtils.seededRandom);
  mockGenomicRiskCategories.mockImplementation(() => actualConstants.GENOMIC_RISK_CATEGORIES);
});

describe('/api/genomics', () => {
  it('GET returns genomics overview (default view)', async () => {
    const res = await getGenomics(new NextRequest('http://localhost:3000/api/genomics'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.profile).toBeDefined();
    expect(body.data.pharmacogenomicCount).toBeDefined();
  });

  it('GET returns pharmacogenomics view', async () => {
    const res = await getGenomics(
      new NextRequest('http://localhost:3000/api/genomics?view=pharmacogenomics'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].gene).toBeDefined();
    expect(body.data[0].drugName).toBeDefined();
  });

  it('GET returns risk-scores view', async () => {
    const res = await getGenomics(
      new NextRequest('http://localhost:3000/api/genomics?view=risk-scores'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].riskLevel).toBeDefined();
    expect(body.data[0].score).toBeDefined();
  });

  it('GET returns risk-scores covering all risk levels via seededRandom mock', async () => {
    // We need to produce scores that hit all 4 branches: high (>=75), elevated (55-74), average (35-54), low (<35)
    // score = Math.round(seededRandom(...) * 60 + 20)
    // For high (>=75): seededRandom >= 0.917 -> score = 75+
    // For elevated (55-74): seededRandom ~0.58-0.90 -> score 55-74
    // For average (35-54): seededRandom ~0.25-0.57 -> score 35-54
    // For low (<35): seededRandom < 0.25 -> score 20-34
    //
    // seededRandom is called for score (SEED+200+i*13) and percentile (SEED+200+i*17)
    // for 6 categories. We mock based on call count.
    let callCount = 0;
    // Return values that alternate to produce all 4 risk levels
    const returnValues = [
      1.0,   // i=0 score: round(1.0*60+20)=80 -> high
      0.5,   // i=0 percentile
      0.7,   // i=1 score: round(0.7*60+20)=62 -> elevated
      0.5,   // i=1 percentile
      0.4,   // i=2 score: round(0.4*60+20)=44 -> average
      0.5,   // i=2 percentile
      0.1,   // i=3 score: round(0.1*60+20)=26 -> low
      0.5,   // i=3 percentile
      0.5,   // i=4 score: round(0.5*60+20)=50 -> average
      0.5,   // i=4 percentile
      0.9,   // i=5 score: round(0.9*60+20)=74 -> elevated
      0.5,   // i=5 percentile
    ];
    mockSeededRandom.mockImplementation(() => {
      const val = returnValues[callCount % returnValues.length] ?? 0.5;
      callCount++;
      return val;
    });

    const res = await getGenomics(
      new NextRequest('http://localhost:3000/api/genomics?view=risk-scores'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const levels = body.data.map((d: { riskLevel: string }) => d.riskLevel);
    expect(levels).toContain('high');
    expect(levels).toContain('elevated');
    expect(levels).toContain('average');
    expect(levels).toContain('low');
  });

  it('GET returns risk-scores with fallback empty arrays for unknown categories', async () => {
    // Add an unknown category that has no entry in RISK_MODIFIABLE_FACTORS or RISK_INTERVENTIONS
    mockGenomicRiskCategories.mockImplementation(() => [
      ...actualConstants.GENOMIC_RISK_CATEGORIES,
      { id: 'unknown_condition', label: 'Unknown Condition', icon: 'Circle', color: '#000' },
    ]);

    const res = await getGenomics(
      new NextRequest('http://localhost:3000/api/genomics?view=risk-scores'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // The extra category should have empty arrays for modifiable factors and interventions
    const unknown = body.data.find((d: { category: string }) => d.category === 'unknown_condition');
    expect(unknown).toBeDefined();
    expect(unknown.modifiableFactors).toEqual([]);
    expect(unknown.recommendedInterventions).toEqual([]);
  });

  it('GET returns 400 for invalid view', async () => {
    const res = await getGenomics(
      new NextRequest('http://localhost:3000/api/genomics?view=invalid'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await getGenomics(new NextRequest('http://localhost:3000/api/genomics'));
    expect(res.status).toBe(429);
  });
});

describe('/api/genomics/biomarkers', () => {
  it('GET returns all biomarkers', async () => {
    const res = await getBiomarkers(new NextRequest('http://localhost:3000/api/genomics/biomarkers'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(10);
  });

  it('GET returns a single biomarker by marker id', async () => {
    const res = await getBiomarkers(new NextRequest('http://localhost:3000/api/genomics/biomarkers?marker=hba1c'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('HbA1c');
    expect(body.data.history).toBeDefined();
    expect(body.data.status).toBeDefined();
    expect(body.data.trend).toBeDefined();
  });

  it('GET returns biomarker with abnormal status via seededRandom mock', async () => {
    // Force seededRandom to return extreme values so currentValue falls outside refRange * 1.1
    // LDL: low=0, high=100, range=100. value = 0 + 30 + 0.99*90 = 119 > 110 (high*1.1) -> abnormal
    mockSeededRandom.mockReturnValue(0.99);
    const res = await getBiomarkers(new NextRequest('http://localhost:3000/api/genomics/biomarkers?marker=ldl'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('abnormal');
  });

  it('GET returns biomarker with borderline status via seededRandom mock', async () => {
    // HbA1c: low=4.0, high=5.6, range=1.6. value = 4.0 + 0.48 + 0.85*1.44 = 5.704 -> 5.7
    // high*1.1 = 6.16, low*0.9 = 3.6 -> not abnormal. But 5.7 > 5.6 -> borderline
    mockSeededRandom.mockReturnValue(0.85);
    const res = await getBiomarkers(new NextRequest('http://localhost:3000/api/genomics/biomarkers?marker=hba1c'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('borderline');
  });

  it('GET handles prevValue=0 branch (line 68 diffPct fallback)', async () => {
    // Force seededRandom to return -30/90 so that for LDL (low=0, range=100):
    // baseValue = 0 + 100*0.3 + (-0.3333)*100*0.9 = 30 - 30 = 0 -> prevValue = 0
    mockSeededRandom.mockReturnValue(-30 / 90);
    const res = await getBiomarkers(new NextRequest('http://localhost:3000/api/genomics/biomarkers?marker=ldl'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // With prevValue=0, diffPct should be 0, trend should be 'stable'
    expect(body.data.trend).toBe('stable');
  });

  it('GET returns 400 for unknown marker id', async () => {
    const res = await getBiomarkers(new NextRequest('http://localhost:3000/api/genomics/biomarkers?marker=nonexistent'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_MARKER');
  });

  it('GET returns blocked when middleware blocks', async () => {
    const { NextResponse } = require('next/server');
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await getBiomarkers(new NextRequest('http://localhost:3000/api/genomics/biomarkers'));
    expect(res.status).toBe(429);
  });
});

describe('/api/genomics/reports', () => {
  it('GET returns genomics reports', async () => {
    const res = await getReports(new NextRequest('http://localhost:3000/api/genomics/reports'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await getReports(new NextRequest('http://localhost:3000/api/genomics/reports'));
    expect(res.status).toBe(429);
  });

  it('POST creates a new genomic report with category', async () => {
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/genomics/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'Pharmacogenomics' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.category).toBe('Pharmacogenomics');
    expect(body.data.status).toBe('generating');
  });

  it('POST creates report with default category', async () => {
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/genomics/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.category).toBe('General');
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/genomics/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BODY');
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 429 }),
    );
    const res = await postReport(
      new NextRequest('http://localhost:3000/api/genomics/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'Test' }),
      }),
    );
    expect(res.status).toBe(429);
  });
});
