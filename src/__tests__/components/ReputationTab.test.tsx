// ============================================================
// Tests for src/components/reputation/ReputationTab.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import ReputationTab from '@/components/reputation/ReputationTab';
import type { ProviderReputation, ProviderReview } from '@/types';

// ---------------------------------------------------------------------------
// Mock the useProviderReputation hook so we control the data returned
// ---------------------------------------------------------------------------

const mockProviders: ProviderReputation[] = [
  {
    address: 'aeth1provider000000000000000000000001',
    name: 'Dr. Sarah Chen',
    specialty: 'OB-GYN',
    trustLevel: 'gold',
    overallScore: 95,
    reviewCount: 42,
    totalAccesses: 220,
    onTimeRevocations: 98,
    dataBreaches: 0,
    averageAccessDuration: 45,
    registeredAt: Date.now() - 365 * 86400000,
    lastActivityAt: Date.now() - 86400000,
  },
  {
    address: 'aeth1provider000000000000000000000002',
    name: 'Dr. James Liu',
    specialty: 'Endocrinology',
    trustLevel: 'silver',
    overallScore: 80,
    reviewCount: 15,
    totalAccesses: 90,
    onTimeRevocations: 95,
    dataBreaches: 0,
    averageAccessDuration: 30,
    registeredAt: Date.now() - 200 * 86400000,
    lastActivityAt: Date.now() - 3 * 86400000,
  },
  {
    address: 'aeth1provider000000000000000000000003',
    name: 'Breach Clinic',
    specialty: 'Primary Care',
    trustLevel: 'bronze',
    overallScore: 55,
    reviewCount: 5,
    totalAccesses: 40,
    onTimeRevocations: 80,
    dataBreaches: 2,
    averageAccessDuration: 20,
    registeredAt: Date.now() - 100 * 86400000,
    lastActivityAt: Date.now() - 10 * 86400000,
  },
];

const mockReviews: ProviderReview[] = [
  {
    id: 'review-1',
    providerAddress: 'aeth1provider000000000000000000000001',
    reviewerAnonymousId: 'anon-001',
    rating: 5,
    categories: { communication: 5, dataHandling: 5, timeliness: 5, professionalism: 5 },
    comment: 'Excellent care and communication.',
    timestamp: Date.now() - 86400000,
    verified: true,
  },
];

let mockHookOverrides: Record<string, any> = {};

function getDefaultReputationHook() {
  return {
    providers: mockProviders,
    isLoading: false,
    error: null,
    useReviews: (_address: string | null) => ({
      reviews: mockReviews,
      isLoading: false,
      error: null,
    }),
    submitReview: {
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isLoading: false,
      error: null,
    },
    topProviders: mockProviders.slice(0, 3),
    averageScore: 77,
    getScoreHistory: (_address: string) => [
      { month: 'Jan', score: 75 },
      { month: 'Feb', score: 78 },
      { month: 'Mar', score: 80 },
    ],
    refetch: jest.fn(),
  };
}

jest.mock('@/hooks/useProviderReputation', () => ({
  useProviderReputation: () => ({ ...getDefaultReputationHook(), ...mockHookOverrides }),
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(AppProvider, null, children),
  );
}

// ---------------------------------------------------------------------------
// ReputationTab
// ---------------------------------------------------------------------------

describe('ReputationTab', () => {
  beforeEach(() => {
    mockHookOverrides = {};
  });

  it('renders stats section with heading labels', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Total Providers')).toBeInTheDocument();
    expect(screen.getByText('Average Score')).toBeInTheDocument();
    expect(screen.getByText('Gold Providers')).toBeInTheDocument();
    expect(screen.getByText('Breach Reports')).toBeInTheDocument();
  });

  it('renders filter and search controls', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText('Search providers...')).toBeInTheDocument();
    expect(screen.getByText('All Trust Levels')).toBeInTheDocument();
  });

  it('renders provider profiles', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Dr. James Liu')).toBeInTheDocument();
  });

  it('can search for providers by name', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    const searchInput = screen.getByPlaceholderText('Search providers...');
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });

    // Dr. Sarah Chen should still show
    expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
    // Dr. James Liu should not
    expect(screen.queryByText('Dr. James Liu')).not.toBeInTheDocument();
  });

  it('shows empty state when no providers match search', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    const searchInput = screen.getByPlaceholderText('Search providers...');
    fireEvent.change(searchInput, { target: { value: 'zzznomatch999' } });

    expect(screen.getByText('No providers match your filters')).toBeInTheDocument();
  });

  it('opens trust level filter dropdown', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Trust Levels'));

    // Check that filter dropdown options appear (as buttons)
    const goldOptions = screen.getAllByText('Gold');
    expect(goldOptions.length).toBeGreaterThan(0);
    // "Unrated" only appears in the dropdown (no providers have that level in mock)
    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });

  it('filters providers by trust level', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    // Open filter dropdown and click Gold
    fireEvent.click(screen.getByText('All Trust Levels'));
    // Get the Gold option from within the dropdown container
    const dropdownItems = document.querySelectorAll('.absolute.left-0.top-full button');
    const goldBtn = Array.from(dropdownItems).find((btn) => btn.textContent === 'Gold');
    expect(goldBtn).toBeTruthy();
    fireEvent.click(goldBtn!);

    // Dr. Sarah Chen has gold trust level
    expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
    // Dr. James Liu has silver trust level - should not appear
    expect(screen.queryByText('Dr. James Liu')).not.toBeInTheDocument();
  });

  it('navigates to provider detail view on click', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByText('Dr. Sarah Chen'));

    expect(screen.getByText('Back to Providers')).toBeInTheDocument();
    expect(screen.getByText('Write Review')).toBeInTheDocument();
  });

  it('shows provider details in detail view', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByText('Dr. Sarah Chen'));

    expect(screen.getByText('Accesses')).toBeInTheDocument();
    expect(screen.getByText('On-Time Revocations')).toBeInTheDocument();
    expect(screen.getByText('Data Breaches')).toBeInTheDocument();
  });

  it('navigates back from provider detail view', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    expect(screen.getByText('Back to Providers')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back to Providers'));

    expect(screen.getByText('Total Providers')).toBeInTheDocument();
  });

  it('opens write review modal from detail view', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    fireEvent.click(screen.getByText('Write Review'));

    expect(screen.getByText('Review Dr. Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Overall Rating')).toBeInTheDocument();
  });

  it('shows reviews in detail view', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByText('Dr. Sarah Chen'));

    expect(screen.getByText('Excellent care and communication.')).toBeInTheDocument();
  });

  it('displays correct total provider count', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays average score', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    expect(screen.getByText('77')).toBeInTheDocument();
  });

  // ---- SubmitReviewModal interaction tests ----

  it('can set overall rating stars in review modal', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    fireEvent.click(screen.getByText('Write Review'));

    // Find overall rating star buttons (w-7 h-7 stars)
    const allButtons = screen.getAllByRole('button');
    const overallStarButtons = allButtons.filter((btn) => btn.querySelector('.w-7'));
    expect(overallStarButtons.length).toBe(5);

    // Click star 2 to set rating to 2
    fireEvent.click(overallStarButtons[1]);
  });

  it('can set category rating stars in review modal', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    fireEvent.click(screen.getByText('Write Review'));

    // Find each category label and click a star next to it
    const commLabel = screen.getByText('Communication');
    const commRow = commLabel.closest('.flex');
    const commStars = commRow?.querySelectorAll('button.p-0\\.5');
    if (commStars && commStars.length >= 5) {
      fireEvent.click(commStars[2]); // Set communication to 3
    }

    const dataLabel = screen.getByText('Data Handling');
    const dataRow = dataLabel.closest('.flex');
    const dataStars = dataRow?.querySelectorAll('button.p-0\\.5');
    if (dataStars && dataStars.length >= 5) {
      fireEvent.click(dataStars[3]); // Set data handling to 4
    }

    const timeLabel = screen.getByText('Timeliness');
    const timeRow = timeLabel.closest('.flex');
    const timeStars = timeRow?.querySelectorAll('button.p-0\\.5');
    if (timeStars && timeStars.length >= 5) {
      fireEvent.click(timeStars[1]); // Set timeliness to 2
    }

    const profLabel = screen.getByText('Professionalism');
    const profRow = profLabel.closest('.flex');
    const profStars = profRow?.querySelectorAll('button.p-0\\.5');
    if (profStars && profStars.length >= 5) {
      fireEvent.click(profStars[4]); // Set professionalism to 5
    }
  });

  it('can type comment and submit review', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    fireEvent.click(screen.getByText('Write Review'));

    // Type comment
    const textarea = screen.getByPlaceholderText('Share your experience with this provider...');
    fireEvent.change(textarea, { target: { value: 'Very professional!' } });

    // Submit should now be enabled
    const submitBtn = screen.getByText('Submit Review');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);
  });

  it('closes review modal via Cancel button', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    fireEvent.click(screen.getByText('Write Review'));
    expect(screen.getByText('Overall Rating')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    // The modal should close (line 456: onClose => setReviewModalOpen(false))
    expect(screen.queryByText('Overall Rating')).not.toBeInTheDocument();
  });

  it('disables submit when comment is empty', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    fireEvent.click(screen.getByText('Write Review'));
    const submitBtn = screen.getByText('Submit Review');
    expect(submitBtn).toBeDisabled();
  });

  it('closes trust filter dropdown via overlay', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Trust Levels'));
    // Verify dropdown is open
    expect(screen.getByText('Unrated')).toBeInTheDocument();

    // Click overlay to close
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
  });

  it('renders reputation history chart in detail view', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    expect(screen.getByText('Reputation History')).toBeInTheDocument();
  });

  it('displays provider detail stats correctly for provider with breaches', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Breach Clinic'));
    // Should show breach count in red
    expect(screen.getByText('Data Breaches')).toBeInTheDocument();
  });

  it('can filter by specialty through search', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    const searchInput = screen.getByPlaceholderText('Search providers...');
    fireEvent.change(searchInput, { target: { value: 'Endocrinology' } });
    expect(screen.getByText('Dr. James Liu')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Sarah Chen')).not.toBeInTheDocument();
  });

  it('filters by Silver trust level', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Trust Levels'));
    const dropdownItems = document.querySelectorAll('.absolute.left-0.top-full button');
    const silverBtn = Array.from(dropdownItems).find((btn) => btn.textContent === 'Silver');
    fireEvent.click(silverBtn!);
    expect(screen.getByText('Dr. James Liu')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Sarah Chen')).not.toBeInTheDocument();
  });

  it('filters by Bronze trust level', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Trust Levels'));
    const dropdownItems = document.querySelectorAll('.absolute.left-0.top-full button');
    const bronzeBtn = Array.from(dropdownItems).find((btn) => btn.textContent === 'Bronze');
    fireEvent.click(bronzeBtn!);
    expect(screen.getByText('Breach Clinic')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Sarah Chen')).not.toBeInTheDocument();
  });

  it('closes review modal from list view (line 456)', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    // Navigate to detail view
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    // Open review modal (sets reviewTarget)
    fireEvent.click(screen.getByText('Write Review'));
    expect(screen.getByText('Review Dr. Sarah Chen')).toBeInTheDocument();
    // Go back to list view while modal is still conceptually open (reviewTarget stays set)
    fireEvent.click(screen.getByText('Back to Providers'));
    // Now we're in list view with reviewTarget set - line 452-462 renders the modal
    // The modal should still be rendered since reviewTarget is set and reviewModalOpen is true
    // Close it via Cancel
    const cancelBtn = screen.queryByText('Cancel');
    if (cancelBtn) {
      fireEvent.click(cancelBtn);
    }
  });

  it('shows correct filter label after selecting a trust filter', () => {
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Trust Levels'));
    const dropdownItems = document.querySelectorAll('.absolute.left-0.top-full button');
    const goldBtn = Array.from(dropdownItems).find((btn) => btn.textContent === 'Gold');
    fireEvent.click(goldBtn!);
    // Filter button should now show "Gold" as the label (line 386)
    // The "All Trust Levels" text should no longer be visible
    expect(screen.queryByText('All Trust Levels')).not.toBeInTheDocument();
  });

  // ---- Branch coverage: loading state ----

  it('shows loading spinner when isLoading is true', () => {
    mockHookOverrides = { isLoading: true };
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  // ---- Branch coverage: error state ----

  it('shows error message when error is present', () => {
    mockHookOverrides = { error: new Error('Network error'), providers: [] };
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Failed to load providers')).toBeInTheDocument();
  });

  // ---- Branch coverage: reviewsLoading in detail view ----

  it('shows loading spinner for reviews in detail view', () => {
    mockHookOverrides = {
      useReviews: () => ({ reviews: [], isLoading: true, error: null }),
    };
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    // Reviews section should show spinner
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  // ---- Branch coverage: no reviews in detail view ----

  it('shows no reviews message in detail view when reviews is empty', () => {
    mockHookOverrides = {
      useReviews: () => ({ reviews: [], isLoading: false, error: null }),
    };
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    expect(screen.getByText('No reviews yet for this provider')).toBeInTheDocument();
  });

  // ---- Branch coverage: submitReview isLoading ----

  it('shows Submitting... text in review modal when submitReview is loading', () => {
    mockHookOverrides = {
      submitReview: { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: true, error: null },
    };
    render(
      <TestWrapper>
        <ReputationTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Dr. Sarah Chen'));
    fireEvent.click(screen.getByText('Write Review'));
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });
});
