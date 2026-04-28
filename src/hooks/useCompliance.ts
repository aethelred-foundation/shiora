/**
 * useCompliance — Compliance & audit center data management.
 *
 * Queries for overview, frameworks, audit log, reports, violations,
 * and individual framework checks. Uses @tanstack/react-query for
 * data fetching and the shared API client for server communication.
 */

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

import type {
  ComplianceOverview,
  ComplianceFramework,
  ComplianceCheck,
  ComplianceAuditEntry,
  ComplianceReport,
  PolicyViolation,
  ComplianceFrameworkId,
  GenerateReportForm,
} from '@/types';
import type { PaginatedResult } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const COMPLIANCE_OVERVIEW_KEY = 'compliance-overview';
const COMPLIANCE_FRAMEWORKS_KEY = 'compliance-frameworks';
const COMPLIANCE_AUDIT_KEY = 'compliance-audit';
const COMPLIANCE_REPORTS_KEY = 'compliance-reports';
const COMPLIANCE_VIOLATIONS_KEY = 'compliance-violations';
const COMPLIANCE_CHECKS_KEY = 'compliance-checks';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseComplianceReturn {
  /** Aggregated compliance overview. */
  overview: ComplianceOverview | null;
  /** All framework summaries. */
  frameworks: ComplianceFramework[];
  /** Paginated audit log entries. */
  auditLog: ComplianceAuditEntry[];
  /** Audit log pagination metadata. */
  auditMeta: { page: number; total: number; totalPages: number } | null;
  /** Compliance reports. */
  reports: ComplianceReport[];
  /** Policy violations. */
  violations: PolicyViolation[];
  /** Controls for the selected framework. */
  frameworkChecks: ComplianceCheck[];

  /** Loading states. */
  isLoading: boolean;
  isAuditLoading: boolean;
  isChecksLoading: boolean;
  error: Error | null;

  /** Current audit page. */
  auditPage: number;
  setAuditPage: (page: number) => void;

  /** Selected framework for checks tab. */
  selectedFramework: ComplianceFrameworkId | null;
  setSelectedFramework: (fw: ComplianceFrameworkId) => void;

  /** Generate a new compliance report. */
  generateReport: {
    mutate: (form: GenerateReportForm) => void;
    mutateAsync: (form: GenerateReportForm) => Promise<ComplianceReport>;
    isLoading: boolean;
    error: Error | null;
  };

  /** Force re-fetch. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Default overview fallback
// ---------------------------------------------------------------------------

const DEFAULT_OVERVIEW: ComplianceOverview = {
  frameworks: [],
  overallComplianceScore: 0,
  activeViolations: 0,
  daysSinceLastAudit: 0,
  upcomingAssessments: [],
  complianceTrend: [],
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompliance(): UseComplianceReturn {
  const queryClient = useQueryClient();
  const [auditPage, setAuditPage] = useState(1);
  const [selectedFramework, setSelectedFrameworkRaw] = useState<ComplianceFrameworkId | null>(
    'hipaa',
  );

  const setSelectedFramework = useCallback((fw: ComplianceFrameworkId) => {
    setSelectedFrameworkRaw(fw);
  }, []);

  // ---- Queries ----

  const overviewQuery = useQuery({
    queryKey: [COMPLIANCE_OVERVIEW_KEY],
    queryFn: () => api.get<ComplianceOverview>('/api/compliance', { view: 'overview' }),
    staleTime: 30_000,
  });

  const frameworksQuery = useQuery({
    queryKey: [COMPLIANCE_FRAMEWORKS_KEY],
    queryFn: () => api.get<ComplianceFramework[]>('/api/compliance', { view: 'frameworks' }),
    staleTime: 30_000,
  });

  const auditQuery = useQuery({
    queryKey: [COMPLIANCE_AUDIT_KEY, auditPage],
    queryFn: () =>
      api.getPaginated<ComplianceAuditEntry>('/api/compliance/audit', {
        page: auditPage,
        limit: 20,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const reportsQuery = useQuery({
    queryKey: [COMPLIANCE_REPORTS_KEY],
    queryFn: () => api.get<ComplianceReport[]>('/api/compliance/reports'),
    staleTime: 30_000,
  });

  const violationsQuery = useQuery({
    queryKey: [COMPLIANCE_VIOLATIONS_KEY],
    queryFn: () => api.get<PolicyViolation[]>('/api/compliance', { view: 'violations' }),
    staleTime: 30_000,
  });

  const checksQuery = useQuery({
    queryKey: [COMPLIANCE_CHECKS_KEY, selectedFramework],
    queryFn: () =>
      api.get<ComplianceCheck[]>('/api/compliance/checks', { framework: selectedFramework! }),
    enabled: selectedFramework !== null,
    staleTime: 30_000,
  });

  // ---- Mutations ----

  const generateReportMutation = useMutation({
    mutationFn: (form: GenerateReportForm) =>
      api.post<ComplianceReport>('/api/compliance/reports', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_REPORTS_KEY] });
    },
  });

  // ---- Refetch ----

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_OVERVIEW_KEY] });
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_FRAMEWORKS_KEY] });
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_AUDIT_KEY] });
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_REPORTS_KEY] });
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_VIOLATIONS_KEY] });
  }, [queryClient]);

  return {
    overview: overviewQuery.data ?? DEFAULT_OVERVIEW,
    frameworks: frameworksQuery.data ?? [],
    auditLog: auditQuery.data?.items ?? [],
    auditMeta: auditQuery.data?.meta
      ? {
          page: auditQuery.data.meta.page,
          total: auditQuery.data.meta.total,
          totalPages: auditQuery.data.meta.totalPages,
        }
      : null,
    reports: reportsQuery.data ?? [],
    violations: violationsQuery.data ?? [],
    frameworkChecks: checksQuery.data ?? [],

    isLoading: overviewQuery.isLoading,
    isAuditLoading: auditQuery.isLoading,
    isChecksLoading: checksQuery.isLoading,
    error: overviewQuery.error as Error | null,

    auditPage,
    setAuditPage,
    selectedFramework,
    setSelectedFramework,

    generateReport: {
      mutate: generateReportMutation.mutate,
      mutateAsync: generateReportMutation.mutateAsync,
      isLoading: generateReportMutation.isPending,
      error: generateReportMutation.error as Error | null,
    },

    refetch,
  };
}
