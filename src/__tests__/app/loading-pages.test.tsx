/**
 * Tests for all loading.tsx skeleton pages.
 *
 * Each loading component is a pure presentational component — we verify it
 * mounts without throwing and renders at least one DOM element so that
 * coverage is recorded for every file.
 */

import React from 'react';
import { render } from '@testing-library/react';

// Root loading
import RootLoading from '@/app/loading';

// Route-level loading components
import AccessLoading from '@/app/access/loading';
import AlertsLoading from '@/app/alerts/loading';
import ChatLoading from '@/app/chat/loading';
import ClinicalLoading from '@/app/clinical/loading';
import CommunityLoading from '@/app/community/loading';
import ComplianceLoading from '@/app/compliance/loading';
import EmergencyLoading from '@/app/emergency/loading';
import FHIRLoading from '@/app/fhir/loading';
import GenomicsLoading from '@/app/genomics/loading';
import GovernanceLoading from '@/app/governance/loading';
import InsightsLoading from '@/app/insights/loading';
import MarketplaceLoading from '@/app/marketplace/loading';
import MPCLoading from '@/app/mpc/loading';
import RecordsLoading from '@/app/records/loading';
import ResearchLoading from '@/app/research/loading';
import SettingsLoading from '@/app/settings/loading';
import TEEExplorerLoading from '@/app/tee-explorer/loading';
import TwinLoading from '@/app/twin/loading';
import VaultLoading from '@/app/vault/loading';
import WearablesLoading from '@/app/wearables/loading';

describe('Loading skeleton pages', () => {
  it('renders root loading without crashing', () => {
    const { container } = render(<RootLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders access loading without crashing', () => {
    const { container } = render(<AccessLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders alerts loading without crashing', () => {
    const { container } = render(<AlertsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders chat loading without crashing', () => {
    const { container } = render(<ChatLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders clinical loading without crashing', () => {
    const { container } = render(<ClinicalLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders community loading without crashing', () => {
    const { container } = render(<CommunityLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders compliance loading without crashing', () => {
    const { container } = render(<ComplianceLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders emergency loading without crashing', () => {
    const { container } = render(<EmergencyLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders FHIR loading without crashing', () => {
    const { container } = render(<FHIRLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders genomics loading without crashing', () => {
    const { container } = render(<GenomicsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders governance loading without crashing', () => {
    const { container } = render(<GovernanceLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders insights loading without crashing', () => {
    const { container } = render(<InsightsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders marketplace loading without crashing', () => {
    const { container } = render(<MarketplaceLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders MPC loading without crashing', () => {
    const { container } = render(<MPCLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders records loading without crashing', () => {
    const { container } = render(<RecordsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders research loading without crashing', () => {
    const { container } = render(<ResearchLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders settings loading without crashing', () => {
    const { container } = render(<SettingsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders TEE explorer loading without crashing', () => {
    const { container } = render(<TEEExplorerLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders twin loading without crashing', () => {
    const { container } = render(<TwinLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders vault loading without crashing', () => {
    const { container } = render(<VaultLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders wearables loading without crashing', () => {
    const { container } = render(<WearablesLoading />);
    expect(container.firstChild).toBeTruthy();
  });
});
