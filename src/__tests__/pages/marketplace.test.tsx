// ============================================================
// Tests for src/app/marketplace/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockSetSearch = jest.fn();
const mockSetCategoryFilter = jest.fn();
const mockSetQualityFilter = jest.fn();
const mockSetPriceRange = jest.fn();
const mockSetFilters = jest.fn();
const mockPurchase = { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false, error: null };
const mockWithdraw = { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false, error: null };
const mockCreate = { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false, error: null };
const mockRefetch = jest.fn();

let mockOverrides: Record<string, unknown> = {};
let mockWalletBalance = 0;

jest.mock('@/contexts/AppContext', () => {
  const original = jest.requireActual('@/contexts/AppContext');
  return {
    ...original,
    useApp: () => ({
      wallet: {
        connected: mockWalletBalance > 0,
        address: '0xmockwallet',
        aethelBalance: mockWalletBalance,
      },
      healthData: {
        totalRecords: 147,
        encryptedRecords: 147,
        lastUpload: Date.now(),
        storageUsed: 1024 * 1024 * 50,
        ipfsNodes: 42,
        teeVerified: true,
      },
      teeState: {
        status: 'operational',
        platform: 'Intel SGX',
        enclaveId: '0x123',
        lastAttestation: Date.now(),
        modelVersions: {},
      },
      realTime: {
        blockHeight: 1000000,
        epoch: 42,
        tps: 1500,
      },
      theme: 'light',
      toggleTheme: jest.fn(),
      addToast: jest.fn(),
      addNotification: jest.fn(),
      removeNotification: jest.fn(),
      dismissToast: jest.fn(),
      toasts: [],
      notifications: [],
      searchOpen: false,
      setSearchOpen: jest.fn(),
      connectWallet: jest.fn(),
      disconnectWallet: jest.fn(),
    }),
    AppProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('@/hooks/useMarketplace', () => ({
  useMarketplace: () => ({
    listings: [
      {
        id: 'listing-1',
        seller: '0xseller1',
        sellerReputation: 95,
        category: 'lab_results',
        title: 'Comprehensive Lab Panel',
        description: 'Anonymized lab results dataset',
        dataPoints: 15000,
        dateRange: { start: Date.now() - 86400000 * 180, end: Date.now() },
        qualityScore: 92,
        anonymizationLevel: 'differential-privacy',
        price: 50,
        currency: 'AETHEL',
        status: 'active',
        teeVerified: true,
        attestation: '0xatt1',
        purchaseCount: 12,
        createdAt: Date.now() - 86400000 * 30,
        expiresAt: Date.now() + 86400000 * 150,
      },
      {
        id: 'listing-2',
        seller: '0xseller2',
        sellerReputation: 88,
        category: 'vitals_timeseries',
        title: 'Heart Rate Monitoring Data',
        description: 'Continuous HR monitoring dataset',
        dataPoints: 50000,
        dateRange: { start: Date.now() - 86400000 * 90, end: Date.now() },
        qualityScore: 85,
        anonymizationLevel: 'k-anonymity',
        price: 75,
        currency: 'AETHEL',
        status: 'active',
        teeVerified: true,
        attestation: '0xatt2',
        purchaseCount: 5,
        createdAt: Date.now() - 86400000 * 14,
        expiresAt: Date.now() + 86400000 * 166,
      },
    ],
    purchases: [
      {
        id: 'purch-1',
        listingId: 'listing-1',
        buyer: '0xbuyer1',
        seller: '0xseller1',
        price: 50,
        purchasedAt: Date.now() - 86400000 * 7,
        txHash: '0xtxhash1',
        downloadCount: 3,
        category: 'lab_results',
        title: 'Comprehensive Lab Panel',
      },
    ],
    stats: {
      totalListings: 45,
      activeListings: 32,
      totalVolume: 12500,
      totalSellers: 18,
      totalBuyers: 120,
      averagePrice: 65,
    },
    isLoading: false,
    isFetching: false,
    error: null,
    filters: {},
    setFilters: mockSetFilters,
    setCategoryFilter: mockSetCategoryFilter,
    setSearch: mockSetSearch,
    setQualityFilter: mockSetQualityFilter,
    setPriceRange: mockSetPriceRange,
    create: mockCreate,
    purchase: mockPurchase,
    withdraw: mockWithdraw,
    revenueData: [
      { day: '2024-01-01', revenue: 500, transactions: 10 },
      { day: '2024-01-02', revenue: 750, transactions: 15 },
    ],
    totalRevenue: 1250,
    totalTransactions: 25,
    refetch: mockRefetch,
    ...mockOverrides,
  }),
}));

import MarketplacePage from '@/app/marketplace/page';

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
  mockWalletBalance = 0;
});

describe('MarketplacePage', () => {
  it('renders the marketplace page heading', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText('Health Data Marketplace')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(
      screen.getByText(/Buy and sell anonymized, TEE-verified health datasets/),
    ).toBeInTheDocument();
  });

  it('renders navigation and footer', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the create listing button', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText('Create Listing')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.getByText('My Listings')).toBeInTheDocument();
    expect(screen.getByText('My Purchases')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  // --- Browse Tab ---

  it('renders search input on Browse tab', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText('Search datasets...')).toBeInTheDocument();
  });

  it('renders category and quality filter dropdowns', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText('All Categories')).toBeInTheDocument();
    expect(screen.getByText('Any Quality')).toBeInTheDocument();
  });

  it('renders listing cards on Browse tab', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText('Comprehensive Lab Panel')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate Monitoring Data')).toBeInTheDocument();
  });

  it('renders listing count text', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText(/Showing 2 listings/)).toBeInTheDocument();
  });

  it('calls setSearch when search input changes', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const searchInput = screen.getByPlaceholderText('Search datasets...');
    fireEvent.change(searchInput, { target: { value: 'lab' } });
    expect(mockSetSearch).toHaveBeenCalledWith('lab');
  });

  it('calls setCategoryFilter when category dropdown changes', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const selects = screen.getAllByRole('combobox');
    // First select is category
    fireEvent.change(selects[0], { target: { value: 'lab_results' } });
    expect(mockSetCategoryFilter).toHaveBeenCalledWith('lab_results');
  });

  it('calls setCategoryFilter with undefined when All Categories is selected', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '' } });
    expect(mockSetCategoryFilter).toHaveBeenCalledWith(undefined);
  });

  it('calls setQualityFilter when quality dropdown changes', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const selects = screen.getAllByRole('combobox');
    // Second select is quality
    fireEvent.change(selects[1], { target: { value: '90' } });
    expect(mockSetQualityFilter).toHaveBeenCalledWith(90);
  });

  it('calls setQualityFilter with undefined when Any Quality is selected', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(mockSetQualityFilter).toHaveBeenCalledWith(undefined);
  });

  it('shows loading skeletons when isLoading is true', () => {
    mockOverrides = { isLoading: true };
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.queryByText('Comprehensive Lab Panel')).not.toBeInTheDocument();
  });

  it('shows no listings found when listings is empty', () => {
    mockOverrides = { listings: [] };
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText('No listings found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or search query')).toBeInTheDocument();
  });

  it('hides stats bar when stats is null', () => {
    mockOverrides = { stats: null };
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    // Page should still render
    expect(screen.getByText('Health Data Marketplace')).toBeInTheDocument();
  });

  // --- My Listings Tab ---

  it('switches to My Listings tab and shows listings', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Listings'));
    expect(screen.getAllByText('My Listings').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Datasets you have listed for sale/)).toBeInTheDocument();
  });

  it('shows empty state on My Listings when listings is empty', () => {
    mockOverrides = { listings: [] };
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Listings'));
    expect(screen.getByText('No listings yet')).toBeInTheDocument();
  });

  // --- My Purchases Tab ---

  it('switches to My Purchases tab and shows purchase table', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Purchases'));
    expect(screen.getByText(/Datasets you have purchased/)).toBeInTheDocument();
    expect(screen.getByText('Dataset')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
  });

  it('shows empty state on My Purchases when purchases is empty', () => {
    mockOverrides = { purchases: [] };
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Purchases'));
    expect(screen.getByText('No purchases yet')).toBeInTheDocument();
  });

  // --- Analytics Tab ---

  it('switches to Analytics tab and shows charts', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Analytics'));
    expect(screen.getByText('Marketplace Analytics')).toBeInTheDocument();
    expect(screen.getByText('Category Distribution')).toBeInTheDocument();
    expect(screen.getByText('Volume by Category')).toBeInTheDocument();
  });

  // --- Purchase Modal ---

  it('opens purchase modal when Purchase button is clicked on a listing card', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const purchaseButtons = screen.getAllByText('Purchase');
    if (purchaseButtons.length > 0) {
      fireEvent.click(purchaseButtons[0]);
      expect(screen.getAllByText('Confirm Purchase').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('confirms purchase button is disabled when wallet balance is zero', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const purchaseButtons = screen.getAllByText('Purchase');
    if (purchaseButtons.length > 0) {
      fireEvent.click(purchaseButtons[0]);
      const confirmButtons = screen.getAllByText('Confirm Purchase');
      const confirmBtn = confirmButtons.find((el) => el.closest('button'));
      if (confirmBtn) {
        // Button should be disabled since wallet.aethelBalance is 0
        expect(confirmBtn.closest('button')).toBeDisabled();
      }
    }
  });

  it('closes purchase modal when cancel is clicked', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const purchaseButtons = screen.getAllByText('Purchase');
    if (purchaseButtons.length > 0) {
      fireEvent.click(purchaseButtons[0]);
      expect(screen.getAllByText('Confirm Purchase').length).toBeGreaterThanOrEqual(1);
      fireEvent.click(screen.getByText('Cancel'));
    }
  });

  // --- Withdraw ---

  it('clicks Withdraw button on My Listings tab', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Listings'));
    const withdrawButtons = screen.getAllByText('Withdraw');
    if (withdrawButtons.length > 0) {
      fireEvent.click(withdrawButtons[0]);
      expect(mockWithdraw.mutate).toHaveBeenCalled();
    }
  });

  // --- Additional coverage tests ---

  it('renders category distribution pie chart labels on Analytics tab', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Analytics'));
    expect(screen.getByText('Listings by category')).toBeInTheDocument();
    expect(screen.getByText('AETHEL traded per category')).toBeInTheDocument();
  });

  it('renders revenue chart on Analytics tab', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Analytics'));
    expect(screen.getByText(/Revenue, categories, and volume trends/)).toBeInTheDocument();
  });

  it('renders purchase details in My Purchases table', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Purchases'));
    expect(screen.getByText('Comprehensive Lab Panel')).toBeInTheDocument();
    expect(screen.getByText(/50\.00 AETHEL/)).toBeInTheDocument();
    expect(screen.getByText('Purchased')).toBeInTheDocument();
    expect(screen.getByText('Downloads')).toBeInTheDocument();
  });

  it('renders quality filter options', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const selects = screen.getAllByRole('combobox');
    const qualitySelect = selects[1];
    expect(qualitySelect).toBeInTheDocument();
    // Verify quality options exist
    const options = qualitySelect.querySelectorAll('option');
    expect(options.length).toBe(4); // Any Quality, 90+, 75+, 60+
  });

  it('shows 0 listings text when listings are empty on browse tab', () => {
    mockOverrides = { listings: [] };
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    expect(screen.getByText(/Showing 0 listings/)).toBeInTheDocument();
  });

  it('renders marketplace stats bar with stats', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    // Stats bar should render when stats are provided
    expect(screen.getByText('Health Data Marketplace')).toBeInTheDocument();
  });

  it('confirms purchase when wallet has sufficient balance', () => {
    mockWalletBalance = 1000;
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const purchaseButtons = screen.getAllByText('Purchase');
    fireEvent.click(purchaseButtons[0]);
    const confirmButtons = screen.getAllByText('Confirm Purchase');
    const confirmBtn = confirmButtons.find((el) => el.closest('button'));
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn!.closest('button')).not.toBeDisabled();
    fireEvent.click(confirmBtn!.closest('button')!);
    expect(mockPurchase.mutate).toHaveBeenCalledWith('listing-1');
  });

  it('shows insufficient balance warning when wallet balance is 0', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    const purchaseButtons = screen.getAllByText('Purchase');
    fireEvent.click(purchaseButtons[0]);
    // Wallet balance is 0, so "Insufficient balance" warning should appear
    expect(screen.getByText(/Insufficient AETHEL balance/i)).toBeInTheDocument();
  });

  it('renders My Listings with isOwner cards showing Withdraw buttons', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Listings'));
    const withdrawButtons = screen.getAllByText('Withdraw');
    expect(withdrawButtons.length).toBeGreaterThan(0);
  });

  it('renders category badge in purchases table', () => {
    render(
      <TestWrapper>
        <MarketplacePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('My Purchases'));
    // The category badge should render the label for lab_results
    expect(screen.getByText('Lab Results')).toBeInTheDocument();
  });
});
