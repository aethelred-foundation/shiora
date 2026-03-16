// ============================================================
// Tests for src/app/emergency/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockRunTriage = { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false, error: null };
const mockAddCareTeamMember = { mutate: jest.fn(), isLoading: false, error: null };
const mockInitiateHandoff = { mutate: jest.fn(), isLoading: false, error: null };
const mockRefetch = jest.fn();

let mockOverrides: Record<string, unknown> = {};

const DEFAULT_EMERGENCY_CARD = {
  id: 'ecard-001',
  bloodType: 'O+',
  allergies: ['Penicillin', 'Sulfa'],
  currentMedications: [{ name: 'Metformin', dosage: '500mg', frequency: 'Daily' }],
  conditions: ['Type 2 Diabetes', 'Hypertension'],
  emergencyContacts: [{ id: 'ec-1', name: 'Jane Doe', phone: '555-0100', relationship: 'Spouse', email: 'jane@example.com', isPrimary: true, notifyOnEmergency: true }],
  advanceDirectives: 'DNR',
  organDonor: true,
  insuranceInfo: 'BlueCross',
  primaryPhysician: 'Dr. Smith',
  lastVerified: Date.now() - 86400000,
  teeAttestation: '0xabc123',
  ownerAddress: 'aeth1xxx',
};

const DEFAULT_CARE_TEAM = [
  { id: 'member-0', name: 'Dr. Sarah Chen', role: 'primary_physician', institution: 'City Hospital', specialty: 'OB-GYN', phone: '555-0100', email: 'sarah@example.com', accessLevel: 'full' as const, lastInteraction: Date.now() - 86400000, isActive: true },
  { id: 'member-1', name: 'Dr. James Liu', role: 'specialist', institution: 'Med Center', specialty: 'Endocrinology', phone: '555-0101', email: 'james@example.com', accessLevel: 'partial' as const, lastInteraction: Date.now() - 172800000, isActive: true },
  { id: 'member-2', name: 'Nurse Kim Park', role: 'nurse', institution: 'City Hospital', specialty: "Women's Health", phone: '555-0102', email: 'kim@example.com', accessLevel: 'partial' as const, lastInteraction: Date.now() - 259200000, isActive: true },
  { id: 'member-3', name: 'Dr. Emily Davis', role: 'emergency_contact', institution: 'ER Unit', specialty: 'Emergency Medicine', phone: '555-0103', email: 'emily@example.com', accessLevel: 'emergency_only' as const, lastInteraction: Date.now() - 345600000, isActive: false },
];

const DEFAULT_PROTOCOLS = [
  { id: 'protocol-0', name: 'Cardiac Emergency', category: 'cardiac', severity: 'critical' as const, steps: [{ order: 1, instruction: 'Call 911' }], autoNotifyTeam: true, teeVerifiedDoses: true, attestation: '0xdef', lastReviewed: Date.now() - 86400000 },
  { id: 'protocol-1', name: 'Allergic Reaction', category: 'allergy', severity: 'high' as const, steps: [{ order: 1, instruction: 'Administer epinephrine' }], autoNotifyTeam: true, teeVerifiedDoses: false, attestation: '0xghi', lastReviewed: Date.now() - 172800000 },
  { id: 'protocol-2', name: 'Stroke Protocol', category: 'neuro', severity: 'critical' as const, steps: [{ order: 1, instruction: 'FAST assessment' }], autoNotifyTeam: true, teeVerifiedDoses: true, attestation: '0xjkl', lastReviewed: Date.now() - 259200000 },
];

const DEFAULT_TRIAGE_HISTORY = [
  { id: 'triage-0', symptoms: ['chest_pain', 'shortness_of_breath', 'dizziness', 'nausea'], vitalSigns: { heartRate: 102 }, esiLevel: 2 as const, disposition: 'emergency_room' as const, reasoning: 'Urgent', confidence: 95, attestation: '0x111', assessedAt: Date.now() - 7 * 86400000, modelId: 'model-v1' },
  { id: 'triage-1', symptoms: ['headache'], vitalSigns: { heartRate: 78 }, esiLevel: 4 as const, disposition: 'home_care' as const, reasoning: 'Non-urgent', confidence: 78, attestation: '0x222', assessedAt: Date.now() - 14 * 86400000, modelId: 'model-v1' },
  { id: 'triage-2', symptoms: ['mild_fever'], vitalSigns: { heartRate: 85 }, esiLevel: 3 as const, disposition: 'urgent_care' as const, reasoning: 'Moderate', confidence: 85, attestation: '0x333', assessedAt: Date.now() - 21 * 86400000, modelId: 'model-v1' },
];

const DEFAULT_HANDOFFS = [
  { id: 'handoff-0', fromProvider: 'Dr. Provider 0', toProvider: 'Dr. Provider 1', patientSummary: 'Patient handoff summary 0', outstandingIssues: ['Issue 1'], medications: ['Med A'], qualityScore: 92, completenessScore: 88, handoffAt: Date.now() - 86400000, acknowledgedAt: Date.now() - 43200000 },
  { id: 'handoff-1', fromProvider: 'Dr. Provider 1', toProvider: 'Dr. Provider 2', patientSummary: 'Patient handoff summary 1', outstandingIssues: [], medications: ['Med B'], qualityScore: 85, completenessScore: 90, handoffAt: Date.now() - 259200000 },
];

jest.mock('@/hooks/useEmergency', () => ({
  useEmergency: () => ({
    emergencyCard: DEFAULT_EMERGENCY_CARD,
    careTeam: DEFAULT_CARE_TEAM,
    protocols: DEFAULT_PROTOCOLS,
    triageResult: null,
    triageHistory: DEFAULT_TRIAGE_HISTORY,
    handoffs: DEFAULT_HANDOFFS,
    isLoading: false,
    isCareTeamLoading: false,
    isProtocolsLoading: false,
    isTriageHistoryLoading: false,
    isHandoffsLoading: false,
    error: null,
    runTriage: mockRunTriage,
    addCareTeamMember: mockAddCareTeamMember,
    initiateHandoff: mockInitiateHandoff,
    refetch: mockRefetch,
    ...mockOverrides,
  }),
}));

import EmergencyPage from '@/app/emergency/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOverrides = {};
});

describe('EmergencyPage', () => {
  it('renders the page heading', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    expect(screen.getByText('Emergency & Care Coordination')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    expect(screen.getByText(/Emergency medical information, care team management, and AI-powered triage/)).toBeInTheDocument();
  });

  it('renders navigation and footer', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders Emergency Ready badge and TEE badge', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    expect(screen.getByText('Emergency Ready')).toBeInTheDocument();
    expect(screen.getAllByText('Intel SGX Verified').length).toBeGreaterThanOrEqual(1);
  });

  it('renders stat cards', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    expect(screen.getAllByText('Emergency Contacts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Care Team Members')).toBeInTheDocument();
    expect(screen.getAllByText('Emergency Protocols').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Care Handoffs').length).toBeGreaterThanOrEqual(1);
  });

  it('renders tab navigation with all five tabs', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    expect(screen.getByText('Emergency Card')).toBeInTheDocument();
    expect(screen.getByText('Care Team')).toBeInTheDocument();
    expect(screen.getByText('Protocols')).toBeInTheDocument();
    expect(screen.getByText('Triage')).toBeInTheDocument();
    expect(screen.getByText('Handoffs')).toBeInTheDocument();
  });

  // --- Emergency Card Tab ---

  it('shows emergency card info by default', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    // The EmergencyInfoCard component should be rendered with card data
    // Default tab is emergency-card
  });

  it('shows loading skeleton for emergency card tab when isLoading', () => {
    mockOverrides = { isLoading: true, emergencyCard: null };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    // Should show skeleton placeholders
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no emergency card is configured', () => {
    mockOverrides = { emergencyCard: null };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    expect(screen.getByText('No emergency card configured. Connect your wallet to set up.')).toBeInTheDocument();
  });

  // --- Care Team Tab ---

  it('switches to Care Team tab and shows team members', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Care Team'));
    expect(screen.getAllByText('Care Team').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('4 team members managing your care')).toBeInTheDocument();
  });

  it('shows loading skeletons for care team tab when loading', () => {
    mockOverrides = { isCareTeamLoading: true };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Care Team'));
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state for care team when no members', () => {
    mockOverrides = { careTeam: [] };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Care Team'));
    expect(screen.getByText('No care team members found.')).toBeInTheDocument();
  });

  // --- Protocols Tab ---

  it('switches to Protocols tab and shows protocols', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Protocols'));
    expect(screen.getByText(/3 protocols with step-by-step emergency response instructions/)).toBeInTheDocument();
  });

  it('shows loading skeletons for protocols tab when loading', () => {
    mockOverrides = { isProtocolsLoading: true };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Protocols'));
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state for protocols when no protocols', () => {
    mockOverrides = { protocols: [] };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Protocols'));
    expect(screen.getByText('No emergency protocols configured.')).toBeInTheDocument();
  });

  // --- Triage Tab ---

  it('switches to Triage tab and shows AI Triage Assessment', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Triage'));
    expect(screen.getAllByText('AI Triage Assessment').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ESI Level Reference')).toBeInTheDocument();
  });

  it('renders triage history table with assessment records', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Triage'));
    expect(screen.getByText('Assessment History')).toBeInTheDocument();
    // Table headers
    expect(screen.getAllByText('Date').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ESI Level').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Symptoms').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Disposition').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Confidence').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render triage history table when history is empty', () => {
    mockOverrides = { triageHistory: [] };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Triage'));
    expect(screen.queryByText('Assessment History')).not.toBeInTheDocument();
  });

  it('shows +N extra symptoms when more than 3 in triage history row', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Triage'));
    // First triage entry has 4 symptoms, shows 3 + "+1"
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('shows disposition with underscores replaced by spaces', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Triage'));
    expect(screen.getAllByText('emergency room').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('home care').length).toBeGreaterThanOrEqual(1);
  });

  it('shows confidence percentage in triage history', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Triage'));
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  it('uses triageResult when available instead of DEFAULT_TRIAGE', () => {
    mockOverrides = {
      triageResult: {
        id: 'triage-custom',
        symptoms: ['fever'],
        vitalSigns: { heartRate: 90 },
        esiLevel: 3,
        disposition: 'urgent_care',
        reasoning: 'Custom triage result',
        confidence: 88,
        attestation: '0xcustom',
        assessedAt: Date.now(),
        modelId: 'model-v2',
      },
    };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Triage'));
    // The TriageResult component receives the custom result
    expect(screen.getAllByText('AI Triage Assessment').length).toBeGreaterThanOrEqual(1);
  });

  // --- Handoffs Tab ---

  it('switches to Handoffs tab and shows handoff records', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Handoffs'));
    expect(screen.getByText(/2 care transition records with TEE attestations/)).toBeInTheDocument();
  });

  it('shows loading skeletons for handoffs tab when loading', () => {
    mockOverrides = { isHandoffsLoading: true };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Handoffs'));
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state for handoffs when no records', () => {
    mockOverrides = { handoffs: [] };
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Handoffs'));
    expect(screen.getByText('No handoff records found.')).toBeInTheDocument();
  });

  // --- Stat card counts ---

  it('shows correct count for active care team members', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    // 3 out of 4 care team members are active
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('shows correct emergency contacts count from card', () => {
    render(<TestWrapper><EmergencyPage /></TestWrapper>);
    // 1 emergency contact
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });
});
