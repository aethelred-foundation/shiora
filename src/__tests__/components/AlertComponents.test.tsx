// ============================================================
// Tests for src/components/alerts/AlertComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  AlertCard,
  AlertRuleCard,
  ThresholdSlider,
  AlertTimeline,
  ChannelSelector,
} from '@/components/alerts/AlertComponents';
import type {
  PredictiveAlert,
  AlertRule,
  AlertHistory,
  AlertChannel,
} from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client: qc },
    React.createElement(AppProvider, null, children));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockAlert: PredictiveAlert = {
  id: 'alert-1',
  ruleId: 'rule-1',
  metric: 'heart_rate',
  severity: 'warning',
  title: 'Elevated Heart Rate',
  message: 'Your heart rate has been consistently elevated.',
  currentValue: 105,
  threshold: 100,
  triggeredAt: Date.now() - 3600000,
  confidence: 88,
  attestation: '0xabc123def456abc123def456abc123def456abc123',
};

const mockActiveAlert: PredictiveAlert = {
  ...mockAlert,
  id: 'alert-active',
};

const mockAcknowledgedAlert: PredictiveAlert = {
  ...mockAlert,
  id: 'alert-ack',
  acknowledgedAt: Date.now() - 1800000,
};

const mockResolvedAlert: PredictiveAlert = {
  ...mockAlert,
  id: 'alert-resolved',
  resolvedAt: Date.now() - 900000,
};

const mockRule: AlertRule = {
  id: 'rule-1',
  metric: 'heart_rate',
  condition: 'above',
  threshold: 100,
  unit: 'bpm',
  severity: 'warning',
  channels: ['in_app', 'email'],
  enabled: true,
  cooldownMinutes: 30,
  createdAt: Date.now() - 86400000,
};

const mockHistory: AlertHistory[] = [
  {
    id: 'hist-1',
    alertId: 'alert-1',
    action: 'triggered',
    timestamp: Date.now() - 7200000,
    actor: 'System',
    notes: 'Threshold exceeded',
  },
  {
    id: 'hist-2',
    alertId: 'alert-1',
    action: 'acknowledged',
    timestamp: Date.now() - 3600000,
    actor: 'User',
  },
];

// ---------------------------------------------------------------------------
// AlertCard
// ---------------------------------------------------------------------------

describe('AlertCard', () => {
  it('renders alert title and message', () => {
    render(
      <TestWrapper>
        <AlertCard alert={mockAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('Elevated Heart Rate')).toBeInTheDocument();
    expect(screen.getByText(/consistently elevated/)).toBeInTheDocument();
  });

  it('renders severity badge', () => {
    render(
      <TestWrapper>
        <AlertCard alert={mockAlert} />
      </TestWrapper>
    );
    expect(screen.getAllByText('warning').length).toBeGreaterThan(0);
  });

  it('renders confidence percentage', () => {
    render(
      <TestWrapper>
        <AlertCard alert={mockAlert} />
      </TestWrapper>
    );
    expect(screen.getByText(/88% confidence/)).toBeInTheDocument();
  });

  it('shows Active badge for unacknowledged alert', () => {
    render(
      <TestWrapper>
        <AlertCard alert={mockActiveAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Acknowledged badge', () => {
    render(
      <TestWrapper>
        <AlertCard alert={mockAcknowledgedAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
  });

  it('shows Resolved badge', () => {
    render(
      <TestWrapper>
        <AlertCard alert={mockResolvedAlert} />
      </TestWrapper>
    );
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('calls onAcknowledge when acknowledge button clicked', () => {
    const onAcknowledge = jest.fn();
    render(
      <TestWrapper>
        <AlertCard alert={mockActiveAlert} onAcknowledge={onAcknowledge} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Acknowledge'));
    expect(onAcknowledge).toHaveBeenCalledWith('alert-active');
  });

  it('calls onResolve when resolve button clicked', () => {
    const onResolve = jest.fn();
    render(
      <TestWrapper>
        <AlertCard alert={mockActiveAlert} onResolve={onResolve} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Resolve'));
    expect(onResolve).toHaveBeenCalledWith('alert-active');
  });
});

// ---------------------------------------------------------------------------
// AlertRuleCard
// ---------------------------------------------------------------------------

describe('AlertRuleCard', () => {
  it('renders metric label', () => {
    render(
      <TestWrapper>
        <AlertRuleCard rule={mockRule} />
      </TestWrapper>
    );
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
  });

  it('renders condition and threshold', () => {
    render(
      <TestWrapper>
        <AlertRuleCard rule={mockRule} />
      </TestWrapper>
    );
    expect(screen.getByText(/Above 100 bpm/)).toBeInTheDocument();
  });

  it('renders cooldown time', () => {
    render(
      <TestWrapper>
        <AlertRuleCard rule={mockRule} />
      </TestWrapper>
    );
    expect(screen.getByText(/Cooldown: 30min/)).toBeInTheDocument();
  });

  it('calls onToggle when toggle button clicked', () => {
    const onToggle = jest.fn();
    render(
      <TestWrapper>
        <AlertRuleCard rule={mockRule} onToggle={onToggle} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByTitle('Disable rule'));
    expect(onToggle).toHaveBeenCalledWith('rule-1');
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = jest.fn();
    render(
      <TestWrapper>
        <AlertRuleCard rule={mockRule} onEdit={onEdit} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(mockRule);
  });

  it('renders disabled rule with correct toggle title', () => {
    const disabledRule = { ...mockRule, enabled: false };
    render(
      <TestWrapper>
        <AlertRuleCard rule={disabledRule} />
      </TestWrapper>
    );
    expect(screen.getByTitle('Enable rule')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ThresholdSlider
// ---------------------------------------------------------------------------

describe('ThresholdSlider', () => {
  it('renders min, max and threshold labels', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ThresholdSlider
          min={40}
          max={200}
          threshold={100}
          unit="bpm"
          onChange={onChange}
          condition="above"
        />
      </TestWrapper>
    );
    expect(screen.getByText(/40 bpm/)).toBeInTheDocument();
    expect(screen.getByText(/200 bpm/)).toBeInTheDocument();
    expect(screen.getByText(/Threshold: 100 bpm/)).toBeInTheDocument();
  });

  it('renders with current value marker', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ThresholdSlider
          min={40}
          max={200}
          threshold={100}
          currentValue={105}
          unit="bpm"
          onChange={onChange}
          condition="above"
        />
      </TestWrapper>
    );
    // The marker div has a title attribute
    const marker = document.querySelector('[title="Current: 105 bpm"]');
    expect(marker).toBeInTheDocument();
  });

  it('calls onChange when slider value changes', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ThresholdSlider
          min={40}
          max={200}
          threshold={100}
          unit="bpm"
          onChange={onChange}
          condition="above"
        />
      </TestWrapper>
    );
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '120' } });
    expect(onChange).toHaveBeenCalledWith(120);
  });
});

// ---------------------------------------------------------------------------
// AlertTimeline
// ---------------------------------------------------------------------------

describe('AlertTimeline', () => {
  it('renders history entries', () => {
    render(
      <TestWrapper>
        <AlertTimeline history={mockHistory} />
      </TestWrapper>
    );
    expect(screen.getByText('triggered')).toBeInTheDocument();
    expect(screen.getByText('acknowledged')).toBeInTheDocument();
  });

  it('renders actor names', () => {
    render(
      <TestWrapper>
        <AlertTimeline history={mockHistory} />
      </TestWrapper>
    );
    expect(screen.getByText(/by System/)).toBeInTheDocument();
    expect(screen.getByText(/by User/)).toBeInTheDocument();
  });

  it('renders notes when present', () => {
    render(
      <TestWrapper>
        <AlertTimeline history={mockHistory} />
      </TestWrapper>
    );
    expect(screen.getByText('Threshold exceeded')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ChannelSelector
// ---------------------------------------------------------------------------

describe('ChannelSelector', () => {
  it('renders channel options', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ChannelSelector selected={[]} onChange={onChange} />
      </TestWrapper>
    );
    expect(screen.getByText('In-App')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('calls onChange when channel toggled', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ChannelSelector selected={[]} onChange={onChange} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('In-App').closest('button')!);
    expect(onChange).toHaveBeenCalled();
  });

  it('shows selected channels as highlighted', () => {
    const onChange = jest.fn();
    const { container } = render(
      <TestWrapper>
        <ChannelSelector selected={['in_app' as AlertChannel]} onChange={onChange} />
      </TestWrapper>
    );
    // Selected button has brand styling
    const selectedBtn = container.querySelector('.border-brand-300');
    expect(selectedBtn).toBeInTheDocument();
  });

  it('removes channel when already-selected channel is toggled', () => {
    const onChange = jest.fn();
    render(
      <TestWrapper>
        <ChannelSelector selected={['in_app' as AlertChannel, 'email' as AlertChannel]} onChange={onChange} />
      </TestWrapper>
    );
    // Click In-App to deselect it
    fireEvent.click(screen.getByText('In-App').closest('button')!);
    expect(onChange).toHaveBeenCalledWith(['email']);
  });
});

// ---------------------------------------------------------------------------
// AlertCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('AlertCard — branch coverage', () => {
  it('renders critical severity with red styling', () => {
    const alert: PredictiveAlert = { ...mockAlert, severity: 'critical' };
    render(
      <TestWrapper>
        <AlertCard alert={alert} />
      </TestWrapper>
    );
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('renders info severity with info styling', () => {
    const alert: PredictiveAlert = { ...mockAlert, severity: 'info' };
    render(
      <TestWrapper>
        <AlertCard alert={alert} />
      </TestWrapper>
    );
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('renders metric label fallback for unknown metric', () => {
    const alert: PredictiveAlert = { ...mockAlert, metric: 'unknown_metric' as any };
    render(
      <TestWrapper>
        <AlertCard alert={alert} />
      </TestWrapper>
    );
    expect(screen.getByText('unknown_metric')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AlertRuleCard — additional branch coverage
// ---------------------------------------------------------------------------

describe('AlertRuleCard — branch coverage', () => {
  it('renders below condition label', () => {
    const rule: AlertRule = { ...mockRule, condition: 'below' };
    render(
      <TestWrapper>
        <AlertRuleCard rule={rule} />
      </TestWrapper>
    );
    expect(screen.getByText(/Below 100 bpm/)).toBeInTheDocument();
  });

  it('renders deviation condition label', () => {
    const rule: AlertRule = { ...mockRule, condition: 'deviation' };
    render(
      <TestWrapper>
        <AlertRuleCard rule={rule} />
      </TestWrapper>
    );
    expect(screen.getByText(/Deviation 100 bpm/)).toBeInTheDocument();
  });

  it('renders fallback metric icon for unknown metric', () => {
    const rule: AlertRule = { ...mockRule, metric: 'unknown_metric' as any };
    render(
      <TestWrapper>
        <AlertRuleCard rule={rule} />
      </TestWrapper>
    );
    // METRIC_LABELS fallback also displays the raw metric string
    expect(screen.getByText('unknown_metric')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ThresholdSlider — additional branch coverage
// ---------------------------------------------------------------------------

describe('ThresholdSlider — branch coverage', () => {
  it('renders with below condition', () => {
    render(
      <TestWrapper>
        <ThresholdSlider
          min={40}
          max={200}
          threshold={100}
          unit="bpm"
          onChange={jest.fn()}
          condition="below"
        />
      </TestWrapper>
    );
    expect(screen.getByText(/Threshold: 100 bpm/)).toBeInTheDocument();
  });

  it('renders with deviation condition', () => {
    render(
      <TestWrapper>
        <ThresholdSlider
          min={40}
          max={200}
          threshold={100}
          unit="bpm"
          onChange={jest.fn()}
          condition="deviation"
        />
      </TestWrapper>
    );
    expect(screen.getByText(/Threshold: 100 bpm/)).toBeInTheDocument();
  });

  it('renders without currentValue marker', () => {
    const { container } = render(
      <TestWrapper>
        <ThresholdSlider
          min={40}
          max={200}
          threshold={100}
          unit="bpm"
          onChange={jest.fn()}
          condition="above"
        />
      </TestWrapper>
    );
    expect(container.querySelector('[title^="Current:"]')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AlertTimeline — additional branch coverage
// ---------------------------------------------------------------------------

describe('AlertTimeline — branch coverage', () => {
  it('renders unknown action with fallback triggered style', () => {
    const history: AlertHistory[] = [
      {
        id: 'hist-unknown',
        alertId: 'alert-1',
        action: 'custom_action' as any,
        timestamp: Date.now() - 3600000,
      },
    ];
    render(
      <TestWrapper>
        <AlertTimeline history={history} />
      </TestWrapper>
    );
    expect(screen.getByText('custom_action')).toBeInTheDocument();
  });

  it('renders resolved and escalated actions', () => {
    const history: AlertHistory[] = [
      {
        id: 'hist-resolved',
        alertId: 'alert-1',
        action: 'resolved',
        timestamp: Date.now() - 3600000,
        actor: 'Admin',
      },
      {
        id: 'hist-escalated',
        alertId: 'alert-1',
        action: 'escalated',
        timestamp: Date.now() - 7200000,
        notes: 'Escalated to on-call team',
      },
    ];
    render(
      <TestWrapper>
        <AlertTimeline history={history} />
      </TestWrapper>
    );
    expect(screen.getByText('resolved')).toBeInTheDocument();
    expect(screen.getByText('escalated')).toBeInTheDocument();
    expect(screen.getByText(/by Admin/)).toBeInTheDocument();
    expect(screen.getByText('Escalated to on-call team')).toBeInTheDocument();
  });

  it('renders entry without actor or notes', () => {
    const history: AlertHistory[] = [
      {
        id: 'hist-noactor',
        alertId: 'alert-1',
        action: 'triggered',
        timestamp: Date.now() - 3600000,
      },
    ];
    render(
      <TestWrapper>
        <AlertTimeline history={history} />
      </TestWrapper>
    );
    expect(screen.getByText('triggered')).toBeInTheDocument();
    expect(screen.queryByText(/by /)).not.toBeInTheDocument();
  });
});
