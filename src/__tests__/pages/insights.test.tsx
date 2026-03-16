// ============================================================
// Tests for src/app/insights/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import InsightsPage from '@/app/insights/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

describe('InsightsPage', () => {
  it('renders the insights page', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );
    // "AI Insights" appears in both page heading and nav link
    expect(screen.getAllByText('AI Insights').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/TEE-verified health analytics powered by machine learning/)
    ).toBeInTheDocument();
  });

  it('renders key insight metric cards', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Next Period')).toBeInTheDocument();
    expect(screen.getByText('Fertile Window')).toBeInTheDocument();
    expect(screen.getByText('Active Anomalies')).toBeInTheDocument();
    // "Health Score" appears in metric card and overview section
    expect(screen.getAllByText('Health Score').length).toBeGreaterThanOrEqual(1);
  });

  it('renders tabs', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Cycle Tracking')).toBeInTheDocument();
    // "Anomalies" may appear in tab and elsewhere
    expect(screen.getAllByText('Anomalies').length).toBeGreaterThanOrEqual(1);
    // "AI Models" may appear in tab and elsewhere
    expect(screen.getAllByText('AI Models').length).toBeGreaterThanOrEqual(1);
  });

  it('shows overview tab content by default', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Cycle Prediction')).toBeInTheDocument();
    // "Health Score" appears in metric card and overview section heading
    expect(screen.getAllByText('Health Score').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Weekly Wellness')).toBeInTheDocument();
    expect(screen.getByText('Recent Inferences')).toBeInTheDocument();
  });

  it('switches to Cycle Tracking tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Cycle Tracking'));

    expect(screen.getByText('Temperature & Fertility Window')).toBeInTheDocument();
    expect(screen.getByText('Average Cycle Length')).toBeInTheDocument();
    expect(screen.getByText('Avg BBT Shift')).toBeInTheDocument();
    expect(screen.getByText('Prediction Accuracy')).toBeInTheDocument();
  });

  it('switches to Anomalies tab and shows anomaly cards', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    // "Anomalies" tab; there may be multiple elements with this text
    const anomalyTabs = screen.getAllByText('Anomalies');
    fireEvent.click(anomalyTabs[0]);

    // "Elevated Temperature" may appear multiple times if there are multiple anomalies of same type
    expect(screen.getAllByText('Elevated Temperature').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Irregular Cycle Length').length).toBeGreaterThanOrEqual(1);
  });

  it('displays anomaly severity and confidence', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const anomalyTabs = screen.getAllByText('Anomalies');
    fireEvent.click(anomalyTabs[0]);

    // Check for severity badges
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    // Check for confidence values
    expect(screen.getAllByText(/\d+\.\d+% confidence/).length).toBeGreaterThan(0);
  });

  it('switches to Models tab and shows model cards', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const modelTabs = screen.getAllByText('AI Models');
    fireEvent.click(modelTabs[0]);

    expect(screen.getByText('Cycle LSTM')).toBeInTheDocument();
    expect(screen.getByText('Anomaly Detector')).toBeInTheDocument();
    expect(screen.getByText('Fertility XGBoost')).toBeInTheDocument();
    expect(screen.getByText('Health Transformer')).toBeInTheDocument();
  });

  it('displays model accuracy values', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const modelTabs = screen.getAllByText('AI Models');
    fireEvent.click(modelTabs[0]);

    expect(screen.getByText('96.2%')).toBeInTheDocument();
    expect(screen.getByText('93.8%')).toBeInTheDocument();
    expect(screen.getByText('91.5%')).toBeInTheDocument();
    expect(screen.getByText('94.7%')).toBeInTheDocument();
  });

  it('renders TEE-verified notice on Models tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const modelTabs = screen.getAllByText('AI Models');
    fireEvent.click(modelTabs[0]);

    expect(screen.getByText('TEE-Verified Inference')).toBeInTheDocument();
  });

  it('renders TEE status badge', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );
    expect(screen.getAllByText('Operational').length).toBeGreaterThanOrEqual(1);
  });

  it('renders cycle phase legend on Cycle Tracking tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Cycle Tracking'));

    expect(screen.getByText('Cycle Phases:')).toBeInTheDocument();
    expect(screen.getByText('Menstrual')).toBeInTheDocument();
    expect(screen.getByText('Follicular')).toBeInTheDocument();
    expect(screen.getByText('Ovulation')).toBeInTheDocument();
    expect(screen.getByText('Luteal')).toBeInTheDocument();
  });

  // --- Clinical AI Tab ---

  it('switches to Clinical AI tab and shows risk scores', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Clinical AI'));

    expect(screen.getByText('Cardiovascular Risk')).toBeInTheDocument();
    expect(screen.getByText('Metabolic Risk')).toBeInTheDocument();
    expect(screen.getByText('Oncology Risk')).toBeInTheDocument();
  });

  it('renders treatment effectiveness on Clinical AI tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Clinical AI'));

    expect(screen.getByText('Treatment Effectiveness')).toBeInTheDocument();
    expect(screen.getByText('Metformin 500mg')).toBeInTheDocument();
    expect(screen.getByText('Lisinopril 10mg')).toBeInTheDocument();
    expect(screen.getByText('Atorvastatin 20mg')).toBeInTheDocument();
    expect(screen.getByText('Vitamin D 2000 IU')).toBeInTheDocument();
  });

  it('renders treatment effectiveness status with varying thresholds', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Clinical AI'));

    // Different effectiveness levels: 87 (Optimal), 92 (Optimal), 78 (Good), 65 (Moderate)
    expect(screen.getByText('Optimal (87%)')).toBeInTheDocument();
    expect(screen.getByText('Optimal (92%)')).toBeInTheDocument();
    expect(screen.getByText('Good (78%)')).toBeInTheDocument();
    expect(screen.getByText('Moderate (65%)')).toBeInTheDocument();
  });

  it('renders drug interaction warnings on Clinical AI tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Clinical AI'));

    expect(screen.getByText('Drug Interaction Warnings')).toBeInTheDocument();
    expect(screen.getByText('Warfarin + Aspirin')).toBeInTheDocument();
    expect(screen.getByText('Metformin + Contrast Dye')).toBeInTheDocument();
    expect(screen.getByText('All other combinations safe')).toBeInTheDocument();
  });

  it('renders cross-links on Clinical AI tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Clinical AI'));

    expect(screen.getByText('Clinical Decision Support')).toBeInTheDocument();
    expect(screen.getByText('Digital Health Twin')).toBeInTheDocument();
    expect(screen.getByText('Genomics Lab')).toBeInTheDocument();
  });

  // --- Anomalies Tab: resolved badge ---

  it('shows resolved badge for resolved anomalies', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const anomalyTabs = screen.getAllByText('Anomalies');
    fireEvent.click(anomalyTabs[0]);

    // Some anomalies are resolved (indices 4 and 5)
    expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
  });

  it('shows anomaly severity variants (High, Medium, Low)', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const anomalyTabs = screen.getAllByText('Anomalies');
    fireEvent.click(anomalyTabs[0]);

    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Low').length).toBeGreaterThan(0);
  });

  it('shows TEE attestation hashes on anomalies tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const anomalyTabs = screen.getAllByText('Anomalies');
    fireEvent.click(anomalyTabs[0]);

    expect(screen.getAllByText('TEE Attestation').length).toBeGreaterThan(0);
  });

  // --- Explainability Tab ---

  it('switches to Explainability tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Explainability'));
    // The ExplainabilityTab component should render
    // It will show loading or content from the useExplainableAI hook
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  // --- Overview tab inferences ---

  it('shows inference result styling for Normal and Anomaly Detected', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    // Overview tab (default) shows recent inferences with result text
    expect(screen.getAllByText(/Normal/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Anomaly Detected/).length).toBeGreaterThan(0);
  });

  it('renders cycle stats on cycle tracking tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Cycle Tracking'));

    expect(screen.getByText('28.3 days')).toBeInTheDocument();
    expect(screen.getByText('+0.5°F')).toBeInTheDocument();
    // 96.2% appears in both the cycle tracking and metric card, use getAllByText
    expect(screen.getAllByText('96.2%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders model architecture types on Models tab', () => {
    render(
      <TestWrapper>
        <InsightsPage />
      </TestWrapper>
    );

    const modelTabs = screen.getAllByText('AI Models');
    fireEvent.click(modelTabs[0]);

    expect(screen.getByText('LSTM Architecture')).toBeInTheDocument();
    expect(screen.getAllByText(/Architecture/).length).toBeGreaterThan(0);
  });
});
