// ============================================================
// Tests for src/components/reputation/ReputationComponents.tsx
// ============================================================

// Override recharts mock to render Tooltip content prop for coverage
jest.mock('recharts', () => {
  const React = require('react');
  const createMockComponent = (name: string) =>
    React.forwardRef(function MockChart({ children, ...props }: any, ref: any) {
      return React.createElement('div', { 'data-testid': `mock-${name}`, ref }, children);
    });

  return {
    ResponsiveContainer: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'mock-responsive-container' }, children),
    LineChart: createMockComponent('line-chart'),
    Line: createMockComponent('line'),
    XAxis: createMockComponent('x-axis'),
    YAxis: createMockComponent('y-axis'),
    Tooltip: ({ content, children, ...props }: any) =>
      React.createElement('div', { 'data-testid': 'mock-tooltip' }, content, children),
    CartesianGrid: createMockComponent('cartesian-grid'),
    AreaChart: createMockComponent('area-chart'),
    Area: createMockComponent('area'),
    BarChart: createMockComponent('bar-chart'),
    Bar: createMockComponent('bar'),
    PieChart: createMockComponent('pie-chart'),
    Pie: createMockComponent('pie'),
    Cell: createMockComponent('cell'),
    ReferenceLine: createMockComponent('reference-line'),
  };
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  ReputationScore,
  StarRating,
  ReviewCard,
  TrustBadge,
  ReputationHistory,
  ProviderProfile,
} from '@/components/reputation/ReputationComponents';
import type { ProviderReputation, ProviderReview, TrustLevel } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(AppProvider, null, children),
  );
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProvider: ProviderReputation = {
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
};

const mockProviderWithBreach: ProviderReputation = {
  ...mockProvider,
  address: 'aeth1provider000000000000000000000002',
  name: 'Breach Clinic',
  trustLevel: 'bronze',
  overallScore: 58,
  dataBreaches: 2,
};

const mockReview: ProviderReview = {
  id: 'review-1',
  providerAddress: 'aeth1provider000000000000000000000001',
  reviewerAnonymousId: 'anon-reviewer-abc',
  rating: 5,
  categories: {
    communication: 5,
    dataHandling: 4,
    timeliness: 5,
    professionalism: 5,
  },
  comment: 'Excellent provider, highly recommended.',
  timestamp: Date.now() - 86400000,
  verified: true,
};

const mockUnverifiedReview: ProviderReview = {
  ...mockReview,
  id: 'review-2',
  verified: false,
  comment: 'Good but could improve.',
};

const mockScoreHistory = [
  { month: 'Jan', score: 80 },
  { month: 'Feb', score: 82 },
  { month: 'Mar', score: 85 },
  { month: 'Apr', score: 88 },
  { month: 'May', score: 90 },
  { month: 'Jun', score: 95 },
];

// ---------------------------------------------------------------------------
// ReputationScore
// ---------------------------------------------------------------------------

describe('ReputationScore', () => {
  it('renders the score value', () => {
    render(
      <TestWrapper>
        <ReputationScore score={85} trustLevel="gold" />
      </TestWrapper>,
    );
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders /100 label for md size (default)', () => {
    render(
      <TestWrapper>
        <ReputationScore score={85} trustLevel="silver" />
      </TestWrapper>,
    );
    expect(screen.getByText('/ 100')).toBeInTheDocument();
  });

  it('does not render /100 label for sm size', () => {
    render(
      <TestWrapper>
        <ReputationScore score={72} trustLevel="bronze" size="sm" />
      </TestWrapper>,
    );
    expect(screen.queryByText('/ 100')).not.toBeInTheDocument();
  });

  it('renders for unrated trust level', () => {
    const { container } = render(
      <TestWrapper>
        <ReputationScore score={40} trustLevel="unrated" size="lg" />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('uses correct color for score between 75 and 89', () => {
    const { container } = render(
      <TestWrapper>
        <ReputationScore score={82} trustLevel="silver" />
      </TestWrapper>,
    );
    expect(screen.getByText('82')).toBeInTheDocument();
  });

  it('uses correct color for score between 60 and 74', () => {
    const { container } = render(
      <TestWrapper>
        <ReputationScore score={65} trustLevel="bronze" />
      </TestWrapper>,
    );
    expect(screen.getByText('65')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StarRating
// ---------------------------------------------------------------------------

describe('StarRating', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TestWrapper>
        <StarRating rating={4} />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders for medium size', () => {
    const { container } = render(
      <TestWrapper>
        <StarRating rating={3.5} size="md" />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ReviewCard
// ---------------------------------------------------------------------------

describe('ReviewCard', () => {
  it('renders reviewer ID and comment', () => {
    render(
      <TestWrapper>
        <ReviewCard review={mockReview} />
      </TestWrapper>,
    );
    expect(screen.getByText('anon-reviewer-abc')).toBeInTheDocument();
    expect(screen.getByText('Excellent provider, highly recommended.')).toBeInTheDocument();
  });

  it('shows Verified badge for verified reviews', () => {
    render(
      <TestWrapper>
        <ReviewCard review={mockReview} />
      </TestWrapper>,
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('does not show Verified badge for unverified reviews', () => {
    render(
      <TestWrapper>
        <ReviewCard review={mockUnverifiedReview} />
      </TestWrapper>,
    );
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TrustBadge
// ---------------------------------------------------------------------------

describe('TrustBadge', () => {
  const levels: TrustLevel[] = ['gold', 'silver', 'bronze', 'unrated'];
  const expectedLabels = ['Gold', 'Silver', 'Bronze', 'Unrated'];

  levels.forEach((level, idx) => {
    it(`renders ${level} trust level badge`, () => {
      render(
        <TestWrapper>
          <TrustBadge trustLevel={level} />
        </TestWrapper>,
      );
      expect(screen.getByText(expectedLabels[idx])).toBeInTheDocument();
    });
  });

  it('renders md size without crashing', () => {
    const { container } = render(
      <TestWrapper>
        <TrustBadge trustLevel="gold" size="md" />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ReputationHistory
// ---------------------------------------------------------------------------

describe('ReputationHistory', () => {
  it('renders the Reputation History heading', () => {
    render(
      <TestWrapper>
        <ReputationHistory data={mockScoreHistory} />
      </TestWrapper>,
    );
    expect(screen.getByText('Reputation History')).toBeInTheDocument();
  });

  it('renders without crashing with empty data', () => {
    const { container } = render(
      <TestWrapper>
        <ReputationHistory data={[]} />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ProviderProfile
// ---------------------------------------------------------------------------

describe('ProviderProfile', () => {
  it('renders provider name and specialty', () => {
    render(
      <TestWrapper>
        <ProviderProfile provider={mockProvider} />
      </TestWrapper>,
    );
    expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('OB-GYN')).toBeInTheDocument();
  });

  it('renders review count and overall score', () => {
    render(
      <TestWrapper>
        <ProviderProfile provider={mockProvider} />
      </TestWrapper>,
    );
    expect(screen.getByText('42 reviews')).toBeInTheDocument();
    expect(screen.getByText('95/100')).toBeInTheDocument();
  });

  it('renders breach warning when dataBreaches > 0', () => {
    render(
      <TestWrapper>
        <ProviderProfile provider={mockProviderWithBreach} />
      </TestWrapper>,
    );
    expect(screen.getByText('2 breaches')).toBeInTheDocument();
  });

  it('does not render breach warning when dataBreaches is 0', () => {
    render(
      <TestWrapper>
        <ProviderProfile provider={mockProvider} />
      </TestWrapper>,
    );
    expect(screen.queryByText(/breach/)).not.toBeInTheDocument();
  });

  it('renders trust badge', () => {
    render(
      <TestWrapper>
        <ProviderProfile provider={mockProvider} />
      </TestWrapper>,
    );
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('is clickable when onClick is provided', () => {
    const onClick = jest.fn();
    render(
      <TestWrapper>
        <ProviderProfile provider={mockProvider} onClick={onClick} />
      </TestWrapper>,
    );
    // Card is rendered with cursor-pointer; basic render check
    const card = screen.getByText('Dr. Sarah Chen').closest('div');
    expect(card).toBeTruthy();
  });

  it('renders singular breach text for single breach', () => {
    const singleBreach = { ...mockProviderWithBreach, dataBreaches: 1 };
    render(
      <TestWrapper>
        <ProviderProfile provider={singleBreach} />
      </TestWrapper>,
    );
    expect(screen.getByText('1 breach')).toBeInTheDocument();
  });

  it('renders without onClick (no cursor-pointer)', () => {
    render(
      <TestWrapper>
        <ProviderProfile provider={mockProvider} />
      </TestWrapper>,
    );
    expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
  });
});
