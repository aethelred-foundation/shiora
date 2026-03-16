// ============================================================
// Tests for src/components/clinical/ClinicalComponents.tsx
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  ClinicalAlertCard,
  PathwayFlowchart,
  DrugInteractionRow,
  DifferentialCard,
  AuditTrailTable,
} from '@/components/clinical/ClinicalComponents';
import type {
  ClinicalAlert,
  ClinicalPathway,
  DrugInteraction,
  DifferentialDiagnosis,
  ClinicalDecisionAuditEntry,
} from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockAlert: ClinicalAlert = {
  id: 'alert-1',
  type: 'drug_interaction',
  severity: 'critical',
  title: 'Warfarin-Aspirin Interaction',
  message: 'Concurrent use increases bleeding risk significantly.',
  recommendation: 'Consider alternative anticoagulation strategy.',
  triggeredAt: Date.now() - 3600000,
  relatedDrugs: ['Warfarin', 'Aspirin'],
  relatedConditions: ['Atrial Fibrillation'],
  acknowledged: false,
};

const mockPathway: ClinicalPathway = {
  id: 'pw-1',
  name: 'Hypertension Management',
  description: 'Stepwise approach to blood pressure control.',
  guidelineSource: 'ACC/AHA',
  version: '2.1',
  applicableConditions: ['Hypertension', 'CKD'],
  teeVerified: true,
  steps: [
    {
      id: 'step-1',
      order: 1,
      title: 'Lifestyle Modifications',
      description: 'Diet, exercise, sodium restriction.',
      status: 'completed',
      actionRequired: 'Counsel patient on DASH diet.',
      criteria: ['BMI > 25', 'Sodium > 2300mg/day'],
      completedAt: Date.now() - 86400000 * 7,
      attestation: '0xabc123def456',
    },
    {
      id: 'step-2',
      order: 2,
      title: 'First-Line Pharmacotherapy',
      description: 'Initiate ACE inhibitor or ARB.',
      status: 'active',
      actionRequired: 'Start Lisinopril 10mg daily.',
      criteria: ['BP > 140/90 after 3 months lifestyle'],
    },
  ],
};

const mockInteraction: DrugInteraction = {
  id: 'di-1',
  drugA: 'Metformin',
  drugB: 'Contrast Dye',
  severity: 'major',
  mechanism: 'Lactic acidosis risk with iodinated contrast.',
  clinicalEffect: 'Potential for renal impairment and lactic acidosis.',
  recommendation: 'Hold metformin 48h before and after contrast.',
  evidenceLevel: 'established',
  teeVerified: true,
};

const mockDiagnosis: DifferentialDiagnosis = {
  id: 'dx-1',
  condition: 'Pulmonary Embolism',
  icdCode: 'I26.99',
  probability: 0.82,
  urgency: 'emergent',
  supportingEvidence: ['Acute dyspnea', 'Elevated D-dimer'],
  contradictingEvidence: ['No prior DVT history'],
  recommendedTests: ['CT Pulmonary Angiogram', 'V/Q Scan'],
  teeVerified: true,
  attestation: '0xdef789abc012',
};

const mockAuditEntries: ClinicalDecisionAuditEntry[] = [
  {
    id: 'audit-1',
    timestamp: Date.now() - 3600000,
    decisionType: 'drug_check',
    modelId: 'clinical-llm-v3',
    confidence: 96.5,
    output: 'Major interaction detected between Warfarin and Aspirin.',
    reviewedBy: 'Dr. Smith',
    reviewedAt: Date.now() - 1800000,
    attestation: '0x123456789abcdef0',
  },
];

// ---------------------------------------------------------------------------
// ClinicalAlertCard
// ---------------------------------------------------------------------------

describe('ClinicalAlertCard', () => {
  it('renders alert title and message', () => {
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={mockAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('Warfarin-Aspirin Interaction')).toBeInTheDocument();
    expect(screen.getByText(/Concurrent use increases bleeding risk/)).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={mockAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('renders recommendation', () => {
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={mockAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('Consider alternative anticoagulation strategy.')).toBeInTheDocument();
  });

  it('renders related drugs', () => {
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={mockAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('Warfarin')).toBeInTheDocument();
    expect(screen.getByText('Aspirin')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PathwayFlowchart
// ---------------------------------------------------------------------------

describe('PathwayFlowchart', () => {
  it('renders pathway name and description', () => {
    render(
      <TestWrapper>
        <PathwayFlowchart pathway={mockPathway} />
      </TestWrapper>
    );
    expect(screen.getByText('Hypertension Management')).toBeInTheDocument();
    expect(screen.getByText(/Stepwise approach/)).toBeInTheDocument();
  });

  it('renders applicable conditions', () => {
    render(
      <TestWrapper>
        <PathwayFlowchart pathway={mockPathway} />
      </TestWrapper>
    );
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
    expect(screen.getByText('CKD')).toBeInTheDocument();
  });

  it('renders step titles', () => {
    render(
      <TestWrapper>
        <PathwayFlowchart pathway={mockPathway} />
      </TestWrapper>
    );
    expect(screen.getByText('Lifestyle Modifications')).toBeInTheDocument();
    expect(screen.getByText('First-Line Pharmacotherapy')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DrugInteractionRow
// ---------------------------------------------------------------------------

describe('DrugInteractionRow', () => {
  it('renders drug names and severity', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <DrugInteractionRow interaction={mockInteraction} />
          </tbody>
        </table>
      </TestWrapper>
    );
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('Contrast Dye')).toBeInTheDocument();
    expect(screen.getByText('major')).toBeInTheDocument();
  });

  it('renders evidence level', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <DrugInteractionRow interaction={mockInteraction} />
          </tbody>
        </table>
      </TestWrapper>
    );
    expect(screen.getByText('established')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DifferentialCard
// ---------------------------------------------------------------------------

describe('DifferentialCard', () => {
  it('renders condition and ICD code', () => {
    render(
      <TestWrapper>
        <DifferentialCard diagnosis={mockDiagnosis} />
      </TestWrapper>
    );
    expect(screen.getByText('Pulmonary Embolism')).toBeInTheDocument();
    expect(screen.getByText(/I26\.99/)).toBeInTheDocument();
  });

  it('renders probability percentage', () => {
    render(
      <TestWrapper>
        <DifferentialCard diagnosis={mockDiagnosis} />
      </TestWrapper>
    );
    expect(screen.getByText('82%')).toBeInTheDocument();
  });

  it('renders supporting and contradicting evidence', () => {
    render(
      <TestWrapper>
        <DifferentialCard diagnosis={mockDiagnosis} />
      </TestWrapper>
    );
    expect(screen.getByText('Acute dyspnea')).toBeInTheDocument();
    expect(screen.getByText('No prior DVT history')).toBeInTheDocument();
  });

  it('renders recommended tests', () => {
    render(
      <TestWrapper>
        <DifferentialCard diagnosis={mockDiagnosis} />
      </TestWrapper>
    );
    expect(screen.getByText('CT Pulmonary Angiogram')).toBeInTheDocument();
    expect(screen.getByText('V/Q Scan')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AuditTrailTable
// ---------------------------------------------------------------------------

describe('AuditTrailTable', () => {
  it('renders table headers', () => {
    render(
      <TestWrapper>
        <AuditTrailTable entries={mockAuditEntries} />
      </TestWrapper>
    );
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Decision Type')).toBeInTheDocument();
    expect(screen.getByText('Model ID')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('renders entry data', () => {
    render(
      <TestWrapper>
        <AuditTrailTable entries={mockAuditEntries} />
      </TestWrapper>
    );
    expect(screen.getByText('Drug Check')).toBeInTheDocument();
    expect(screen.getByText('clinical-llm-v3')).toBeInTheDocument();
    expect(screen.getByText('96.5%')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('renders loading state when empty', () => {
    render(
      <TestWrapper>
        <AuditTrailTable entries={[]} />
      </TestWrapper>
    );
    expect(screen.getByText('Loading audit trail...')).toBeInTheDocument();
  });

  it('renders entry without reviewedBy as Pending review', () => {
    const entry: ClinicalDecisionAuditEntry = {
      ...mockAuditEntries[0],
      reviewedBy: undefined as any,
      reviewedAt: undefined,
    };
    render(
      <TestWrapper>
        <AuditTrailTable entries={[entry]} />
      </TestWrapper>
    );
    expect(screen.getByText('Pending review')).toBeInTheDocument();
  });

  it('renders confidence < 75 with red color', () => {
    const entry: ClinicalDecisionAuditEntry = { ...mockAuditEntries[0], confidence: 65.0 };
    render(
      <TestWrapper>
        <AuditTrailTable entries={[entry]} />
      </TestWrapper>
    );
    expect(screen.getByText('65.0%')).toBeInTheDocument();
  });

  it('renders confidence 75-84 with amber color', () => {
    const entry: ClinicalDecisionAuditEntry = { ...mockAuditEntries[0], confidence: 80.0 };
    render(
      <TestWrapper>
        <AuditTrailTable entries={[entry]} />
      </TestWrapper>
    );
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('renders confidence 85-94 with blue color', () => {
    const entry: ClinicalDecisionAuditEntry = { ...mockAuditEntries[0], confidence: 90.0 };
    render(
      <TestWrapper>
        <AuditTrailTable entries={[entry]} />
      </TestWrapper>
    );
    expect(screen.getByText('90.0%')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ClinicalAlertCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('ClinicalAlertCard — branch coverage', () => {
  it('renders info severity with info variant', () => {
    const alert: ClinicalAlert = { ...mockAlert, severity: 'info' as any };
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={alert} />
      </TestWrapper>
    );
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('renders warning severity with warning variant', () => {
    const alert: ClinicalAlert = { ...mockAlert, severity: 'warning' as any };
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={alert} />
      </TestWrapper>
    );
    expect(screen.getByText('warning')).toBeInTheDocument();
  });

  it('renders alert without relatedDrugs', () => {
    const alert: ClinicalAlert = { ...mockAlert, relatedDrugs: undefined as any };
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={alert} />
      </TestWrapper>
    );
    expect(screen.getByText('Warfarin-Aspirin Interaction')).toBeInTheDocument();
  });

  it('renders alert without relatedConditions', () => {
    const alert: ClinicalAlert = { ...mockAlert, relatedConditions: undefined as any };
    render(
      <TestWrapper>
        <ClinicalAlertCard alert={alert} />
      </TestWrapper>
    );
    expect(screen.getByText('Warfarin-Aspirin Interaction')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PathwayFlowchart — additional branch coverage
// ---------------------------------------------------------------------------

describe('PathwayFlowchart — branch coverage', () => {
  it('renders pending and skipped step statuses', () => {
    const pathway: ClinicalPathway = {
      ...mockPathway,
      steps: [
        ...mockPathway.steps,
        {
          id: 'step-3',
          order: 3,
          title: 'Pending Step',
          description: 'Awaiting results.',
          status: 'pending' as any,
          actionRequired: 'Wait for lab results.',
          criteria: ['Lab ordered'],
        },
        {
          id: 'step-4',
          order: 4,
          title: 'Skipped Step',
          description: 'Not applicable.',
          status: 'skipped' as any,
          actionRequired: 'N/A',
          criteria: ['Contraindicated'],
        },
      ],
    };
    render(
      <TestWrapper>
        <PathwayFlowchart pathway={pathway} />
      </TestWrapper>
    );
    expect(screen.getByText('Pending Step')).toBeInTheDocument();
    expect(screen.getByText('Skipped Step')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it('renders step without completedAt or attestation', () => {
    const pathway: ClinicalPathway = {
      ...mockPathway,
      steps: [
        {
          id: 'step-no-meta',
          order: 1,
          title: 'No Meta Step',
          description: 'Simple step.',
          status: 'active',
          actionRequired: 'Do something.',
          criteria: ['Criteria A'],
        },
      ],
    };
    render(
      <TestWrapper>
        <PathwayFlowchart pathway={pathway} />
      </TestWrapper>
    );
    expect(screen.getByText('No Meta Step')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DrugInteractionRow — additional branch coverage
// ---------------------------------------------------------------------------

describe('DrugInteractionRow — branch coverage', () => {
  it('renders with teeVerified=false', () => {
    const interaction: DrugInteraction = { ...mockInteraction, teeVerified: false };
    render(
      <TestWrapper>
        <table><tbody><DrugInteractionRow interaction={interaction} /></tbody></table>
      </TestWrapper>
    );
    expect(screen.getByText('Metformin')).toBeInTheDocument();
  });

  it('renders probable evidence level with info variant', () => {
    const interaction: DrugInteraction = { ...mockInteraction, evidenceLevel: 'probable' as any };
    render(
      <TestWrapper>
        <table><tbody><DrugInteractionRow interaction={interaction} /></tbody></table>
      </TestWrapper>
    );
    expect(screen.getByText('probable')).toBeInTheDocument();
  });

  it('renders unknown evidence level with neutral variant', () => {
    const interaction: DrugInteraction = { ...mockInteraction, evidenceLevel: 'theoretical' as any };
    render(
      <TestWrapper>
        <table><tbody><DrugInteractionRow interaction={interaction} /></tbody></table>
      </TestWrapper>
    );
    expect(screen.getByText('theoretical')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DifferentialCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('DifferentialCard — branch coverage', () => {
  it('renders probability < 40 with slate bar color', () => {
    const dx: DifferentialDiagnosis = { ...mockDiagnosis, probability: 0.25 };
    render(
      <TestWrapper>
        <DifferentialCard diagnosis={dx} />
      </TestWrapper>
    );
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('renders probability 40-59 with cyan bar color', () => {
    const dx: DifferentialDiagnosis = { ...mockDiagnosis, probability: 0.50 };
    render(
      <TestWrapper>
        <DifferentialCard diagnosis={dx} />
      </TestWrapper>
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders probability 60-79 with amber bar color', () => {
    const dx: DifferentialDiagnosis = { ...mockDiagnosis, probability: 0.70 };
    render(
      <TestWrapper>
        <DifferentialCard diagnosis={dx} />
      </TestWrapper>
    );
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});
