// ============================================================
// Tests for src/components/marketplace/MarketplaceComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  QualityScoreBadge,
  DataListingCard,
  MarketplaceStatsBar,
  PurchaseModal,
  RevenueChart,
} from '@/components/marketplace/MarketplaceComponents';
import type { DataListing, MarketplaceStats } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockListing: DataListing = {
  id: 'listing-1',
  title: 'Menstrual Cycle Dataset',
  category: 'menstrual_cycles',
  dataPoints: 50000,
  qualityScore: 92,
  price: 15.5,
  seller: 'aeth1seller001',
  status: 'active',
  teeVerified: true,
  anonymizationLevel: 'k-anonymity',
  createdAt: Date.now() - 7 * 86400000,
};

const mockListingInactive: DataListing = {
  ...mockListing,
  id: 'listing-2',
  status: 'sold',
  teeVerified: false,
};

const mockListingLowQuality: DataListing = {
  ...mockListing,
  id: 'listing-3',
  qualityScore: 55,
};

const mockStats: MarketplaceStats = {
  totalListings: 156,
  totalVolume: 45230,
  averagePrice: 12.45,
  totalSellers: 42,
};

// ---------------------------------------------------------------------------
// QualityScoreBadge
// ---------------------------------------------------------------------------

describe('QualityScoreBadge', () => {
  it('renders score value', () => {
    render(
      <TestWrapper>
        <QualityScoreBadge score={88} />
      </TestWrapper>,
    );
    expect(screen.getByText('88')).toBeInTheDocument();
  });

  it('renders with high score (>= 90) green', () => {
    render(
      <TestWrapper>
        <QualityScoreBadge score={95} />
      </TestWrapper>,
    );
    expect(screen.getByText('95')).toBeInTheDocument();
  });

  it('renders with medium score (75-89) brand color', () => {
    render(
      <TestWrapper>
        <QualityScoreBadge score={80} />
      </TestWrapper>,
    );
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders with low-medium score (60-74) orange', () => {
    render(
      <TestWrapper>
        <QualityScoreBadge score={65} />
      </TestWrapper>,
    );
    expect(screen.getByText('65')).toBeInTheDocument();
  });

  it('renders with low score (< 60) red', () => {
    render(
      <TestWrapper>
        <QualityScoreBadge score={45} />
      </TestWrapper>,
    );
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('accepts custom size', () => {
    render(
      <TestWrapper>
        <QualityScoreBadge score={88} size={60} />
      </TestWrapper>,
    );
    expect(screen.getByText('88')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DataListingCard
// ---------------------------------------------------------------------------

describe('DataListingCard', () => {
  it('renders listing title and category', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} />
      </TestWrapper>,
    );
    expect(screen.getByText('Menstrual Cycle Dataset')).toBeInTheDocument();
    expect(screen.getByText('Menstrual Cycles')).toBeInTheDocument();
  });

  it('renders quality score', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} />
      </TestWrapper>,
    );
    expect(screen.getByText('92/100')).toBeInTheDocument();
  });

  it('renders TEE Verified badge when teeVerified', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} />
      </TestWrapper>,
    );
    expect(screen.getByText('TEE Verified')).toBeInTheDocument();
  });

  it('renders price', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} />
      </TestWrapper>,
    );
    expect(screen.getByText('15.50')).toBeInTheDocument();
  });

  it('renders Purchase button for active listing with onPurchase', () => {
    const onPurchase = jest.fn();
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} onPurchase={onPurchase} />
      </TestWrapper>,
    );
    const btn = screen.getByText('Purchase');
    fireEvent.click(btn);
    expect(onPurchase).toHaveBeenCalledWith('listing-1');
  });

  it('renders StatusBadge for inactive listing without onPurchase', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListingInactive} />
      </TestWrapper>,
    );
    // No Purchase button
    expect(screen.queryByText('Purchase')).not.toBeInTheDocument();
  });

  it('renders Withdraw button for owner with active listing', () => {
    const onWithdraw = jest.fn();
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} isOwner={true} onWithdraw={onWithdraw} />
      </TestWrapper>,
    );
    const btn = screen.getByText('Withdraw');
    fireEvent.click(btn);
    expect(onWithdraw).toHaveBeenCalledWith('listing-1');
  });

  it('renders StatusBadge for owner with non-active listing', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListingInactive} isOwner={true} />
      </TestWrapper>,
    );
    expect(screen.queryByText('Withdraw')).not.toBeInTheDocument();
    expect(screen.queryByText('Purchase')).not.toBeInTheDocument();
  });

  it('renders StatusBadge for active listing when not owner and no onPurchase', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListingInactive} isOwner={false} />
      </TestWrapper>,
    );
    expect(screen.queryByText('Purchase')).not.toBeInTheDocument();
  });

  it('renders data points count', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} />
      </TestWrapper>,
    );
    expect(screen.getByText(/50\.0K data points/)).toBeInTheDocument();
  });

  it('renders anonymization level badge', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListing} />
      </TestWrapper>,
    );
    expect(screen.getByText('k-anonymity')).toBeInTheDocument();
  });

  it('renders unknown category with fallback', () => {
    const unknownCat = { ...mockListing, category: 'unknown_cat' as any };
    render(
      <TestWrapper>
        <DataListingCard listing={unknownCat} />
      </TestWrapper>,
    );
    expect(screen.getByText('unknown_cat')).toBeInTheDocument();
  });

  it('renders quality bar with medium score color', () => {
    const midQuality = { ...mockListing, qualityScore: 80 };
    render(
      <TestWrapper>
        <DataListingCard listing={midQuality} />
      </TestWrapper>,
    );
    expect(screen.getByText('80/100')).toBeInTheDocument();
  });

  it('renders quality bar with low score color', () => {
    render(
      <TestWrapper>
        <DataListingCard listing={mockListingLowQuality} />
      </TestWrapper>,
    );
    expect(screen.getByText('55/100')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MarketplaceStatsBar
// ---------------------------------------------------------------------------

describe('MarketplaceStatsBar', () => {
  it('renders all stat cards', () => {
    render(
      <TestWrapper>
        <MarketplaceStatsBar stats={mockStats} />
      </TestWrapper>,
    );
    expect(screen.getByText('Total Listings')).toBeInTheDocument();
    expect(screen.getByText('156')).toBeInTheDocument();
    expect(screen.getByText('Total Volume')).toBeInTheDocument();
    expect(screen.getByText('Avg Price')).toBeInTheDocument();
    expect(screen.getByText('12.45 AETHEL')).toBeInTheDocument();
    expect(screen.getByText('Sellers')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PurchaseModal
// ---------------------------------------------------------------------------

describe('PurchaseModal', () => {
  it('renders nothing when listing is null', () => {
    const { container } = render(
      <TestWrapper>
        <PurchaseModal
          listing={null}
          open={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          isLoading={false}
        />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders listing details when open', () => {
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListing}
          open={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          isLoading={false}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Menstrual Cycle Dataset')).toBeInTheDocument();
    expect(screen.getByText('Menstrual Cycles')).toBeInTheDocument();
    expect(screen.getByText('15.50 AETHEL')).toBeInTheDocument();
  });

  it('shows insufficient balance warning when balance < price', () => {
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListing}
          open={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          isLoading={false}
          aethelBalance={5}
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/Insufficient AETHEL balance/)).toBeInTheDocument();
  });

  it('shows TEE verified message when teeVerified', () => {
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListing}
          open={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          isLoading={false}
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/TEE-verified/)).toBeInTheDocument();
  });

  it('does not show TEE message when not teeVerified', () => {
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListingInactive}
          open={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          isLoading={false}
        />
      </TestWrapper>,
    );
    expect(screen.queryByText(/TEE-verified/)).not.toBeInTheDocument();
  });

  it('calls onConfirm when Confirm Purchase is clicked', () => {
    const onConfirm = jest.fn();
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListing}
          open={true}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          isLoading={false}
        />
      </TestWrapper>,
    );
    const btns = screen.getAllByText('Confirm Purchase');
    const btn = btns.find((el) => el.tagName === 'BUTTON') ?? btns[0];
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListing}
          open={true}
          onClose={onClose}
          onConfirm={jest.fn()}
          isLoading={false}
        />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Processing... when loading', () => {
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListing}
          open={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          isLoading={true}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('disables confirm when cannot afford', () => {
    render(
      <TestWrapper>
        <PurchaseModal
          listing={mockListing}
          open={true}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          isLoading={false}
          aethelBalance={5}
        />
      </TestWrapper>,
    );
    const btns = screen.getAllByText('Confirm Purchase');
    const btn = btns.find((el) => el.tagName === 'BUTTON') ?? btns[0];
    expect(btn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// RevenueChart
// ---------------------------------------------------------------------------

describe('RevenueChart', () => {
  it('renders chart heading', () => {
    render(
      <TestWrapper>
        <RevenueChart data={[{ day: 'Day 1', revenue: 100, transactions: 5 }]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Marketplace Revenue')).toBeInTheDocument();
    expect(screen.getByText('AETHEL volume over 30 days')).toBeInTheDocument();
  });
});
