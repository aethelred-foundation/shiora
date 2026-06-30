// ============================================================
// Tests for src/app/insights/page.tsx
// ============================================================

// The insights page reads real statistical insights from /api/insights via
// useInsights. Mock the hook with deterministic data (all three trends, both
// anomaly directions) for the populated render, and empty/loading data for the
// empty-state render; the live fetch is covered by the hook's own test.
const mockInsightsState = {
  metrics: [] as unknown[],
  anomalies: [] as unknown[],
  anomalyCount: 0,
  generatedAt: null as number | null,
  isLoading: false,
  error: null as Error | null,
  refetch: jest.fn(),
};
jest.mock('@/hooks/useInsights', () => ({ useInsights: () => mockInsightsState }));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import InsightsPage from '@/app/insights/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

function setState(s: Partial<typeof mockInsightsState>) {
  Object.assign(mockInsightsState, {
    metrics: [], anomalies: [], anomalyCount: 0, generatedAt: null, isLoading: false,
    error: null, refetch: jest.fn(),
  }, s);
}

describe('InsightsPage', () => {
  it('renders populated metrics (all trends), anomalies (both directions), and honest framing', () => {
    setState({
      metrics: [
        { metric: 'heart_rate', sampleCount: 30, mean: 68.4, stdDev: 4.2, baselineLow: 60, baselineHigh: 77, trend: 'rising', anomalies: [] },
        { metric: 'sleep_hours', sampleCount: 21, mean: 7.1, stdDev: 0.8, baselineLow: 5.5, baselineHigh: 8.7, trend: 'falling', anomalies: [] },
        { metric: 'steps', sampleCount: 28, mean: 8200, stdDev: 1500, baselineLow: 5200, baselineHigh: 11200, trend: 'stable', anomalies: [] },
      ],
      anomalies: [
        { metric: 'heart_rate', value: 110, recordedAt: Date.now() - 3600000, zScore: 3, direction: 'above' },
        { metric: 'sleep_hours', value: 3.2, recordedAt: Date.now() - 7200000, zScore: 2.4, direction: 'below' },
      ],
      anomalyCount: 2,
      generatedAt: Date.now() - 600000,
      isLoading: false,
    });
    render(<TestWrapper><InsightsPage /></TestWrapper>);

    expect(screen.getByText('Health Insights')).toBeInTheDocument();
    expect(screen.getByText('Metrics Tracked')).toBeInTheDocument();
    expect(screen.getByText('Rising')).toBeInTheDocument();
    expect(screen.getByText('Falling')).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText(/above baseline/)).toBeInTheDocument();
    expect(screen.getByText(/below baseline/)).toBeInTheDocument();
    // Honest framing: descriptive statistics, explicitly not AI/TEE/medical-device.
    expect(screen.getByText(/not AI\/ML predictions/)).toBeInTheDocument();
    expect(screen.getByText(/not a medical device/)).toBeInTheDocument();
  });

  it('renders empty states + loading when there is no wearable data', () => {
    setState({ metrics: [], anomalies: [], anomalyCount: 0, generatedAt: null, isLoading: true });
    render(<TestWrapper><InsightsPage /></TestWrapper>);

    expect(screen.getByText('No wearable data yet.')).toBeInTheDocument();
    expect(screen.getByText(/No anomalies detected/)).toBeInTheDocument();
    expect(screen.getByText('Awaiting data')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
