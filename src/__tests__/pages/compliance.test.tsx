// ============================================================
// Tests for src/app/compliance/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockSetAuditPage = jest.fn();
const mockSetSelectedFramework = jest.fn();
const mockGenerateReport = { mutate: jest.fn(), isLoading: false };

let mockOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useCompliance', () => ({
  useCompliance: () => ({
    overview: {
      overallComplianceScore: 94,
      frameworks: [
        { id: 'hipaa', name: 'HIPAA', score: 96 },
        { id: 'gdpr', name: 'GDPR', score: 92 },
        { id: 'soc2', name: 'SOC 2', score: 91 },
        { id: 'hitrust', name: 'HITRUST', score: 89 },
        { id: 'fda', name: 'FDA 21 CFR', score: 88 },
      ],
      activeViolations: 3,
      daysSinceLastAudit: 14,
      upcomingAssessments: [
        { frameworkId: 'hipaa', dueDate: Date.now() + 86400000 * 30 },
        { frameworkId: 'gdpr', dueDate: Date.now() + 86400000 * 60 },
      ],
      complianceTrend: [
        { month: 'Jan', score: 90 },
        { month: 'Feb', score: 91 },
        { month: 'Mar', score: 93 },
      ],
    },
    frameworks: [
      { id: 'hipaa', name: 'HIPAA', version: '2024', description: 'HIPAA compliance', overallScore: 96, passedControls: 48, failedControls: 2, notAssessedControls: 0 },
      { id: 'gdpr', name: 'GDPR', version: '2023', description: 'GDPR compliance', overallScore: 92, passedControls: 40, failedControls: 4, notAssessedControls: 1 },
    ],
    auditLog: [
      { id: 'a-1', action: 'user_login', actor: 'admin', resource: 'auth', resourceType: 'system', riskLevel: 'low', timestamp: Date.now(), teeAttestation: '0xabc123def456', details: 'Login from IP', ipAddress: '10.0.0.1', frameworkRelevance: ['hipaa'] },
      { id: 'a-2', action: 'data_export', actor: 'user', resource: 'records', resourceType: 'data', riskLevel: 'medium', timestamp: Date.now(), teeAttestation: '0xdef456abc123', details: 'Export records', ipAddress: '10.0.0.2', frameworkRelevance: ['gdpr'] },
      { id: 'a-3', action: 'config_change', actor: 'admin', resource: 'settings', resourceType: 'system', riskLevel: 'high', timestamp: Date.now(), teeAttestation: '0x123abc456def', details: 'Config updated', ipAddress: '10.0.0.3', frameworkRelevance: ['soc2'] },
    ],
    auditMeta: { page: 1, total: 50, totalPages: 5 },
    reports: [
      { id: 'r-1', title: 'Q1 Report', type: 'quarterly', createdAt: Date.now(), status: 'completed' },
      { id: 'r-2', title: 'Annual Report', type: 'annual', createdAt: Date.now(), status: 'completed' },
    ],
    violations: [
      { id: 'v-1', frameworkId: 'hipaa', controlId: 'HIPAA-164.312', severity: 'high', title: 'Encryption gap', status: 'open', detectedAt: Date.now(), assignedTo: 'Security Team', remediationPlan: 'Update encryption' },
      { id: 'v-2', frameworkId: 'gdpr', controlId: 'GDPR-Art32', severity: 'medium', title: 'Consent update needed', status: 'in_progress', detectedAt: Date.now(), assignedTo: 'Legal', remediationPlan: 'Update consent flows' },
      { id: 'v-3', frameworkId: 'soc2', controlId: 'SOC2-CC6', severity: 'low', title: 'Access review overdue', status: 'resolved', detectedAt: Date.now(), assignedTo: 'IT Ops', remediationPlan: 'Complete review' },
      { id: 'v-4', frameworkId: 'hipaa', controlId: 'HIPAA-164.308', severity: 'low', title: 'Policy update', status: 'accepted_risk', detectedAt: Date.now(), assignedTo: 'Compliance', remediationPlan: 'Accept risk' },
    ],
    frameworkChecks: [
      { id: 'c-1', frameworkId: 'hipaa', controlId: 'HIPAA-001', title: 'Access Control', status: 'passed', lastChecked: Date.now() },
    ],
    isLoading: false,
    isAuditLoading: false,
    isChecksLoading: false,
    error: null,
    auditPage: 1,
    setAuditPage: mockSetAuditPage,
    selectedFramework: 'hipaa',
    setSelectedFramework: mockSetSelectedFramework,
    generateReport: mockGenerateReport,
    ...mockOverrides,
  }),
}));

import CompliancePage from '@/app/compliance/page';

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

describe('CompliancePage', () => {
  it('renders the page heading', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(screen.getByText('Compliance & Audit Center')).toBeInTheDocument();
  });

  it('renders the page description mentioning regulatory frameworks', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/Monitor regulatory compliance across HIPAA, GDPR, SOC 2/)
    ).toBeInTheDocument();
  });

  it('renders navigation', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders TEE badge and All Systems Compliant badge', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(screen.getByText('Intel SGX Verified')).toBeInTheDocument();
    expect(screen.getByText('All Systems Compliant')).toBeInTheDocument();
  });

  it('renders tab navigation with Overview, Frameworks, Audit Log, Reports, Violations', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Frameworks')).toBeInTheDocument();
    expect(screen.getAllByText('Audit Log').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Violations')).toBeInTheDocument();
  });

  it('renders Overview tab by default with Overall Score and Compliance Trend', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
    expect(screen.getByText('Compliance Trend')).toBeInTheDocument();
  });

  it('renders summary stat cards on Overview tab', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    expect(screen.getByText('Active Violations')).toBeInTheDocument();
    expect(screen.getByText('Days Since Last Audit')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Assessments')).toBeInTheDocument();
  });

  it('switches to Frameworks tab when clicked', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Frameworks'));
    // After switching tabs, overview-specific content should no longer be visible
    expect(screen.queryByText('Upcoming Assessments')).not.toBeInTheDocument();
  });

  it('switches to Audit Log tab when clicked', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    // Audit Log tab shows risk filter buttons
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('switches to Reports tab when clicked', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Reports'));
    expect(screen.getByText('Compliance Reports')).toBeInTheDocument();
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
  });

  it('switches to Violations tab when clicked', () => {
    render(
      <TestWrapper>
        <CompliancePage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Violations'));
    expect(screen.getByText('Policy Violations')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Accepted Risk')).toBeInTheDocument();
  });

  // --- Overview Tab Details ---

  it('renders compliance score cards on overview', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    // Framework scores are clickable cards
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
  });

  it('clicks a framework score card to navigate to frameworks tab', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    // Each framework card calls onClick which switches to frameworks tab
    // The framework names appear in the overview
    const hipaaElements = screen.getAllByText('HIPAA');
    // Click the first HIPAA element (score card)
    fireEvent.click(hipaaElements[0]);
    // Should switch to frameworks tab
    expect(mockSetSelectedFramework).toHaveBeenCalled();
  });

  it('renders upcoming assessments', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    expect(screen.getByText('Upcoming Assessments')).toBeInTheDocument();
  });

  // --- Frameworks Tab Details ---

  it('expands and collapses a framework on frameworks tab', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Frameworks'));

    // HIPAA should be expanded by default (expandedFramework starts as 'hipaa')
    // Click the HIPAA header to collapse it
    const hipaaHeaders = screen.getAllByText('HIPAA');
    const clickableHeader = hipaaHeaders.find(
      (el) => el.closest('button')
    );
    if (clickableHeader) {
      fireEvent.click(clickableHeader.closest('button')!);
    }

    // Click GDPR to expand it
    const gdprHeaders = screen.getAllByText('GDPR');
    const gdprClickable = gdprHeaders.find(
      (el) => el.closest('button')
    );
    if (gdprClickable) {
      fireEvent.click(gdprClickable.closest('button')!);
    }
  });

  it('shows framework control counts', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Frameworks'));
    expect(screen.getByText(/48 passed/)).toBeInTheDocument();
    expect(screen.getByText(/2 failed/)).toBeInTheDocument();
  });

  // --- Audit Log Tab Details ---

  it('renders audit log table with entries', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Actor')).toBeInTheDocument();
    expect(screen.getByText('Resource')).toBeInTheDocument();
  });

  it('filters audit log by risk level', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);

    // Click "High" risk filter
    fireEvent.click(screen.getByText('High'));
    // Click "Medium" risk filter
    fireEvent.click(screen.getByText('Medium'));
    // Click "Low" risk filter
    fireEvent.click(screen.getByText('Low'));
    // Click "All" to reset
    fireEvent.click(screen.getByText('All'));
  });

  it('renders pagination on audit log tab', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 5/)).toBeInTheDocument();
  });

  it('clicks pagination buttons', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);

    fireEvent.click(screen.getByText('Next'));
    expect(mockSetAuditPage).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Previous'));
    expect(mockSetAuditPage).toHaveBeenCalled();
  });

  // --- Reports Tab Details ---

  it('renders report cards on reports tab', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Reports'));
    expect(screen.getByText('Q1 Report')).toBeInTheDocument();
    expect(screen.getByText('Annual Report')).toBeInTheDocument();
  });

  it('clicks generate report button', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Reports'));
    fireEvent.click(screen.getByText('Generate Report'));
    expect(mockGenerateReport.mutate).toHaveBeenCalledWith({});
  });

  // --- Violations Tab Details ---

  it('renders violation summary counts', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Violations'));
    // Summary counts for open, in_progress, resolved, accepted_risk
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders violations table with entries', () => {
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Violations'));
    expect(screen.getByText('Encryption gap')).toBeInTheDocument();
    expect(screen.getByText('Consent update needed')).toBeInTheDocument();
  });

  // --- Previous button on page > 1 ---

  it('clicks Previous button when on page 2', () => {
    mockOverrides = { auditPage: 2 };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    const prevBtn = screen.getByText('Previous');
    expect(prevBtn.closest('button')).not.toBeDisabled();
    fireEvent.click(prevBtn);
    expect(mockSetAuditPage).toHaveBeenCalled();
  });

  // --- Empty states ---

  it('renders empty frameworks state when frameworks is empty', () => {
    mockOverrides = { frameworks: [] };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Frameworks'));
    expect(screen.getByText('No frameworks loaded')).toBeInTheDocument();
  });

  it('renders empty reports state when reports is empty', () => {
    mockOverrides = { reports: [] };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Reports'));
    expect(screen.getByText('No reports generated yet')).toBeInTheDocument();
  });

  it('renders empty violations state when violations is empty', () => {
    mockOverrides = { violations: [] };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Violations'));
    expect(screen.getByText('No violations found')).toBeInTheDocument();
  });

  it('renders empty audit log after filtering with no matches', () => {
    mockOverrides = {
      auditLog: [
        { id: 'a-1', action: 'user_login', actor: 'admin', resource: 'auth', resourceType: 'system', riskLevel: 'low', timestamp: Date.now(), teeAttestation: '0xabc123def456', details: 'Login', ipAddress: '10.0.0.1', frameworkRelevance: ['hipaa'] },
      ],
    };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    // Filter by high - no high risk entries exist
    fireEvent.click(screen.getByText('High'));
    expect(screen.getByText('No audit entries match your filter')).toBeInTheDocument();
  });

  // --- Error state ---

  it('renders error state when error is present', () => {
    mockOverrides = { error: { message: 'Failed to load compliance data' } };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    expect(screen.getByText('Error loading compliance data')).toBeInTheDocument();
    expect(screen.getByText('Failed to load compliance data')).toBeInTheDocument();
  });

  // --- Null/undefined overview fallbacks ---

  it('renders with null overview gracefully', () => {
    mockOverrides = { overview: null };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
    // Should show 0 for fallback values (multiple zeros may appear)
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });

  // --- Generate report loading state ---

  it('renders Generating... when report is loading', () => {
    mockOverrides = { generateReport: { mutate: jest.fn(), isLoading: true } };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Reports'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  // --- auditMeta with single page (no pagination) ---

  it('does not render pagination when totalPages is 1', () => {
    mockOverrides = { auditMeta: { page: 1, total: 3, totalPages: 1 } };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  // --- Next button disabled on last page ---

  it('disables Next button on last page', () => {
    mockOverrides = { auditPage: 5 };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    const nextBtn = screen.getByText('Next').closest('button');
    expect(nextBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Next'));
  });

  // --- Framework with unknown meta (fallback to fw.name) ---

  it('renders framework name fallback when COMPLIANCE_FRAMEWORKS has no match', () => {
    mockOverrides = {
      frameworks: [
        { id: 'unknown_fw', name: 'Custom Framework', version: '1.0', description: 'Custom', overallScore: 80, passedControls: 30, failedControls: 5, notAssessedControls: 2 },
      ],
    };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    fireEvent.click(screen.getByText('Frameworks'));
    expect(screen.getByText('Custom Framework')).toBeInTheDocument();
  });

  // --- Upcoming assessment with unknown framework ---

  it('renders upcoming assessment with unknown framework ID', () => {
    mockOverrides = {
      overview: {
        overallComplianceScore: 90,
        frameworks: [],
        activeViolations: 0,
        daysSinceLastAudit: 5,
        upcomingAssessments: [
          { frameworkId: 'unknown_fw', dueDate: Date.now() + 86400000 * 30 },
        ],
        complianceTrend: [],
      },
    };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    // When COMPLIANCE_FRAMEWORKS has no match, falls back to frameworkId
    expect(screen.getByText('unknown_fw')).toBeInTheDocument();
  });

  // --- Null auditMeta fallbacks ---

  it('renders audit log tab with null auditMeta', () => {
    mockOverrides = { auditMeta: null };
    render(<TestWrapper><CompliancePage /></TestWrapper>);
    const auditLogTabs = screen.getAllByText('Audit Log');
    fireEvent.click(auditLogTabs[0]);
    // Should show fallback "0 events tracked" and "Page 1"
    expect(screen.getByText(/0 events tracked/)).toBeInTheDocument();
  });
});
