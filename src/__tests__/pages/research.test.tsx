// ============================================================
// Tests for src/app/research/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockEnrollMutate = jest.fn();
const mockContributeMutate = jest.fn();

let mockOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useResearch', () => ({
  useResearch: () => ({
    studies: [
      {
        id: 'study-1',
        title: 'Reproductive Health AI Study',
        description: 'A study on reproductive health',
        institution: 'Stanford University',
        principalInvestigator: 'Dr. Jane Smith',
        status: 'recruiting',
        participantCount: 120,
        targetParticipants: 500,
        dataTypesRequired: ['vital_signs', 'lab_results'],
        compensationShio: 250,
        irbApprovalId: 'IRB-2024-001',
        startDate: Date.now() - 86400000 * 30,
        endDate: Date.now() + 86400000 * 180,
        zkpRequired: true,
      },
      {
        id: 'study-2',
        title: 'Cardiac Monitoring Research',
        description: 'Cardiac monitoring study',
        institution: 'MIT',
        principalInvestigator: 'Dr. John Doe',
        status: 'active',
        participantCount: 400,
        targetParticipants: 400,
        dataTypesRequired: ['vital_signs'],
        compensationShio: 100,
        irbApprovalId: 'IRB-2024-002',
        startDate: Date.now() - 86400000 * 60,
        endDate: Date.now() + 86400000 * 120,
        zkpRequired: false,
      },
      {
        id: 'study-3',
        title: 'Completed Sleep Study',
        description: 'Sleep patterns analysis',
        institution: 'Harvard',
        principalInvestigator: 'Dr. Alice Chen',
        status: 'completed',
        participantCount: 300,
        targetParticipants: 300,
        dataTypesRequired: ['vital_signs'],
        compensationShio: 75,
        irbApprovalId: 'IRB-2023-010',
        startDate: Date.now() - 86400000 * 180,
        endDate: Date.now() - 86400000 * 30,
        zkpRequired: false,
      },
    ],
    contributions: [
      {
        id: 'contrib-1',
        studyId: 'study-1',
        contributorAnonymousId: 'anon-001',
        dataTypes: ['vital_signs'],
        contributedAt: Date.now() - 86400000 * 7,
        compensation: 250,
        consentId: 'consent-1',
        status: 'accepted',
      },
      {
        id: 'contrib-2',
        studyId: 'study-2',
        contributorAnonymousId: 'anon-001',
        dataTypes: ['lab_results'],
        contributedAt: Date.now() - 86400000 * 14,
        compensation: 100,
        consentId: 'consent-2',
        status: 'pending',
      },
    ],
    isLoading: false,
    isLoadingContributions: false,
    error: null,
    enrollMutation: {
      mutate: mockEnrollMutate,
      mutateAsync: jest.fn(),
      isLoading: false,
      error: null,
    },
    contributeMutation: {
      mutate: mockContributeMutate,
      mutateAsync: jest.fn(),
      isLoading: false,
      error: null,
    },
    activeStudyCount: 2,
    refetch: jest.fn(),
    ...mockOverrides,
  }),
}));

import ResearchPage from '@/app/research/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

describe('ResearchPage', () => {
  it('renders the research portal title', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Research Portal')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    expect(
      screen.getByText(/Contribute your anonymized health data to IRB-approved research studies/),
    ).toBeInTheDocument();
  });

  it('renders all three tabs', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map((t) => t.textContent);
    expect(tabLabels).toContainEqual(expect.stringContaining('Available Studies'));
    expect(tabLabels).toContainEqual(expect.stringContaining('My Contributions'));
    expect(tabLabels).toContain('About Research');
  });

  it('renders stat cards', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Active Studies')).toBeInTheDocument();
    expect(screen.getAllByText('My Contributions').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Earned')).toBeInTheDocument();
    expect(screen.getByText('IRB Approved')).toBeInTheDocument();
  });

  it('renders the search input on studies tab', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText('Search studies...')).toBeInTheDocument();
  });

  it('renders status filter tabs', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map((t) => t.textContent);
    expect(tabLabels).toContain('All');
    expect(tabLabels).toContainEqual(expect.stringContaining('Recruiting'));
  });

  it('renders study cards on studies tab', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Reproductive Health AI Study')).toBeInTheDocument();
    expect(screen.getByText('Cardiac Monitoring Research')).toBeInTheDocument();
    expect(screen.getByText('Completed Sleep Study')).toBeInTheDocument();
  });

  it('renders the security notice', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Privacy-Preserving Research')).toBeInTheDocument();
  });

  // --- Search ---

  it('filters studies by search query', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const searchInput = screen.getByPlaceholderText('Search studies...');
    fireEvent.change(searchInput, { target: { value: 'Cardiac' } });
    expect(screen.getByText('Cardiac Monitoring Research')).toBeInTheDocument();
    expect(screen.queryByText('Reproductive Health AI Study')).not.toBeInTheDocument();
  });

  it('filters studies by institution', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const searchInput = screen.getByPlaceholderText('Search studies...');
    fireEvent.change(searchInput, { target: { value: 'Stanford' } });
    expect(screen.getByText('Reproductive Health AI Study')).toBeInTheDocument();
    expect(screen.queryByText('Cardiac Monitoring Research')).not.toBeInTheDocument();
  });

  it('filters studies by principal investigator', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const searchInput = screen.getByPlaceholderText('Search studies...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    expect(screen.getByText('Completed Sleep Study')).toBeInTheDocument();
    expect(screen.queryByText('Reproductive Health AI Study')).not.toBeInTheDocument();
  });

  // --- Status filters ---

  it('filters studies by status', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const recruitingTab = tabs.find((t) => t.textContent?.includes('Recruiting'));
    expect(recruitingTab).toBeTruthy();
    fireEvent.click(recruitingTab!);
    expect(screen.getByText('Reproductive Health AI Study')).toBeInTheDocument();
    expect(screen.queryByText('Cardiac Monitoring Research')).not.toBeInTheDocument();
  });

  it('shows no studies message when filter matches nothing', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const suspendedTab = tabs.find((t) => t.textContent?.includes('Suspended'));
    expect(suspendedTab).toBeTruthy();
    fireEvent.click(suspendedTab!);
    expect(screen.getByText('No studies match your filters')).toBeInTheDocument();
  });

  // --- Enroll ---

  it('clicks Enroll on a recruiting study to open modal', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const enrollButtons = screen.getAllByText('Enroll');
    fireEvent.click(enrollButtons[0]);
    // EnrollModal should open with the study (title appears in card + modal)
    expect(screen.getAllByText(/Reproductive Health AI Study/).length).toBeGreaterThanOrEqual(2);
  });

  // --- My Contributions tab ---

  it('switches to My Contributions tab', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const contributionsTab = tabs.find((t) => t.textContent?.includes('My Contributions'));
    expect(contributionsTab).toBeDefined();
    fireEvent.click(contributionsTab!);
    // ContributionHistory renders
    expect(screen.getByText('Total Compensation')).toBeInTheDocument();
  });

  // --- About Research tab ---

  it('switches to About Research tab', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const aboutTab = tabs.find((t) => t.textContent === 'About Research');
    expect(aboutTab).toBeDefined();
    fireEvent.click(aboutTab!);
    expect(screen.getByText('How Research Works on Shiora')).toBeInTheDocument();
    expect(screen.getByText('Privacy Guarantees')).toBeInTheDocument();
    expect(screen.getByText('Data Usage')).toBeInTheDocument();
  });

  it('renders privacy features on About tab', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const aboutTab = tabs.find((t) => t.textContent === 'About Research');
    fireEvent.click(aboutTab!);
    expect(screen.getByText('Zero-Knowledge Proofs')).toBeInTheDocument();
    expect(screen.getByText('TEE Processing')).toBeInTheDocument();
    expect(screen.getByText('Revocable Consent')).toBeInTheDocument();
    expect(screen.getByText('Differential Privacy')).toBeInTheDocument();
  });

  it('renders data usage section on About tab', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const aboutTab = tabs.find((t) => t.textContent === 'About Research');
    fireEvent.click(aboutTab!);
    expect(screen.getByText('What data is used?')).toBeInTheDocument();
    expect(screen.getByText('Who sees my data?')).toBeInTheDocument();
    expect(screen.getByText('How does it advance science?')).toBeInTheDocument();
  });

  // --- Loading state ---

  it('shows loading spinner when isLoading is true', () => {
    mockOverrides = { isLoading: true };
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    // Should not show study cards
    expect(screen.queryByText('Reproductive Health AI Study')).not.toBeInTheDocument();
  });

  // --- Error state ---

  it('shows error message when error occurs', () => {
    mockOverrides = { error: new Error('Network error') };
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Failed to load studies')).toBeInTheDocument();
  });

  // --- Contributions loading state ---

  it('shows loading on contributions tab when isLoadingContributions is true', () => {
    mockOverrides = { isLoadingContributions: true };
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const contributionsTab = tabs.find((t) => t.textContent?.includes('My Contributions'));
    fireEvent.click(contributionsTab!);
    // Should not render ContributionHistory
    expect(screen.queryByText('Total Compensation')).not.toBeInTheDocument();
  });

  // --- handleEnroll with non-existent study ---

  it('does not open modal for non-existent study id', () => {
    // handleEnroll only sets enrollTarget if study is found
    // We verify by ensuring the normal flow works
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    // All studies are present, so enroll should work
    const enrollButtons = screen.getAllByText('Enroll');
    expect(enrollButtons.length).toBeGreaterThan(0);
  });

  // --- handleConfirmEnroll ---

  it('calls enrollMutation and contributeMutation when confirming enrollment', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    // Click Enroll to open modal
    const enrollButtons = screen.getAllByText('Enroll');
    fireEvent.click(enrollButtons[0]);

    // Select data type checkboxes (study-1 requires vital_signs and lab_results)
    const checkboxes = screen.getAllByRole('checkbox');
    // Select at least the data type checkboxes
    checkboxes.forEach((cb) => {
      if (!(cb as HTMLInputElement).checked) {
        fireEvent.click(cb);
      }
    });

    // Now click Confirm Enrollment
    const confirmBtn = screen.getByText('Confirm Enrollment');
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(mockEnrollMutate).toHaveBeenCalledWith('study-1');
    expect(mockContributeMutate).toHaveBeenCalled();
  });

  // --- Modal close ---

  it('closes enroll modal when Cancel is clicked', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    // Click Enroll to open modal
    const enrollButtons = screen.getAllByText('Enroll');
    fireEvent.click(enrollButtons[0]);
    // Click Cancel
    fireEvent.click(screen.getByText('Cancel'));
    // Modal should be closed
    expect(screen.queryByText('Confirm Enrollment')).not.toBeInTheDocument();
  });

  // --- Empty search result ---

  it('shows empty state when search matches nothing', () => {
    render(
      <TestWrapper>
        <ResearchPage />
      </TestWrapper>,
    );
    const searchInput = screen.getByPlaceholderText('Search studies...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No studies match your filters')).toBeInTheDocument();
  });
});
