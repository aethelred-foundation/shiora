// ============================================================
// Tests for src/app/clinical/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockSetActiveTab = jest.fn();
const mockSetSeverityFilter = jest.fn();
const mockSetAuditTypeFilter = jest.fn();
const mockAcknowledgeAlert = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
  isLoading: false,
  error: null,
};
const mockRefetch = jest.fn();

let mockOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useClinicalDecisionSupport', () => ({
  useClinicalDecisionSupport: () => ({
    stats: {
      totalDecisions: 150,
      activeClinicalAlerts: 5,
      activePathways: 3,
      drugChecksToday: 32,
      guidelineComplianceScore: 91,
      teeVerifiedDecisions: 140,
    },
    alerts: [
      {
        id: 'alert-1',
        type: 'drug_interaction',
        severity: 'critical',
        title: 'Metformin-Warfarin Interaction',
        message: 'Potential bleeding risk',
        relatedDrugs: ['Metformin', 'Warfarin'],
        recommendation: 'Monitor INR closely',
        triggeredAt: Date.now(),
        attestation: '0xalert1att',
      },
      {
        id: 'alert-2',
        type: 'lab_abnormal',
        severity: 'high',
        title: 'Dosage Adjustment Needed',
        message: 'Renal function decline detected',
        recommendation: 'Adjust dosage',
        triggeredAt: Date.now(),
        attestation: '0xalert2att',
      },
      {
        id: 'alert-3',
        type: 'guideline_deviation',
        severity: 'medium',
        title: 'Guideline Update Available',
        message: 'New AHA guidelines published',
        recommendation: 'Review guidelines',
        triggeredAt: Date.now(),
        acknowledgedAt: Date.now(),
        attestation: '0xalert3att',
      },
    ],
    pathways: [
      {
        id: 'pw-1',
        name: 'Diabetes Management',
        category: 'endocrine',
        description: 'Type 2 diabetes care pathway',
        applicableConditions: ['Type 2 Diabetes', 'Prediabetes'],
        guidelineSource: 'ADA 2024',
        version: '3.1',
        lastUpdated: Date.now(),
        teeVerified: true,
        attestation: '0xpw1att',
        steps: [
          {
            id: 's1',
            order: 1,
            title: 'Initial Assessment',
            description: 'Full patient assessment',
            actionRequired: 'Complete assessment form',
            status: 'completed',
            completedAt: Date.now(),
            criteria: ['Patient history review'],
          },
          {
            id: 's2',
            order: 2,
            title: 'Lab Work',
            description: 'Order labs',
            actionRequired: 'Order HbA1c and metabolic panel',
            status: 'completed',
            completedAt: Date.now(),
            criteria: ['HbA1c ordered'],
          },
          {
            id: 's3',
            order: 3,
            title: 'Treatment Plan',
            description: 'Create treatment plan',
            actionRequired: 'Review lab results and create plan',
            status: 'active',
            criteria: ['Lab results reviewed'],
          },
          {
            id: 's4',
            order: 4,
            title: 'Follow-up',
            description: 'Schedule follow-up',
            actionRequired: 'Schedule 3-month follow-up',
            status: 'pending',
            criteria: ['Follow-up scheduled'],
          },
        ],
      },
      {
        id: 'pw-2',
        name: 'Cardiac Rehabilitation',
        category: 'cardiology',
        description: 'Post-MI rehab pathway',
        applicableConditions: ['Myocardial Infarction'],
        guidelineSource: 'AHA 2024',
        version: '2.0',
        lastUpdated: Date.now(),
        teeVerified: true,
        attestation: '0xpw2att',
        steps: [
          {
            id: 's5',
            order: 1,
            title: 'Evaluation',
            description: 'Cardiac eval',
            actionRequired: 'Perform cardiac eval',
            status: 'completed',
            completedAt: Date.now(),
            criteria: ['Eval complete'],
          },
          {
            id: 's6',
            order: 2,
            title: 'Exercise Program',
            description: 'Start exercise',
            actionRequired: 'Begin supervised exercise',
            status: 'active',
            criteria: ['Exercise started'],
          },
          {
            id: 's7',
            order: 3,
            title: 'Monitoring',
            description: 'Monitor progress',
            actionRequired: 'Weekly monitoring',
            status: 'pending',
            criteria: ['Monitoring scheduled'],
          },
        ],
      },
      {
        id: 'pw-3',
        name: 'Pain Management',
        category: 'pain',
        description: 'Chronic pain pathway',
        applicableConditions: ['Chronic Pain'],
        guidelineSource: 'CDC 2023',
        version: '1.5',
        lastUpdated: Date.now(),
        teeVerified: true,
        attestation: '0xpw3att',
        steps: [
          {
            id: 's8',
            order: 1,
            title: 'Assessment',
            description: 'Pain assessment',
            actionRequired: 'Assess pain level',
            status: 'completed',
            completedAt: Date.now(),
            criteria: ['Assessment done'],
          },
          {
            id: 's9',
            order: 2,
            title: 'Medication Review',
            description: 'Review meds',
            actionRequired: 'Review current meds',
            status: 'completed',
            completedAt: Date.now(),
            criteria: ['Meds reviewed'],
          },
          {
            id: 's10',
            order: 3,
            title: 'Physical Therapy',
            description: 'PT referral',
            actionRequired: 'Refer to PT',
            status: 'completed',
            completedAt: Date.now(),
            criteria: ['PT referral sent'],
          },
        ],
      },
    ],
    interactions: [
      {
        id: 'int-1',
        drugA: 'Metformin',
        drugB: 'Warfarin',
        severity: 'major',
        mechanism: 'CYP2C9 inhibition',
        clinicalEffect: 'Increased bleeding risk',
        recommendation: 'Monitor INR closely',
        evidenceLevel: 'established',
        teeVerified: true,
        attestation: '0xint1att',
      },
      {
        id: 'int-2',
        drugA: 'Lisinopril',
        drugB: 'Ibuprofen',
        severity: 'moderate',
        mechanism: 'Renal prostaglandin inhibition',
        clinicalEffect: 'Reduced antihypertensive effect',
        recommendation: 'Consider alternative NSAID',
        evidenceLevel: 'probable',
        teeVerified: true,
        attestation: '0xint2att',
      },
    ],
    differentials: [
      {
        id: 'dx-1',
        condition: 'Type 2 Diabetes',
        icdCode: 'E11.9',
        probability: 0.85,
        supportingEvidence: ['Elevated HbA1c', 'Fasting glucose >126'],
        contradictingEvidence: ['No ketoacidosis'],
        recommendedTests: ['Fasting glucose', 'C-peptide'],
        urgency: 'routine',
        teeVerified: true,
        attestation: '0xdx1att',
      },
      {
        id: 'dx-2',
        condition: 'Metabolic Syndrome',
        icdCode: 'E88.81',
        probability: 0.72,
        supportingEvidence: ['Elevated triglycerides', 'Central obesity'],
        contradictingEvidence: ['Normal blood pressure'],
        recommendedTests: ['Lipid panel'],
        urgency: 'routine',
        teeVerified: true,
        attestation: '0xdx2att',
      },
    ],
    auditEntries: [
      {
        id: 'aud-1',
        decisionType: 'drug_check',
        inputs: 'Metformin + Warfarin',
        output: 'Major interaction detected',
        modelId: 'cds-v3',
        confidence: 0.95,
        attestation: '0xaud1att',
        timestamp: Date.now(),
      },
      {
        id: 'aud-2',
        decisionType: 'pathway_step',
        inputs: 'Pathway pw-1 step s2',
        output: 'Lab Work completed',
        modelId: 'cds-v3',
        confidence: 0.99,
        attestation: '0xaud2att',
        timestamp: Date.now(),
        reviewedBy: 'Dr. Smith',
        reviewedAt: Date.now(),
      },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
    activeTab: 'dashboard',
    setActiveTab: mockSetActiveTab,
    severityFilter: 'all',
    setSeverityFilter: mockSetSeverityFilter,
    auditTypeFilter: 'all',
    setAuditTypeFilter: mockSetAuditTypeFilter,
    acknowledgeAlert: mockAcknowledgeAlert,
    refetch: mockRefetch,
    ...mockOverrides,
  }),
}));

import ClinicalDecisionSupportPage from '@/app/clinical/page';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockOverrides = {};
});

describe('ClinicalDecisionSupportPage', () => {
  it('renders the page heading', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(
      screen.getByText(
        /AI-powered clinical pathways, drug interaction checks, and differential diagnosis/,
      ),
    ).toBeInTheDocument();
  });

  it('renders navigation', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders TEE badge', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Intel SGX Verified').length).toBeGreaterThanOrEqual(1);
  });

  it('renders stat cards', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Active Pathways')).toBeInTheDocument();
    expect(screen.getByText('Drug Checks Today')).toBeInTheDocument();
    expect(screen.getByText('Guideline Compliance')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pathways')).toBeInTheDocument();
    expect(screen.getByText('Drug Interactions')).toBeInTheDocument();
    expect(screen.getByText('Differentials')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
  });

  // --- Dashboard Tab ---

  it('renders dashboard tab by default with Clinical Alerts and Decision Confidence', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Clinical Alerts')).toBeInTheDocument();
    expect(screen.getByText('Decision Confidence')).toBeInTheDocument();
  });

  it('renders Active Pathways Overview on dashboard', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Active Pathways Overview')).toBeInTheDocument();
  });

  it('renders pathway cards on dashboard with progress', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Diabetes Management')).toBeInTheDocument();
    expect(screen.getByText('Cardiac Rehabilitation')).toBeInTheDocument();
    expect(screen.getByText('Pain Management')).toBeInTheDocument();
  });

  it('renders View All button on dashboard and clicks it', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    const viewAllBtn = screen.getByText('View All');
    expect(viewAllBtn).toBeInTheDocument();
    fireEvent.click(viewAllBtn);
    expect(mockSetActiveTab).toHaveBeenCalledWith('pathways');
  });

  it('clicks a pathway card on dashboard to navigate to pathways tab', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Diabetes Management'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('pathways');
  });

  it('shows empty alerts state when alerts is empty', () => {
    mockOverrides = { alerts: [] };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Loading clinical alerts...')).toBeInTheDocument();
  });

  // --- Pathways Tab ---

  it('switches to Pathways tab', () => {
    mockOverrides = { activeTab: 'pathways' };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Clinical Pathways')).toBeInTheDocument();
    expect(screen.getByText(/Evidence-based care protocols/)).toBeInTheDocument();
  });

  it('shows loading pathways when pathways is empty', () => {
    mockOverrides = { activeTab: 'pathways', pathways: [] };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Loading clinical pathways...')).toBeInTheDocument();
  });

  // --- Drug Interactions Tab ---

  it('switches to Drug Interactions tab', () => {
    mockOverrides = { activeTab: 'interactions' };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Drug Interaction Analysis')).toBeInTheDocument();
    expect(screen.getByText('Drug A')).toBeInTheDocument();
    expect(screen.getByText('Drug B')).toBeInTheDocument();
    expect(screen.getByText('Mechanism')).toBeInTheDocument();
  });

  it('shows loading interactions when interactions is empty', () => {
    mockOverrides = { activeTab: 'interactions', interactions: [] };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Loading drug interaction data...')).toBeInTheDocument();
  });

  // --- Differentials Tab ---

  it('switches to Differentials tab', () => {
    mockOverrides = { activeTab: 'differentials' };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Differential Diagnosis')).toBeInTheDocument();
    expect(screen.getByText(/AI-generated differential diagnoses/)).toBeInTheDocument();
  });

  it('shows loading differentials when differentials is empty', () => {
    mockOverrides = { activeTab: 'differentials', differentials: [] };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Loading differential diagnoses...')).toBeInTheDocument();
  });

  // --- Audit Trail Tab ---

  it('switches to Audit Trail tab', () => {
    mockOverrides = { activeTab: 'audit' };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Clinical Decision Audit Trail')).toBeInTheDocument();
    expect(screen.getByText(/Immutable, TEE-attested record/)).toBeInTheDocument();
  });

  // --- Stats undefined ---

  it('renders stat cards with default values when stats is undefined', () => {
    mockOverrides = { stats: undefined };
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Active Pathways')).toBeInTheDocument();
  });

  // --- Tab switching via onChange ---

  it('calls setActiveTab when Pathways tab is clicked', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Pathways'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('pathways');
  });

  it('calls setActiveTab for Drug Interactions tab', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Drug Interactions'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('interactions');
  });

  it('calls setActiveTab for Differentials tab', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Differentials'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('differentials');
  });

  it('calls setActiveTab for Audit Trail tab', () => {
    render(
      <TestWrapper>
        <ClinicalDecisionSupportPage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Audit Trail'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('audit');
  });
});
