/**
 * ExplainabilityTab — Self-contained XAI dashboard component
 * for the Insights page. Uses the useExplainableAI hook.
 */

'use client';

import React from 'react';
import {
  Brain, Eye, ChevronDown, Info, BarChart3,
} from 'lucide-react';

import { useExplainableAI } from '@/hooks/useExplainableAI';
import { SHAPWaterfall, FeatureImportanceChart, ModelCardViewer, BiasHeatmap, DecisionPath } from '@/components/xai/XAIComponents';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { AI_MODELS } from '@/lib/constants';

export default function ExplainabilityTab() {
  const xai = useExplainableAI();

  if (xai.isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Model Selector */}
      <MedicalCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-violet-500" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Select AI Model</p>
              <p className="text-xs text-slate-400">Choose a model to view its explainability details</p>
            </div>
          </div>
          <div className="relative">
            <select
              value={xai.selectedModelId}
              onChange={(e) => xai.setSelectedModelId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              {AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.version})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </MedicalCard>

      {/* SHAP Values + Feature Importance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {xai.selectedResult && (
          <SHAPWaterfall shapValues={xai.selectedResult.shapValues} />
        )}
        {xai.featureImportances.length > 0 && (
          <FeatureImportanceChart features={xai.featureImportances} />
        )}
      </div>

      {/* Explanation + Decision Path */}
      {xai.selectedResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MedicalCard>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-brand-500" />
              <h4 className="text-sm font-semibold text-slate-900">AI Explanation</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{xai.selectedResult.explanation}</p>
            <div className="flex items-center gap-2">
              <Badge variant="brand">
                <BarChart3 className="w-3 h-3 mr-1" />
                {xai.selectedResult.confidence}% confidence
              </Badge>
              <Badge variant="medical">
                Inference: {xai.selectedResult.inferenceId.slice(0, 12)}...
              </Badge>
            </div>
          </MedicalCard>

          <DecisionPath steps={xai.selectedResult.decisionPath} />
        </div>
      )}

      {/* Model Card */}
      {xai.selectedModelCard && (
        <ModelCardViewer card={xai.selectedModelCard} />
      )}

      {/* Bias Report */}
      {xai.selectedBiasReport && (
        <BiasHeatmap report={xai.selectedBiasReport} />
      )}

      {/* Info box */}
      <div className="p-5 bg-violet-50 border border-violet-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-violet-900 mb-1">About Explainable AI</h4>
            <p className="text-sm text-violet-700">
              All AI models in Shiora produce explainability artifacts including SHAP values, feature
              importance rankings, and decision paths. These artifacts are generated inside TEE enclaves
              and verified on-chain, ensuring that you can trust not only the prediction but also the
              explanation of how that prediction was made.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
