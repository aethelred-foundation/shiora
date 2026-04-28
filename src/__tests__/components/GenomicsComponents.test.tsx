// ============================================================
// Tests for src/components/genomics/GenomicsComponents.tsx
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  MetabolismBadge,
  GenomicProfileCard,
  GeneVariantBadge,
  PharmacogenomicRow,
  BiomarkerCard,
  BiomarkerTrendChart,
  RiskScoreRadar,
  RiskScoreCard,
  GenomicReportCard,
} from '@/components/genomics/GenomicsComponents';
import type {
  GenomicsOverview,
  PharmacogenomicResult,
  Biomarker,
  PolygenicRiskScore,
  GenomicReport,
} from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockOverview: GenomicsOverview = {
  profile: {
    id: 'gp-1',
    totalVariants: 4500000,
    clinicallySignificant: 42,
    pharmacogenomicFlags: 8,
    riskScoresGenerated: 6,
    teeProcessed: true,
    lastUpdated: Date.now() - 86400000,
  },
  pharmacogenomicCount: 8,
  biomarkerCount: 12,
  riskScoreCount: 6,
  reportCount: 3,
  actionableFindings: 5,
  highRiskConditions: ['Cardiovascular Disease'],
};

const mockPgxResult: PharmacogenomicResult = {
  id: 'pgx-1',
  gene: 'CYP2D6',
  variant: '*4/*4',
  rsId: 'rs3892097',
  drugName: 'Codeine',
  drugCategory: 'Analgesic',
  metabolismRate: 'poor',
  clinicalRecommendation: 'Avoid codeine; use alternative analgesic.',
  evidenceLevel: '1A',
  teeVerified: true,
};

const mockBiomarker: Biomarker = {
  id: 'bio-1',
  name: 'HbA1c',
  category: 'Metabolic',
  currentValue: 6.2,
  unit: '%',
  status: 'borderline',
  trend: 'worsening',
  referenceRange: { low: 4.0, high: 5.6 },
  history: [
    { date: Date.now() - 86400000 * 180, value: 5.4 },
    { date: Date.now() - 86400000 * 150, value: 5.6 },
    { date: Date.now() - 86400000 * 120, value: 5.8 },
    { date: Date.now() - 86400000 * 90, value: 5.9 },
    { date: Date.now() - 86400000 * 60, value: 6.0 },
    { date: Date.now() - 86400000 * 30, value: 6.2 },
  ],
};

const mockRiskScores: PolygenicRiskScore[] = [
  {
    id: 'prs-1',
    category: 'cardiovascular',
    score: 72,
    percentile: 85,
    riskLevel: 'elevated',
    variantsAnalyzed: 1200,
    modifiableFactors: ['Diet', 'Exercise'],
    nonModifiableFactors: ['Family history'],
    recommendedInterventions: ['Increase aerobic exercise'],
  },
];

const mockReport: GenomicReport = {
  id: 'gr-1',
  title: 'Pharmacogenomic Summary',
  category: 'PGx',
  status: 'reviewed',
  generatedAt: Date.now() - 86400000 * 7,
  summary: 'Analysis of 8 drug-gene pairs with 3 actionable findings.',
  findings: 8,
  actionableItems: 3,
  teeVerified: true,
  attestation: '0xabc123def456abc123def456abc123def456abc1',
};

// ---------------------------------------------------------------------------
// MetabolismBadge
// ---------------------------------------------------------------------------

describe('MetabolismBadge', () => {
  it('renders poor metabolizer label', () => {
    render(<MetabolismBadge rate="poor" />);
    expect(screen.getByText('Poor Metabolizer')).toBeInTheDocument();
  });

  it('renders normal label', () => {
    render(<MetabolismBadge rate="normal" />);
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GeneVariantBadge
// ---------------------------------------------------------------------------

describe('GeneVariantBadge', () => {
  it('renders gene and variant', () => {
    render(<GeneVariantBadge gene="CYP2D6" variant="*4/*4" />);
    expect(screen.getByText('CYP2D6')).toBeInTheDocument();
    expect(screen.getByText('*4/*4')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GenomicProfileCard
// ---------------------------------------------------------------------------

describe('GenomicProfileCard', () => {
  it('renders profile overview', () => {
    render(
      <TestWrapper>
        <GenomicProfileCard overview={mockOverview} />
      </TestWrapper>,
    );
    expect(screen.getByText('Genomic Profile')).toBeInTheDocument();
    expect(screen.getByText('Clinically Significant')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders high risk conditions', () => {
    render(
      <TestWrapper>
        <GenomicProfileCard overview={mockOverview} />
      </TestWrapper>,
    );
    expect(screen.getByText('Cardiovascular Disease')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PharmacogenomicRow
// ---------------------------------------------------------------------------

describe('PharmacogenomicRow', () => {
  it('renders drug name and gene data', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <PharmacogenomicRow result={mockPgxResult} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Codeine')).toBeInTheDocument();
    expect(screen.getByText('Analgesic')).toBeInTheDocument();
    expect(screen.getByText('Poor Metabolizer')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BiomarkerCard
// ---------------------------------------------------------------------------

describe('BiomarkerCard', () => {
  it('renders biomarker name and value', () => {
    render(
      <TestWrapper>
        <BiomarkerCard biomarker={mockBiomarker} />
      </TestWrapper>,
    );
    expect(screen.getByText('HbA1c')).toBeInTheDocument();
    expect(screen.getByText('6.2')).toBeInTheDocument();
    expect(screen.getByText('borderline')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BiomarkerTrendChart
// ---------------------------------------------------------------------------

describe('BiomarkerTrendChart', () => {
  it('renders chart header with biomarker name', () => {
    render(
      <TestWrapper>
        <BiomarkerTrendChart biomarker={mockBiomarker} />
      </TestWrapper>,
    );
    expect(screen.getByText('HbA1c')).toBeInTheDocument();
    expect(screen.getByText('Metabolic marker')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RiskScoreRadar
// ---------------------------------------------------------------------------

describe('RiskScoreRadar', () => {
  it('renders risk profile heading', () => {
    render(
      <TestWrapper>
        <RiskScoreRadar scores={mockRiskScores} />
      </TestWrapper>,
    );
    expect(screen.getByText('Risk Profile Overview')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RiskScoreCard
// ---------------------------------------------------------------------------

describe('RiskScoreCard', () => {
  it('renders score and risk level', () => {
    render(
      <TestWrapper>
        <RiskScoreCard score={mockRiskScores[0]} />
      </TestWrapper>,
    );
    expect(screen.getByText('elevated')).toBeInTheDocument();
    expect(screen.getByText('85th percentile')).toBeInTheDocument();
    expect(screen.getByText('1200 variants analyzed')).toBeInTheDocument();
  });

  it('renders modifiable factors', () => {
    render(
      <TestWrapper>
        <RiskScoreCard score={mockRiskScores[0]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Diet')).toBeInTheDocument();
    expect(screen.getByText('Exercise')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GenomicReportCard
// ---------------------------------------------------------------------------

describe('GenomicReportCard', () => {
  it('renders report title and status', () => {
    render(
      <TestWrapper>
        <GenomicReportCard report={mockReport} />
      </TestWrapper>,
    );
    expect(screen.getByText('Pharmacogenomic Summary')).toBeInTheDocument();
    expect(screen.getByText('reviewed')).toBeInTheDocument();
  });

  it('renders findings count', () => {
    render(
      <TestWrapper>
        <GenomicReportCard report={mockReport} />
      </TestWrapper>,
    );
    expect(screen.getByText('8 findings')).toBeInTheDocument();
    expect(screen.getByText('3 actionable')).toBeInTheDocument();
  });

  it('renders with teeVerified=false (no attestation hash shown)', () => {
    const report: GenomicReport = { ...mockReport, teeVerified: false };
    render(
      <TestWrapper>
        <GenomicReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('Pharmacogenomic Summary')).toBeInTheDocument();
  });

  it('renders generating status with warning variant', () => {
    const report: GenomicReport = { ...mockReport, status: 'generating' as any };
    render(
      <TestWrapper>
        <GenomicReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('generating')).toBeInTheDocument();
  });

  it('renders ready status with info variant', () => {
    const report: GenomicReport = { ...mockReport, status: 'ready' as any };
    render(
      <TestWrapper>
        <GenomicReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('renders shared status with brand variant', () => {
    const report: GenomicReport = { ...mockReport, status: 'shared' as any };
    render(
      <TestWrapper>
        <GenomicReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('shared')).toBeInTheDocument();
  });

  it('renders unknown status with neutral fallback', () => {
    const report: GenomicReport = { ...mockReport, status: 'unknown_status' as any };
    render(
      <TestWrapper>
        <GenomicReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BiomarkerCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('BiomarkerCard — branch coverage', () => {
  it('renders with status=normal and trend=improving', () => {
    const biomarker: Biomarker = {
      ...mockBiomarker,
      status: 'normal',
      trend: 'improving',
      currentValue: 5.0,
    };
    render(
      <TestWrapper>
        <BiomarkerCard biomarker={biomarker} />
      </TestWrapper>,
    );
    expect(screen.getByText('normal')).toBeInTheDocument();
    expect(screen.getByText('improving')).toBeInTheDocument();
  });

  it('renders with status=abnormal and trend=stable', () => {
    const biomarker: Biomarker = {
      ...mockBiomarker,
      status: 'abnormal' as any,
      trend: 'stable',
      currentValue: 8.0,
    };
    render(
      <TestWrapper>
        <BiomarkerCard biomarker={biomarker} />
      </TestWrapper>,
    );
    expect(screen.getByText('abnormal')).toBeInTheDocument();
    expect(screen.getByText('stable')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BiomarkerTrendChart — additional branch coverage
// ---------------------------------------------------------------------------

describe('BiomarkerTrendChart — branch coverage', () => {
  it('renders with status=normal and trend=improving', () => {
    const biomarker: Biomarker = {
      ...mockBiomarker,
      status: 'normal',
      trend: 'improving',
      currentValue: 5.0,
    };
    render(
      <TestWrapper>
        <BiomarkerTrendChart biomarker={biomarker} />
      </TestWrapper>,
    );
    expect(screen.getByText('normal')).toBeInTheDocument();
    expect(screen.getByText('improving')).toBeInTheDocument();
  });

  it('renders with status=abnormal and trend=stable', () => {
    const biomarker: Biomarker = {
      ...mockBiomarker,
      status: 'abnormal' as any,
      trend: 'stable',
      currentValue: 8.0,
    };
    render(
      <TestWrapper>
        <BiomarkerTrendChart biomarker={biomarker} />
      </TestWrapper>,
    );
    expect(screen.getByText('abnormal')).toBeInTheDocument();
    expect(screen.getByText('stable')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GenomicProfileCard — empty high risk conditions
// ---------------------------------------------------------------------------

describe('GenomicProfileCard — branch coverage', () => {
  it('renders without high risk conditions section when empty', () => {
    const overview: GenomicsOverview = { ...mockOverview, highRiskConditions: [] };
    render(
      <TestWrapper>
        <GenomicProfileCard overview={overview} />
      </TestWrapper>,
    );
    expect(screen.getByText('Genomic Profile')).toBeInTheDocument();
    expect(screen.queryByText('High Risk Conditions')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RiskScoreCard — unknown risk level fallback
// ---------------------------------------------------------------------------

describe('RiskScoreCard — branch coverage', () => {
  it('renders unknown risk level with neutral fallback', () => {
    const score: PolygenicRiskScore = {
      ...mockRiskScores[0],
      riskLevel: 'unknown_level' as any,
    };
    render(
      <TestWrapper>
        <RiskScoreCard score={score} />
      </TestWrapper>,
    );
    expect(screen.getByText('unknown_level')).toBeInTheDocument();
  });

  it('renders low risk level', () => {
    const score: PolygenicRiskScore = {
      ...mockRiskScores[0],
      riskLevel: 'low',
    };
    render(
      <TestWrapper>
        <RiskScoreCard score={score} />
      </TestWrapper>,
    );
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('renders high risk level', () => {
    const score: PolygenicRiskScore = {
      ...mockRiskScores[0],
      riskLevel: 'high',
    };
    render(
      <TestWrapper>
        <RiskScoreCard score={score} />
      </TestWrapper>,
    );
    expect(screen.getByText('high')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RiskScoreRadar — unknown category fallback
// ---------------------------------------------------------------------------

describe('RiskScoreRadar — branch coverage', () => {
  it('renders with unknown category ID (fallback to Dna icon)', () => {
    const scores: PolygenicRiskScore[] = [
      {
        ...mockRiskScores[0],
        category: 'unknown_category' as any,
      },
    ];
    render(
      <TestWrapper>
        <RiskScoreRadar scores={scores} />
      </TestWrapper>,
    );
    expect(screen.getByText('Risk Profile Overview')).toBeInTheDocument();
  });
});
