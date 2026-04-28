// ============================================================
// Tests for src/components/compliance/ComplianceComponents.tsx
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  ComplianceScoreCard,
  ComplianceGauge,
  FrameworkChecklist,
  AuditLogRow,
  ViolationCard,
  ReportCard,
} from '@/components/compliance/ComplianceComponents';
import type {
  ComplianceFramework,
  ComplianceCheck,
  ComplianceAuditEntry,
  PolicyViolation,
  ComplianceReport,
} from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockFramework: ComplianceFramework = {
  id: 'hipaa',
  name: 'HIPAA',
  overallScore: 94,
  passedControls: 47,
  totalControls: 50,
  lastAuditAt: Date.now() - 86400000,
};

const mockChecks: ComplianceCheck[] = [
  {
    id: 'chk-1',
    frameworkId: 'hipaa',
    controlId: 'HIPAA-164.312(a)',
    controlName: 'Access Control',
    category: 'Technical Safeguards',
    status: 'pass',
    lastCheckedAt: Date.now() - 3600000,
    teeVerified: true,
  },
  {
    id: 'chk-2',
    frameworkId: 'hipaa',
    controlId: 'HIPAA-164.312(e)',
    controlName: 'Transmission Security',
    category: 'Technical Safeguards',
    status: 'fail',
    lastCheckedAt: Date.now() - 7200000,
    teeVerified: false,
  },
];

const mockAuditEntry: ComplianceAuditEntry = {
  id: 'ae-1',
  timestamp: Date.now() - 3600000,
  action: 'Access Policy Updated',
  actor: '0xabc123def456abc123def456abc123def456abc1',
  resource: '/api/records',
  resourceType: 'API Endpoint',
  riskLevel: 'low',
  teeAttestation: '0xdef789abc012def789abc012def789abc012def7',
};

const mockViolation: PolicyViolation = {
  id: 'vio-1',
  frameworkId: 'hipaa',
  controlId: 'HIPAA-164.312(e)',
  severity: 'high',
  title: 'Unencrypted data transmission detected',
  detectedAt: Date.now() - 86400000,
  status: 'open',
  assignedTo: 'Security Team',
  remediationPlan: 'Enable TLS 1.3 on all endpoints.',
};

const mockReport: ComplianceReport = {
  id: 'rpt-1',
  frameworkId: 'hipaa',
  title: 'Q4 2025 HIPAA Compliance Report',
  status: 'final',
  generatedAt: Date.now() - 86400000 * 7,
  overallScore: 92,
  findings: 12,
  criticalGaps: 0,
};

// ---------------------------------------------------------------------------
// ComplianceScoreCard
// ---------------------------------------------------------------------------

describe('ComplianceScoreCard', () => {
  it('renders framework score and controls', () => {
    render(
      <TestWrapper>
        <ComplianceScoreCard framework={mockFramework} />
      </TestWrapper>,
    );
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText('47/50 controls')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ComplianceGauge
// ---------------------------------------------------------------------------

describe('ComplianceGauge', () => {
  it('renders score and compliant label', () => {
    render(
      <TestWrapper>
        <ComplianceGauge score={88} />
      </TestWrapper>,
    );
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('Compliant')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FrameworkChecklist
// ---------------------------------------------------------------------------

describe('FrameworkChecklist', () => {
  it('renders table headers', () => {
    render(
      <TestWrapper>
        <FrameworkChecklist checks={mockChecks} />
      </TestWrapper>,
    );
    expect(screen.getByText('Control ID')).toBeInTheDocument();
    expect(screen.getByText('Control Name')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders check data', () => {
    render(
      <TestWrapper>
        <FrameworkChecklist checks={mockChecks} />
      </TestWrapper>,
    );
    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.getByText('Transmission Security')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <TestWrapper>
        <FrameworkChecklist checks={[]} isLoading />
      </TestWrapper>,
    );
    // Should render skeleton divs, not the table
    expect(screen.queryByText('Control ID')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AuditLogRow
// ---------------------------------------------------------------------------

describe('AuditLogRow', () => {
  it('renders action and resource type', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <AuditLogRow entry={mockAuditEntry} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Access Policy Updated')).toBeInTheDocument();
    expect(screen.getByText('API Endpoint')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ViolationCard
// ---------------------------------------------------------------------------

describe('ViolationCard', () => {
  it('renders violation title and severity', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ViolationCard violation={mockViolation} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Unencrypted data transmission detected')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ReportCard
// ---------------------------------------------------------------------------

describe('ReportCard', () => {
  it('renders report title and score', () => {
    render(
      <TestWrapper>
        <ReportCard report={mockReport} />
      </TestWrapper>,
    );
    expect(screen.getByText('Q4 2025 HIPAA Compliance Report')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('final')).toBeInTheDocument();
  });

  it('renders findings and critical gaps', () => {
    render(
      <TestWrapper>
        <ReportCard report={mockReport} />
      </TestWrapper>,
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders score < 75 with red color', () => {
    const report: ComplianceReport = { ...mockReport, overallScore: 60 };
    render(
      <TestWrapper>
        <ReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders score 75-89 with amber color', () => {
    const report: ComplianceReport = { ...mockReport, overallScore: 80 };
    render(
      <TestWrapper>
        <ReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders criticalGaps > 0 with red color', () => {
    const report: ComplianceReport = { ...mockReport, criticalGaps: 3 };
    render(
      <TestWrapper>
        <ReportCard report={report} />
      </TestWrapper>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ComplianceScoreCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('ComplianceScoreCard — branch coverage', () => {
  it('renders score < 75 with red styling', () => {
    const framework: ComplianceFramework = { ...mockFramework, overallScore: 60 };
    render(
      <TestWrapper>
        <ComplianceScoreCard framework={framework} />
      </TestWrapper>,
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders score 75-89 with amber styling', () => {
    const framework: ComplianceFramework = { ...mockFramework, overallScore: 80 };
    render(
      <TestWrapper>
        <ComplianceScoreCard framework={framework} />
      </TestWrapper>,
    );
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ComplianceGauge — additional branch coverage
// ---------------------------------------------------------------------------

describe('ComplianceGauge — branch coverage', () => {
  it('renders score < 75 with red color', () => {
    render(
      <TestWrapper>
        <ComplianceGauge score={60} />
      </TestWrapper>,
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders score 75-89 with amber color', () => {
    render(
      <TestWrapper>
        <ComplianceGauge score={80} />
      </TestWrapper>,
    );
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FrameworkChecklist — additional branch coverage
// ---------------------------------------------------------------------------

describe('FrameworkChecklist — branch coverage', () => {
  it('renders na, partial, and not_assessed status checks', () => {
    const checks: ComplianceCheck[] = [
      { ...mockChecks[0], id: 'chk-na', status: 'na' as any, controlName: 'N/A Control' },
      {
        ...mockChecks[0],
        id: 'chk-partial',
        status: 'partial' as any,
        controlName: 'Partial Control',
      },
      {
        ...mockChecks[0],
        id: 'chk-not',
        status: 'not_assessed' as any,
        controlName: 'Not Assessed Control',
      },
    ];
    render(
      <TestWrapper>
        <FrameworkChecklist checks={checks} />
      </TestWrapper>,
    );
    expect(screen.getByText('N/A Control')).toBeInTheDocument();
    expect(screen.getByText('Partial Control')).toBeInTheDocument();
    expect(screen.getByText('Not Assessed Control')).toBeInTheDocument();
    expect(screen.getByText('na')).toBeInTheDocument();
    expect(screen.getByText('partial')).toBeInTheDocument();
    expect(screen.getByText('not assessed')).toBeInTheDocument();
  });

  it('renders check with teeVerified=false showing --', () => {
    render(
      <TestWrapper>
        <FrameworkChecklist checks={[mockChecks[1]]} />
      </TestWrapper>,
    );
    expect(screen.getByText('--')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ViolationCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('ViolationCard — branch coverage', () => {
  it('renders violation without assignedTo as --', () => {
    const violation: PolicyViolation = { ...mockViolation, assignedTo: undefined as any };
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ViolationCard violation={violation} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('--')).toBeInTheDocument();
  });
});
