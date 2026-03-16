// ============================================================
// Tests for src/app/twin/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockSetSelectedSimulation = jest.fn();
const mockSetParameterOverride = jest.fn();
const mockResetOverrides = jest.fn();
const mockRunSimulation = { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false, error: null };
const mockRefetch = jest.fn();

let mockOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useDigitalTwin', () => ({
  useDigitalTwin: () => ({
    twin: {
      id: 'twin-1',
      overallHealthScore: 82,
      organScores: [
        { system: 'cardiovascular', score: 88, trend: 'improving', lastUpdated: Date.now() },
        { system: 'respiratory', score: 91, trend: 'stable', lastUpdated: Date.now() },
        { system: 'neurological', score: 79, trend: 'declining', lastUpdated: Date.now() },
        { system: 'musculoskeletal', score: 85, trend: 'improving', lastUpdated: Date.now() },
        { system: 'gastrointestinal', score: 90, trend: 'stable', lastUpdated: Date.now() },
        { system: 'endocrine', score: 84, trend: 'improving', lastUpdated: Date.now() },
        { system: 'immune', score: 87, trend: 'stable', lastUpdated: Date.now() },
        { system: 'renal', score: 92, trend: 'improving', lastUpdated: Date.now() },
        { system: 'hepatic', score: 95, trend: 'stable', lastUpdated: Date.now() },
        { system: 'reproductive', score: 89, trend: 'stable', lastUpdated: Date.now() },
      ],
      simulationCount: 5,
      dataSourceCount: 7,
      modelVersion: 'v2.1.0',
      lastUpdated: Date.now() - 3600000,
      createdAt: Date.now() - 86400000 * 90,
      attestation: '0xabc123def456789',
    },
    simulations: [
      {
        id: 'sim-1',
        twinId: 'twin-1',
        scenario: 'Weight Loss',
        description: 'Simulate 10kg weight loss over 6 months',
        parameters: [],
        status: 'completed',
        startedAt: Date.now() - 86400000 * 30,
        completedAt: Date.now() - 86400000 * 29,
        attestation: '0xsim1attestation',
        txHash: '0xtxhash1',
        confidenceInterval: 92,
        beforeMetrics: [
          { metric: 'Weight', value: 85, unit: 'kg' },
          { metric: 'BMI', value: 28.5, unit: 'kg/m²' },
        ],
        afterMetrics: [
          { metric: 'Weight', value: 75, unit: 'kg' },
          { metric: 'BMI', value: 25.1, unit: 'kg/m²' },
        ],
        trajectoryData: [
          { day: 0, before: 85, after: 85, metric: 'Weight (kg)' },
          { day: 30, before: 85, after: 81, metric: 'Weight (kg)' },
          { day: 60, before: 85, after: 78, metric: 'Weight (kg)' },
          { day: 90, before: 85, after: 75, metric: 'Weight (kg)' },
        ],
      },
      {
        id: 'sim-2',
        twinId: 'twin-1',
        scenario: 'Exercise Increase',
        description: 'Increase daily exercise to 60 minutes',
        parameters: [],
        status: 'completed',
        startedAt: Date.now() - 86400000 * 20,
        completedAt: Date.now() - 86400000 * 19,
        attestation: '0xsim2attestation',
        txHash: '0xtxhash2',
        confidenceInterval: 88,
        beforeMetrics: [
          { metric: 'VO2 Max', value: 38, unit: 'mL/kg/min' },
        ],
        afterMetrics: [
          { metric: 'VO2 Max', value: 42, unit: 'mL/kg/min' },
        ],
        trajectoryData: [
          { day: 0, before: 38, after: 38, metric: 'VO2 Max' },
          { day: 90, before: 38, after: 42, metric: 'VO2 Max' },
        ],
      },
    ],
    parameters: [
      { id: 'p-weight', name: 'Weight', category: 'Physical', currentValue: 75, min: 40, max: 150, unit: 'kg', step: 0.5 },
      { id: 'p-bmi', name: 'BMI', category: 'Physical', currentValue: 24.5, min: 15, max: 45, unit: 'kg/m²', step: 0.1 },
      { id: 'p-steps', name: 'Daily Steps', category: 'Activity', currentValue: 8000, min: 0, max: 30000, unit: 'steps', step: 500 },
      { id: 'p-exercise', name: 'Exercise Minutes', category: 'Activity', currentValue: 30, min: 0, max: 180, unit: 'min', step: 5 },
      { id: 'p-sleep', name: 'Sleep Duration', category: 'Sleep', currentValue: 7.5, min: 3, max: 12, unit: 'hours', step: 0.5 },
      { id: 'p-calories', name: 'Daily Calories', category: 'Diet', currentValue: 2000, min: 1000, max: 4000, unit: 'kcal', step: 100 },
      { id: 'p-stress', name: 'Stress Level', category: 'Stress', currentValue: 4, min: 1, max: 10, unit: '/10', step: 1 },
    ],
    predictions: [
      {
        id: 'pred-1', twinId: 'twin-1', metric: 'HbA1c', currentValue: 5.4,
        predicted30d: 5.3, predicted60d: 5.2, predicted90d: 5.2,
        unit: '%', confidenceBand: 92, riskLevel: 'low',
        recommendations: ['Maintain current diet', 'Continue monitoring'],
        attestation: '0xpred1att', generatedAt: Date.now(),
      },
      {
        id: 'pred-2', twinId: 'twin-1', metric: 'LDL Cholesterol', currentValue: 120,
        predicted30d: 118, predicted60d: 116, predicted90d: 115,
        unit: 'mg/dL', confidenceBand: 88, riskLevel: 'moderate',
        recommendations: ['Increase fiber intake', 'Consider statin therapy review'],
        attestation: '0xpred2att', generatedAt: Date.now(),
      },
      {
        id: 'pred-3', twinId: 'twin-1', metric: 'Blood Pressure', currentValue: 128,
        predicted30d: 126, predicted60d: 125, predicted90d: 124,
        unit: 'mmHg', confidenceBand: 85, riskLevel: 'high',
        recommendations: ['Reduce sodium intake', 'Increase aerobic exercise'],
        attestation: '0xpred3att', generatedAt: Date.now(),
      },
    ],
    timeline: [
      { id: 'evt-1', twinId: 'twin-1', type: 'data_sync', title: 'Data Source Synced', description: 'Wearable data synced', timestamp: Date.now() - 3600000 },
      { id: 'evt-2', twinId: 'twin-1', type: 'simulation', title: 'Simulation: Weight Loss', description: 'Weight loss sim completed', timestamp: Date.now() - 86400000, relatedId: 'sim-1', attestation: '0xsim1attestation' },
      { id: 'evt-3', twinId: 'twin-1', type: 'parameter_update', title: 'Parameters Updated', description: 'Updated physical parameters', timestamp: Date.now() - 86400000 * 5 },
      { id: 'evt-4', twinId: 'twin-1', type: 'prediction', title: '90-Day Predictions Generated', description: 'Biomarker predictions recalculated', timestamp: Date.now() - 86400000 * 10, attestation: '0xpredattestation' },
      { id: 'evt-5', twinId: 'twin-1', type: 'creation', title: 'Digital Twin Created', description: 'Digital twin model initialized', timestamp: Date.now() - 86400000 * 90, attestation: '0xabc123def456789' },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
    selectedSimulation: null,
    setSelectedSimulation: mockSetSelectedSimulation,
    parameterOverrides: {},
    setParameterOverride: mockSetParameterOverride,
    resetOverrides: mockResetOverrides,
    runSimulation: mockRunSimulation,
    refetch: mockRefetch,
    ...mockOverrides,
  }),
}));

import TwinPage from '@/app/twin/page';

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

describe('TwinPage', () => {
  it('renders the page heading', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByText('Digital Health Twin')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(
      screen.getByText(/Comprehensive health simulation engine with TEE-attested predictions/)
    ).toBeInTheDocument();
  });

  it('renders navigation', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders TEE badge', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getAllByText('Intel SGX Verified').length).toBeGreaterThanOrEqual(1);
  });

  it('renders stat cards for health score, organ systems, simulations, and data sources', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getAllByText('Overall Health Score').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Organ Systems')).toBeInTheDocument();
    expect(screen.getAllByText(/Simulations/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Data Sources/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders tab navigation with all five tabs', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByText('My Twin')).toBeInTheDocument();
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByText('Predictions')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
  });

  // --- My Twin Tab ---

  it('renders My Twin tab by default with organ system health section', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByText('Organ System Health')).toBeInTheDocument();
    expect(screen.getByText(/Health scores for each major organ system/)).toBeInTheDocument();
  });

  it('renders data sources card on My Twin tab', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByText('Connected Wearables')).toBeInTheDocument();
    expect(screen.getByText('Records Synced')).toBeInTheDocument();
    expect(screen.getByText('Last Sync')).toBeInTheDocument();
  });

  it('renders model version badge on My Twin tab', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
  });

  it('shows loading state when twin is undefined', () => {
    mockOverrides = { twin: undefined };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    expect(screen.getByText('Loading digital twin...')).toBeInTheDocument();
  });

  // --- Simulations Tab ---

  it('switches to Simulations tab and shows header', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    expect(screen.getByText('What-If Simulations')).toBeInTheDocument();
    expect(screen.getByText(/Explore how lifestyle and treatment changes/)).toBeInTheDocument();
  });

  it('renders simulation cards on Simulations tab', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    expect(screen.getByText('Weight Loss')).toBeInTheDocument();
    expect(screen.getByText('Exercise Increase')).toBeInTheDocument();
  });

  it('shows "Select a simulation" placeholder when no simulation is selected', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    expect(screen.getByText('Select a simulation to view details')).toBeInTheDocument();
    expect(screen.getByText('Click on a simulation card to see trajectory analysis')).toBeInTheDocument();
  });

  it('shows simulation detail when a simulation is selected', () => {
    mockOverrides = { selectedSimulation: 'sim-1' };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    expect(screen.queryByText('Select a simulation to view details')).not.toBeInTheDocument();
  });

  it('shows loading simulations when simulations array is empty', () => {
    mockOverrides = { simulations: [] };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    expect(screen.getByText('Loading simulations...')).toBeInTheDocument();
  });

  it('clicks a simulation card to toggle selection', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    // Click the "Weight Loss" simulation card
    fireEvent.click(screen.getByText('Weight Loss'));
    expect(mockSetSelectedSimulation).toHaveBeenCalledWith('sim-1');
  });

  // --- Parameters Tab ---

  it('switches to Parameters tab when clicked', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Twin Parameters')).toBeInTheDocument();
    expect(screen.getByText(/Adjust health parameters to run what-if simulations/)).toBeInTheDocument();
  });

  it('renders parameter categories on Parameters tab', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    // Category headers are uppercase
    expect(screen.getAllByText('Physical').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Activity').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sleep').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Diet').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Stress').length).toBeGreaterThanOrEqual(1);
  });

  it('renders parameter sliders on Parameters tab', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('BMI')).toBeInTheDocument();
    expect(screen.getByText('Daily Steps')).toBeInTheDocument();
    expect(screen.getByText('Sleep Duration')).toBeInTheDocument();
  });

  it('changes a parameter slider to trigger setParameterOverride', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    // Find range inputs (sliders)
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
    // Change the first slider value
    fireEvent.change(sliders[0], { target: { value: '70' } });
    expect(mockSetParameterOverride).toHaveBeenCalledWith('p-weight', 70);
  });

  it('renders Run Simulation button disabled when no overrides', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    const runBtn = screen.getByText('Run Simulation');
    expect(runBtn.closest('button')).toBeDisabled();
  });

  it('renders Reset button and enables Run Simulation when there are overrides', () => {
    mockOverrides = { parameterOverrides: { 'p-weight': 70 } };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Reset')).toBeInTheDocument();
    const runBtn = screen.getByText('Run Simulation');
    expect(runBtn.closest('button')).not.toBeDisabled();
  });

  it('clicks Reset button to reset overrides', () => {
    mockOverrides = { parameterOverrides: { 'p-weight': 70 } };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    fireEvent.click(screen.getByText('Reset'));
    expect(mockResetOverrides).toHaveBeenCalled();
  });

  it('clicks Run Simulation button with overrides', () => {
    mockOverrides = { parameterOverrides: { 'p-weight': 70 } };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    fireEvent.click(screen.getByText('Run Simulation'));
    expect(mockRunSimulation.mutate).toHaveBeenCalledWith({
      scenario: 'Custom Parameter Change',
      description: 'Modified 1 parameter(s) from the twin parameter panel.',
      parameters: [{ id: 'p-weight', value: 70 }],
    });
  });

  it('does not call mutate when Run Simulation clicked without overrides', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    fireEvent.click(screen.getByText('Run Simulation'));
    expect(mockRunSimulation.mutate).not.toHaveBeenCalled();
  });

  it('shows Simulating... text when runSimulation is loading', () => {
    mockOverrides = {
      parameterOverrides: { 'p-weight': 70 },
      runSimulation: { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: true, error: null },
    };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Simulating...')).toBeInTheDocument();
  });

  it('shows loading parameters when parameters array is empty', () => {
    mockOverrides = { parameters: [] };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    expect(screen.getByText('Loading parameters...')).toBeInTheDocument();
  });

  // --- Predictions Tab ---

  it('switches to Predictions tab when clicked', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Predictions'));
    expect(screen.getByText('Biomarker Predictions')).toBeInTheDocument();
    expect(screen.getByText(/90-day forecasts with confidence intervals/)).toBeInTheDocument();
  });

  it('renders prediction cards on Predictions tab', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Predictions'));
    expect(screen.getByText('HbA1c')).toBeInTheDocument();
    expect(screen.getByText('LDL Cholesterol')).toBeInTheDocument();
    expect(screen.getByText('Blood Pressure')).toBeInTheDocument();
  });

  it('shows loading predictions when predictions array is empty', () => {
    mockOverrides = { predictions: [] };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Predictions'));
    expect(screen.getByText('Loading predictions...')).toBeInTheDocument();
  });

  // --- Timeline Tab ---

  it('switches to Timeline tab when clicked', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    expect(screen.getByText(/Chronological log of twin events/)).toBeInTheDocument();
  });

  it('renders timeline events on Timeline tab', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('Data Source Synced')).toBeInTheDocument();
    expect(screen.getByText('Simulation: Weight Loss')).toBeInTheDocument();
    expect(screen.getByText('Parameters Updated')).toBeInTheDocument();
    expect(screen.getByText('90-Day Predictions Generated')).toBeInTheDocument();
    expect(screen.getByText('Digital Twin Created')).toBeInTheDocument();
  });

  it('shows loading timeline when timeline array is empty', () => {
    mockOverrides = { timeline: [] };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Timeline'));
    expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
  });

  // --- Simulation card click ---

  it('clicks a simulation card to select it', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    fireEvent.click(screen.getByText('Weight Loss'));
    expect(mockSetSelectedSimulation).toHaveBeenCalled();
  });

  it('clicks a selected simulation card to deselect it', () => {
    mockOverrides = { selectedSimulation: 'sim-1' };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    const tabButtons = screen.getAllByRole('tab');
    const simTab = tabButtons.find((btn) => btn.textContent?.includes('Simulations'));
    if (simTab) fireEvent.click(simTab);
    fireEvent.click(screen.getByText('Weight Loss'));
    expect(mockSetSelectedSimulation).toHaveBeenCalledWith(null);
  });

  // --- Parameter slider change ---

  it('changes a parameter slider value', () => {
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
    fireEvent.change(sliders[0], { target: { value: '70' } });
    expect(mockSetParameterOverride).toHaveBeenCalled();
  });

  // --- Category with no params (null return) ---

  it('handles category with no matching parameters gracefully', () => {
    // Only provide Physical category parameters, skip others
    mockOverrides = {
      parameters: [
        { id: 'p-weight', name: 'Weight', category: 'Physical', currentValue: 75, min: 40, max: 150, unit: 'kg', step: 0.5 },
      ],
    };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    // Should render Physical but not crash on missing categories
    expect(screen.getAllByText('Physical').length).toBeGreaterThanOrEqual(1);
  });

  // --- Run Simulation with multiple overrides ---

  it('clicks Run Simulation button with multiple overrides', () => {
    mockOverrides = { parameterOverrides: { 'p-weight': 70, 'p-steps': 12000, 'p-sleep': 8 } };
    render(<TestWrapper><TwinPage /></TestWrapper>);
    fireEvent.click(screen.getByText('Parameters'));
    fireEvent.click(screen.getByText('Run Simulation'));
    expect(mockRunSimulation.mutate).toHaveBeenCalledWith({
      scenario: 'Custom Parameter Change',
      description: 'Modified 3 parameter(s) from the twin parameter panel.',
      parameters: expect.arrayContaining([
        { id: 'p-weight', value: 70 },
        { id: 'p-steps', value: 12000 },
        { id: 'p-sleep', value: 8 },
      ]),
    });
  });
});
