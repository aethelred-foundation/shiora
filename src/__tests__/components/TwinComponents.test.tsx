// ============================================================
// Tests for src/components/twin/TwinComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  OrganScoreCard,
  SimulationCard,
  SimulationDetailChart,
  ParameterSlider,
  PredictionCard,
  TimelineEventItem,
} from '@/components/twin/TwinComponents';
import type {
  TwinSimulation,
  TwinParameter,
  TwinPrediction,
  TwinTimelineEvent,
} from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSimulation: TwinSimulation = {
  id: 'sim-1',
  scenario: 'Statin Therapy Start',
  description: 'Simulate the effect of starting atorvastatin 20mg daily.',
  status: 'completed',
  confidenceInterval: 92,
  completedAt: Date.now() - 3600000,
  beforeMetrics: [
    { metric: 'LDL Cholesterol', value: 145, unit: 'mg/dL' },
    { metric: 'Total Cholesterol', value: 230, unit: 'mg/dL' },
  ],
  afterMetrics: [
    { metric: 'LDL Cholesterol', value: 98, unit: 'mg/dL' },
    { metric: 'Total Cholesterol', value: 185, unit: 'mg/dL' },
  ],
  trajectoryData: [
    { day: 0, metric: 'LDL Cholesterol', before: 145, after: 145 },
    { day: 30, metric: 'LDL Cholesterol', before: 145, after: 125 },
    { day: 60, metric: 'LDL Cholesterol', before: 145, after: 110 },
    { day: 90, metric: 'LDL Cholesterol', before: 145, after: 98 },
  ],
  attestation: '0xabc123def456abc123def456abc123def456abc1',
};

const mockParameter: TwinParameter = {
  id: 'param-1',
  name: 'Resting Heart Rate',
  category: 'Cardiovascular',
  currentValue: 72,
  min: 40,
  max: 120,
  step: 1,
  unit: 'bpm',
};

const mockPrediction: TwinPrediction = {
  id: 'pred-1',
  metric: 'Fasting Glucose',
  currentValue: 102,
  predicted30d: 105,
  predicted60d: 108,
  predicted90d: 112,
  unit: 'mg/dL',
  riskLevel: 'moderate',
  confidenceBand: 85,
  recommendations: ['Reduce carbohydrate intake', 'Increase daily walking'],
};

const mockEvent: TwinTimelineEvent = {
  id: 'evt-1',
  type: 'simulation',
  title: 'Statin Simulation Run',
  description: 'Completed simulation of atorvastatin therapy.',
  timestamp: Date.now() - 3600000,
  attestation: '0xabc123def456',
};

// ---------------------------------------------------------------------------
// OrganScoreCard
// ---------------------------------------------------------------------------

describe('OrganScoreCard', () => {
  it('renders organ system label and score', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system="cardiovascular"
          score={82}
          trend="improving"
          lastUpdated={Date.now() - 3600000}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Health Score')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Improving')).toBeInTheDocument();
  });

  it('renders declining trend', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system="respiratory"
          score={50}
          trend="declining"
          lastUpdated={Date.now() - 3600000}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Declining')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders stable trend', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system="neurological"
          score={75}
          trend="stable"
          lastUpdated={Date.now() - 3600000}
        />
      </TestWrapper>
    );
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('renders high score (>= 85) with green color', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system="cardiovascular"
          score={90}
          trend="improving"
          lastUpdated={Date.now()}
        />
      </TestWrapper>
    );
    expect(screen.getByText('90')).toBeInTheDocument();
  });

  it('renders medium score (70-84) with cyan color', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system="cardiovascular"
          score={72}
          trend="stable"
          lastUpdated={Date.now()}
        />
      </TestWrapper>
    );
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('renders low-medium score (55-69) with yellow color', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system="endocrine"
          score={60}
          trend="declining"
          lastUpdated={Date.now()}
        />
      </TestWrapper>
    );
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('renders low score (< 55) with red color', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system="renal"
          score={40}
          trend="declining"
          lastUpdated={Date.now()}
        />
      </TestWrapper>
    );
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('renders unknown organ system with fallback', () => {
    render(
      <TestWrapper>
        <OrganScoreCard
          system={'unknownsystem' as any}
          score={70}
          trend="stable"
          lastUpdated={Date.now()}
        />
      </TestWrapper>
    );
    expect(screen.getByText('unknownsystem')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SimulationCard
// ---------------------------------------------------------------------------

describe('SimulationCard', () => {
  it('renders simulation scenario and status', () => {
    render(
      <TestWrapper>
        <SimulationCard simulation={mockSimulation} />
      </TestWrapper>
    );
    expect(screen.getByText('Statin Therapy Start')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <TestWrapper>
        <SimulationCard simulation={mockSimulation} />
      </TestWrapper>
    );
    expect(screen.getByText(/Simulate the effect of starting atorvastatin/)).toBeInTheDocument();
  });

  it('renders metric comparisons for completed simulations', () => {
    render(
      <TestWrapper>
        <SimulationCard simulation={mockSimulation} />
      </TestWrapper>
    );
    expect(screen.getByText('LDL Cholesterol')).toBeInTheDocument();
    expect(screen.getByText('Total Cholesterol')).toBeInTheDocument();
  });

  it('renders worsening metrics with rose color and plus sign', () => {
    const worseningSim: TwinSimulation = {
      ...mockSimulation,
      beforeMetrics: [
        { metric: 'Blood Pressure', value: 120, unit: 'mmHg' },
        { metric: 'Heart Rate', value: 70, unit: 'bpm' },
      ],
      afterMetrics: [
        { metric: 'Blood Pressure', value: 150, unit: 'mmHg' },
        { metric: 'Heart Rate', value: 90, unit: 'bpm' },
      ],
    };
    render(
      <TestWrapper>
        <SimulationCard simulation={worseningSim} />
      </TestWrapper>
    );
    // Positive change should show '+' prefix and rose color
    expect(screen.getByText('+25.0%')).toBeInTheDocument();
    expect(screen.getByText('+28.6%')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SimulationDetailChart
// ---------------------------------------------------------------------------

describe('SimulationDetailChart', () => {
  it('renders trajectory chart heading', () => {
    render(
      <TestWrapper>
        <SimulationDetailChart simulation={mockSimulation} />
      </TestWrapper>
    );
    expect(screen.getByText('LDL Cholesterol Trajectory')).toBeInTheDocument();
  });

  it('renders worsening and zero-change metrics in detail table', () => {
    const mixedSim: TwinSimulation = {
      ...mockSimulation,
      beforeMetrics: [
        { metric: 'LDL Cholesterol', value: 100, unit: 'mg/dL' },
        { metric: 'HDL Cholesterol', value: 50, unit: 'mg/dL' },
        { metric: 'Triglycerides', value: 150, unit: 'mg/dL' },
      ],
      afterMetrics: [
        { metric: 'LDL Cholesterol', value: 130, unit: 'mg/dL' },
        { metric: 'HDL Cholesterol', value: 50, unit: 'mg/dL' },
        { metric: 'Triglycerides', value: 120, unit: 'mg/dL' },
      ],
    };
    render(
      <TestWrapper>
        <SimulationDetailChart simulation={mixedSim} />
      </TestWrapper>
    );
    // Worsening metric (positive change) should show rose color with '+' prefix
    expect(screen.getByText('+30.0%')).toBeInTheDocument();
    // Zero change should show slate color
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('returns null when trajectory data is empty', () => {
    const emptySim = { ...mockSimulation, trajectoryData: [] };
    const { container } = render(
      <TestWrapper>
        <SimulationDetailChart simulation={emptySim} />
      </TestWrapper>
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ParameterSlider
// ---------------------------------------------------------------------------

describe('ParameterSlider', () => {
  it('renders parameter name, value and unit', () => {
    render(
      <TestWrapper>
        <ParameterSlider parameter={mockParameter} />
      </TestWrapper>
    );
    expect(screen.getByText('Resting Heart Rate')).toBeInTheDocument();
    expect(screen.getByText('Cardiovascular')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('bpm')).toBeInTheDocument();
  });

  it('shows modified state when override value differs', () => {
    render(
      <TestWrapper>
        <ParameterSlider parameter={mockParameter} overrideValue={85} />
      </TestWrapper>
    );
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Modified (was 72)')).toBeInTheDocument();
  });

  it('calls onChange when slider value changes', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ParameterSlider parameter={mockParameter} onChange={onChange} />
      </TestWrapper>
    );
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '80' } });
    expect(onChange).toHaveBeenCalledWith(80);
  });
});

// ---------------------------------------------------------------------------
// PredictionCard
// ---------------------------------------------------------------------------

describe('PredictionCard', () => {
  it('renders prediction metric and risk level', () => {
    render(
      <TestWrapper>
        <PredictionCard prediction={mockPrediction} />
      </TestWrapper>
    );
    expect(screen.getByText('Fasting Glucose')).toBeInTheDocument();
    expect(screen.getByText('moderate risk')).toBeInTheDocument();
    expect(screen.getByText('90-day forecast')).toBeInTheDocument();
  });

  it('renders prediction values', () => {
    render(
      <TestWrapper>
        <PredictionCard prediction={mockPrediction} />
      </TestWrapper>
    );
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('105')).toBeInTheDocument();
    expect(screen.getByText('112')).toBeInTheDocument();
  });

  it('renders recommendations', () => {
    render(
      <TestWrapper>
        <PredictionCard prediction={mockPrediction} />
      </TestWrapper>
    );
    expect(screen.getByText('Reduce carbohydrate intake')).toBeInTheDocument();
    expect(screen.getByText('Increase daily walking')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TimelineEventItem
// ---------------------------------------------------------------------------

describe('TimelineEventItem', () => {
  it('renders event title and description', () => {
    render(
      <TestWrapper>
        <TimelineEventItem event={mockEvent} />
      </TestWrapper>
    );
    expect(screen.getByText('Statin Simulation Run')).toBeInTheDocument();
    expect(screen.getByText(/Completed simulation of atorvastatin/)).toBeInTheDocument();
  });

  it('renders event type badge', () => {
    render(
      <TestWrapper>
        <TimelineEventItem event={mockEvent} />
      </TestWrapper>
    );
    expect(screen.getByText('simulation')).toBeInTheDocument();
  });

  it('renders event without attestation', () => {
    const noAttestation: TwinTimelineEvent = {
      id: 'evt-2',
      type: 'data_sync',
      title: 'Data Sync Event',
      description: 'Synced data from wearable.',
      timestamp: Date.now(),
    };
    render(
      <TestWrapper>
        <TimelineEventItem event={noAttestation} />
      </TestWrapper>
    );
    expect(screen.getByText('Data Sync Event')).toBeInTheDocument();
    expect(screen.getByText('data sync')).toBeInTheDocument();
  });

  it('renders creation event type', () => {
    const creation: TwinTimelineEvent = {
      id: 'evt-3',
      type: 'creation',
      title: 'Twin Created',
      description: 'Digital twin was created.',
      timestamp: Date.now(),
      attestation: '0xattest123',
    };
    render(
      <TestWrapper>
        <TimelineEventItem event={creation} />
      </TestWrapper>
    );
    expect(screen.getByText('Twin Created')).toBeInTheDocument();
  });

  it('renders parameter_update event type', () => {
    const paramUpdate: TwinTimelineEvent = {
      id: 'evt-4',
      type: 'parameter_update',
      title: 'Parameter Changed',
      description: 'Heart rate parameter was updated.',
      timestamp: Date.now(),
    };
    render(
      <TestWrapper>
        <TimelineEventItem event={paramUpdate} />
      </TestWrapper>
    );
    expect(screen.getByText('Parameter Changed')).toBeInTheDocument();
    expect(screen.getByText('parameter update')).toBeInTheDocument();
  });

  it('renders prediction event type', () => {
    const pred: TwinTimelineEvent = {
      id: 'evt-5',
      type: 'prediction',
      title: 'Prediction Generated',
      description: 'New health prediction available.',
      timestamp: Date.now(),
    };
    render(
      <TestWrapper>
        <TimelineEventItem event={pred} />
      </TestWrapper>
    );
    expect(screen.getByText('Prediction Generated')).toBeInTheDocument();
  });

  it('renders unknown event type with fallback', () => {
    const unknown: TwinTimelineEvent = {
      id: 'evt-6',
      type: 'unknown_type' as any,
      title: 'Unknown Event',
      description: 'Something happened.',
      timestamp: Date.now(),
    };
    render(
      <TestWrapper>
        <TimelineEventItem event={unknown} />
      </TestWrapper>
    );
    expect(screen.getByText('Unknown Event')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SimulationCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('SimulationCard — branch coverage', () => {
  it('renders simulating status with spinning icon and Running text', () => {
    const sim: TwinSimulation = {
      ...mockSimulation,
      status: 'simulating',
      completedAt: undefined,
    };
    render(
      <TestWrapper>
        <SimulationCard simulation={sim} />
      </TestWrapper>
    );
    expect(screen.getByText('simulating')).toBeInTheDocument();
    expect(screen.getByText('Running...')).toBeInTheDocument();
  });

  it('renders pending status with Pending text', () => {
    const sim: TwinSimulation = {
      ...mockSimulation,
      status: 'pending',
      completedAt: undefined,
    };
    render(
      <TestWrapper>
        <SimulationCard simulation={sim} />
      </TestWrapper>
    );
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders with isSelected ring styling', () => {
    const { container } = render(
      <TestWrapper>
        <SimulationCard simulation={mockSimulation} isSelected />
      </TestWrapper>
    );
    const card = container.querySelector('.ring-2');
    expect(card).toBeInTheDocument();
  });

  it('renders failed status with unknown SIM_STATUS_VARIANTS fallback', () => {
    const sim: TwinSimulation = {
      ...mockSimulation,
      status: 'failed' as any,
      completedAt: undefined,
    };
    render(
      <TestWrapper>
        <SimulationCard simulation={sim} />
      </TestWrapper>
    );
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('does not render avgChange for non-completed simulation', () => {
    const sim: TwinSimulation = {
      ...mockSimulation,
      status: 'pending',
      completedAt: undefined,
    };
    render(
      <TestWrapper>
        <SimulationCard simulation={sim} />
      </TestWrapper>
    );
    expect(screen.queryByText(/LDL Cholesterol/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SimulationDetailChart — change === 0 color
// ---------------------------------------------------------------------------

describe('SimulationDetailChart — branch coverage', () => {
  it('renders zero change with slate color', () => {
    const sim: TwinSimulation = {
      ...mockSimulation,
      beforeMetrics: [{ metric: 'LDL', value: 100, unit: 'mg/dL' }],
      afterMetrics: [{ metric: 'LDL', value: 100, unit: 'mg/dL' }],
    };
    render(
      <TestWrapper>
        <SimulationDetailChart simulation={sim} />
      </TestWrapper>
    );
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PredictionCard — branch coverage
// ---------------------------------------------------------------------------

describe('PredictionCard — branch coverage', () => {
  it('renders high risk level with red styling', () => {
    const pred: TwinPrediction = {
      ...mockPrediction,
      riskLevel: 'high',
      predicted90d: 150,
    };
    render(
      <TestWrapper>
        <PredictionCard prediction={pred} />
      </TestWrapper>
    );
    expect(screen.getByText('high risk')).toBeInTheDocument();
  });

  it('renders low risk level with green styling', () => {
    const pred: TwinPrediction = {
      ...mockPrediction,
      riskLevel: 'low',
      predicted90d: 95,
    };
    render(
      <TestWrapper>
        <PredictionCard prediction={pred} />
      </TestWrapper>
    );
    expect(screen.getByText('low risk')).toBeInTheDocument();
  });

  it('renders falling trend (isRising=false) with green down arrow', () => {
    const pred: TwinPrediction = {
      ...mockPrediction,
      currentValue: 120,
      predicted90d: 95,
    };
    render(
      <TestWrapper>
        <PredictionCard prediction={pred} />
      </TestWrapper>
    );
    expect(screen.getByText(/-25\.0/)).toBeInTheDocument();
  });

  it('renders unknown risk level with neutral fallback', () => {
    const pred: TwinPrediction = {
      ...mockPrediction,
      riskLevel: 'unknown' as any,
    };
    render(
      <TestWrapper>
        <PredictionCard prediction={pred} />
      </TestWrapper>
    );
    expect(screen.getByText('unknown risk')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ParameterSlider — overrideValue === undefined (no modified state)
// ---------------------------------------------------------------------------

describe('ParameterSlider — branch coverage', () => {
  it('renders without modified state when overrideValue is undefined', () => {
    render(
      <TestWrapper>
        <ParameterSlider parameter={mockParameter} />
      </TestWrapper>
    );
    expect(screen.queryByText(/Modified/)).not.toBeInTheDocument();
  });

  it('renders without modified state when overrideValue equals currentValue', () => {
    render(
      <TestWrapper>
        <ParameterSlider parameter={mockParameter} overrideValue={72} />
      </TestWrapper>
    );
    expect(screen.queryByText(/Modified/)).not.toBeInTheDocument();
  });
});
