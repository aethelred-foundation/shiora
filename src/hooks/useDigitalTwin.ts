/**
 * useDigitalTwin — Digital Health Twin data fetching and state management.
 *
 * Uses @tanstack/react-query for data fetching and the shared API client
 * for all server communication.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DigitalTwin,
  TwinSimulation,
  TwinParameter,
  TwinPrediction,
  TwinTimelineEvent,
  RunSimulationForm,
} from '@/types';
import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const TWIN_KEY = 'digital-twin';
const SIMULATIONS_KEY = 'twin-simulations';
const PARAMETERS_KEY = 'twin-parameters';
const PREDICTIONS_KEY = 'twin-predictions';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseDigitalTwinReturn {
  twin: DigitalTwin | undefined;
  simulations: TwinSimulation[];
  parameters: TwinParameter[];
  predictions: TwinPrediction[];
  timeline: TwinTimelineEvent[];

  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;

  selectedSimulation: string | null;
  setSelectedSimulation: (id: string | null) => void;

  parameterOverrides: Record<string, number>;
  setParameterOverride: (id: string, value: number) => void;
  resetOverrides: () => void;

  runSimulation: {
    mutate: (form: RunSimulationForm) => void;
    mutateAsync: (form: RunSimulationForm) => Promise<TwinSimulation>;
    isLoading: boolean;
    error: Error | null;
  };

  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Timeline generation from twin + simulations
// ---------------------------------------------------------------------------

function buildTimeline(
  twin: DigitalTwin | undefined,
  simulations: TwinSimulation[],
): TwinTimelineEvent[] {
  if (!twin) return [];

  const events: TwinTimelineEvent[] = [];
  const twinId = twin.id;

  // Twin creation event
  events.push({
    id: `evt-creation`,
    twinId,
    type: 'creation',
    title: 'Digital Twin Created',
    description: `Digital twin model ${twin.modelVersion} initialized with ${twin.dataSourceCount} data sources.`,
    timestamp: twin.createdAt,
    attestation: twin.attestation,
  });

  // Simulation events
  simulations.forEach((sim, i) => {
    events.push({
      id: `evt-sim-${i}`,
      twinId,
      type: 'simulation',
      title: `Simulation: ${sim.scenario}`,
      description: sim.description,
      timestamp: sim.startedAt,
      relatedId: sim.id,
      attestation: sim.attestation,
    });
  });

  // Parameter update events (mock historical)
  const paramUpdateTimes = [
    twin.createdAt + 5 * 86400000,
    twin.createdAt + 18 * 86400000,
    twin.createdAt + 42 * 86400000,
  ];
  const paramUpdateDescs = [
    'Updated physical parameters: weight, BMI recalculated from latest wearable sync.',
    'Sleep parameters adjusted after 2-week Oura Ring data integration.',
    'Activity metrics updated from Apple Health 30-day aggregate.',
  ];
  paramUpdateTimes.forEach((t, i) => {
    events.push({
      id: `evt-param-${i}`,
      twinId,
      type: 'parameter_update',
      title: 'Parameters Updated',
      description: paramUpdateDescs[i],
      timestamp: t,
    });
  });

  // Prediction events
  events.push({
    id: `evt-pred-0`,
    twinId,
    type: 'prediction',
    title: '90-Day Predictions Generated',
    description: 'Biomarker predictions recalculated with updated parameters and latest lab results.',
    timestamp: twin.createdAt + 60 * 86400000,
    attestation: twin.attestation,
  });

  // Data sync events
  const syncTimes = [
    Date.now() - 2 * 3600000,
    Date.now() - 24 * 3600000,
  ];
  const syncDescs = [
    'Wearable data synced: 1,248 new data points from Apple Health and Oura Ring.',
    'EHR records synced: 3 new lab results imported via FHIR bridge.',
  ];
  syncTimes.forEach((t, i) => {
    events.push({
      id: `evt-sync-${i}`,
      twinId,
      type: 'data_sync',
      title: 'Data Source Synced',
      description: syncDescs[i],
      timestamp: t,
    });
  });

  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => b.timestamp - a.timestamp);

  return events;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDigitalTwin(): UseDigitalTwinReturn {
  const queryClient = useQueryClient();

  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null);
  const [parameterOverrides, setParameterOverrides] = useState<Record<string, number>>({});

  // ---- Queries ----

  const twinQuery = useQuery({
    queryKey: [TWIN_KEY],
    queryFn: () => api.get<DigitalTwin>('/api/twin'),
    staleTime: 30_000,
  });

  const simulationsQuery = useQuery({
    queryKey: [SIMULATIONS_KEY],
    queryFn: () => api.get<TwinSimulation[]>('/api/twin/simulations'),
    staleTime: 30_000,
  });

  const parametersQuery = useQuery({
    queryKey: [PARAMETERS_KEY],
    queryFn: () => api.get<TwinParameter[]>('/api/twin/parameters'),
    staleTime: 30_000,
  });

  const predictionsQuery = useQuery({
    queryKey: [PREDICTIONS_KEY],
    queryFn: () => api.get<TwinPrediction[]>('/api/twin/predictions'),
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const runSimulationMutation = useMutation({
    mutationFn: (form: RunSimulationForm) =>
      api.post<TwinSimulation>('/api/twin/simulations', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SIMULATIONS_KEY] });
    },
  });

  // ---- Computed ----

  const simulations = useMemo(
    () => simulationsQuery.data ?? [],
    [simulationsQuery.data],
  );

  const parameters = useMemo(
    () => parametersQuery.data ?? [],
    [parametersQuery.data],
  );

  const predictions = useMemo(
    () => predictionsQuery.data ?? [],
    [predictionsQuery.data],
  );

  const timeline = useMemo(
    () => buildTimeline(twinQuery.data, simulations),
    [twinQuery.data, simulations],
  );

  const setParameterOverride = useCallback((id: string, value: number) => {
    setParameterOverrides((prev) => ({ ...prev, [id]: value }));
  }, []);

  const resetOverrides = useCallback(() => {
    setParameterOverrides({});
  }, []);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [TWIN_KEY] });
    queryClient.invalidateQueries({ queryKey: [SIMULATIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [PARAMETERS_KEY] });
    queryClient.invalidateQueries({ queryKey: [PREDICTIONS_KEY] });
  }, [queryClient]);

  return {
    twin: twinQuery.data,
    simulations,
    parameters,
    predictions,
    timeline,

    isLoading: twinQuery.isLoading,
    isFetching: twinQuery.isFetching,
    error: twinQuery.error as Error | null,

    selectedSimulation,
    setSelectedSimulation,

    parameterOverrides,
    setParameterOverride,
    resetOverrides,

    runSimulation: {
      mutate: runSimulationMutation.mutate,
      mutateAsync: runSimulationMutation.mutateAsync,
      isLoading: runSimulationMutation.isPending,
      error: runSimulationMutation.error as Error | null,
    },

    refetch,
  };
}
