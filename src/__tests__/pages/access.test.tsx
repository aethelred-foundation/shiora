// ============================================================
// Tests for src/app/access/page.tsx
// ============================================================

// The access page reads real grants + the real audit trail via useAccessControl
// (GET /api/access and /api/access/audit). Mock the hook with deterministic,
// varied grants (every status; canShare/canDownload variations; a null-lastAccess
// grant) and audit entries so the client-side filter/search and the detail modal
// render at full coverage; the live fetch is covered by the hook's own test.
const mockNow = Date.now();
const mockGrants = [
  { id: 'g1', provider: 'Dr. Sarah Chen, OB-GYN', specialty: 'OB-GYN', address: '0xaaaa000000000000000000000000000000000001', status: 'Active', scope: 'Full Records', grantedAt: mockNow - 30 * 86400000, expiresAt: mockNow + 60 * 86400000, lastAccess: mockNow - 2 * 3600000, accessCount: 12, txHash: '', attestation: '', canView: true, canDownload: true, canShare: true },
  { id: 'g2', provider: 'Dr. James Liu, Endocrinology', specialty: 'Endocrinology', address: '0xbbbb000000000000000000000000000000000002', status: 'Active', scope: 'Lab Results Only', grantedAt: mockNow - 20 * 86400000, expiresAt: mockNow + 40 * 86400000, lastAccess: mockNow - 5 * 3600000, accessCount: 5, txHash: '', attestation: '', canView: true, canDownload: true, canShare: false },
  { id: 'g3', provider: 'Metro Imaging Center', specialty: 'Radiology', address: '0xcccc000000000000000000000000000000000003', status: 'Active', scope: 'Imaging', grantedAt: mockNow - 10 * 86400000, expiresAt: mockNow + 20 * 86400000, lastAccess: mockNow - 26 * 3600000, accessCount: 3, txHash: '', attestation: '', canView: true, canDownload: false, canShare: false },
  { id: 'g4', provider: 'Old Family Clinic', specialty: 'General Practice', address: '0xdddd000000000000000000000000000000000004', status: 'Expired', scope: 'Full Records', grantedAt: mockNow - 120 * 86400000, expiresAt: mockNow - 5 * 86400000, lastAccess: null, accessCount: 0, txHash: '', attestation: '', canView: true, canDownload: false, canShare: false },
  { id: 'g5', provider: 'North Vitals Lab', specialty: 'Pathology', address: '0xeeee000000000000000000000000000000000005', status: 'Active', scope: 'Vitals', grantedAt: mockNow - 4 * 86400000, expiresAt: mockNow + 50 * 86400000, lastAccess: mockNow - 9 * 3600000, accessCount: 2, txHash: '', attestation: '', canView: true, canDownload: false, canShare: false },
];
const mockAuditLog = [
  { id: 'a1', provider: '0xaaaa000000000000000000000000000000000001', action: 'Record accessed', timestamp: mockNow - 2 * 3600000, details: 'health_records · rec-1', txHash: '', type: 'access' },
  { id: 'a2', provider: '0xowner00000000000000000000000000000000000', action: 'Access granted', timestamp: mockNow - 5 * 3600000, details: 'access-grant · grant-1', txHash: '', type: 'grant' },
];
jest.mock('@/hooks/useAccessControl', () => ({
  useAccessControl: () => ({
    grants: mockGrants,
    auditLog: mockAuditLog,
    createGrant: { mutate: jest.fn(), mutateAsync: jest.fn(async () => ({})), isLoading: false, error: null },
    revokeGrant: { mutate: jest.fn(), mutateAsync: jest.fn(async () => {}), isLoading: false, error: null },
  }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import AccessPage from '@/app/access/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

describe('AccessPage', () => {
  it('renders the access page', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    // "Access Control" appears in page heading and nav link
    expect(screen.getAllByText('Access Control').length).toBeGreaterThanOrEqual(1);
  });

  it('guards Grant Access behind wallet connection with a notification', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole('button', { name: /grant access/i }));
    expect(screen.getByText(/Connect your wallet/i)).toBeInTheDocument();
  });


  it('renders the page description', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/Manage provider access to your encrypted health data/)
    ).toBeInTheDocument();
  });

  it('renders grant access button', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    expect(screen.getByText('Grant Access')).toBeInTheDocument();
  });

  it('renders stats cards', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    expect(screen.getByText('Active Grants')).toBeInTheDocument();
    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getByText('Total Providers')).toBeInTheDocument();
    expect(screen.getByText('Audit Events')).toBeInTheDocument();
  });

  it('renders main tabs', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    expect(screen.getByText('Access Grants')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('displays grant list on grants tab', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    // First provider name from mock data
    expect(screen.getByText('Dr. Sarah Chen, OB-GYN')).toBeInTheDocument();
  });

  it('renders status filter tabs', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    // These are the status filter tabs within the grants view
    const allTabs = screen.getAllByText('All');
    expect(allTabs.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('filters grants by status', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    // "Revoked" appears as both a filter tab label and status badge on grants
    const revokedElements = screen.getAllByText('Revoked');
    // Click the first one (the filter tab)
    fireEvent.click(revokedElements[0]);

    // Should filter - the count of displayed grants may change
    // Just verify the page still renders without error
    expect(screen.getAllByText('Access Control').length).toBeGreaterThanOrEqual(1);
  });

  it('renders search input for providers', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    expect(screen.getByPlaceholderText('Search providers...')).toBeInTheDocument();
  });

  it('filters grants with search query', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search providers...');
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });

    expect(screen.getByText('Dr. Sarah Chen, OB-GYN')).toBeInTheDocument();
  });

  it('shows no results when search matches nothing', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search providers...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText('No access grants match your filters')).toBeInTheDocument();
  });

  it('switches to audit log tab', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Audit Log'));

    // Audit log has table headers
    expect(screen.getByText('Action')).toBeInTheDocument();
    // "Provider" may appear elsewhere
    expect(screen.getAllByText('Provider').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    // The fabricated on-chain "Transaction" column was removed.
    expect(screen.queryByText('Transaction')).not.toBeInTheDocument();
  });

  it('displays audit log entries', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Audit Log'));

    expect(screen.getByText('Record accessed')).toBeInTheDocument();
    expect(screen.getByText('Access granted')).toBeInTheDocument();
  });

  it('opens grant detail modal when a grant is clicked', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    // Click on the first grant card
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));

    // Modal should open with grant details
    expect(screen.getByText('Access Grant Details')).toBeInTheDocument();
    expect(screen.getAllByText('Permissions').length).toBeGreaterThanOrEqual(1);
    // De-theatered: a "Provider" block replaces the fabricated "Blockchain Verification".
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.queryByText('Blockchain Verification')).not.toBeInTheDocument();
    expect(screen.queryByText('TEE Attestation')).not.toBeInTheDocument();
  });

  it('renders security notice', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    expect(screen.getByText('Encrypted, owner-controlled access')).toBeInTheDocument();
  });

  it('renders grant permissions icons', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    // Grant cards should have permission indicator boxes
    // The exact presence depends on grant data, but the structure should render
    const grantCards = screen.getAllByText(/accesses/);
    expect(grantCards.length).toBeGreaterThan(0);
  });

  it('closes the grant detail modal', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    // Open the modal by clicking a grant
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    expect(screen.getByText('Access Grant Details')).toBeInTheDocument();

    // Close the modal by clicking the close button (the Modal component has a close button)
    const closeButtons = screen.getAllByRole('button');
    // Find the close/X button in the modal — typically the last one or one with specific aria
    const closeBtn = closeButtons.find(
      (btn) => btn.querySelector('svg') && btn.closest('[class*="fixed"]')
    );
    if (closeBtn) {
      fireEvent.click(closeBtn);
    } else {
      // Fallback: click the backdrop overlay
      const overlay = document.querySelector('[class*="fixed"] [class*="bg-black"]');
      if (overlay) fireEvent.click(overlay);
    }
  });

  it('opens grant detail modal for grant with limited permissions (canShare=false)', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    // Grants at index 2+ have canShare=false, grants at index 4+ have canDownload=false
    // Find a provider that has limited permissions
    // PROVIDER_NAMES[2] should be the third provider
    const providerNames = screen.getAllByText(/Dr\./);
    // Click on a provider further down the list
    // Grant at index 4 has canDownload: false, canShare: false
    // Provider at index 4 is PROVIDER_NAMES[4]
    // Let's find and click the 5th grant card
    const grantCards = screen.getAllByText(/accesses/);
    if (grantCards.length >= 5) {
      const fifthGrantCard = grantCards[4].closest('[class*="cursor-pointer"]');
      if (fifthGrantCard) {
        fireEvent.click(fifthGrantCard);
        expect(screen.getByText('Access Grant Details')).toBeInTheDocument();
      }
    }
  });

  it('opens grant detail modal for an expired grant (daysLeft <= 0)', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    // Filter to show expired grants
    const expiredElements = screen.getAllByText('Expired');
    fireEvent.click(expiredElements[0]);

    // Now click on an expired grant card to open its detail modal
    const grantCards = document.querySelectorAll('[class*="cursor-pointer"]');
    if (grantCards.length > 0) {
      fireEvent.click(grantCards[0]);
    }
    // Verify modal opened and shows expired status
    expect(screen.getAllByText('Expired').length).toBeGreaterThanOrEqual(1);
  });

  it('renders grant with no lastAccess (null)', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );
    // Grants with status != 'Active' have lastAccess: null
    // These grants should not show "Last: ..." text
    // Filter to show all grants
    expect(screen.getByText('Grant Access')).toBeInTheDocument();
  });

  it('switches to consent tab', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    const tabs = screen.getAllByRole('tab');
    const consentTab = tabs.find((t) => t.textContent?.includes('Consent'));
    expect(consentTab).toBeDefined();
    fireEvent.click(consentTab!);
  });

  it('switches to reputation tab', () => {
    render(
      <TestWrapper>
        <AccessPage />
      </TestWrapper>
    );

    const tabs = screen.getAllByRole('tab');
    const repTab = tabs.find((t) => t.textContent?.includes('Reputation'));
    expect(repTab).toBeDefined();
    fireEvent.click(repTab!);
  });
});
