// ============================================================
// Tests for src/app/genomics/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockGenerateReport = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isLoading: false,
  error: null,
};
const mockRefetch = jest.fn();

let mockOverrides: Record<string, unknown> = {};

const DEFAULT_OVERVIEW = {
  profile: {
    id: 'gp-001',
    ownerAddress: 'aeth1xxx',
    sequencingStatus: 'completed' as const,
    sequencingDate: Date.now() - 86400000,
    totalVariants: 4521,
    clinicallySignificant: 42,
    pharmacogenomicFlags: 5,
    riskScoresGenerated: 6,
    dataEncrypted: true,
    teeProcessed: true,
    attestation: '0xprofile',
    lastUpdated: Date.now() - 86400000,
  },
  pharmacogenomicCount: 8,
  biomarkerCount: 10,
  riskScoreCount: 6,
  reportCount: 3,
  highRiskConditions: ['Type 2 Diabetes', 'Coronary Artery Disease'],
  actionableFindings: 5,
};

const DEFAULT_PHARMACOGENOMICS = [
  {
    id: 'pgx-0',
    gene: 'CYP2D6',
    variant: '*1/*2',
    rsId: 'rs1065852',
    drugName: 'Codeine',
    drugCategory: 'Pain',
    metabolismRate: 'normal' as const,
    clinicalRecommendation: 'Standard dose',
    evidenceLevel: 'Level 1A' as const,
    guidelineSource: 'CPIC',
    teeVerified: true,
    attestation: '0xabc',
  },
  {
    id: 'pgx-1',
    gene: 'CYP2C19',
    variant: '*1/*17',
    rsId: 'rs4244285',
    drugName: 'Clopidogrel',
    drugCategory: 'Cardiovascular',
    metabolismRate: 'rapid' as const,
    clinicalRecommendation: 'Consider alternative',
    evidenceLevel: 'Level 2A' as const,
    guidelineSource: 'DPWG',
    teeVerified: true,
    attestation: '0xdef',
  },
];

const DEFAULT_BIOMARKERS = [
  {
    id: 'bio-0',
    name: 'HbA1c',
    category: 'metabolic',
    currentValue: 5.4,
    unit: '%',
    referenceRange: { low: 4.0, high: 5.6 },
    status: 'normal' as const,
    trend: 'stable' as const,
    lastMeasured: Date.now() - 7 * 86400000,
    history: [
      { date: Date.now() - 30 * 86400000, value: 5.5 },
      { date: Date.now() - 7 * 86400000, value: 5.4 },
    ],
  },
  {
    id: 'bio-1',
    name: 'Cholesterol',
    category: 'lipid',
    currentValue: 190,
    unit: 'mg/dL',
    referenceRange: { low: 0, high: 200 },
    status: 'normal' as const,
    trend: 'improving' as const,
    lastMeasured: Date.now() - 14 * 86400000,
    history: [
      { date: Date.now() - 30 * 86400000, value: 210 },
      { date: Date.now() - 14 * 86400000, value: 190 },
    ],
  },
];

const DEFAULT_RISK_SCORES = [
  {
    id: 'prs-0',
    condition: 'Type 2 Diabetes',
    category: 'metabolic',
    score: 0.72,
    percentile: 72,
    riskLevel: 'elevated' as const,
    variantsAnalyzed: 150,
    modifiableFactors: ['Diet', 'Exercise'],
    nonModifiableFactors: ['Family history'],
    recommendedInterventions: ['Regular screening'],
    attestation: '0x123',
    calculatedAt: Date.now() - 86400000,
  },
  {
    id: 'prs-1',
    condition: 'Coronary Artery Disease',
    category: 'cardiovascular',
    score: 0.55,
    percentile: 55,
    riskLevel: 'average' as const,
    variantsAnalyzed: 200,
    modifiableFactors: ['Smoking cessation'],
    nonModifiableFactors: ['Age'],
    recommendedInterventions: ['Exercise'],
    attestation: '0x456',
    calculatedAt: Date.now() - 172800000,
  },
];

const DEFAULT_REPORTS = [
  {
    id: 'greport-0',
    category: 'pharmacogenomics',
    title: 'Pharmacogenomics Report',
    generatedAt: Date.now() - 30 * 86400000,
    status: 'ready' as const,
    summary: 'Full PGx analysis',
    findings: 8,
    actionableItems: 3,
    teeVerified: true,
    attestation: '0xrpt1',
  },
  {
    id: 'greport-1',
    category: 'risk_assessment',
    title: 'Polygenic Risk Report',
    generatedAt: Date.now() - 60 * 86400000,
    status: 'ready' as const,
    summary: 'Risk assessment summary',
    findings: 6,
    actionableItems: 2,
    teeVerified: true,
    attestation: '0xrpt2',
  },
];

jest.mock('@/hooks/useGenomics', () => ({
  useGenomics: () => ({
    overview: DEFAULT_OVERVIEW,
    pharmacogenomics: DEFAULT_PHARMACOGENOMICS,
    biomarkers: DEFAULT_BIOMARKERS,
    biomarker: undefined,
    riskScores: DEFAULT_RISK_SCORES,
    reports: DEFAULT_REPORTS,
    isLoading: false,
    isFetching: false,
    error: null,
    selectedMarker: 'hba1c',
    setSelectedMarker: jest.fn(),
    generateReport: mockGenerateReport,
    refetch: mockRefetch,
    ...mockOverrides,
  }),
}));

import GenomicsPage from '@/app/genomics/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

function clickTab(name: string) {
  // Tabs use role="tab", so find the tab button by role and name
  const tab = screen.getByRole('tab', { name });
  fireEvent.click(tab);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOverrides = {};
});

describe('GenomicsPage', () => {
  it('renders the page heading', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Genomics & Biomarker Lab')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(
      screen.getByText(/Pharmacogenomics, biomarker tracking, and polygenic risk analysis/),
    ).toBeInTheDocument();
  });

  it('renders navigation and footer', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders TEE and encryption badges', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Intel SGX Verified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AES-256-GCM').length).toBeGreaterThanOrEqual(1);
  });

  it('renders stat cards', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Variants Analyzed')).toBeInTheDocument();
    expect(screen.getByText('Drug Sensitivity Flags')).toBeInTheDocument();
    expect(screen.getByText('Active Biomarkers')).toBeInTheDocument();
    expect(screen.getByText('Risk Categories')).toBeInTheDocument();
  });

  it('renders tab navigation with all five tabs', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Overview').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pharmacogenomics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Biomarkers').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Risk Scores').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reports').length).toBeGreaterThanOrEqual(1);
  });

  // --- Overview Tab ---

  it('renders overview tab by default with summary cards', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText(/drug-gene interactions analyzed/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/markers tracked with trend data/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/polygenic risk assessments/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/genomic reports generated/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows overview summary card counts', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('6').length).toBeGreaterThanOrEqual(1);
  });

  it('shows high risk conditions alert when conditions exist', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getByText('High Risk Conditions Alert')).toBeInTheDocument();
    expect(screen.getAllByText('Type 2 Diabetes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Coronary Artery Disease').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show high risk alert when no conditions', () => {
    mockOverrides = {
      overview: { ...DEFAULT_OVERVIEW, highRiskConditions: [] },
    };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.queryByText('High Risk Conditions Alert')).not.toBeInTheDocument();
  });

  it('shows loading state when overview is undefined', () => {
    mockOverrides = { overview: undefined };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Loading genomic profile...')).toBeInTheDocument();
  });

  // --- Pharmacogenomics Tab ---

  it('switches to Pharmacogenomics tab and shows drug-gene interactions', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Pharmacogenomics');
    expect(screen.getByText('Drug-Gene Interactions')).toBeInTheDocument();
  });

  it('shows pharmacogenomics guideline legend when data exists', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Pharmacogenomics');
    expect(
      screen.getByText(/Clinical Pharmacogenetics Implementation Consortium/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Dutch Pharmacogenetics Working Group/)).toBeInTheDocument();
    expect(screen.getByText(/Pharmacogenomics Knowledge Base/)).toBeInTheDocument();
  });

  it('shows loading message when pharmacogenomics data is empty', () => {
    mockOverrides = { pharmacogenomics: [] };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Pharmacogenomics');
    expect(screen.getByText('Loading pharmacogenomic data...')).toBeInTheDocument();
  });

  it('does not show guideline legend when pharmacogenomics is empty', () => {
    mockOverrides = { pharmacogenomics: [] };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Pharmacogenomics');
    expect(
      screen.queryByText(/Clinical Pharmacogenetics Implementation Consortium/),
    ).not.toBeInTheDocument();
  });

  // --- Biomarkers Tab ---

  it('switches to Biomarkers tab and shows biomarker cards', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Biomarkers');
    expect(screen.getByText('Biomarker Tracking')).toBeInTheDocument();
  });

  it('shows loading message when biomarkers data is empty', () => {
    mockOverrides = { biomarkers: [] };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Biomarkers');
    expect(screen.getByText('Loading biomarker data...')).toBeInTheDocument();
  });

  // --- Risk Scores Tab ---

  it('switches to Risk Scores tab and shows risk score cards', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Risk Scores');
    expect(screen.getByText('Polygenic Risk Scores')).toBeInTheDocument();
  });

  it('shows loading message when risk scores data is empty', () => {
    mockOverrides = { riskScores: [] };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Risk Scores');
    expect(screen.getByText('Loading risk scores...')).toBeInTheDocument();
  });

  // --- Reports Tab ---

  it('switches to Reports tab and shows report cards', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Reports');
    expect(screen.getByText('Genomic Reports')).toBeInTheDocument();
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
  });

  it('shows loading message when reports data is empty', () => {
    mockOverrides = { reports: [] };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Reports');
    expect(screen.getByText('Loading reports...')).toBeInTheDocument();
  });

  it('calls generateReport.mutate when Generate Report button is clicked', () => {
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Reports');
    fireEvent.click(screen.getByText('Generate Report'));
    expect(mockGenerateReport.mutate).toHaveBeenCalledWith('General');
  });

  it('shows Generating... text when report generation is loading', () => {
    mockOverrides = {
      generateReport: { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: true, error: null },
    };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Reports');
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('disables Generate Report button when loading', () => {
    mockOverrides = {
      generateReport: { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: true, error: null },
    };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    clickTab('Reports');
    const btn = screen.getByText('Generating...').closest('button');
    expect(btn).toBeDisabled();
  });

  it('renders high risk conditions from overview', () => {
    mockOverrides = {
      overview: {
        ...DEFAULT_OVERVIEW,
        highRiskConditions: ['Condition A', 'Condition B', 'Condition C', 'Condition D'],
      },
    };
    render(
      <TestWrapper>
        <GenomicsPage />
      </TestWrapper>,
    );
    // The high risk alert card should show conditions (sliced to first 3)
    expect(screen.getByText('High Risk Conditions Alert')).toBeInTheDocument();
    expect(screen.getAllByText('Condition A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Condition B').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Condition C').length).toBeGreaterThanOrEqual(1);
  });
});
