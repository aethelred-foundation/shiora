// ============================================================
// Tests for src/app/vault/page.tsx
// ============================================================

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
      </TestWrapper>
    );
    expect(screen.getByText('Reproductive Data Vault')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/Sovereign, encrypted reproductive health data/)
    ).toBeInTheDocument();
  });

  it('renders all tabs', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
    );
    expect(screen.getByText(/Privacy Score: 87/)).toBeInTheDocument();
  });

  it('renders stat cards on overview', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
    );
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders locked/total badge', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
    );
    expect(screen.getByText(/\d+\/\d+ Locked/)).toBeInTheDocument();
  });

  // --- Fertility tab details ---

  it('renders AI predictions on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    fireEvent.click(fertilityTab!);
    expect(screen.getByText('AI Predictions')).toBeInTheDocument();
    expect(screen.getByText('Next Period')).toBeInTheDocument();
    expect(screen.getByText('Cycle Regularity')).toBeInTheDocument();
    expect(screen.getByText('Hormone Balance')).toBeInTheDocument();
  });

  it('renders fertility markers on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    fireEvent.click(fertilityTab!);
    expect(screen.getByText('Fertility Markers')).toBeInTheDocument();
    // Marker labels should appear
    expect(screen.getAllByText(/LH Surge|BBT Shift|Cervical Mucus|Ovulation Confirmed/).length).toBeGreaterThan(0);
    // Source labels should appear
    expect(screen.getAllByText(/Manual Entry|AI Predicted|Wearable Device/).length).toBeGreaterThan(0);
  });

  it('renders hormone level chart on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const fertilityTab = tabs.find((t) => t.textContent === 'Fertility');
    fireEvent.click(fertilityTab!);
    expect(screen.getByText('Hormone Levels')).toBeInTheDocument();
    expect(screen.getByText('Estimated hormone levels through the cycle')).toBeInTheDocument();
  });

  it('renders AI prediction confidence badges with correct variants on fertility tab', () => {
    render(
      <TestWrapper>
        <VaultPage />
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
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
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const cycleTab = tabs.find((t) => t.textContent === 'Cycle Tracking');
    fireEvent.click(cycleTab!);
    // Check for either "Active now" or "Upcoming" text
    const activeOrUpcoming = screen.getAllByText(/Active now|Upcoming/);
    expect(activeOrUpcoming.length).toBeGreaterThan(0);
  });
});
