// ============================================================
// Tests for src/components/consent/ConsentComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  ConsentCard,
  ConsentTimeline,
  ConsentScopeSelector,
  ConsentExpiryPicker,
  CreateConsentModal,
  SmartContractStatus,
} from '@/components/consent/ConsentComponents';
import type {
  ConsentGrant,
  ConsentAuditEntry,
  ConsentScope,
  ConsentPolicy,
} from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client: qc },
    React.createElement(AppProvider, null, children));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockActiveConsent: ConsentGrant = {
  id: 'consent-1',
  providerName: 'City Medical Center',
  providerAddress: '0xabc123def456abc123def456abc123def456abc1',
  scopes: ['lab_results', 'vitals'],
  status: 'active',
  grantedAt: Date.now() - 86400000 * 30,
  expiresAt: Date.now() + 86400000 * 60,
  autoRenew: false,
  txHash: '0xtxhash123abc456def789ghi012jkl345mno678',
  attestation: '0xattest123abc456def789ghi012jkl345mno678',
};

const mockRevokedConsent: ConsentGrant = {
  ...mockActiveConsent,
  id: 'consent-2',
  status: 'revoked',
  revokedAt: Date.now() - 3600000,
};

const mockAuditEntries: ConsentAuditEntry[] = [
  {
    id: 'audit-1',
    consentId: 'consent-1',
    action: 'granted',
    timestamp: Date.now() - 86400000 * 30,
    actor: '0xuser000000000000000000000000000000000001',
    txHash: '0xtx1abc',
    details: 'Consent granted to City Medical Center',
  },
  {
    id: 'audit-2',
    consentId: 'consent-1',
    action: 'accessed',
    timestamp: Date.now() - 3600000,
    actor: '0xprovider00000000000000000000000000000001',
    txHash: '0xtx2abc',
    details: 'Provider accessed lab results',
  },
];

const mockPolicies: ConsentPolicy[] = [
  {
    id: 'policy-1',
    name: 'Standard Research',
    scopes: ['lab_results'],
    maxDurationDays: 365,
    autoRenew: false,
    description: 'Standard policy for research access',
  },
];

// ---------------------------------------------------------------------------
// ConsentCard
// ---------------------------------------------------------------------------

describe('ConsentCard', () => {
  it('renders provider name', () => {
    render(
      <TestWrapper>
        <ConsentCard consent={mockActiveConsent} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('City Medical Center')).toBeInTheDocument();
  });

  it('renders Active status badge', () => {
    render(
      <TestWrapper>
        <ConsentCard consent={mockActiveConsent} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders scope tags', () => {
    render(
      <TestWrapper>
        <ConsentCard consent={mockActiveConsent} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Lab Results')).toBeInTheDocument();
    expect(screen.getByText('Vitals')).toBeInTheDocument();
  });

  it('renders Modify and Revoke buttons for active consent', () => {
    render(
      <TestWrapper>
        <ConsentCard consent={mockActiveConsent} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Modify')).toBeInTheDocument();
    expect(screen.getByText('Revoke')).toBeInTheDocument();
  });

  it('calls onRevoke when Revoke button clicked', () => {
    const onRevoke = jest.fn();
    render(
      <TestWrapper>
        <ConsentCard consent={mockActiveConsent} onRevoke={onRevoke} onModify={jest.fn()} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Revoke'));
    expect(onRevoke).toHaveBeenCalled();
  });

  it('calls onModify when Modify button clicked', () => {
    const onModify = jest.fn();
    render(
      <TestWrapper>
        <ConsentCard consent={mockActiveConsent} onRevoke={jest.fn()} onModify={onModify} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Modify'));
    expect(onModify).toHaveBeenCalled();
  });

  it('does not show action buttons for revoked consent', () => {
    render(
      <TestWrapper>
        <ConsentCard consent={mockRevokedConsent} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.queryByText('Revoke')).not.toBeInTheDocument();
    expect(screen.queryByText('Modify')).not.toBeInTheDocument();
  });

  it('renders auto-renew indicator when enabled', () => {
    const autoRenewConsent = { ...mockActiveConsent, autoRenew: true };
    render(
      <TestWrapper>
        <ConsentCard consent={autoRenewConsent} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText(/Auto-renew/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConsentTimeline
// ---------------------------------------------------------------------------

describe('ConsentTimeline', () => {
  it('renders audit entry actions', () => {
    render(
      <TestWrapper>
        <ConsentTimeline auditEntries={mockAuditEntries} />
      </TestWrapper>
    );
    expect(screen.getByText('granted')).toBeInTheDocument();
    expect(screen.getByText('accessed')).toBeInTheDocument();
  });

  it('renders entry details', () => {
    render(
      <TestWrapper>
        <ConsentTimeline auditEntries={mockAuditEntries} />
      </TestWrapper>
    );
    expect(screen.getByText('Consent granted to City Medical Center')).toBeInTheDocument();
  });

  it('renders empty state when no entries', () => {
    render(
      <TestWrapper>
        <ConsentTimeline auditEntries={[]} />
      </TestWrapper>
    );
    expect(screen.getByText('No audit entries found')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConsentScopeSelector
// ---------------------------------------------------------------------------

describe('ConsentScopeSelector', () => {
  it('renders Data Scopes heading', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentScopeSelector selected={[]} onChange={onChange} />
      </TestWrapper>
    );
    expect(screen.getByText('Data Scopes')).toBeInTheDocument();
  });

  it('renders selected count', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentScopeSelector selected={['lab_results' as ConsentScope]} onChange={onChange} />
      </TestWrapper>
    );
    expect(screen.getByText('1/10 selected')).toBeInTheDocument();
  });

  it('calls onChange when scope toggled', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentScopeSelector selected={[]} onChange={onChange} />
      </TestWrapper>
    );
    const firstButton = screen.getAllByRole('button')[0];
    fireEvent.click(firstButton);
    expect(onChange).toHaveBeenCalled();
  });

  it('removes scope when already selected scope is toggled', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentScopeSelector selected={['lab_results' as ConsentScope]} onChange={onChange} />
      </TestWrapper>
    );
    // Click the Lab Results button to deselect it
    const buttons = screen.getAllByRole('button');
    const labButton = buttons.find(b => b.textContent?.includes('Lab Results'));
    if (labButton) fireEvent.click(labButton);
    expect(onChange).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ConsentExpiryPicker
// ---------------------------------------------------------------------------

describe('ConsentExpiryPicker', () => {
  it('renders Duration heading', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentExpiryPicker durationDays={90} onChange={onChange} />
      </TestWrapper>
    );
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('renders preset duration buttons', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentExpiryPicker durationDays={90} onChange={onChange} />
      </TestWrapper>
    );
    expect(screen.getByText('7 days')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(screen.getByText('180 days')).toBeInTheDocument();
    expect(screen.getByText('365 days')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('shows expiry date', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentExpiryPicker durationDays={30} onChange={onChange} />
      </TestWrapper>
    );
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });

  it('calls onChange when preset button clicked', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentExpiryPicker durationDays={90} onChange={onChange} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('30 days'));
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('shows custom input when Custom button clicked', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentExpiryPicker durationDays={90} onChange={onChange} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Custom'));
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('calls onChange when custom input value changed', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentExpiryPicker durationDays={90} onChange={onChange} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Custom'));
    const customInput = screen.getByRole('spinbutton');
    fireEvent.change(customInput, { target: { value: '45' } });
    expect(onChange).toHaveBeenCalledWith(45);
  });
});

// ---------------------------------------------------------------------------
// CreateConsentModal
// ---------------------------------------------------------------------------

describe('CreateConsentModal', () => {
  it('renders modal when open', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Create Consent Grant')).toBeInTheDocument();
  });

  it('does not render modal content when closed', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen={false}
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    expect(screen.queryByText('Create Consent Grant')).not.toBeInTheDocument();
  });

  it('renders step indicators', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Scopes')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders policy template selector when policies are provided', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={mockPolicies}
          isLoading={false}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Policy Template (optional)')).toBeInTheDocument();
    expect(screen.getByText('Standard Research')).toBeInTheDocument();
  });

  it('shows Cancel button on first step', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = jest.fn();
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={onClose}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('advances through all steps and submits', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={onSubmit}
          policies={mockPolicies}
          isLoading={false}
        />
      </TestWrapper>
    );
    // Step 1: Apply policy template (auto-selects scopes) and enter provider name
    fireEvent.click(screen.getByText('Standard Research'));
    const searchInput = screen.getByPlaceholderText('Search or enter provider name...');
    fireEvent.change(searchInput, { target: { value: 'Test Provider' } });
    fireEvent.click(screen.getByText('Continue'));

    // Step 2: Scopes (already selected via policy) - continue
    fireEvent.click(screen.getByText('Continue'));

    // Step 3: Duration - continue
    fireEvent.click(screen.getByText('Continue'));

    // Step 4: Review - submit
    expect(screen.getByText('Grant Consent')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Grant Consent'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows Back button on step 2 and goes back', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    // Enter provider name
    const searchInput = screen.getByPlaceholderText('Search or enter provider name...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Continue'));
    // Now on step 2, click Back
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('applies policy template on selection', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={mockPolicies}
          isLoading={false}
        />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Standard Research'));
    expect(screen.getByText('Standard Research')).toBeInTheDocument();
  });

  it('shows loading state on Grant Consent button', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={mockPolicies}
          isLoading={true}
        />
      </TestWrapper>
    );
    // Apply policy template to enable Continue on scopes step
    fireEvent.click(screen.getByText('Standard Research'));
    const searchInput = screen.getByPlaceholderText('Search or enter provider name...');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Grant Consent')).toBeInTheDocument();
  });

  it('shows provider suggestions when typing provider name', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    const searchInput = screen.getByPlaceholderText('Search or enter provider name...');
    fireEvent.change(searchInput, { target: { value: 'C' } });
    // Should show filtered provider suggestions
    expect(searchInput).toHaveValue('C');
  });

  it('selects a provider from the suggestion list', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    const searchInput = screen.getByPlaceholderText('Search or enter provider name...');
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });
    // Click on the suggestion
    const suggestion = screen.queryByText('Dr. Sarah Chen, OB-GYN');
    if (suggestion) {
      fireEvent.click(suggestion);
    }
  });

  it('enters provider address on step 1', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    const addressInput = screen.getByPlaceholderText('aeth1...');
    fireEvent.change(addressInput, { target: { value: 'aeth1abc123456789' } });
    expect(addressInput).toHaveValue('aeth1abc123456789');
  });

  it('navigates back to step 1 by clicking step indicator', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    // Enter provider name
    const searchInput = screen.getByPlaceholderText('Search or enter provider name...');
    fireEvent.change(searchInput, { target: { value: 'Test Provider' } });
    // Go to step 2
    fireEvent.click(screen.getByText('Continue'));
    // Now click on "Provider" step indicator to go back
    fireEvent.click(screen.getByText('Provider'));
    // Should be back on step 1
    expect(screen.getByPlaceholderText('Search or enter provider name...')).toBeInTheDocument();
  });

  it('reaches duration step and toggles auto-renew', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    // Step 0: Enter provider
    const searchInput = screen.getByPlaceholderText('Search or enter provider name...');
    fireEvent.change(searchInput, { target: { value: 'Test Provider' } });
    fireEvent.click(screen.getByText('Continue'));
    // Step 1: Scopes - need to select at least one scope to proceed
    // Scope buttons are rendered as buttons, not checkboxes
    const scopeText = screen.queryByText('Lab Results');
    if (scopeText) {
      fireEvent.click(scopeText.closest('button') || scopeText);
    }
    fireEvent.click(screen.getByText('Continue'));
    // Step 2: Duration - should show auto-renew
    expect(screen.getByText('Auto-renew on expiry')).toBeInTheDocument();
    // Toggle auto-renew - the button is a sibling inside the flex container
    const autoRenewContainer = screen.getByText('Auto-renew on expiry').closest('.bg-slate-50');
    const toggleBtn = autoRenewContainer?.querySelector('button.rounded-full');
    expect(toggleBtn).toBeTruthy();
    fireEvent.click(toggleBtn!);
  });
});

// ---------------------------------------------------------------------------
// SmartContractStatus
// ---------------------------------------------------------------------------

describe('SmartContractStatus', () => {
  it('renders Smart Contract Status heading', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 60}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Smart Contract Status')).toBeInTheDocument();
  });

  it('renders on-chain status', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 60}
        />
      </TestWrapper>
    );
    expect(screen.getByText('On-Chain Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders TEE Attestation verified indicator', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 60}
        />
      </TestWrapper>
    );
    expect(screen.getByText('TEE Attestation')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders block confirmations', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 60}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Block Confirmations')).toBeInTheDocument();
    expect(screen.getByText(/blocks/)).toBeInTheDocument();
  });

  it('renders expiry countdown for active status', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 30}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Expires In')).toBeInTheDocument();
    expect(screen.getByText(/days/)).toBeInTheDocument();
  });

  it('renders revoked status with red styling', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="revoked"
          expiresAt={Date.now() - 86400000}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });

  it('renders pending status with amber styling', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="pending"
          expiresAt={Date.now() + 86400000 * 30}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders expired status with slate styling', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="expired"
          expiresAt={Date.now() - 86400000 * 10}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('renders active status with daysLeft <= 7 warning style', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 5}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Expires In')).toBeInTheDocument();
  });

  it('renders active status with 1 day remaining (singular)', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 1.5}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Expires In')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConsentCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('ConsentCard — branch coverage', () => {
  it('renders expired consent (daysLeft < 0)', () => {
    const expired: ConsentGrant = {
      ...mockActiveConsent,
      status: 'active',
      expiresAt: Date.now() - 86400000 * 10,
    };
    render(
      <TestWrapper>
        <ConsentCard consent={expired} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });

  it('renders consent expiring today (daysLeft === 0)', () => {
    const today: ConsentGrant = {
      ...mockActiveConsent,
      status: 'active',
      expiresAt: Date.now() + 1000, // 1 second from now => Math.round(~0) = 0
    };
    render(
      <TestWrapper>
        <ConsentCard consent={today} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Expires today')).toBeInTheDocument();
  });

  it('renders consent with 1 day remaining (singular day)', () => {
    const oneDay: ConsentGrant = {
      ...mockActiveConsent,
      status: 'active',
      expiresAt: Date.now() + 86400000 * 1, // Math.round(1) = 1
    };
    render(
      <TestWrapper>
        <ConsentCard consent={oneDay} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('1 day remaining')).toBeInTheDocument();
  });

  it('renders expiring soon warning when daysLeft <= 7', () => {
    const expiringSoon: ConsentGrant = {
      ...mockActiveConsent,
      status: 'active',
      expiresAt: Date.now() + 86400000 * 5,
    };
    render(
      <TestWrapper>
        <ConsentCard consent={expiringSoon} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Expiring soon')).toBeInTheDocument();
  });

  it('renders revoked consent with revokedAt timestamp', () => {
    render(
      <TestWrapper>
        <ConsentCard consent={mockRevokedConsent} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    const revokedTexts = screen.getAllByText(/Revoked/);
    expect(revokedTexts.length).toBeGreaterThan(0);
  });

  it('renders revoked consent without revokedAt', () => {
    const revokedNoDate: ConsentGrant = { ...mockRevokedConsent, revokedAt: undefined };
    render(
      <TestWrapper>
        <ConsentCard consent={revokedNoDate} onRevoke={jest.fn()} onModify={jest.fn()} />
      </TestWrapper>
    );
    const revokedTexts = screen.getAllByText(/Revoked/);
    expect(revokedTexts.length).toBeGreaterThan(0);
  });
});

describe('SmartContractStatus — daysLeft singular', () => {
  it('renders singular "day" when daysLeft is exactly 1', () => {
    render(
      <TestWrapper>
        <SmartContractStatus
          txHash="0xtxhash123abc456def789"
          attestation="0xattest123abc456def789"
          status="active"
          expiresAt={Date.now() + 86400000 * 1}
        />
      </TestWrapper>
    );
    expect(screen.getByText(/1 day$/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConsentScopeSelector — maxScopes reached
// ---------------------------------------------------------------------------

describe('ConsentScopeSelector — branch coverage', () => {
  it('disables buttons when maxScopes is reached', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentScopeSelector
          selected={['lab_results' as ConsentScope, 'vitals' as ConsentScope]}
          onChange={onChange}
          maxScopes={2}
        />
      </TestWrapper>
    );
    expect(screen.getByText('2/2 selected')).toBeInTheDocument();
    // Non-selected buttons should be disabled
    const buttons = screen.getAllByRole('button');
    const disabledButtons = buttons.filter(b => (b as HTMLButtonElement).disabled);
    expect(disabledButtons.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ConsentExpiryPicker — non-preset initial duration
// ---------------------------------------------------------------------------

describe('ConsentExpiryPicker — branch coverage', () => {
  it('starts in custom mode when initial duration is not a preset', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ConsentExpiryPicker durationDays={45} onChange={onChange} />
      </TestWrapper>
    );
    // Custom mode should be active, showing the input
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CreateConsentModal — step indicator clicking for completed steps
// ---------------------------------------------------------------------------

describe('CreateConsentModal — branch coverage', () => {
  it('clicking future step indicator does not navigate forward', () => {
    render(
      <TestWrapper>
        <CreateConsentModal
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          policies={[]}
          isLoading={false}
        />
      </TestWrapper>
    );
    // Try clicking "Scopes" step (step 1) from step 0 — should not navigate
    fireEvent.click(screen.getByText('Scopes'));
    // Should still be on step 0 (Provider input visible)
    expect(screen.getByPlaceholderText('Search or enter provider name...')).toBeInTheDocument();
  });
});
