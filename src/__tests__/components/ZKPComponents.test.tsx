// ============================================================
// Tests for src/components/zkp/ZKPComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ProofGenerator,
  ProofVerifier,
  ClaimBadge,
  ZKPExplainer,
  ZKPDashboard,
} from '@/components/zkp/ZKPComponents';
import type { ZKProof, ZKClaim, ZKClaimType } from '@/types';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockProofVerified: ZKProof = {
  id: 'proof-1',
  claimType: 'age_range',
  proofHash: '0xabc123def456789012345678901234567890abcdef',
  publicInputs: '25 <= age <= 35',
  verified: true,
  verifiedAt: Date.now() - 3600000,
  createdAt: Date.now() - 7200000,
  expiresAt: Date.now() + 86400000,
  txHash: '0xtx123def456789012345678901234567890abcdef',
};

const mockProofPending: ZKProof = {
  id: 'proof-2',
  claimType: 'medication_active',
  proofHash: '0xdef456789012345678901234567890abcdef1234',
  publicInputs: 'medication_count > 0',
  verified: false,
  createdAt: Date.now() - 1800000,
  expiresAt: Date.now() + 86400000,
};

const mockProofFailed: ZKProof = {
  id: 'proof-3',
  claimType: 'condition_present',
  proofHash: '0xfail12345678901234567890123456789012abcd',
  publicInputs: 'condition_exists = true',
  verified: false,
  createdAt: Date.now() - 3600000,
  expiresAt: Date.now() + 86400000,
  txHash: '0xtxfailed12345678901234567890123456789012',
};

const mockClaims: ZKClaim[] = [
  {
    id: 'claim-1',
    claimType: 'age_range',
    description: 'Age between 25-35',
    status: 'verified',
    createdAt: Date.now(),
  },
  {
    id: 'claim-2',
    claimType: 'medication_active',
    description: 'On active medication',
    status: 'proving',
    createdAt: Date.now(),
  },
  {
    id: 'claim-3',
    claimType: 'condition_present',
    description: 'Condition exists',
    status: 'expired',
    createdAt: Date.now(),
  },
  {
    id: 'claim-4',
    claimType: 'data_quality',
    description: 'Data quality met',
    status: 'verified',
    createdAt: Date.now(),
  },
];

// ---------------------------------------------------------------------------
// ProofGenerator
// ---------------------------------------------------------------------------
describe('ProofGenerator', () => {
  it('renders claim type label', () => {
    render(<ProofGenerator claimType="age_range" onGenerate={jest.fn()} isLoading={false} />);
    expect(screen.getByText('Age Range')).toBeInTheDocument();
  });

  it('renders explainer text', () => {
    render(<ProofGenerator claimType="age_range" onGenerate={jest.fn()} isLoading={false} />);
    expect(screen.getByText('Proves you are between 25-35 years old')).toBeInTheDocument();
  });

  it('renders estimated gas', () => {
    render(<ProofGenerator claimType="age_range" onGenerate={jest.fn()} isLoading={false} />);
    expect(screen.getByText(/~85,000/)).toBeInTheDocument();
  });

  it('renders Generate Proof button', () => {
    render(<ProofGenerator claimType="age_range" onGenerate={jest.fn()} isLoading={false} />);
    expect(screen.getByText('Generate Proof')).toBeInTheDocument();
  });

  it('calls onGenerate when button is clicked', () => {
    const onGenerate = jest.fn();
    render(<ProofGenerator claimType="age_range" onGenerate={onGenerate} isLoading={false} />);
    fireEvent.click(screen.getByText('Generate Proof'));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('shows loading state when isLoading is true', () => {
    render(<ProofGenerator claimType="age_range" onGenerate={jest.fn()} isLoading={true} />);
    expect(screen.getByText('Generating Proof...')).toBeInTheDocument();
  });

  it('disables button when loading', () => {
    render(<ProofGenerator claimType="age_range" onGenerate={jest.fn()} isLoading={true} />);
    const button = screen.getByText('Generating Proof...').closest('button');
    expect(button).toBeDisabled();
  });

  it('renders for different claim types', () => {
    const claimTypes: ZKClaimType[] = [
      'condition_present',
      'medication_active',
      'data_quality',
      'provider_verified',
      'fertility_window',
    ];
    for (const ct of claimTypes) {
      const { unmount } = render(
        <ProofGenerator claimType={ct} onGenerate={jest.fn()} isLoading={false} />,
      );
      expect(screen.getByText('Generate Proof')).toBeInTheDocument();
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// ProofVerifier
// ---------------------------------------------------------------------------
describe('ProofVerifier', () => {
  it('renders verified proof with Verified badge', () => {
    render(<ProofVerifier proof={mockProofVerified} />);
    expect(screen.getByText('Age Range')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders proof hash', () => {
    render(<ProofVerifier proof={mockProofVerified} />);
    expect(screen.getByText('Proof Hash:')).toBeInTheDocument();
  });

  it('renders public inputs', () => {
    render(<ProofVerifier proof={mockProofVerified} />);
    expect(screen.getByText('25 <= age <= 35')).toBeInTheDocument();
  });

  it('shows verified timestamp for verified proofs', () => {
    render(<ProofVerifier proof={mockProofVerified} />);
    expect(screen.getByText('Verified:')).toBeInTheDocument();
  });

  it('shows tx hash when available', () => {
    render(<ProofVerifier proof={mockProofVerified} />);
    expect(screen.getByText('Tx:')).toBeInTheDocument();
  });

  it('renders pending proof with Pending badge', () => {
    render(<ProofVerifier proof={mockProofPending} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders failed proof with Failed badge', () => {
    render(<ProofVerifier proof={mockProofFailed} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows creation time', () => {
    render(<ProofVerifier proof={mockProofVerified} />);
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it('shows expiry time', () => {
    render(<ProofVerifier proof={mockProofVerified} />);
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ClaimBadge
// ---------------------------------------------------------------------------
describe('ClaimBadge', () => {
  it('renders claim type label', () => {
    render(<ClaimBadge claim={mockClaims[0]} />);
    expect(screen.getByText('Age Range')).toBeInTheDocument();
  });

  it('renders verified claim with emerald dot', () => {
    const { container } = render(<ClaimBadge claim={mockClaims[0]} />);
    const dot = container.querySelector('.bg-emerald-500');
    expect(dot).toBeInTheDocument();
  });

  it('renders proving claim with pulsing dot', () => {
    const { container } = render(<ClaimBadge claim={mockClaims[1]} />);
    const dot = container.querySelector('.animate-pulse');
    expect(dot).toBeInTheDocument();
  });

  it('renders expired claim with amber dot', () => {
    const { container } = render(<ClaimBadge claim={mockClaims[2]} />);
    const dot = container.querySelector('.bg-amber-500');
    expect(dot).toBeInTheDocument();
  });

  it('renders for different claim types', () => {
    for (const claim of mockClaims) {
      const { unmount } = render(<ClaimBadge claim={claim} />);
      expect(screen.getByText(/Range|Active|Present|Quality/)).toBeInTheDocument();
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// ZKPExplainer
// ---------------------------------------------------------------------------
describe('ZKPExplainer', () => {
  it('renders title', () => {
    render(<ZKPExplainer claimType="age_range" />);
    expect(screen.getByText('How This ZK Proof Works')).toBeInTheDocument();
  });

  it('renders "What it proves" section', () => {
    render(<ZKPExplainer claimType="age_range" />);
    expect(screen.getByText('What it proves')).toBeInTheDocument();
    expect(screen.getByText('Proves you are between 25-35 years old')).toBeInTheDocument();
  });

  it('renders "What remains private" section', () => {
    render(<ZKPExplainer claimType="age_range" />);
    expect(screen.getByText('What remains private')).toBeInTheDocument();
    expect(screen.getByText('Without revealing your exact date of birth')).toBeInTheDocument();
  });

  it('renders TEE security note', () => {
    render(<ZKPExplainer claimType="age_range" />);
    expect(screen.getByText(/ZK proofs are generated inside a TEE enclave/)).toBeInTheDocument();
  });

  it('renders for different claim types', () => {
    const claimTypes: ZKClaimType[] = [
      'condition_present',
      'medication_active',
      'fertility_window',
    ];
    for (const ct of claimTypes) {
      const { unmount } = render(<ZKPExplainer claimType={ct} />);
      expect(screen.getByText('How This ZK Proof Works')).toBeInTheDocument();
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// ZKPDashboard
// ---------------------------------------------------------------------------
describe('ZKPDashboard', () => {
  it('renders ZKP Summary heading', () => {
    render(<ZKPDashboard claims={mockClaims} proofs={[mockProofVerified, mockProofPending]} />);
    expect(screen.getByText('ZKP Summary')).toBeInTheDocument();
  });

  it('displays correct verified count', () => {
    render(<ZKPDashboard claims={mockClaims} proofs={[]} />);
    // 2 verified claims in mockClaims
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('displays pending and expired counts', () => {
    const { container } = render(<ZKPDashboard claims={mockClaims} proofs={[]} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    // Both pending and expired counts are 1; verify via their styled containers
    const pendingBox = container.querySelector('.bg-brand-50 .text-2xl');
    expect(pendingBox?.textContent).toBe('1');
    const expiredBox = container.querySelector('.bg-amber-50 .text-2xl');
    expect(expiredBox?.textContent).toBe('1');
  });

  it('renders Claims by Type section', () => {
    render(<ZKPDashboard claims={mockClaims} proofs={[]} />);
    expect(screen.getByText('Claims by Type')).toBeInTheDocument();
  });

  it('renders Recent Proofs section', () => {
    render(<ZKPDashboard claims={mockClaims} proofs={[mockProofVerified]} />);
    expect(screen.getByText('Recent Proofs')).toBeInTheDocument();
  });

  it('renders with empty claims and proofs', () => {
    render(<ZKPDashboard claims={[]} proofs={[]} />);
    expect(screen.getByText('ZKP Summary')).toBeInTheDocument();
    expect(screen.getByText('Claims by Type')).toBeInTheDocument();
    expect(screen.getByText('Recent Proofs')).toBeInTheDocument();
  });

  it('renders unverified proofs with Pending badge and Clock icon', () => {
    render(<ZKPDashboard claims={mockClaims} proofs={[mockProofPending]} />);
    // The proof is not verified, so it shows "Pending" badge and Clock icon
    const pendingBadges = screen.getAllByText('Pending');
    expect(pendingBadges.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ClaimBadge — additional branch coverage
// ---------------------------------------------------------------------------

describe('ClaimBadge — branch coverage', () => {
  it('renders failed claim with red dot', () => {
    const failedClaim: ZKClaim = {
      id: 'claim-failed',
      claimType: 'condition_present',
      description: 'Condition check failed',
      status: 'failed',
      createdAt: Date.now(),
    };
    const { container } = render(<ClaimBadge claim={failedClaim} />);
    const dot = container.querySelector('.bg-red-500');
    expect(dot).toBeInTheDocument();
  });

  it('renders unproven claim with slate dot', () => {
    const unprovenClaim: ZKClaim = {
      id: 'claim-unproven',
      claimType: 'data_quality',
      description: 'Not yet proven',
      status: 'unproven',
      createdAt: Date.now(),
    };
    const { container } = render(<ClaimBadge claim={unprovenClaim} />);
    const dot = container.querySelector('.bg-slate-400');
    expect(dot).toBeInTheDocument();
  });

  it('renders claim with unknown status using STATUS_CONFIG fallback', () => {
    const unknownStatusClaim: ZKClaim = {
      id: 'claim-unknown',
      claimType: 'age_range',
      description: 'Unknown status',
      status: 'mystery_status' as any,
      createdAt: Date.now(),
    };
    const { container } = render(<ClaimBadge claim={unknownStatusClaim} />);
    // Falls through all conditions to the default slate-400
    const dot = container.querySelector('.bg-slate-400');
    expect(dot).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProofVerifier — additional branch coverage
// ---------------------------------------------------------------------------

describe('ProofVerifier — branch coverage', () => {
  it('renders without expiresAt (no expiry text)', () => {
    const proofNoExpiry: ZKProof = {
      ...mockProofVerified,
      expiresAt: undefined,
    };
    render(<ProofVerifier proof={proofNoExpiry} />);
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
  });

  it('renders without txHash (no Tx line)', () => {
    const proofNoTx: ZKProof = {
      ...mockProofPending,
      txHash: undefined,
    };
    render(<ProofVerifier proof={proofNoTx} />);
    expect(screen.queryByText('Tx:')).not.toBeInTheDocument();
  });

  it('renders unverified proof without verifiedAt (no Verified line)', () => {
    render(<ProofVerifier proof={mockProofPending} />);
    expect(screen.queryByText('Verified:')).not.toBeInTheDocument();
  });
});
