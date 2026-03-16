// ============================================================
// Tests for src/components/research/ResearchComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  StudyCard,
  ContributionHistory,
  EnrollModal,
} from '@/components/research/ResearchComponents';
import type { ResearchStudy, DataContribution, RecordType } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client: qc },
    React.createElement(AppProvider, null, children));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockStudy: ResearchStudy = {
  id: 'study-1',
  title: 'Endometriosis Biomarker Discovery',
  description: 'A multi-center study identifying novel biomarkers for early endometriosis detection.',
  institution: 'Stanford Medical Center',
  principalInvestigator: 'Dr. Emily Nakamura',
  status: 'recruiting',
  participantCount: 120,
  targetParticipants: 500,
  dataTypesRequired: ['lab_result', 'vitals'],
  compensationShio: 25,
  irbApprovalId: 'IRB-2024-0042',
  startDate: Date.now() - 30 * 86400000,
  endDate: Date.now() + 365 * 86400000,
  zkpRequired: true,
};

const mockCompletedStudy: ResearchStudy = {
  ...mockStudy,
  id: 'study-2',
  title: 'PCOS Genetic Mapping',
  status: 'completed',
  zkpRequired: false,
  participantCount: 500,
};

const mockContributions: DataContribution[] = [
  {
    id: 'contrib-1',
    studyId: 'study-1',
    contributorAnonymousId: 'anon-001',
    dataTypes: ['lab_result'],
    contributedAt: Date.now() - 7 * 86400000,
    compensation: 25,
    consentId: 'consent-001',
    status: 'accepted',
  },
  {
    id: 'contrib-2',
    studyId: 'study-2',
    contributorAnonymousId: 'anon-001',
    dataTypes: ['vitals'],
    contributedAt: Date.now() - 14 * 86400000,
    compensation: 10,
    consentId: 'consent-002',
    status: 'pending',
  },
];

// ---------------------------------------------------------------------------
// StudyCard
// ---------------------------------------------------------------------------

describe('StudyCard', () => {
  it('renders study title and institution', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} />
      </TestWrapper>
    );
    expect(screen.getByText('Endometriosis Biomarker Discovery')).toBeInTheDocument();
    expect(screen.getByText('Stanford Medical Center')).toBeInTheDocument();
  });

  it('renders principal investigator', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} />
      </TestWrapper>
    );
    expect(screen.getByText('PI: Dr. Emily Nakamura')).toBeInTheDocument();
  });

  it('renders participant progress', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} />
      </TestWrapper>
    );
    expect(screen.getByText('120/500 participants')).toBeInTheDocument();
    expect(screen.getByText('24%')).toBeInTheDocument();
  });

  it('renders compensation amount', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} />
      </TestWrapper>
    );
    expect(screen.getByText('25 AETHEL')).toBeInTheDocument();
  });

  it('renders ZKP Required badge when zkpRequired is true', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} />
      </TestWrapper>
    );
    expect(screen.getByText('ZKP Required')).toBeInTheDocument();
  });

  it('does not render ZKP badge when zkpRequired is false', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockCompletedStudy} />
      </TestWrapper>
    );
    expect(screen.queryByText('ZKP Required')).not.toBeInTheDocument();
  });

  it('renders Enroll button for recruiting studies', () => {
    const onEnroll = jest.fn();
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} onEnroll={onEnroll} />
      </TestWrapper>
    );
    expect(screen.getByText('Enroll')).toBeInTheDocument();
  });

  it('calls onEnroll with study id when Enroll button is clicked', () => {
    const onEnroll = jest.fn();
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} onEnroll={onEnroll} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Enroll'));
    expect(onEnroll).toHaveBeenCalledWith('study-1');
  });

  it('shows loading state when isEnrolling is true', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockStudy} onEnroll={jest.fn()} isEnrolling={true} />
      </TestWrapper>
    );
    expect(screen.getByText('Enrolling...')).toBeInTheDocument();
  });

  it('does not render Enroll button for non-recruiting studies', () => {
    render(
      <TestWrapper>
        <StudyCard study={mockCompletedStudy} onEnroll={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.queryByText('Enroll')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ContributionHistory
// ---------------------------------------------------------------------------

describe('ContributionHistory', () => {
  it('renders total contributions count', () => {
    render(
      <TestWrapper>
        <ContributionHistory contributions={mockContributions} studies={[mockStudy, mockCompletedStudy]} />
      </TestWrapper>
    );
    expect(screen.getByText('Contributions')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders total compensation for accepted contributions', () => {
    render(
      <TestWrapper>
        <ContributionHistory contributions={mockContributions} studies={[mockStudy, mockCompletedStudy]} />
      </TestWrapper>
    );
    expect(screen.getByText('Total Compensation')).toBeInTheDocument();
    // Only accepted contributions count (25 AETHEL)
    expect(screen.getByText('25 AETHEL')).toBeInTheDocument();
  });

  it('renders contribution list with study titles', () => {
    render(
      <TestWrapper>
        <ContributionHistory contributions={mockContributions} studies={[mockStudy, mockCompletedStudy]} />
      </TestWrapper>
    );
    expect(screen.getByText('Endometriosis Biomarker Discovery')).toBeInTheDocument();
    expect(screen.getByText('PCOS Genetic Mapping')).toBeInTheDocument();
  });

  it('renders status badges for each contribution', () => {
    render(
      <TestWrapper>
        <ContributionHistory contributions={mockContributions} studies={[mockStudy, mockCompletedStudy]} />
      </TestWrapper>
    );
    expect(screen.getByText('accepted')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders empty state when no contributions', () => {
    render(
      <TestWrapper>
        <ContributionHistory contributions={[]} studies={[]} />
      </TestWrapper>
    );
    expect(screen.getByText('No contributions yet')).toBeInTheDocument();
  });

  it('renders Unknown Study when study is not found', () => {
    const orphanContrib: DataContribution = {
      id: 'contrib-orphan',
      studyId: 'nonexistent-study',
      contributorAnonymousId: 'anon-001',
      dataTypes: ['lab_result'],
      contributedAt: Date.now(),
      compensation: 10,
      consentId: 'consent-x',
      status: 'rejected',
    };
    render(
      <TestWrapper>
        <ContributionHistory contributions={[orphanContrib]} studies={[]} />
      </TestWrapper>
    );
    expect(screen.getByText('Unknown Study')).toBeInTheDocument();
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  it('renders unknown status with fallback colors', () => {
    const unknownStatus: DataContribution = {
      ...mockContributions[0],
      id: 'contrib-unknown',
      status: 'reviewing' as any,
    };
    render(
      <TestWrapper>
        <ContributionHistory contributions={[unknownStatus]} studies={[mockStudy]} />
      </TestWrapper>
    );
    expect(screen.getByText('reviewing')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EnrollModal
// ---------------------------------------------------------------------------

describe('EnrollModal', () => {
  it('renders nothing when study is null', () => {
    const { container } = render(
      <TestWrapper>
        <EnrollModal study={null} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders study title and institution when open', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Endometriosis Biomarker Discovery')).toBeInTheDocument();
    expect(screen.getByText(/Stanford Medical Center/)).toBeInTheDocument();
  });

  it('renders compensation section', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Compensation')).toBeInTheDocument();
    expect(screen.getByText('25 AETHEL')).toBeInTheDocument();
  });

  it('renders consent checkboxes', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Consent')).toBeInTheDocument();
  });

  it('Confirm Enrollment button is disabled when consent not given', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    const confirmBtn = screen.getByText('Confirm Enrollment');
    expect(confirmBtn).toBeDisabled();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = jest.fn();
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={onClose} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={true} />
      </TestWrapper>
    );
    expect(screen.getByText('Enrolling...')).toBeInTheDocument();
  });

  it('renders data type checkboxes for study', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Select Data Types to Contribute')).toBeInTheDocument();
    // lab_result and vitals should be available as checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2); // 2 data types + 3 consent = 5
  });

  it('can toggle data type selection', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // First two are data type checkboxes, next three are consent
    // Toggle first data type on
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
    // Toggle it off
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('can check all consent boxes and enable confirm', () => {
    const onConfirm = jest.fn();
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={onConfirm} isLoading={false} />
      </TestWrapper>
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // Check a data type
    fireEvent.click(checkboxes[0]); // lab_result

    // Check all 3 consent boxes
    fireEvent.click(checkboxes[2]); // dataUsage
    fireEvent.click(checkboxes[3]); // privacy
    fireEvent.click(checkboxes[4]); // withdrawal

    // Now Confirm Enrollment should be enabled
    const confirmBtn = screen.getByText('Confirm Enrollment');
    expect(confirmBtn).not.toBeDisabled();

    // Click to confirm
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('study-1', expect.any(Array));
  });

  it('keeps confirm disabled when only consent is checked but no data types', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // Check all consent boxes but no data types
    fireEvent.click(checkboxes[2]); // dataUsage
    fireEvent.click(checkboxes[3]); // privacy
    fireEvent.click(checkboxes[4]); // withdrawal

    const confirmBtn = screen.getByText('Confirm Enrollment');
    expect(confirmBtn).toBeDisabled();
  });

  it('renders study description in the modal', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText(/multi-center study/)).toBeInTheDocument();
  });

  it('renders IRB approval ID in consent text', () => {
    render(
      <TestWrapper>
        <EnrollModal study={mockStudy} open={true} onClose={jest.fn()} onConfirm={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText(/IRB-2024-0042/)).toBeInTheDocument();
  });
});
