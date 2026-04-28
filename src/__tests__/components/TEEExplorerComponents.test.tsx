// ============================================================
// Tests for src/components/tee/TEEExplorerComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  AttestationRow,
  ComputeJobRow,
  EnclaveCard,
  VerificationPipeline,
  RecentVerificationChains,
  PlatformDistribution,
} from '@/components/tee/TEEExplorerComponents';
import type { TEEVerificationChain, TEEComputeJob, TEEEnclaveInfo } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockAttestation: TEEVerificationChain = {
  id: 'att-1',
  attestationHash: '0xabc123def456abc123def456abc123def456abc1abc123def456abc123def456ab',
  measurementHash: '0xdef789abc012def789abc012def789abc012def7def789abc012def789abc012de',
  inputHash: '0x111222333444555666777888999000aaabbbccc111222333444555666777888999',
  outputHash: '0xaaabbbccc111222333444555666777888999000aaabbbccc111222333444555666',
  nonce: '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0',
  pcrValues: ['0xpcr0abc123', '0xpcr1def456', '0xpcr2ghi789'],
  signature: '0xsig123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  txHash: '0xtx123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0',
  platform: 'Intel SGX',
  modelId: 'cycle-lstm-v3',
  verifiedOnChain: true,
  blockHeight: 1234567,
  timestamp: Date.now() - 3600000,
};

const mockComputeJob: TEEComputeJob = {
  id: 'job-001',
  modelName: 'Anomaly Detector v2',
  enclaveId: 'enc-sgx-01',
  status: 'completed',
  executionTimeMs: 1250,
  gasCost: 0.0042,
  priority: 'high',
};

const mockEnclave: TEEEnclaveInfo = {
  id: 'enc-sgx-01',
  platform: 'Intel SGX',
  status: 'operational',
  firmwareVersion: 'v2.18.0',
  region: 'us-east-1',
  uptime: 99.7,
  jobsProcessed: 15420,
  trustScore: 97.2,
  lastAttestationAt: Date.now() - 600000,
};

// ---------------------------------------------------------------------------
// AttestationRow
// ---------------------------------------------------------------------------

describe('AttestationRow', () => {
  it('renders platform and model ID', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <AttestationRow attestation={mockAttestation} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Intel SGX')).toBeInTheDocument();
    expect(screen.getByText('cycle-lstm-v3')).toBeInTheDocument();
  });

  it('renders verified badge', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <AttestationRow attestation={mockAttestation} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders pending badge for unverified attestation', () => {
    const unverified = { ...mockAttestation, verifiedOnChain: false };
    render(
      <TestWrapper>
        <table>
          <tbody>
            <AttestationRow attestation={unverified} index={1} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('expands and collapses on row click', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <AttestationRow attestation={mockAttestation} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );

    // Initially collapsed
    expect(screen.queryByText('Measurement Hash')).not.toBeInTheDocument();

    // Click row to expand
    const row = screen.getByText('cycle-lstm-v3').closest('tr')!;
    fireEvent.click(row);

    // Now details should be visible
    expect(screen.getByText('Measurement Hash')).toBeInTheDocument();
    expect(screen.getByText('Input Hash')).toBeInTheDocument();
    expect(screen.getByText('Output Hash')).toBeInTheDocument();
    expect(screen.getByText('Nonce')).toBeInTheDocument();
    expect(screen.getByText('PCR Values')).toBeInTheDocument();
    expect(screen.getByText('Signature')).toBeInTheDocument();
    expect(screen.getByText('PCR[0]:')).toBeInTheDocument();
    expect(screen.getByText('PCR[1]:')).toBeInTheDocument();
    expect(screen.getByText('PCR[2]:')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(row);
    expect(screen.queryByText('Measurement Hash')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ComputeJobRow
// ---------------------------------------------------------------------------

describe('ComputeJobRow', () => {
  it('renders job details', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ComputeJobRow job={mockComputeJob} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('job-001')).toBeInTheDocument();
    expect(screen.getByText('Anomaly Detector v2')).toBeInTheDocument();
    expect(screen.getByText('1.25s')).toBeInTheDocument();
    expect(screen.getByText('0.0042 AETH')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EnclaveCard
// ---------------------------------------------------------------------------

describe('EnclaveCard', () => {
  it('renders enclave ID and platform', () => {
    render(
      <TestWrapper>
        <EnclaveCard enclave={mockEnclave} />
      </TestWrapper>,
    );
    expect(screen.getByText('enc-sgx-01')).toBeInTheDocument();
    expect(screen.getByText('Intel SGX')).toBeInTheDocument();
  });

  it('renders status', () => {
    render(
      <TestWrapper>
        <EnclaveCard enclave={mockEnclave} />
      </TestWrapper>,
    );
    expect(screen.getByText('Operational')).toBeInTheDocument();
  });

  it('renders stats', () => {
    render(
      <TestWrapper>
        <EnclaveCard enclave={mockEnclave} />
      </TestWrapper>,
    );
    expect(screen.getByText('v2.18.0')).toBeInTheDocument();
    expect(screen.getByText('us-east-1')).toBeInTheDocument();
    expect(screen.getByText('99.7%')).toBeInTheDocument();
    expect(screen.getByText('97.2/100')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// VerificationPipeline
// ---------------------------------------------------------------------------

describe('VerificationPipeline', () => {
  it('renders pipeline steps', () => {
    render(
      <TestWrapper>
        <VerificationPipeline seed={42} />
      </TestWrapper>,
    );
    // Mobile and desktop both render these labels
    expect(screen.getAllByText('Request Submitted').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('On-chain Anchor').length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// RecentVerificationChains
// ---------------------------------------------------------------------------

describe('RecentVerificationChains', () => {
  it('renders attestation entries', () => {
    render(
      <TestWrapper>
        <RecentVerificationChains attestations={[mockAttestation]} />
      </TestWrapper>,
    );
    expect(screen.getByText('att-1')).toBeInTheDocument();
    expect(screen.getByText('Anchored')).toBeInTheDocument();
  });

  it('renders empty state when no attestations', () => {
    render(
      <TestWrapper>
        <RecentVerificationChains attestations={[]} />
      </TestWrapper>,
    );
    expect(screen.getByText('No recent verification chains')).toBeInTheDocument();
  });

  it('expands and collapses a chain entry when clicked', () => {
    render(
      <TestWrapper>
        <RecentVerificationChains attestations={[mockAttestation]} />
      </TestWrapper>,
    );
    // Initially collapsed — no detailed hashes visible
    expect(screen.queryByText('Attestation Hash')).not.toBeInTheDocument();

    // Click the button to expand
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Now details should be visible
    expect(screen.getByText('Attestation Hash')).toBeInTheDocument();
    expect(screen.getByText('Measurement Hash')).toBeInTheDocument();
    expect(screen.getByText('Input Hash')).toBeInTheDocument();
    expect(screen.getByText('Output Hash')).toBeInTheDocument();
    expect(screen.getByText('Nonce')).toBeInTheDocument();
    expect(screen.getByText('Signature')).toBeInTheDocument();
    expect(screen.getByText('Transaction')).toBeInTheDocument();
    // PCR values
    expect(screen.getByText('PCR Values')).toBeInTheDocument();
    expect(screen.getByText('PCR[0]:')).toBeInTheDocument();
    // Mini pipeline
    expect(screen.getByText('Request')).toBeInTheDocument();
    expect(screen.getByText('On-chain')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(button);
    expect(screen.queryByText('Attestation Hash')).not.toBeInTheDocument();
  });

  it('renders pending badge for unverified attestation', () => {
    const unverified = { ...mockAttestation, id: 'att-2', verifiedOnChain: false };
    render(
      <TestWrapper>
        <RecentVerificationChains attestations={[unverified]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('only expands one entry at a time', () => {
    const att2 = { ...mockAttestation, id: 'att-2', attestationHash: '0x222abc' };
    render(
      <TestWrapper>
        <RecentVerificationChains attestations={[mockAttestation, att2]} />
      </TestWrapper>,
    );
    const buttons = screen.getAllByRole('button');
    // Expand first
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Attestation Hash')).toBeInTheDocument();

    // Expand second - first should collapse (expandedId changes)
    fireEvent.click(buttons[1]);
    // The details section should still exist (for the second entry)
    expect(screen.getByText('Attestation Hash')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PlatformDistribution
// ---------------------------------------------------------------------------

describe('EnclaveCard edge cases', () => {
  it('renders degraded status', () => {
    const degraded = { ...mockEnclave, status: 'degraded' as const };
    render(
      <TestWrapper>
        <EnclaveCard enclave={degraded} />
      </TestWrapper>,
    );
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('renders offline status', () => {
    const offline = { ...mockEnclave, status: 'offline' as const };
    render(
      <TestWrapper>
        <EnclaveCard enclave={offline} />
      </TestWrapper>,
    );
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders unknown status with default styling', () => {
    const unknown = { ...mockEnclave, status: 'maintenance' as any };
    render(
      <TestWrapper>
        <EnclaveCard enclave={unknown} />
      </TestWrapper>,
    );
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });

  it('renders low trust score (below 90)', () => {
    const lowTrust = { ...mockEnclave, trustScore: 85.0 };
    render(
      <TestWrapper>
        <EnclaveCard enclave={lowTrust} />
      </TestWrapper>,
    );
    expect(screen.getByText('85.0/100')).toBeInTheDocument();
  });

  it('renders very low trust score (below 90)', () => {
    const veryLow = { ...mockEnclave, trustScore: 70.0 };
    render(
      <TestWrapper>
        <EnclaveCard enclave={veryLow} />
      </TestWrapper>,
    );
    expect(screen.getByText('70.0/100')).toBeInTheDocument();
  });

  it('renders AMD SEV platform', () => {
    const amd = { ...mockEnclave, platform: 'AMD SEV' as const };
    render(
      <TestWrapper>
        <EnclaveCard enclave={amd} />
      </TestWrapper>,
    );
    expect(screen.getByText('AMD SEV')).toBeInTheDocument();
  });

  it('renders AWS Nitro platform', () => {
    const nitro = { ...mockEnclave, platform: 'AWS Nitro' as const };
    render(
      <TestWrapper>
        <EnclaveCard enclave={nitro} />
      </TestWrapper>,
    );
    expect(screen.getByText('AWS Nitro')).toBeInTheDocument();
  });

  it('renders unknown platform with default icon', () => {
    const unknown = { ...mockEnclave, platform: 'Unknown Platform' as any };
    render(
      <TestWrapper>
        <EnclaveCard enclave={unknown} />
      </TestWrapper>,
    );
    expect(screen.getByText('Unknown Platform')).toBeInTheDocument();
  });

  it('renders trust score above 95 with green', () => {
    const high = { ...mockEnclave, trustScore: 96.0 };
    render(
      <TestWrapper>
        <EnclaveCard enclave={high} />
      </TestWrapper>,
    );
    expect(screen.getByText('96.0/100')).toBeInTheDocument();
  });

  it('renders trust score between 90-95 with brand color', () => {
    const mid = { ...mockEnclave, trustScore: 92.0 };
    render(
      <TestWrapper>
        <EnclaveCard enclave={mid} />
      </TestWrapper>,
    );
    expect(screen.getByText('92.0/100')).toBeInTheDocument();
  });
});

describe('ComputeJobRow edge cases', () => {
  it('renders job with sub-second execution time', () => {
    const fastJob = { ...mockComputeJob, executionTimeMs: 500 };
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ComputeJobRow job={fastJob} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('500ms')).toBeInTheDocument();
  });

  it('renders job with odd index for alternating row colors', () => {
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ComputeJobRow job={mockComputeJob} index={1} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('job-001')).toBeInTheDocument();
  });

  it('renders unknown status with neutral variant', () => {
    const unknownStatus = { ...mockComputeJob, status: 'unknown' as any };
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ComputeJobRow job={unknownStatus} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders unknown priority with neutral variant', () => {
    const unknownPriority = { ...mockComputeJob, priority: 'urgent' as any };
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ComputeJobRow job={unknownPriority} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('renders cancelled status', () => {
    const cancelled = { ...mockComputeJob, status: 'cancelled' as any };
    render(
      <TestWrapper>
        <table>
          <tbody>
            <ComputeJobRow job={cancelled} index={0} />
          </tbody>
        </table>
      </TestWrapper>,
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});

describe('PlatformDistribution', () => {
  it('renders platform names and counts', () => {
    render(
      <TestWrapper>
        <PlatformDistribution
          data={[
            { platform: 'Intel SGX', count: 120, percentage: 60 },
            { platform: 'AWS Nitro', count: 80, percentage: 40 },
          ]}
          colors={['#3b82f6', '#f97316']}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Intel SGX')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('AWS Nitro')).toBeInTheDocument();
  });

  it('renders unknown platform with default icon and fallback color', () => {
    render(
      <TestWrapper>
        <PlatformDistribution
          data={[{ platform: 'Unknown TEE' as any, count: 10, percentage: 100 }]}
          colors={[]}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Unknown TEE')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
