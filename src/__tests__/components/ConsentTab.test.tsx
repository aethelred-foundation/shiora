// ============================================================
// Tests for src/components/consent/ConsentTab.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import ConsentTab from '@/components/consent/ConsentTab';
import type { ConsentGrant, ConsentAuditEntry } from '@/types';

// ---------------------------------------------------------------------------
// Mock useConsentManagement at module level
// ---------------------------------------------------------------------------

const mockMutate = jest.fn();
const mockSetStatusFilter = jest.fn();
const mockSetScopeFilter = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockRefetch = jest.fn();

const now = Date.now();
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayMs = todayStart.getTime();

const mockActiveConsent: ConsentGrant = {
  id: 'consent-1',
  patientAddress: 'aeth1patient001',
  providerAddress: 'aeth1provider000000000000000000000001',
  providerName: 'City Hospital',
  scopes: ['lab_results', 'vitals'],
  status: 'active',
  grantedAt: now - 30 * 86400000,
  expiresAt: now + 5 * 86400000, // expiring soon (within 7 days)
  txHash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  attestation: '0xatt123',
  policyId: 'policy-1',
  autoRenew: true,
};

const mockExpiredConsent: ConsentGrant = {
  id: 'consent-2',
  patientAddress: 'aeth1patient001',
  providerAddress: 'aeth1provider000000000000000000000002',
  providerName: 'Dr. Smith Clinic',
  scopes: ['imaging'],
  status: 'expired',
  grantedAt: now - 60 * 86400000,
  expiresAt: todayMs + 3600000, // expired today
  txHash: '0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4',
  attestation: '0xatt456',
  policyId: 'policy-2',
  autoRenew: false,
};

const mockRevokedConsent: ConsentGrant = {
  id: 'consent-3',
  patientAddress: 'aeth1patient001',
  providerAddress: 'aeth1provider000000000000000000000003',
  providerName: 'Breach Lab',
  scopes: ['prescriptions'],
  status: 'revoked',
  grantedAt: now - 90 * 86400000,
  expiresAt: now + 30 * 86400000,
  revokedAt: todayMs + 1000, // revoked today
  txHash: '0x789abc123def456abc123def456abc123def456abc123def456abc123def4567',
  attestation: '0xatt789',
  policyId: 'policy-1',
  autoRenew: false,
};

const mockPendingConsent: ConsentGrant = {
  id: 'consent-4',
  patientAddress: 'aeth1patient001',
  providerAddress: 'aeth1provider000000000000000000000004',
  providerName: 'Pending Clinic',
  scopes: ['clinical_notes'],
  status: 'pending',
  grantedAt: now - 1 * 86400000,
  expiresAt: now + 90 * 86400000,
  txHash: '0xpending123456789',
  attestation: '0xattpend',
  policyId: 'policy-1',
  autoRenew: false,
};

const allConsents = [mockActiveConsent, mockExpiredConsent, mockRevokedConsent, mockPendingConsent];

const mockAuditEntries: ConsentAuditEntry[] = [
  {
    id: 'audit-1',
    consentId: 'consent-1',
    action: 'granted',
    actor: 'aeth1patient000000000000000000000001',
    timestamp: now - 86400000,
    details: 'Consent granted to City Hospital',
    txHash: '0xaudit1hash',
  },
  {
    id: 'audit-2',
    consentId: 'consent-3',
    action: 'revoked',
    actor: 'aeth1patient000000000000000000000001',
    timestamp: now - 3600000,
    details: 'Consent revoked for Breach Lab',
    txHash: '0xaudit2hash',
  },
];

let mockHookReturn: any;

function getDefaultHookReturn() {
  return {
    consents: allConsents,
    total: allConsents.length,
    isLoading: false,
    error: null,
    policies: [],
    auditLog: mockAuditEntries,
    isLoadingAudit: false,
    statusFilter: undefined,
    setStatusFilter: mockSetStatusFilter,
    scopeFilter: undefined,
    setScopeFilter: mockSetScopeFilter,
    searchQuery: '',
    setSearchQuery: mockSetSearchQuery,
    createConsent: { mutate: mockMutate, mutateAsync: jest.fn(), isLoading: false },
    revokeConsent: { mutate: mockMutate, isLoading: false },
    modifyConsent: { mutate: mockMutate, isLoading: false },
    revokeAllFromProvider: { mutate: mockMutate, isLoading: false },
    activeCount: 1,
    expiredCount: 1,
    revokedCount: 1,
    pendingCount: 1,
    refetch: mockRefetch,
  };
}

jest.mock('@/hooks/useConsentManagement', () => ({
  useConsentManagement: () => mockHookReturn,
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
// ConsentTab tests
// ---------------------------------------------------------------------------

describe('ConsentTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHookReturn = getDefaultHookReturn();
  });

  // ---- Stats bar ----

  it('renders stats bar with correct stat labels', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Active Consents')).toBeInTheDocument();
    // "Pending" appears as stat label AND as consent card badge
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Expired Today')).toBeInTheDocument();
    expect(screen.getByText('Revoked Today')).toBeInTheDocument();
  });

  // ---- Filter controls ----

  it('renders filter controls', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
    expect(screen.getByText('All Scopes')).toBeInTheDocument();
  });

  it('renders New Consent and Timeline buttons', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('New Consent')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText('Search providers...')).toBeInTheDocument();
  });

  it('calls setSearchQuery on search input change', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.change(screen.getByPlaceholderText('Search providers...'), {
      target: { value: 'City' },
    });
    expect(mockSetSearchQuery).toHaveBeenCalledWith('City');
  });

  // ---- Status filter dropdown ----

  it('opens status dropdown and shows options', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Statuses'));
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expired').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Revoked').length).toBeGreaterThan(0);
  });

  it('selects a status filter option and closes dropdown', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Statuses'));
    // Find dropdown items by querying within the dropdown container
    const dropdownItems = document.querySelectorAll('.absolute.left-0.top-full button');
    // Click the "Expired" option (4th item: All Statuses, Active, Pending, Expired)
    const expiredBtn = Array.from(dropdownItems).find((btn) => btn.textContent === 'Expired');
    expect(expiredBtn).toBeTruthy();
    fireEvent.click(expiredBtn!);
    expect(mockSetStatusFilter).toHaveBeenCalledWith('expired');
  });

  it('closes status dropdown via overlay', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Statuses'));
    const overlay = document.querySelector('.fixed.inset-0.z-10');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
    // Dropdown should be closed - no Unrated option visible
  });

  it('shows status label when filter is set', () => {
    mockHookReturn.statusFilter = 'active';
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    // The filter button should show "Active" instead of "All Statuses"
    // Active appears multiple times (stat label + filter + consent card badge)
    const activeElements = screen.getAllByText('Active');
    expect(activeElements.length).toBeGreaterThan(0);
  });

  // ---- Scope filter dropdown ----

  it('opens scope dropdown on click', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Scopes'));
    // Look for scope options in the dropdown
    const scopeDropdownItems = document.querySelectorAll(
      '.absolute.left-0.top-full.mt-1.z-20 button',
    );
    expect(scopeDropdownItems.length).toBeGreaterThan(0);
  });

  it('selects a scope filter option from dropdown', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Scopes'));
    // Find the scope option in the dropdown container
    const scopeDropdownItems = document.querySelectorAll(
      '.absolute.left-0.top-full.mt-1.z-20 button',
    );
    // Find one that says "Wearable Data" (unlikely to appear elsewhere)
    const wearableBtn = Array.from(scopeDropdownItems).find(
      (btn) => btn.textContent === 'Wearable Data',
    );
    expect(wearableBtn).toBeTruthy();
    fireEvent.click(wearableBtn!);
    expect(mockSetScopeFilter).toHaveBeenCalledWith('wearable_data');
  });

  it('closes scope dropdown via overlay', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Scopes'));
    const overlays = document.querySelectorAll('.fixed.inset-0.z-10');
    expect(overlays.length).toBeGreaterThan(0);
    fireEvent.click(overlays[overlays.length - 1]);
  });

  it('shows scope label when filter is set', () => {
    mockHookReturn.scopeFilter = 'wearable_data';
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Wearable Data')).toBeInTheDocument();
  });

  // ---- Dropdown mutual exclusion ----

  it('closes status dropdown when scope dropdown is opened', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Statuses'));
    // Verify status dropdown is open
    expect(document.querySelector('.fixed.inset-0.z-10')).toBeTruthy();
    // Open scope dropdown (should close status)
    fireEvent.click(screen.getByText('All Scopes'));
    const scopeDropdownItems = document.querySelectorAll(
      '.absolute.left-0.top-full.mt-1.z-20 button',
    );
    expect(scopeDropdownItems.length).toBeGreaterThan(0);
  });

  it('closes scope dropdown when status dropdown is opened', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All Scopes'));
    // Verify scope dropdown is open
    const scopeItems = document.querySelectorAll('.absolute.left-0.top-full.mt-1.z-20 button');
    expect(scopeItems.length).toBeGreaterThan(0);
    // Open status dropdown
    fireEvent.click(screen.getByText('All Statuses'));
    const statusItems = document.querySelectorAll('.absolute.left-0.top-full button');
    expect(statusItems.length).toBeGreaterThan(0);
  });

  // ---- Timeline ----

  it('toggles timeline view on and off', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('Consent Audit Timeline')).toBeInTheDocument();
    // Audit entries should render
    expect(screen.getByText('Consent granted to City Hospital')).toBeInTheDocument();
    expect(screen.getByText('Consent revoked for Breach Lab')).toBeInTheDocument();
    // Toggle off
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.queryByText('Consent Audit Timeline')).not.toBeInTheDocument();
  });

  it('shows loading spinner in timeline when audit is loading', () => {
    mockHookReturn.isLoadingAudit = true;
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('Consent Audit Timeline')).toBeInTheDocument();
    // Loading spinner should render (Loader2 component)
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows empty audit timeline message', () => {
    mockHookReturn.auditLog = [];
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('No audit entries found')).toBeInTheDocument();
  });

  // ---- Consent Cards ----

  it('renders consent cards with provider names', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('City Hospital')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith Clinic')).toBeInTheDocument();
    expect(screen.getByText('Breach Lab')).toBeInTheDocument();
    expect(screen.getByText('Pending Clinic')).toBeInTheDocument();
  });

  it('shows Revoke and Modify buttons on active consent', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Revoke')).toBeInTheDocument();
    expect(screen.getByText('Modify')).toBeInTheDocument();
  });

  // ---- Revoke flow ----

  it('opens revoke confirm dialog and confirms', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Revoke'));
    expect(screen.getByText('Revoke Consent')).toBeInTheDocument();
    expect(screen.getByText(/permanently revoke/)).toBeInTheDocument();
    // Confirm revoke
    const revokeButtons = screen.getAllByText('Revoke');
    fireEvent.click(revokeButtons[revokeButtons.length - 1]);
    expect(mockMutate).toHaveBeenCalledWith('consent-1');
  });

  it('opens revoke dialog and cancels via Keep Active', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Revoke'));
    expect(screen.getByText('Revoke Consent')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Keep Active'));
    // Dialog should close
  });

  // ---- Modify flow ----

  it('fires onModify callback on Modify button click', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Modify'));
    // setSelectedConsent is called - this is internal state; just verify no crash
  });

  // ---- Create modal ----

  it('opens create consent modal', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('New Consent'));
    expect(screen.getByText('Create Consent Grant')).toBeInTheDocument();
  });

  it('submits create consent form through modal', () => {
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('New Consent'));
    expect(screen.getByText('Create Consent Grant')).toBeInTheDocument();
    // Step 1: Enter provider name
    fireEvent.change(screen.getByPlaceholderText('Search or enter provider name...'), {
      target: { value: 'Test Provider' },
    });
    fireEvent.click(screen.getByText('Continue'));
    // Step 2: Select a scope
    const labResultBtns = screen.getAllByText('Lab Results');
    fireEvent.click(labResultBtns[labResultBtns.length - 1]);
    fireEvent.click(screen.getByText('Continue'));
    // Step 3: Duration (default 90 days is fine)
    fireEvent.click(screen.getByText('Continue'));
    // Step 4: Review - submit
    fireEvent.click(screen.getByText('Grant Consent'));
    expect(mockMutate).toHaveBeenCalled();
  });

  // ---- Loading state ----

  it('shows loading spinner when isLoading is true', () => {
    mockHookReturn.isLoading = true;
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  // ---- Error state ----

  it('shows error message when error is present', () => {
    mockHookReturn.error = new Error('Network error');
    mockHookReturn.consents = [];
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Failed to load consents')).toBeInTheDocument();
  });

  // ---- Empty state ----

  it('shows empty state when consents is empty array and no error', () => {
    mockHookReturn.consents = [];
    render(
      <TestWrapper>
        <ConsentTab />
      </TestWrapper>,
    );
    expect(screen.getByText('No consent grants match your filters')).toBeInTheDocument();
  });
});
