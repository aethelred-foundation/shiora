// ============================================================
// Tests for src/app/vault/page.tsx
// ============================================================

// The vault page reads all of its encrypted data — compartments, cycle
// entries, symptoms, fertility markers, privacy score — from the real
// /api/vault/* APIs via useReproductiveVault. Mock the hook here so the page
// renders deterministic, varied data (locked + unlocked + partial
// compartments; every cycle phase; multiple marker types/sources) and
// exercises its frequency/trend/storage derivations at full coverage. The
// live fetch + mutations are covered by the hook's own MSW-backed test.
const mockLogSymptom = { mutate: jest.fn(), isLoading: false };
const mockLockCompartment = { mutate: jest.fn(), isLoading: false };
const mockUnlockCompartment = { mutate: jest.fn(), isLoading: false };

const mockVaultSymptoms = [
  {
    id: 's1',
    date: Date.now() - 2 * 86400000,
    category: 'pain',
    symptom: 'Cramps',
    severity: 3,
    notes: '',
    tags: [],
  },
  {
    id: 's2',
    date: Date.now() - 5 * 86400000,
    category: 'mood',
    symptom: 'Anxiety',
    severity: 2,
    notes: '',
    tags: [],
  },
  {
    id: 's3',
    date: Date.now() - 100 * 86400000,
    category: 'pain',
    symptom: 'Headache',
    severity: 1,
    notes: '',
    tags: [],
  },
];

// Build one compartment per real vault category (labels like 'Fertility Data'
// and storage-breakdown colours align by index with VAULT_CATEGORIES), cycling
// locked/unlocked/partial and empty/non-empty access lists for full branch
// coverage of the compartment cards.
const { VAULT_CATEGORIES } = jest.requireActual('@/lib/constants') as {
  VAULT_CATEGORIES: Array<{ id: string; label: string }>;
};
const mockLockStatuses = ['locked', 'unlocked', 'partial'];
const mockCompartments = VAULT_CATEGORIES.map((cat, i) => ({
  id: `vault-${i}`,
  category: cat.id,
  label: cat.label,
  description: `Encrypted ${cat.label.toLowerCase()} compartment`,
  lockStatus: mockLockStatuses[i % 3],
  recordCount: 5 + i * 3,
  storageUsed: (50 + i * 100) * 1024,
  lastAccessed: Date.now() - (i + 1) * 3600000,
  encryptionKey: `0xkey${i}`,
  accessList: i % 2 === 0 ? ['Dr. Sarah Chen, OB-GYN'] : [],
  jurisdictionFlags: i % 2 === 0 ? ['us-ca', 'eu-gdpr'] : [],
  createdAt: Date.now() - (i + 1) * 50 * 86400000,
}));

const mockCyclePhases = ['menstrual', 'follicular', 'ovulation', 'luteal'];
const mockCycleEntries = Array.from({ length: 28 }, (_, i) => ({
  id: `cy${i}`,
  date: Date.now() - (28 - i) * 86400000,
  day: i + 1,
  phase: mockCyclePhases[Math.min(3, Math.floor(i / 7))],
  temperature: 97.2 + (i % 5) * 0.1,
  flow: i < 2 ? 'heavy' : i < 4 ? 'medium' : i < 5 ? 'light' : 'none',
  symptoms: [],
  fertilityScore: 20 + i,
  notes: '',
}));

const mockFertilityMarkers = [
  {
    id: 'f1',
    date: Date.now() - 2 * 86400000,
    type: 'lh_surge',
    value: 45.2,
    confidence: 92.1,
    source: 'manual',
    attestation: '0xatt1',
  },
  {
    id: 'f2',
    date: Date.now() - 10 * 86400000,
    type: 'bbt_shift',
    value: 30.0,
    confidence: 80.5,
    source: 'wearable',
    attestation: '0xatt2',
  },
  {
    id: 'f3',
    date: Date.now() - 20 * 86400000,
    type: 'ovulation_confirmed',
    value: 88.0,
    confidence: 95.0,
    source: 'ai_predicted',
    attestation: '0xatt3',
  },
];

const mockPrivacyScore = {
  overall: 87,
  encryptionScore: 95,
  accessControlScore: 82,
  jurisdictionScore: 85,
  dataMinimizationScore: 78,
};

jest.mock('@/hooks/useReproductiveVault', () => ({
  useReproductiveVault: () => ({
    compartments: mockCompartments,
    cycleEntries: mockCycleEntries,
    symptoms: mockVaultSymptoms,
    fertilityMarkers: mockFertilityMarkers,
    privacyScore: mockPrivacyScore,
    isLoading: false,
    error: null,
    logSymptom: mockLogSymptom,
    lockCompartment: mockLockCompartment,
    unlockCompartment: mockUnlockCompartment,
    currentCycleDay: 25,
    currentPhase: 'luteal',
    nextPeriodDate: Date.now() + 14 * 86400000,
    fertileWindowStart: Date.now() + 1 * 86400000,
    fertileWindowEnd: Date.now() + 5 * 86400000,
    averageCycleLength: 28,
    refetch: jest.fn(),
  }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import VaultPage from '@/app/vault/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('VaultPage', () => {
  it('renders the vault page title', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Reproductive Data Vault')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    expect(screen.getByText(/Sovereign, encrypted reproductive health data/)).toBeInTheDocument();
  });

  it('renders all tabs', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    // Use role=tab to target only the tab buttons
    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map((t) => t.textContent);
    expect(tabLabels).toContain('Overview');
    expect(tabLabels).toContain('Cycle Tracking');
    expect(tabLabels).toContain('Symptoms');
    expect(tabLabels).toContain('Fertility');
    expect(tabLabels).toContain('Compartments');
    expect(tabLabels).toContain('Privacy');
  });

  it('renders compartment cards on overview tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Data Compartments')).toBeInTheDocument();
    // Compartment labels appear (may have duplicates with tabs)
    expect(screen.getAllByText('Cycle Tracking').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fertility Data').length).toBeGreaterThanOrEqual(1);
  });

  it('renders privacy score badge', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    expect(screen.getByText(/Privacy Score: 87/)).toBeInTheDocument();
  });

  it('renders stat cards on overview', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Total Compartments')).toBeInTheDocument();
    // "Locked" appears multiple times (stat card + lock status badges), use getAllByText
    expect(screen.getAllByText('Locked').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getByText('Total Storage')).toBeInTheDocument();
  });

  it('switches to Cycle Tracking tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    // Find tab by role
    const tabs = screen.getAllByRole('tab');
    const cycleTab = tabs.find((t) => t.textContent === 'Cycle Tracking');
    expect(cycleTab).toBeDefined();
    fireEvent.click(cycleTab!);
    expect(screen.getByText('Cycle Calendar')).toBeInTheDocument();
    expect(screen.getByText('Current Day')).toBeInTheDocument();
  });

  it('switches to Privacy tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const privacyTab = tabs.find((t) => t.textContent === 'Privacy');
    expect(privacyTab).toBeDefined();
    fireEvent.click(privacyTab!);
    // "Privacy Score" may appear in header badge + section, use getAllByText
    expect(screen.getAllByText('Privacy Score').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Jurisdiction Protections')).toBeInTheDocument();
  });

  it('switches to Compartments tab and shows controls', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const compartmentsTab = tabs.find((t) => t.textContent === 'Compartments');
    expect(compartmentsTab).toBeDefined();
    fireEvent.click(compartmentsTab!);
    expect(screen.getByText('Lock All')).toBeInTheDocument();
    expect(screen.getByText('Unlock All')).toBeInTheDocument();
  });

  it('switches to Symptoms tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const symptomsTab = tabs.find((t) => t.textContent === 'Symptoms');
    expect(symptomsTab).toBeDefined();
    fireEvent.click(symptomsTab!);
    expect(screen.getByText('Log Symptoms')).toBeInTheDocument();
    expect(screen.getByText('Symptom Frequency')).toBeInTheDocument();
  });

  it('switches to Fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    expect(fertilityTab).toBeDefined();
    fireEvent.click(fertilityTab!);
    expect(screen.getByText('Fertility Overview')).toBeInTheDocument();
    expect(screen.getByText('Fertility Markers')).toBeInTheDocument();
  });

  it('renders recent activity on overview', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders locked/total badge', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    expect(screen.getByText(/\d+\/\d+ Locked/)).toBeInTheDocument();
  });

  // --- Fertility tab details ---

  it('renders verified estimates on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    fireEvent.click(fertilityTab!);
    expect(screen.getByText('Verified Estimates')).toBeInTheDocument();
    expect(screen.getByText('Next Period')).toBeInTheDocument();
    expect(screen.getByText('Cycle Regularity')).toBeInTheDocument();
    expect(screen.getByText('Hormone Balance')).toBeInTheDocument();
  });

  it('renders fertility markers on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    fireEvent.click(fertilityTab!);
    expect(screen.getByText('Fertility Markers')).toBeInTheDocument();
    // Marker labels should appear
    expect(
      screen.getAllByText(/LH Surge|BBT Shift|Cervical Mucus|Ovulation Confirmed/).length,
    ).toBeGreaterThan(0);
    // Source labels should appear
    expect(
      screen.getAllByText(/Manual Entry|Workload Estimated|Wearable Device/).length,
    ).toBeGreaterThan(0);
  });

  it('renders hormone level chart on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    fireEvent.click(fertilityTab!);
    expect(screen.getByText('Hormone Levels')).toBeInTheDocument();
    expect(screen.getByText('Estimated hormone levels through the cycle')).toBeInTheDocument();
  });

  it('renders estimate confidence badges with correct variants on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    fireEvent.click(fertilityTab!);
    // Check for confidence percentages in badges
    expect(screen.getByText('94% confidence')).toBeInTheDocument();
    expect(screen.getByText('91% confidence')).toBeInTheDocument();
    expect(screen.getByText('88% confidence')).toBeInTheDocument();
    expect(screen.getByText('85% confidence')).toBeInTheDocument();
  });

  // --- Compartments tab details ---

  it('renders access management on compartments tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const compartmentsTab = tabs.find((t) => t.textContent === 'Compartments');
    fireEvent.click(compartmentsTab!);
    expect(screen.getByText('Access Management')).toBeInTheDocument();
    expect(screen.getByText('Providers with compartment access')).toBeInTheDocument();
  });

  it('renders storage breakdown on compartments tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const compartmentsTab = tabs.find((t) => t.textContent === 'Compartments');
    fireEvent.click(compartmentsTab!);
    expect(screen.getByText('Storage Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Storage used per compartment')).toBeInTheDocument();
  });

  it('renders refresh button on compartments tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const compartmentsTab = tabs.find((t) => t.textContent === 'Compartments');
    fireEvent.click(compartmentsTab!);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  // --- Privacy tab details ---

  it('renders data controls on privacy tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const privacyTab = tabs.find((t) => t.textContent === 'Privacy');
    fireEvent.click(privacyTab!);
    expect(screen.getByText('Data Controls')).toBeInTheDocument();
    expect(screen.getByText('Request Data Export')).toBeInTheDocument();
    expect(screen.getByText('Data Portability')).toBeInTheDocument();
    expect(screen.getByText('Delete All Data')).toBeInTheDocument();
  });

  it('renders encryption status on privacy tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const privacyTab = tabs.find((t) => t.textContent === 'Privacy');
    fireEvent.click(privacyTab!);
    expect(screen.getByText('Encryption Status')).toBeInTheDocument();
    expect(screen.getByText('Per-compartment encryption verification')).toBeInTheDocument();
    // All compartments should show AES-256-GCM
    expect(screen.getAllByText('AES-256-GCM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Encrypted').length).toBeGreaterThan(0);
  });

  it('renders last security audit on privacy tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const privacyTab = tabs.find((t) => t.textContent === 'Privacy');
    fireEvent.click(privacyTab!);
    expect(screen.getByText('Last Security Audit')).toBeInTheDocument();
    expect(screen.getByText(/All \d+ compartments verified/)).toBeInTheDocument();
  });

  // --- Cycle tracking tab details ---

  it('renders cycle stats on cycle tracking tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const cycleTab = tabs.find((t) => t.textContent === 'Cycle Tracking');
    fireEvent.click(cycleTab!);
    expect(screen.getAllByText('Next Period').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fertile Window').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Avg Cycle Length')).toBeInTheDocument();
    expect(screen.getAllByText('Last 6 cycles').length).toBeGreaterThanOrEqual(1);
  });

  it('renders temperature chart on cycle tracking tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const cycleTab = tabs.find((t) => t.textContent === 'Cycle Tracking');
    fireEvent.click(cycleTab!);
    expect(screen.getByText('Basal Body Temperature')).toBeInTheDocument();
    expect(screen.getByText('Last 28 days')).toBeInTheDocument();
  });

  it('renders cycle length history on cycle tracking tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const cycleTab = tabs.find((t) => t.textContent === 'Cycle Tracking');
    fireEvent.click(cycleTab!);
    expect(screen.getByText('Cycle Length History')).toBeInTheDocument();
  });

  // --- Symptom tab details ---

  it('renders symptom trend on symptoms tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const symptomsTab = tabs.find((t) => t.textContent === 'Symptoms');
    fireEvent.click(symptomsTab!);
    expect(screen.getByText('Symptom Trend')).toBeInTheDocument();
    expect(screen.getByText('Symptoms per day over the last 30 days')).toBeInTheDocument();
  });

  it('clicks lock button on an unlocked compartment', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    // Find and click lock buttons (for unlocked compartments)
    const lockButtons = screen.getAllByLabelText('Lock compartment');
    expect(lockButtons.length).toBeGreaterThan(0);
    fireEvent.click(lockButtons[0]);
  });

  it('clicks unlock button on a locked compartment', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    // Find and click unlock buttons (for locked compartments)
    const unlockButtons = screen.getAllByLabelText('Unlock compartment');
    expect(unlockButtons.length).toBeGreaterThan(0);
    fireEvent.click(unlockButtons[0]);
  });

  it('clicks lock/unlock buttons on compartments tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const compartmentsTab = tabs.find((t) => t.textContent === 'Compartments');
    fireEvent.click(compartmentsTab!);
    // Find and click lock/unlock buttons
    const lockButtons = screen.getAllByLabelText('Lock compartment');
    const unlockButtons = screen.getAllByLabelText('Unlock compartment');
    if (lockButtons.length > 0) fireEvent.click(lockButtons[0]);
    if (unlockButtons.length > 0) fireEvent.click(unlockButtons[0]);
  });

  it('renders fertile window active/upcoming text on cycle tracking tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const cycleTab = tabs.find((t) => t.textContent === 'Cycle Tracking');
    fireEvent.click(cycleTab!);
    // Check for either "Active now" or "Upcoming" text
    const activeOrUpcoming = screen.getAllByText(/Active now|Upcoming/);
    expect(activeOrUpcoming.length).toBeGreaterThan(0);
  });
});
