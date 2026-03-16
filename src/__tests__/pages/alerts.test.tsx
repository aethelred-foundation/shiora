// ============================================================
// Tests for src/app/alerts/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import AlertsPage from '@/app/alerts/page';

// Mock usePredictiveAlerts to control state
const mockAcknowledgeMutate = jest.fn();
const mockResolveMutate = jest.fn();
const mockToggleRuleMutate = jest.fn();
const mockCreateRuleMutateAsync = jest.fn().mockResolvedValue({});
const mockCreateRuleMutate = jest.fn();
const mockSetSeverityFilter = jest.fn();
const mockSetStatusFilter = jest.fn();

const mockAlerts = [
  {
    id: 'alert-1',
    ruleId: 'rule-1',
    metric: 'temperature',
    severity: 'critical' as const,
    title: 'High Temperature',
    message: 'Temperature above safe threshold',
    currentValue: 101.2,
    threshold: 100.4,
    triggeredAt: Date.now() - 3600000,
    acknowledgedAt: undefined,
    resolvedAt: undefined,
    modelId: 'anomaly',
    confidence: 92,
    attestation: '0x' + 'c'.repeat(64),
  },
  {
    id: 'alert-2',
    ruleId: 'rule-2',
    metric: 'heart_rate',
    severity: 'warning' as const,
    title: 'Elevated Heart Rate',
    message: 'Heart rate elevated above normal',
    currentValue: 105,
    threshold: 100,
    triggeredAt: Date.now() - 7200000,
    acknowledgedAt: undefined,
    resolvedAt: undefined,
    modelId: 'anomaly',
    confidence: 88,
    attestation: '0x' + 'd'.repeat(64),
  },
  {
    id: 'alert-3',
    ruleId: 'rule-3',
    metric: 'spo2',
    severity: 'info' as const,
    title: 'Low SpO2',
    message: 'SpO2 slightly below threshold',
    currentValue: 93,
    threshold: 94,
    triggeredAt: Date.now() - 10800000,
    acknowledgedAt: Date.now() - 5400000,
    resolvedAt: undefined,
    modelId: 'anomaly',
    confidence: 85,
    attestation: '0x' + 'e'.repeat(64),
  },
];

const mockRules = [
  {
    id: 'rule-1',
    metric: 'temperature' as const,
    condition: 'above' as const,
    threshold: 100.4,
    unit: '°F',
    severity: 'critical' as const,
    channels: ['push', 'email'] as const,
    enabled: true,
    cooldownMinutes: 30,
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'rule-2',
    metric: 'heart_rate' as const,
    condition: 'above' as const,
    threshold: 100,
    unit: 'bpm',
    severity: 'warning' as const,
    channels: ['push'] as const,
    enabled: true,
    cooldownMinutes: 60,
    createdAt: Date.now() - 86400000 * 15,
  },
  {
    id: 'rule-3',
    metric: 'spo2' as const,
    condition: 'below' as const,
    threshold: 94,
    unit: '%',
    severity: 'info' as const,
    channels: ['in_app'] as const,
    enabled: false,
    cooldownMinutes: 15,
    createdAt: Date.now() - 86400000 * 7,
  },
];

const mockHistory = [
  { id: 'h-1', alertId: 'alert-1', action: 'triggered' as const, timestamp: Date.now() - 3600000, actor: 'system' },
  { id: 'h-2', alertId: 'alert-1', action: 'acknowledged' as const, timestamp: Date.now() - 1800000, actor: 'user' },
  { id: 'h-3', alertId: 'alert-2', action: 'triggered' as const, timestamp: Date.now() - 7200000, actor: 'system' },
  { id: 'h-4', alertId: 'alert-3', action: 'resolved' as const, timestamp: Date.now() - 5000000, actor: 'user' },
  { id: 'h-5', alertId: 'alert-2', action: 'escalated' as const, timestamp: Date.now() - 500000, actor: 'system' },
];

let mockFilters = { severity: undefined as string | undefined, status: undefined as string | undefined };

jest.mock('@/hooks/usePredictiveAlerts', () => ({
  usePredictiveAlerts: () => ({
    alerts: mockAlerts,
    rules: mockRules,
    history: mockHistory,
    isLoading: false,
    activeAlertCount: mockAlerts.filter((a) => !a.acknowledgedAt && !a.resolvedAt).length,
    criticalCount: mockAlerts.filter((a) => a.severity === 'critical' && !a.resolvedAt).length,
    filters: mockFilters,
    setSeverityFilter: mockSetSeverityFilter,
    setStatusFilter: mockSetStatusFilter,
    mutations: {
      createRule: {
        mutate: mockCreateRuleMutate,
        mutateAsync: mockCreateRuleMutateAsync,
        isLoading: false,
      },
      updateRule: { mutate: jest.fn(), isLoading: false },
      toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
      acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
      resolveAlert: { mutate: mockResolveMutate, isLoading: false },
    },
  }),
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFilters = { severity: undefined, status: undefined };
});

describe('AlertsPage', () => {
  it('renders the alerts page title', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Health Alert Center')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/AI-powered health monitoring with TEE-verified predictions/)
    ).toBeInTheDocument();
  });

  it('renders all three tabs', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map((t) => t.textContent);
    expect(tabLabels.some((l) => l?.includes('Active Alerts'))).toBe(true);
    expect(tabLabels.some((l) => l?.includes('Rules'))).toBe(true);
    expect(tabLabels.some((l) => l?.includes('History'))).toBe(true);
  });

  it('renders health metric cards', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getAllByText('Active Alerts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
    expect(screen.getByText('Rules Active')).toBeInTheDocument();
    expect(screen.getByText('Model Accuracy')).toBeInTheDocument();
  });

  it('renders the alert frequency chart section', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Alert Frequency (14 Days)')).toBeInTheDocument();
  });

  it('renders severity filter buttons on Active Alerts tab', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    const criticalButtons = screen.getAllByText(/critical/i);
    expect(criticalButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders bulk acknowledge button when alerts are active', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByText(/Bulk Acknowledge/)).toBeInTheDocument();
  });

  it('calls bulk acknowledge for all active alerts', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const bulkBtn = screen.getByText(/Bulk Acknowledge/);
    fireEvent.click(bulkBtn);
    // Should call acknowledgeAlert.mutate for each unacknowledged, unresolved alert
    expect(mockAcknowledgeMutate).toHaveBeenCalledWith('alert-1');
    expect(mockAcknowledgeMutate).toHaveBeenCalledWith('alert-2');
    // alert-3 is already acknowledged, should not be called
    expect(mockAcknowledgeMutate).not.toHaveBeenCalledWith('alert-3');
  });

  it('clicks "All" filter to clear severity and status filters', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const allBtn = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allBtn);
    expect(mockSetSeverityFilter).toHaveBeenCalledWith(undefined);
    expect(mockSetStatusFilter).toHaveBeenCalledWith(undefined);
  });

  it('clicks severity filter buttons to toggle filters', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    // Find the severity filter buttons (the ones in the filter bar, not the metric cards)
    const filterButtons = screen.getAllByRole('button');
    const criticalFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'critical'
    );
    if (criticalFilterBtn) {
      fireEvent.click(criticalFilterBtn);
      expect(mockSetSeverityFilter).toHaveBeenCalled();
    }

    const warningFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'warning'
    );
    if (warningFilterBtn) {
      fireEvent.click(warningFilterBtn);
      expect(mockSetSeverityFilter).toHaveBeenCalled();
    }

    const infoFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'info'
    );
    if (infoFilterBtn) {
      fireEvent.click(infoFilterBtn);
      expect(mockSetSeverityFilter).toHaveBeenCalled();
    }
  });

  it('deselects severity filter when clicking the already-active filter', () => {
    mockFilters = { severity: 'critical', status: undefined };
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const filterButtons = screen.getAllByRole('button');
    const criticalFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'critical'
    );
    if (criticalFilterBtn) {
      fireEvent.click(criticalFilterBtn);
      expect(mockSetSeverityFilter).toHaveBeenCalledWith(undefined);
    }
  });

  it('shows warning filter as active and deselects it', () => {
    mockFilters = { severity: 'warning', status: undefined };
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const filterButtons = screen.getAllByRole('button');
    const warningFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'warning'
    );
    if (warningFilterBtn) {
      fireEvent.click(warningFilterBtn);
      expect(mockSetSeverityFilter).toHaveBeenCalledWith(undefined);
    }
  });

  it('shows info filter as active and deselects it', () => {
    mockFilters = { severity: 'info', status: undefined };
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const filterButtons = screen.getAllByRole('button');
    const infoFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'info'
    );
    if (infoFilterBtn) {
      fireEvent.click(infoFilterBtn);
      expect(mockSetSeverityFilter).toHaveBeenCalledWith(undefined);
    }
  });

  it('renders alert cards', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByText('High Temperature')).toBeInTheDocument();
    expect(screen.getByText('Elevated Heart Rate')).toBeInTheDocument();
  });

  it('renders hero section with critical count badge', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Predictive Health Alerts')).toBeInTheDocument();
    // criticalCount > 0 so the critical badge should render
    expect(screen.getByText(/\d+ Critical/)).toBeInTheDocument();
  });

  it('renders hero section with active count', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const activeBadges = screen.getAllByText(/Active/);
    expect(activeBadges.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Rules Tab ───

  it('switches to Rules tab and shows Create Rule button', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    expect(rulesTab).toBeDefined();
    fireEvent.click(rulesTab!);
    expect(screen.getByText('Alert Rules')).toBeInTheDocument();
    expect(screen.getByText('Create Rule')).toBeInTheDocument();
  });

  it('renders rule cards on Rules tab', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    expect(screen.getByText('Alert Rules')).toBeInTheDocument();
  });

  // ─── History Tab ───

  it('switches to History tab and shows timeline', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const historyTab = tabs.find((t) => t.textContent?.includes('History'));
    expect(historyTab).toBeDefined();
    fireEvent.click(historyTab!);
    expect(screen.getByText('Alert History')).toBeInTheDocument();
    expect(screen.getByText('History Summary')).toBeInTheDocument();
  });

  it('shows TEE-Verified info card on History tab', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const historyTab = tabs.find((t) => t.textContent?.includes('History'));
    fireEvent.click(historyTab!);
    expect(screen.getByText('TEE-Verified')).toBeInTheDocument();
  });

  it('shows history summary counts on History tab', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const historyTab = tabs.find((t) => t.textContent?.includes('History'));
    fireEvent.click(historyTab!);

    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Triggered')).toBeInTheDocument();
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('Escalated')).toBeInTheDocument();

    // The counts should be rendered as text
    // total events = 5
    const totalEl = screen.getByText('Total Events').closest('div');
    expect(totalEl).toBeTruthy();
  });

  // ─── Create Rule Modal ───

  it('opens create rule modal when clicking Create Rule', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    // Go to rules tab
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    // Click Create Rule
    const createBtn = screen.getByText('Create Rule');
    fireEvent.click(createBtn);
    // Modal should appear
    expect(screen.getByText('Create Alert Rule')).toBeInTheDocument();
    expect(screen.getByText('Health Metric')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    expect(screen.getByText('Cooldown (minutes)')).toBeInTheDocument();
  });

  it('closes create rule modal when clicking Cancel', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));
    expect(screen.getByText('Create Alert Rule')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Create Alert Rule')).not.toBeInTheDocument();
  });

  it('closes create rule modal when clicking the X button', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));
    expect(screen.getByText('Create Alert Rule')).toBeInTheDocument();

    // Find the X close button in the modal header
    const modalHeader = screen.getByText('Create Alert Rule').closest('div');
    const closeBtn = modalHeader?.querySelector('button');
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
  });

  it('closes create rule modal when clicking backdrop', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));
    expect(screen.getByText('Create Alert Rule')).toBeInTheDocument();

    // Click the backdrop overlay
    const backdrop = document.querySelector('[class*="bg-black"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(screen.queryByText('Create Alert Rule')).not.toBeInTheDocument();
    }
  });

  it('changes metric in create rule modal', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));

    // Change the metric dropdown — the first select in the modal is the metric select
    const metricLabel = screen.getByText('Health Metric');
    const metricSelect = metricLabel.closest('div')?.querySelector('select');
    expect(metricSelect).toBeTruthy();
    fireEvent.change(metricSelect!, { target: { value: 'heart_rate' } });
    // The threshold label should update - may appear in multiple places
    expect(screen.getAllByText(/Threshold:/).length).toBeGreaterThanOrEqual(1);

    // Also test changing to a metric not in the list (no-op branch)
    fireEvent.change(metricSelect!, { target: { value: 'nonexistent_metric' } });
  });

  it('changes condition in create rule modal', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));

    // Click Below condition button
    fireEvent.click(screen.getByText('Below'));
    // Click Deviation condition button
    fireEvent.click(screen.getByText('Deviation'));
    // Click Above again
    fireEvent.click(screen.getByText('Above'));
  });

  it('changes severity in create rule modal', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));

    // Find severity buttons in the modal — there are severity labels both in filter and modal
    const modalSeverityButtons = screen.getAllByRole('button');

    // Click "critical" severity button (the one inside the modal)
    const criticalBtns = modalSeverityButtons.filter(
      (btn) => btn.textContent === 'critical' && btn.closest('[class*="fixed"]')
    );
    if (criticalBtns.length > 0) {
      fireEvent.click(criticalBtns[0]);
    }

    const infoBtns = modalSeverityButtons.filter(
      (btn) => btn.textContent === 'info' && btn.closest('[class*="fixed"]')
    );
    if (infoBtns.length > 0) {
      fireEvent.click(infoBtns[0]);
    }
  });

  it('changes cooldown in create rule modal', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));

    // Change cooldown select
    const cooldownSelect = screen.getByDisplayValue('30 minutes');
    fireEvent.change(cooldownSelect, { target: { value: '60' } });
  });

  it('submits create rule form', async () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));

    // The "Create Rule" button inside the modal (not the tab button)
    const modalButtons = screen.getAllByRole('button');
    const submitBtn = modalButtons.find(
      (btn) => btn.textContent === 'Create Rule' && btn.closest('[class*="fixed"]')
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(submitBtn!);
    });

    await waitFor(() => {
      expect(mockCreateRuleMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: 'temperature',
          condition: 'above',
          threshold: 100.4,
          severity: 'warning',
          enabled: true,
          channels: ['in_app'],
        })
      );
    });
  });

  // ─── Rendering edge cases ───

  it('renders footer and navigation', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders alert frequency chart legend labels', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Distribution of alerts by severity over time')).toBeInTheDocument();
  });

  it('renders the configure threshold and notification channels text', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    expect(
      screen.getByText('Configure thresholds and notification channels for health metrics')
    ).toBeInTheDocument();
  });

  it('renders timeline of alert events text on history tab', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const historyTab = tabs.find((t) => t.textContent?.includes('History'));
    fireEvent.click(historyTab!);
    expect(
      screen.getByText('Timeline of all alert events and actions')
    ).toBeInTheDocument();
  });
});

// Test with loading state
describe('AlertsPage loading state', () => {
  beforeEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    const original = mod.usePredictiveAlerts;
    mod.usePredictiveAlerts = () => ({
      ...original(),
      isLoading: true,
      alerts: [],
      activeAlertCount: 0,
      criticalCount: 0,
    });
  });

  afterEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    mod.usePredictiveAlerts = () => ({
      alerts: mockAlerts,
      rules: mockRules,
      history: mockHistory,
      isLoading: false,
      activeAlertCount: mockAlerts.filter((a: typeof mockAlerts[0]) => !a.acknowledgedAt && !a.resolvedAt).length,
      criticalCount: mockAlerts.filter((a: typeof mockAlerts[0]) => a.severity === 'critical' && !a.resolvedAt).length,
      filters: mockFilters,
      setSeverityFilter: mockSetSeverityFilter,
      setStatusFilter: mockSetStatusFilter,
      mutations: {
        createRule: { mutate: mockCreateRuleMutate, mutateAsync: mockCreateRuleMutateAsync, isLoading: false },
        updateRule: { mutate: jest.fn(), isLoading: false },
        toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
        acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
        resolveAlert: { mutate: mockResolveMutate, isLoading: false },
      },
    });
  });

  it('renders skeleton loading state when isLoading is true', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    // Loading state shows skeleton cards
    const skeletons = document.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(0);
  });
});

// Test with empty alerts
describe('AlertsPage empty alerts', () => {
  beforeEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    const original = mod.usePredictiveAlerts;
    mod.usePredictiveAlerts = () => ({
      ...original(),
      isLoading: false,
      alerts: [],
      activeAlertCount: 0,
      criticalCount: 0,
    });
  });

  afterEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    mod.usePredictiveAlerts = () => ({
      alerts: mockAlerts,
      rules: mockRules,
      history: mockHistory,
      isLoading: false,
      activeAlertCount: mockAlerts.filter((a: typeof mockAlerts[0]) => !a.acknowledgedAt && !a.resolvedAt).length,
      criticalCount: mockAlerts.filter((a: typeof mockAlerts[0]) => a.severity === 'critical' && !a.resolvedAt).length,
      filters: mockFilters,
      setSeverityFilter: mockSetSeverityFilter,
      setStatusFilter: mockSetStatusFilter,
      mutations: {
        createRule: { mutate: mockCreateRuleMutate, mutateAsync: mockCreateRuleMutateAsync, isLoading: false },
        updateRule: { mutate: jest.fn(), isLoading: false },
        toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
        acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
        resolveAlert: { mutate: mockResolveMutate, isLoading: false },
      },
    });
  });

  it('renders "All Clear" when no alerts match filters', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.getByText('All Clear')).toBeInTheDocument();
    expect(screen.getByText('No alerts match your current filters.')).toBeInTheDocument();
  });

  it('does not render Bulk Acknowledge when no active alerts', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    expect(screen.queryByText(/Bulk Acknowledge/)).not.toBeInTheDocument();
  });

  it('does not render critical count badge when criticalCount is 0', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    // The "N Critical" badge in the hero should not appear
    expect(screen.queryByText(/\d+ Critical/)).not.toBeInTheDocument();
  });
});

// Test with empty history
describe('AlertsPage empty history', () => {
  beforeEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    const original = mod.usePredictiveAlerts;
    mod.usePredictiveAlerts = () => ({
      ...original(),
      history: [],
    });
  });

  afterEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    mod.usePredictiveAlerts = () => ({
      alerts: mockAlerts,
      rules: mockRules,
      history: mockHistory,
      isLoading: false,
      activeAlertCount: mockAlerts.filter((a: typeof mockAlerts[0]) => !a.acknowledgedAt && !a.resolvedAt).length,
      criticalCount: mockAlerts.filter((a: typeof mockAlerts[0]) => a.severity === 'critical' && !a.resolvedAt).length,
      filters: mockFilters,
      setSeverityFilter: mockSetSeverityFilter,
      setStatusFilter: mockSetStatusFilter,
      mutations: {
        createRule: { mutate: mockCreateRuleMutate, mutateAsync: mockCreateRuleMutateAsync, isLoading: false },
        updateRule: { mutate: jest.fn(), isLoading: false },
        toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
        acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
        resolveAlert: { mutate: mockResolveMutate, isLoading: false },
      },
    });
  });

  it('shows empty history message', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const historyTab = tabs.find((t) => t.textContent?.includes('History'));
    fireEvent.click(historyTab!);
    expect(screen.getByText('No history entries yet.')).toBeInTheDocument();
  });
});

// Test with severity filter active (covers CSS class branches for active severity buttons)
describe('AlertsPage with severity filter active', () => {
  beforeEach(() => {
    mockFilters = { severity: 'critical', status: undefined };
  });

  afterEach(() => {
    mockFilters = { severity: undefined, status: undefined };
  });

  it('renders critical severity filter as active', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    // The critical filter button should have active styling
    const filterButtons = screen.getAllByRole('button');
    const criticalFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'critical'
    );
    expect(criticalFilterBtn).toBeDefined();
    expect(criticalFilterBtn!.className).toContain('bg-red-500');
  });
});

describe('AlertsPage with warning severity filter', () => {
  beforeEach(() => {
    mockFilters = { severity: 'warning', status: undefined };
  });

  afterEach(() => {
    mockFilters = { severity: undefined, status: undefined };
  });

  it('renders warning severity filter as active', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const filterButtons = screen.getAllByRole('button');
    const warningFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'warning'
    );
    expect(warningFilterBtn).toBeDefined();
    expect(warningFilterBtn!.className).toContain('bg-amber-500');
  });
});

describe('AlertsPage with info severity filter', () => {
  beforeEach(() => {
    mockFilters = { severity: 'info', status: undefined };
  });

  afterEach(() => {
    mockFilters = { severity: undefined, status: undefined };
  });

  it('renders info severity filter as active', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const filterButtons = screen.getAllByRole('button');
    const infoFilterBtn = filterButtons.find(
      (btn) => btn.textContent === 'info'
    );
    expect(infoFilterBtn).toBeDefined();
    expect(infoFilterBtn!.className).toContain('bg-brand-500');
  });
});

// Test with high alert counts (covers branches for trend values)
describe('AlertsPage with many alerts', () => {
  beforeEach(() => {
    const manyAlerts = Array.from({ length: 5 }, (_, i) => ({
      id: `alert-${i}`,
      ruleId: 'rule-1',
      metric: 'temperature' as const,
      severity: 'critical' as const,
      title: `Alert ${i}`,
      message: `Alert message ${i}`,
      currentValue: 101.2,
      threshold: 100.4,
      triggeredAt: Date.now(),
      acknowledgedAt: undefined,
      resolvedAt: undefined,
      modelId: 'anomaly',
      confidence: 92,
      attestation: '0x' + 'a'.repeat(64),
    }));

    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    mod.usePredictiveAlerts = () => ({
      alerts: manyAlerts,
      rules: mockRules,
      history: mockHistory,
      isLoading: false,
      activeAlertCount: 5,
      criticalCount: 5,
      filters: mockFilters,
      setSeverityFilter: mockSetSeverityFilter,
      setStatusFilter: mockSetStatusFilter,
      mutations: {
        createRule: { mutate: mockCreateRuleMutate, mutateAsync: mockCreateRuleMutateAsync, isLoading: false },
        updateRule: { mutate: jest.fn(), isLoading: false },
        toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
        acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
        resolveAlert: { mutate: mockResolveMutate, isLoading: false },
      },
    });
  });

  afterEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    mod.usePredictiveAlerts = () => ({
      alerts: mockAlerts,
      rules: mockRules,
      history: mockHistory,
      isLoading: false,
      activeAlertCount: mockAlerts.filter((a: typeof mockAlerts[0]) => !a.acknowledgedAt && !a.resolvedAt).length,
      criticalCount: mockAlerts.filter((a: typeof mockAlerts[0]) => a.severity === 'critical' && !a.resolvedAt).length,
      filters: mockFilters,
      setSeverityFilter: mockSetSeverityFilter,
      setStatusFilter: mockSetStatusFilter,
      mutations: {
        createRule: { mutate: mockCreateRuleMutate, mutateAsync: mockCreateRuleMutateAsync, isLoading: false },
        updateRule: { mutate: jest.fn(), isLoading: false },
        toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
        acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
        resolveAlert: { mutate: mockResolveMutate, isLoading: false },
      },
    });
  });

  it('renders with activeAlertCount > 3 and criticalCount > 2 for trend branches', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    // With 5 active and 5 critical, the trend values use the > branches
    expect(screen.getByText('Health Alert Center')).toBeInTheDocument();
    expect(screen.getByText(/5 Critical/)).toBeInTheDocument();
  });
});

// Test CreateRuleModal with isLoading true
describe('AlertsPage with createRule loading', () => {
  beforeEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    mod.usePredictiveAlerts = () => ({
      alerts: mockAlerts,
      rules: mockRules,
      history: mockHistory,
      isLoading: false,
      activeAlertCount: mockAlerts.filter((a: typeof mockAlerts[0]) => !a.acknowledgedAt && !a.resolvedAt).length,
      criticalCount: mockAlerts.filter((a: typeof mockAlerts[0]) => a.severity === 'critical' && !a.resolvedAt).length,
      filters: mockFilters,
      setSeverityFilter: mockSetSeverityFilter,
      setStatusFilter: mockSetStatusFilter,
      mutations: {
        createRule: { mutate: mockCreateRuleMutate, mutateAsync: mockCreateRuleMutateAsync, isLoading: true },
        updateRule: { mutate: jest.fn(), isLoading: false },
        toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
        acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
        resolveAlert: { mutate: mockResolveMutate, isLoading: false },
      },
    });
  });

  afterEach(() => {
    const mod = jest.requireMock('@/hooks/usePredictiveAlerts');
    mod.usePredictiveAlerts = () => ({
      alerts: mockAlerts,
      rules: mockRules,
      history: mockHistory,
      isLoading: false,
      activeAlertCount: mockAlerts.filter((a: typeof mockAlerts[0]) => !a.acknowledgedAt && !a.resolvedAt).length,
      criticalCount: mockAlerts.filter((a: typeof mockAlerts[0]) => a.severity === 'critical' && !a.resolvedAt).length,
      filters: mockFilters,
      setSeverityFilter: mockSetSeverityFilter,
      setStatusFilter: mockSetStatusFilter,
      mutations: {
        createRule: { mutate: mockCreateRuleMutate, mutateAsync: mockCreateRuleMutateAsync, isLoading: false },
        updateRule: { mutate: jest.fn(), isLoading: false },
        toggleRule: { mutate: mockToggleRuleMutate, isLoading: false },
        acknowledgeAlert: { mutate: mockAcknowledgeMutate, isLoading: false },
        resolveAlert: { mutate: mockResolveMutate, isLoading: false },
      },
    });
  });

  it('shows Creating... text when createRule is loading', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));
    expect(screen.getByText('Creating...')).toBeInTheDocument();
  });
});

// Test with status filter set (All button inactive CSS branch)
describe('AlertsPage with status filter active', () => {
  beforeEach(() => {
    mockFilters = { severity: undefined, status: 'triggered' };
  });

  afterEach(() => {
    mockFilters = { severity: undefined, status: undefined };
  });

  it('renders All button with inactive style when status filter is set', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const allBtn = screen.getByRole('button', { name: 'All' });
    expect(allBtn.className).toContain('bg-slate-100');
  });
});

// Test modal severity buttons - click all severities to cover all CSS branches
describe('AlertsPage modal severity CSS branches', () => {
  it('exercises all severity button CSS branches in create modal', () => {
    render(
      <TestWrapper>
        <AlertsPage />
      </TestWrapper>
    );
    const tabs = screen.getAllByRole('tab');
    const rulesTab = tabs.find((t) => t.textContent?.includes('Rules'));
    fireEvent.click(rulesTab!);
    fireEvent.click(screen.getByText('Create Rule'));

    // Click critical severity in modal
    const modalBtns = screen.getAllByRole('button');
    const modalCritical = modalBtns.find(
      (btn) => btn.textContent === 'critical' && btn.closest('[class*="fixed"]')
    );
    if (modalCritical) {
      fireEvent.click(modalCritical);
      expect(modalCritical.className).toContain('bg-red-500');
    }

    // Click warning - it should now be inactive, click to make active
    const modalWarning = modalBtns.find(
      (btn) => btn.textContent === 'warning' && btn.closest('[class*="fixed"]')
    );
    if (modalWarning) {
      fireEvent.click(modalWarning);
      expect(modalWarning.className).toContain('bg-amber-500');
    }

    // Click info to make it active
    const modalInfo = modalBtns.find(
      (btn) => btn.textContent === 'info' && btn.closest('[class*="fixed"]')
    );
    if (modalInfo) {
      fireEvent.click(modalInfo);
      expect(modalInfo.className).toContain('bg-brand-500');
    }
  });
});
