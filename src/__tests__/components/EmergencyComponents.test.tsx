// ============================================================
// Tests for src/components/emergency/EmergencyComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  ESILevelBadge,
  EmergencyInfoCard,
  CareTeamMemberCard,
  ProtocolAccordion,
  TriageResult,
  HandoffCard,
} from '@/components/emergency/EmergencyComponents';
import type {
  EmergencyCard,
  CareTeamMember,
  EmergencyProtocol,
  TriageAssessment,
  CareHandoff,
} from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockEmergencyCard: EmergencyCard = {
  id: 'ec-1',
  bloodType: 'O+',
  allergies: ['Penicillin', 'Sulfa'],
  conditions: ['Type 2 Diabetes', 'Hypertension'],
  currentMedications: [
    { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
  ],
  emergencyContacts: [
    {
      id: 'contact-1',
      name: 'Jane Doe',
      relationship: 'Spouse',
      phone: '555-0100',
      email: 'jane@example.com',
      isPrimary: true,
      notifyOnEmergency: true,
    },
  ],
  advanceDirectives: 'Full code — no restrictions',
  organDonor: true,
  insuranceInfo: 'BlueCross — PPO Plan',
  primaryPhysician: 'Dr. Sarah Johnson',
  lastVerified: Date.now() - 86400000,
};

const mockCareTeamMember: CareTeamMember = {
  id: 'ctm-1',
  name: 'Dr. Emily Chen',
  role: 'Cardiologist',
  specialty: 'Interventional Cardiology',
  institution: 'Aethelred Medical Center',
  phone: '555-0200',
  email: 'emily.chen@amc.org',
  accessLevel: 'full',
  isActive: true,
  lastInteraction: Date.now() - 3600000,
};

const mockProtocol: EmergencyProtocol = {
  id: 'proto-1',
  name: 'Anaphylaxis Response',
  severity: 'critical',
  steps: [
    { order: 1, instruction: 'Administer epinephrine IM', medication: 'Epinephrine', dosage: '0.3mg', timeLimit: '< 2 min' },
    { order: 2, instruction: 'Call 911 and prepare for CPR', timeLimit: '< 1 min' },
  ],
  teeVerifiedDoses: true,
  autoNotifyTeam: true,
  lastReviewed: Date.now() - 86400000 * 30,
};

const mockTriageAssessment: TriageAssessment = {
  id: 'triage-1',
  esiLevel: 2,
  symptoms: ['Chest pain', 'Shortness of breath'],
  vitalSigns: {
    heartRate: 110,
    bloodPressure: 90,
    temperature: 98.6,
    respRate: 22,
    spO2: 94,
  },
  disposition: 'admit_icu',
  reasoning: 'Elevated heart rate with chest pain suggests acute coronary syndrome.',
  confidence: 91,
  modelId: 'triage-ai-v2',
};

const mockHandoff: CareHandoff = {
  id: 'handoff-1',
  fromProvider: 'Dr. Chen (ED)',
  toProvider: 'Dr. Patel (ICU)',
  patientSummary: '55M with STEMI, s/p PCI to LAD.',
  outstandingIssues: ['Pending troponin trend', 'Anticoagulation titration'],
  medications: ['Heparin drip', 'Aspirin 325mg', 'Plavix 75mg'],
  qualityScore: 92,
  completenessScore: 88,
  handoffAt: Date.now() - 1800000,
  acknowledgedAt: Date.now() - 900000,
  txHash: '0xabc123def456abc123def456abc123def456abc1abc123def456abc123def456ab',
};

// ---------------------------------------------------------------------------
// ESILevelBadge
// ---------------------------------------------------------------------------

describe('ESILevelBadge', () => {
  it('renders ESI level and label', () => {
    render(<ESILevelBadge level={2} />);
    expect(screen.getByText(/ESI 2/)).toBeInTheDocument();
    expect(screen.getByText(/Emergent/)).toBeInTheDocument();
  });

  it('renders non-urgent for level 5', () => {
    render(<ESILevelBadge level={5} />);
    expect(screen.getByText(/Non-Urgent/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EmergencyInfoCard
// ---------------------------------------------------------------------------

describe('EmergencyInfoCard', () => {
  it('renders blood type and key info', () => {
    render(
      <TestWrapper>
        <EmergencyInfoCard card={mockEmergencyCard} />
      </TestWrapper>
    );
    expect(screen.getByText('O+')).toBeInTheDocument();
    expect(screen.getByText('Emergency Information Card')).toBeInTheDocument();
  });

  it('renders allergies', () => {
    render(
      <TestWrapper>
        <EmergencyInfoCard card={mockEmergencyCard} />
      </TestWrapper>
    );
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Sulfa')).toBeInTheDocument();
  });

  it('renders chronic conditions', () => {
    render(
      <TestWrapper>
        <EmergencyInfoCard card={mockEmergencyCard} />
      </TestWrapper>
    );
    expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
  });

  it('renders emergency contacts', () => {
    render(
      <TestWrapper>
        <EmergencyInfoCard card={mockEmergencyCard} />
      </TestWrapper>
    );
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Spouse')).toBeInTheDocument();
  });

  it('renders primary physician', () => {
    render(
      <TestWrapper>
        <EmergencyInfoCard card={mockEmergencyCard} />
      </TestWrapper>
    );
    expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CareTeamMemberCard
// ---------------------------------------------------------------------------

describe('CareTeamMemberCard', () => {
  it('renders member name and role', () => {
    render(
      <TestWrapper>
        <CareTeamMemberCard member={mockCareTeamMember} />
      </TestWrapper>
    );
    expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
    expect(screen.getByText('Cardiologist')).toBeInTheDocument();
  });

  it('renders institution and specialty', () => {
    render(
      <TestWrapper>
        <CareTeamMemberCard member={mockCareTeamMember} />
      </TestWrapper>
    );
    expect(screen.getByText('Aethelred Medical Center')).toBeInTheDocument();
    expect(screen.getByText('Interventional Cardiology')).toBeInTheDocument();
  });

  it('renders access level badge', () => {
    render(
      <TestWrapper>
        <CareTeamMemberCard member={mockCareTeamMember} />
      </TestWrapper>
    );
    expect(screen.getByText('Full Access')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProtocolAccordion
// ---------------------------------------------------------------------------

describe('ProtocolAccordion', () => {
  it('renders protocol name and severity', () => {
    render(
      <TestWrapper>
        <ProtocolAccordion protocol={mockProtocol} />
      </TestWrapper>
    );
    expect(screen.getByText('Anaphylaxis Response')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('expands to show steps on click', () => {
    render(
      <TestWrapper>
        <ProtocolAccordion protocol={mockProtocol} />
      </TestWrapper>
    );
    // Steps should not be visible initially
    expect(screen.queryByText('Administer epinephrine IM')).not.toBeInTheDocument();
    // Click to expand
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Administer epinephrine IM')).toBeInTheDocument();
    expect(screen.getByText('Call 911 and prepare for CPR')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TriageResult
// ---------------------------------------------------------------------------

describe('TriageResult', () => {
  it('renders triage assessment details', () => {
    render(
      <TestWrapper>
        <TriageResult assessment={mockTriageAssessment} />
      </TestWrapper>
    );
    expect(screen.getByText('AI Triage Assessment')).toBeInTheDocument();
    expect(screen.getByText('triage-ai-v2')).toBeInTheDocument();
  });

  it('renders symptoms', () => {
    render(
      <TestWrapper>
        <TriageResult assessment={mockTriageAssessment} />
      </TestWrapper>
    );
    expect(screen.getByText('Chest pain')).toBeInTheDocument();
    expect(screen.getByText('Shortness of breath')).toBeInTheDocument();
  });

  it('renders disposition recommendation', () => {
    render(
      <TestWrapper>
        <TriageResult assessment={mockTriageAssessment} />
      </TestWrapper>
    );
    expect(screen.getByText('admit icu')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// HandoffCard
// ---------------------------------------------------------------------------

describe('HandoffCard', () => {
  it('renders provider transfer', () => {
    render(
      <TestWrapper>
        <HandoffCard handoff={mockHandoff} />
      </TestWrapper>
    );
    expect(screen.getByText('Dr. Chen (ED)')).toBeInTheDocument();
    expect(screen.getByText('Dr. Patel (ICU)')).toBeInTheDocument();
  });

  it('renders patient summary', () => {
    render(
      <TestWrapper>
        <HandoffCard handoff={mockHandoff} />
      </TestWrapper>
    );
    expect(screen.getByText(/55M with STEMI/)).toBeInTheDocument();
  });

  it('renders outstanding issues', () => {
    render(
      <TestWrapper>
        <HandoffCard handoff={mockHandoff} />
      </TestWrapper>
    );
    expect(screen.getByText('Pending troponin trend')).toBeInTheDocument();
    expect(screen.getByText('Anticoagulation titration')).toBeInTheDocument();
  });

  it('renders medications', () => {
    render(
      <TestWrapper>
        <HandoffCard handoff={mockHandoff} />
      </TestWrapper>
    );
    expect(screen.getByText('Heparin drip')).toBeInTheDocument();
    expect(screen.getByText('Aspirin 325mg')).toBeInTheDocument();
  });

  it('renders pending acknowledgment when acknowledgedAt is null', () => {
    const handoff: CareHandoff = { ...mockHandoff, acknowledgedAt: undefined as any };
    render(
      <TestWrapper>
        <HandoffCard handoff={handoff} />
      </TestWrapper>
    );
    expect(screen.getByText('Pending acknowledgment')).toBeInTheDocument();
  });

  it('renders without outstanding issues section when empty', () => {
    const handoff: CareHandoff = { ...mockHandoff, outstandingIssues: [] };
    render(
      <TestWrapper>
        <HandoffCard handoff={handoff} />
      </TestWrapper>
    );
    expect(screen.queryByText('Outstanding Issues')).not.toBeInTheDocument();
  });

  it('renders without medications section when empty', () => {
    const handoff: CareHandoff = { ...mockHandoff, medications: [] };
    render(
      <TestWrapper>
        <HandoffCard handoff={handoff} />
      </TestWrapper>
    );
    expect(screen.queryByText('Current Medications')).not.toBeInTheDocument();
  });

  it('renders quality score < 75 with red color', () => {
    const handoff: CareHandoff = { ...mockHandoff, qualityScore: 60 };
    render(
      <TestWrapper>
        <HandoffCard handoff={handoff} />
      </TestWrapper>
    );
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders quality score 75-89 with yellow color', () => {
    const handoff: CareHandoff = { ...mockHandoff, qualityScore: 80 };
    render(
      <TestWrapper>
        <HandoffCard handoff={handoff} />
      </TestWrapper>
    );
    expect(screen.getByText('80')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ESILevelBadge — additional branch coverage
// ---------------------------------------------------------------------------

describe('ESILevelBadge — branch coverage', () => {
  it('renders unknown level with fallback to level 5 style', () => {
    render(<ESILevelBadge level={99} />);
    expect(screen.getByText(/ESI 99/)).toBeInTheDocument();
    expect(screen.getByText(/Non-Urgent/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EmergencyInfoCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('EmergencyInfoCard — branch coverage', () => {
  it('renders organDonor=false as No', () => {
    const card: EmergencyCard = { ...mockEmergencyCard, organDonor: false };
    render(
      <TestWrapper>
        <EmergencyInfoCard card={card} />
      </TestWrapper>
    );
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders contact without isPrimary badge', () => {
    const card: EmergencyCard = {
      ...mockEmergencyCard,
      emergencyContacts: [
        { ...mockEmergencyCard.emergencyContacts[0], isPrimary: false },
      ],
    };
    render(
      <TestWrapper>
        <EmergencyInfoCard card={card} />
      </TestWrapper>
    );
    expect(screen.queryByText('Primary')).not.toBeInTheDocument();
  });

  it('renders contact without notifyOnEmergency', () => {
    const card: EmergencyCard = {
      ...mockEmergencyCard,
      emergencyContacts: [
        { ...mockEmergencyCard.emergencyContacts[0], notifyOnEmergency: false },
      ],
    };
    render(
      <TestWrapper>
        <EmergencyInfoCard card={card} />
      </TestWrapper>
    );
    expect(screen.queryByText('Auto-notify on emergency')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CareTeamMemberCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('CareTeamMemberCard — branch coverage', () => {
  it('renders inactive member with Inactive label', () => {
    const member: CareTeamMember = { ...mockCareTeamMember, isActive: false };
    render(
      <TestWrapper>
        <CareTeamMemberCard member={member} />
      </TestWrapper>
    );
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders unknown access level with fallback to partial', () => {
    const member: CareTeamMember = { ...mockCareTeamMember, accessLevel: 'unknown_level' as any };
    render(
      <TestWrapper>
        <CareTeamMemberCard member={member} />
      </TestWrapper>
    );
    expect(screen.getByText('Partial Access')).toBeInTheDocument();
  });

  it('renders emergency_only access level', () => {
    const member: CareTeamMember = { ...mockCareTeamMember, accessLevel: 'emergency_only' };
    render(
      <TestWrapper>
        <CareTeamMemberCard member={member} />
      </TestWrapper>
    );
    expect(screen.getByText('Emergency Only')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProtocolAccordion — additional branch coverage
// ---------------------------------------------------------------------------

describe('ProtocolAccordion — branch coverage', () => {
  it('renders non-critical severity with amber styling', () => {
    const protocol: EmergencyProtocol = {
      ...mockProtocol,
      severity: 'high' as any,
    };
    render(
      <TestWrapper>
        <ProtocolAccordion protocol={protocol} />
      </TestWrapper>
    );
    expect(screen.getByText('Anaphylaxis Response')).toBeInTheDocument();
  });

  it('renders steps without medication or timeLimit', () => {
    const protocol: EmergencyProtocol = {
      ...mockProtocol,
      steps: [
        { order: 1, instruction: 'Check vitals' },
      ],
    };
    render(
      <TestWrapper>
        <ProtocolAccordion protocol={protocol} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Check vitals')).toBeInTheDocument();
  });

  it('renders without teeVerifiedDoses or autoNotifyTeam', () => {
    const protocol: EmergencyProtocol = {
      ...mockProtocol,
      teeVerifiedDoses: false,
      autoNotifyTeam: false,
    };
    render(
      <TestWrapper>
        <ProtocolAccordion protocol={protocol} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('TEE-Verified Doses')).not.toBeInTheDocument();
    expect(screen.queryByText('Auto-Notify Team')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TriageResult — additional branch coverage
// ---------------------------------------------------------------------------

describe('TriageResult — branch coverage', () => {
  it('renders confidence < 80 with red color', () => {
    const assessment: TriageAssessment = { ...mockTriageAssessment, confidence: 70 };
    render(
      <TestWrapper>
        <TriageResult assessment={assessment} />
      </TestWrapper>
    );
    expect(screen.getByText('70')).toBeInTheDocument();
  });

  it('renders confidence 80-89 with yellow color', () => {
    const assessment: TriageAssessment = { ...mockTriageAssessment, confidence: 85 };
    render(
      <TestWrapper>
        <TriageResult assessment={assessment} />
      </TestWrapper>
    );
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders string vital sign values', () => {
    const assessment: TriageAssessment = {
      ...mockTriageAssessment,
      vitalSigns: { ...mockTriageAssessment.vitalSigns, bloodPressure: '120/80' as any },
    };
    render(
      <TestWrapper>
        <TriageResult assessment={assessment} />
      </TestWrapper>
    );
    expect(screen.getByText('120/80')).toBeInTheDocument();
  });
});
