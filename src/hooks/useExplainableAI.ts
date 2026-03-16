'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  ModelCard,
  ExplainabilityResult,
  BiasReport,
  FeatureImportance,
} from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const MODEL_CARDS_KEY = 'xai-model-cards';
const EXPLAINABILITY_KEY = 'xai-explainability';
const BIAS_KEY = 'xai-bias';
const FEATURE_IMPORTANCE_KEY = 'xai-feature-importance';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseExplainableAIReturn {
  modelCards: ModelCard[];
  explainabilityResults: ExplainabilityResult[];
  biasReports: BiasReport[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  selectedResultIndex: number;
  setSelectedResultIndex: (index: number) => void;
  selectedModelCard: ModelCard | null;
  selectedResult: ExplainabilityResult | null;
  selectedBiasReport: BiasReport | null;
  featureImportances: FeatureImportance[];
  isLoading: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useExplainableAI(): UseExplainableAIReturn {
  const [selectedModelId, setSelectedModelId] = useState<string>('lstm');
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);

  const modelCardsQuery = useQuery({
    queryKey: [MODEL_CARDS_KEY],
    queryFn: () => api.get<ModelCard[]>('/api/xai/model-cards'),
    staleTime: 30_000,
  });

  const resultsQuery = useQuery({
    queryKey: [EXPLAINABILITY_KEY],
    queryFn: () => api.get<ExplainabilityResult[]>('/api/xai/shap'),
    staleTime: 30_000,
  });

  const biasQuery = useQuery({
    queryKey: [BIAS_KEY],
    queryFn: () => api.get<BiasReport[]>('/api/xai/bias'),
    staleTime: 30_000,
  });

  const featureQuery = useQuery({
    queryKey: [FEATURE_IMPORTANCE_KEY, selectedModelId],
    queryFn: () =>
      api.get<FeatureImportance[]>('/api/xai/shap', { modelId: selectedModelId }),
    staleTime: 30_000,
  });

  const modelCards = modelCardsQuery.data ?? [];
  const results = resultsQuery.data ?? [];
  const biasReports = biasQuery.data ?? [];

  const selectedModelCard = modelCards.find((m) => m.modelId === selectedModelId) ?? null;
  const modelResults = results.filter((r) => r.modelId === selectedModelId);
  const selectedResult = modelResults[selectedResultIndex] ?? modelResults[0] ?? null;
  const selectedBiasReport = biasReports.find((b) => b.modelId === selectedModelId) ?? null;

  return {
    modelCards,
    explainabilityResults: results,
    biasReports,
    selectedModelId,
    setSelectedModelId,
    selectedResultIndex,
    setSelectedResultIndex,
    selectedModelCard,
    selectedResult,
    selectedBiasReport,
    featureImportances: featureQuery.data ?? [],
    isLoading: modelCardsQuery.isLoading,
    error: modelCardsQuery.error as Error | null,
  };
}
