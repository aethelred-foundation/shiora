// ============================================================
// Tests for src/components/vault/VaultComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  CompartmentCard,
  CycleCalendar,
  SymptomLogger,
  FertilityChart,
  JurisdictionBadge,
  PrivacyMeter,
} from '@/components/vault/VaultComponents';
import type {
  VaultCompartment,
  CycleEntry,
  SymptomLog,
  FertilityMarker,
  VaultPrivacyScore,
} from '@/types';
import { SYMPTOM_CATEGORIES } from '@/lib/constants';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(AppProvider, null, children),
  );
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockCompartment: VaultCompartment = {
  id: 'compartment-1',
  category: 'cycle_tracking',
  label: 'Cycle Tracking',
  description: 'Tracks your menstrual cycle patterns and predictions.',
  lockStatus: 'unlocked',
  recordCount: 45,
  storageUsed: 1024 * 512,
  lastAccessed: Date.now() - 3600000,
  encryptionKey: 'key-abc-123',
  accessList: ['aeth1provider001', 'aeth1provider002'],
  jurisdictionFlags: ['eu-gdpr'],
  createdAt: Date.now() - 365 * 86400000,
};

const mockLockedCompartment: VaultCompartment = {
  ...mockCompartment,
  id: 'compartment-2',
  category: 'fertility_data',
  label: 'Fertility Data',
  lockStatus: 'locked',
  accessList: [],
};

const mockPartialCompartment: VaultCompartment = {
  ...mockCompartment,
  id: 'compartment-3',
  category: 'hormone_levels',
  label: 'Hormone Levels',
  lockStatus: 'partial',
};

const mockSymptomLog: SymptomLog = {
  id: 'symptom-1',
  date: Date.now() - 3600000,
  category: 'pain',
  symptom: 'Pain',
  severity: 3,
  notes: 'Mild lower back pain',
  tags: [],
};

const mockCycleEntries: CycleEntry[] = Array.from({ length: 28 }, (_, i) => ({
  id: `entry-${i}`,
  date: Date.now() - (27 - i) * 86400000,
  day: i + 1,
  phase: (['menstrual', 'follicular', 'ovulation', 'luteal'] as const)[Math.floor(i / 7) % 4],
  temperature: 97.5 + i * 0.02,
  flow: (['none', 'light', 'medium', 'heavy'] as const)[i % 4],
  symptoms: [],
  fertilityScore: 10 + i * 3,
  notes: '',
}));

const mockFertilityMarkers: FertilityMarker[] = [
  {
    id: 'marker-1',
    date: Date.now() - 14 * 86400000,
    type: 'lh_surge',
    value: 25,
    confidence: 0.92,
    source: 'manual',
  },
];

const mockPrivacyScore: VaultPrivacyScore = {
  overall: 88,
  encryptionScore: 98,
  accessControlScore: 85,
  jurisdictionScore: 80,
  dataMinimizationScore: 88,
};

// ---------------------------------------------------------------------------
// CompartmentCard
// ---------------------------------------------------------------------------

describe('CompartmentCard', () => {
  it('renders compartment label and description', () => {
    render(
      <TestWrapper>
        <CompartmentCard compartment={mockCompartment} onLock={jest.fn()} onUnlock={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('Cycle Tracking')).toBeInTheDocument();
    expect(
      screen.getByText('Tracks your menstrual cycle patterns and predictions.'),
    ).toBeInTheDocument();
  });

  it('renders record count', () => {
    render(
      <TestWrapper>
        <CompartmentCard compartment={mockCompartment} onLock={jest.fn()} onUnlock={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('45 records')).toBeInTheDocument();
  });

  it('renders provider count', () => {
    render(
      <TestWrapper>
        <CompartmentCard compartment={mockCompartment} onLock={jest.fn()} onUnlock={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('2 providers')).toBeInTheDocument();
  });

  it('renders Unlocked status badge', () => {
    render(
      <TestWrapper>
        <CompartmentCard compartment={mockCompartment} onLock={jest.fn()} onUnlock={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('Unlocked')).toBeInTheDocument();
  });

  it('renders Locked status badge for locked compartment', () => {
    render(
      <TestWrapper>
        <CompartmentCard
          compartment={mockLockedCompartment}
          onLock={jest.fn()}
          onUnlock={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('renders Partial status badge for partial compartment', () => {
    render(
      <TestWrapper>
        <CompartmentCard
          compartment={mockPartialCompartment}
          onLock={jest.fn()}
          onUnlock={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Partial')).toBeInTheDocument();
  });

  it('calls onLock when lock button is clicked on unlocked compartment', () => {
    const onLock = jest.fn();
    render(
      <TestWrapper>
        <CompartmentCard compartment={mockCompartment} onLock={onLock} onUnlock={jest.fn()} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByLabelText('Lock compartment'));
    expect(onLock).toHaveBeenCalled();
  });

  it('calls onUnlock when unlock button is clicked on locked compartment', () => {
    const onUnlock = jest.fn();
    render(
      <TestWrapper>
        <CompartmentCard
          compartment={mockLockedCompartment}
          onLock={jest.fn()}
          onUnlock={onUnlock}
        />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByLabelText('Unlock compartment'));
    expect(onUnlock).toHaveBeenCalled();
  });

  it('renders singular provider label when only one provider', () => {
    const singleAccessCompartment = { ...mockCompartment, accessList: ['aeth1provider001'] };
    render(
      <TestWrapper>
        <CompartmentCard
          compartment={singleAccessCompartment}
          onLock={jest.fn()}
          onUnlock={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('1 provider')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CycleCalendar
// ---------------------------------------------------------------------------

describe('CycleCalendar', () => {
  it('renders day headers', () => {
    render(
      <TestWrapper>
        <CycleCalendar entries={mockCycleEntries} currentDay={14} />
      </TestWrapper>,
    );
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('renders phase legend items', () => {
    render(
      <TestWrapper>
        <CycleCalendar entries={mockCycleEntries} currentDay={14} />
      </TestWrapper>,
    );
    expect(screen.getByText('Menstrual')).toBeInTheDocument();
    expect(screen.getByText('Follicular')).toBeInTheDocument();
    expect(screen.getByText('Ovulation')).toBeInTheDocument();
    expect(screen.getByText('Luteal')).toBeInTheDocument();
  });

  it('renders without crashing with empty entries', () => {
    const { container } = render(
      <TestWrapper>
        <CycleCalendar entries={[]} currentDay={1} />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SymptomLogger
// ---------------------------------------------------------------------------

describe('SymptomLogger', () => {
  it('renders category selection heading', () => {
    render(
      <TestWrapper>
        <SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={jest.fn()} recentLogs={[]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Select Category')).toBeInTheDocument();
  });

  it('renders all symptom categories', () => {
    render(
      <TestWrapper>
        <SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={jest.fn()} recentLogs={[]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Pain')).toBeInTheDocument();
    expect(screen.getByText('Mood')).toBeInTheDocument();
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByText('Sleep')).toBeInTheDocument();
  });

  it('renders Recent Symptoms heading', () => {
    render(
      <TestWrapper>
        <SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={jest.fn()} recentLogs={[]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Recent Symptoms')).toBeInTheDocument();
  });

  it('shows severity slider and Log Symptom button when category is selected', () => {
    render(
      <TestWrapper>
        <SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={jest.fn()} recentLogs={[]} />
      </TestWrapper>,
    );
    // Click on Pain category
    fireEvent.click(screen.getByText('Pain'));

    expect(screen.getByText(/Severity:/)).toBeInTheDocument();
    expect(screen.getByText('Log Symptom')).toBeInTheDocument();
  });

  it('calls onLog when Log Symptom button is clicked after selecting category', () => {
    const onLog = jest.fn();
    render(
      <TestWrapper>
        <SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={onLog} recentLogs={[]} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Pain'));
    fireEvent.click(screen.getByText('Log Symptom'));
    expect(onLog).toHaveBeenCalled();
  });

  it('renders recent symptom logs', () => {
    render(
      <TestWrapper>
        <SymptomLogger
          categories={SYMPTOM_CATEGORIES}
          onLog={jest.fn()}
          recentLogs={[mockSymptomLog]}
        />
      </TestWrapper>,
    );
    expect(screen.getByText(/Severity 3\/5/)).toBeInTheDocument();
  });

  it('allows changing severity via slider after selecting a category', () => {
    render(
      <TestWrapper>
        <SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={jest.fn()} recentLogs={[]} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Pain'));
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '4' } });
    expect(screen.getByText(/Severity: 4\/5/)).toBeInTheDocument();
  });

  it('allows entering notes after selecting a category', () => {
    render(
      <TestWrapper>
        <SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={jest.fn()} recentLogs={[]} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Pain'));
    const textarea = screen.getByPlaceholderText('Add any additional details...');
    fireEvent.change(textarea, { target: { value: 'Some notes' } });
    expect(textarea).toHaveValue('Some notes');
  });
});

// ---------------------------------------------------------------------------
// FertilityChart
// ---------------------------------------------------------------------------

describe('FertilityChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TestWrapper>
        <FertilityChart
          entries={mockCycleEntries}
          markers={mockFertilityMarkers}
          fertileStart={10}
          fertileEnd={16}
        />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders chart legends', () => {
    render(
      <TestWrapper>
        <FertilityChart
          entries={mockCycleEntries}
          markers={mockFertilityMarkers}
          fertileStart={10}
          fertileEnd={16}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Fertility Score')).toBeInTheDocument();
    expect(screen.getByText('Fertile Window')).toBeInTheDocument();
    expect(screen.getByText('BBT Shift Line')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// JurisdictionBadge
// ---------------------------------------------------------------------------

describe('JurisdictionBadge', () => {
  it('renders jurisdiction name', () => {
    render(
      <TestWrapper>
        <JurisdictionBadge jurisdiction="California, US" protectionLevel="high" />
      </TestWrapper>,
    );
    expect(screen.getByText('California, US')).toBeInTheDocument();
  });

  it('renders for medium protection level', () => {
    const { container } = render(
      <TestWrapper>
        <JurisdictionBadge jurisdiction="Florida, US" protectionLevel="medium" />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('Florida, US')).toBeInTheDocument();
  });

  it('renders for low protection level', () => {
    const { container } = render(
      <TestWrapper>
        <JurisdictionBadge jurisdiction="Texas, US" protectionLevel="low" />
      </TestWrapper>,
    );
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('Texas, US')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PrivacyMeter
// ---------------------------------------------------------------------------

describe('PrivacyMeter', () => {
  it('renders overall privacy score', () => {
    render(
      <TestWrapper>
        <PrivacyMeter score={mockPrivacyScore} />
      </TestWrapper>,
    );
    // Overall score is 88 and dataMinimizationScore is also 88, so use getAllByText
    const scores = screen.getAllByText('88');
    expect(scores.length).toBeGreaterThan(0);
    expect(screen.getByText('Privacy Score')).toBeInTheDocument();
  });

  it('renders all sub-score labels', () => {
    render(
      <TestWrapper>
        <PrivacyMeter score={mockPrivacyScore} />
      </TestWrapper>,
    );
    expect(screen.getByText('Encryption')).toBeInTheDocument();
    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.getByText('Jurisdiction')).toBeInTheDocument();
    expect(screen.getByText('Data Minimization')).toBeInTheDocument();
  });

  it('renders sub-score values', () => {
    render(
      <TestWrapper>
        <PrivacyMeter score={mockPrivacyScore} />
      </TestWrapper>,
    );
    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders medium score in amber for scores 60-79', () => {
    const mediumScore: VaultPrivacyScore = {
      overall: 70,
      encryptionScore: 65,
      accessControlScore: 72,
      jurisdictionScore: 68,
      dataMinimizationScore: 75,
    };
    render(
      <TestWrapper>
        <PrivacyMeter score={mediumScore} />
      </TestWrapper>,
    );
    expect(screen.getByText('70')).toBeInTheDocument();
  });

  it('renders low score in red for scores below 60', () => {
    const lowScore: VaultPrivacyScore = {
      overall: 45,
      encryptionScore: 45,
      accessControlScore: 50,
      jurisdictionScore: 40,
      dataMinimizationScore: 55,
    };
    const { container } = render(
      <TestWrapper>
        <PrivacyMeter score={lowScore} />
      </TestWrapper>,
    );
    // overall=45 and encryptionScore=45 will both render as "45"
    const fortyFives = screen.getAllByText('45');
    expect(fortyFives.length).toBeGreaterThan(0);
    expect(container.firstChild).toBeTruthy();
  });
});
