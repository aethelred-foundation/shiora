// ============================================================
// Tests for src/components/xai/ExplainabilityTab.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import type { UseExplainableAIReturn } from '@/hooks/useExplainableAI';

// Mock the hook before importing the component
const mockXAI: UseExplainableAIReturn = {
  modelCards: [],
  explainabilityResults: [],
  biasReports: [],
  selectedModelId: 'cycle-patterns',
  setSelectedModelId: jest.fn(),
  selectedResultIndex: 0,
  setSelectedResultIndex: jest.fn(),
  selectedModelCard: null,
  selectedResult: null,
  selectedBiasReport: null,
  featureImportances: [],
  isLoading: false,
  error: null,
};

jest.mock('@/hooks/useExplainableAI', () => ({
  useExplainableAI: () => mockXAI,
}));

import ExplainabilityTab from '@/components/xai/ExplainabilityTab';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(AppProvider, null, children),
  );
}

describe('ExplainabilityTab', () => {
  beforeEach(() => {
    // Reset to non-loading defaults
    mockXAI.isLoading = false;
    mockXAI.selectedResult = null;
    mockXAI.selectedModelCard = null;
    mockXAI.selectedBiasReport = null;
    mockXAI.featureImportances = [];
    mockXAI.selectedModelId = 'cycle-patterns';
    (mockXAI.setSelectedModelId as jest.Mock).mockClear();
  });

  it('renders loading skeleton when isLoading is true', () => {
    mockXAI.isLoading = true;
    const { container } = render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders model selector', () => {
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Select Inference Workload')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a workload to view its explainability details'),
    ).toBeInTheDocument();
  });

  it('renders the select dropdown with inference workloads', () => {
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText(/Cycle Pattern Analysis/)).toBeInTheDocument();
  });

  it('calls setSelectedModelId when model is changed', () => {
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'anomaly-detection' } });
    expect(mockXAI.setSelectedModelId).toHaveBeenCalledWith('anomaly-detection');
  });

  it('renders SHAP waterfall when selectedResult is provided', () => {
    mockXAI.selectedResult = {
      inferenceId: 'inf-123456789012',
      modelId: 'cycle-patterns',
      explanation: 'This prediction is based on heart rate patterns.',
      confidence: 92,
      shapValues: [{ feature: 'HR', value: 75, baseValue: 72, contribution: 0.25 }],
      decisionPath: ['Step 1', 'Step 2'],
    };
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(screen.getByText('SHAP Feature Contributions')).toBeInTheDocument();
  });

  it('renders feature importance chart when featureImportances are provided', () => {
    mockXAI.featureImportances = [{ feature: 'HR', importance: 0.35, direction: 'positive' }];
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Feature Importance')).toBeInTheDocument();
  });

  it('renders inference explanation and decision path when selectedResult is set', () => {
    mockXAI.selectedResult = {
      inferenceId: 'inf-123456789012',
      modelId: 'cycle-patterns',
      explanation: 'This prediction is based on heart rate patterns.',
      confidence: 92,
      shapValues: [],
      decisionPath: ['Collect vitals', 'Run model'],
    };
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Inference Explanation')).toBeInTheDocument();
    expect(
      screen.getByText('This prediction is based on heart rate patterns.'),
    ).toBeInTheDocument();
    expect(screen.getByText('92% confidence')).toBeInTheDocument();
    expect(screen.getByText(/inf-123456/)).toBeInTheDocument();
    expect(screen.getByText('Decision Path')).toBeInTheDocument();
  });

  it('renders the workload assessment when one is selected', () => {
    mockXAI.selectedModelCard = {
      modelId: 'cycle-patterns',
      name: 'Cycle Pattern Analysis',
      version: 'v2.1',
      description: 'Test model',
      architecture: 'time-series',
      trainingDataSize: 100000,
      validationAccuracy: 96.2,
      fairnessMetrics: { demographicParity: 0.95, equalizedOdds: 0.92, calibration: 0.98 },
      limitations: ['Limited data'],
      intendedUse: 'Cycle prediction',
      lastUpdated: Date.now(),
    };
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Cycle Pattern Analysis')).toBeInTheDocument();
  });

  it('renders bias heatmap when selectedBiasReport is set', () => {
    mockXAI.selectedBiasReport = {
      modelId: 'cycle-patterns',
      reportDate: Date.now(),
      overallBiasScore: 0.05,
      categories: [
        { category: 'Age 18-30', biasScore: 0.02, sampleSize: 5000, recommendation: 'OK' },
      ],
    };
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(screen.getByText('Bias Analysis')).toBeInTheDocument();
  });

  it('renders the inference explainability info box', () => {
    render(
      <TestWrapper>
        <ExplainabilityTab />
      </TestWrapper>,
    );
    expect(screen.getByText('About Inference Explainability')).toBeInTheDocument();
    expect(
      screen.getByText(/Configured inference workloads produce explainability artifacts/),
    ).toBeInTheDocument();
  });
});
