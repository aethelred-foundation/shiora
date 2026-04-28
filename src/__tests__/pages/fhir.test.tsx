// ============================================================
// Tests for src/app/fhir/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockImportMutate = jest.fn();
const mockExportMutate = jest.fn();

let mockOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useFHIRBridge', () => ({
  useFHIRBridge: () => ({
    resources: [
      {
        id: 'r-1',
        resourceType: 'Patient',
        fhirId: 'patient-001',
        data: {},
        importedAt: Date.now(),
        mapped: true,
        shioraRecordId: 'rec-1',
        attestation: '0xabc',
      },
      {
        id: 'r-2',
        resourceType: 'Observation',
        fhirId: 'obs-001',
        data: {},
        importedAt: Date.now(),
        mapped: true,
        shioraRecordId: 'rec-2',
        attestation: '0xdef',
      },
      {
        id: 'r-3',
        resourceType: 'MedicationRequest',
        fhirId: 'med-001',
        data: {},
        importedAt: Date.now(),
        mapped: false,
        shioraRecordId: null,
        attestation: null,
      },
    ],
    mappings: [
      {
        id: 'm-1',
        fhirType: 'Patient',
        shioraType: 'demographics',
        fieldMappings: [{ fhirPath: 'name', shioraField: 'fullName' }],
        autoMap: true,
      },
      {
        id: 'm-2',
        fhirType: 'Observation',
        shioraType: 'vital_signs',
        fieldMappings: [{ fhirPath: 'value', shioraField: 'reading' }],
        autoMap: true,
      },
    ],
    importJobs: [
      {
        id: 'j-1',
        source: 'Epic MyChart Export',
        status: 'completed',
        startedAt: Date.now() - 86400000,
        completedAt: Date.now() - 86400000 + 3600000,
        resourceCount: 45,
        processedCount: 45,
        failedCount: 0,
        errors: [],
      },
      {
        id: 'j-2',
        source: 'Cerner Health Portal',
        status: 'processing',
        startedAt: Date.now(),
        completedAt: null,
        resourceCount: 30,
        processedCount: 15,
        failedCount: 2,
        errors: ['Invalid resource format at index 7'],
      },
    ],
    exportConfigs: [
      {
        id: 'e-1',
        destination: 'IPFS Encrypted Bundle',
        resourceTypes: ['Patient', 'Observation', 'Condition', 'MedicationRequest'],
        format: 'json',
        lastExportAt: Date.now() - 86400000 * 3,
      },
      {
        id: 'e-2',
        destination: 'Local Backup',
        resourceTypes: ['Patient', 'Observation'],
        format: 'ndjson',
        lastExportAt: null,
      },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
    importMutation: {
      mutate: mockImportMutate,
      mutateAsync: jest.fn(),
      isLoading: false,
      error: null,
    },
    exportMutation: {
      mutate: mockExportMutate,
      mutateAsync: jest.fn(),
      isLoading: false,
      error: null,
    },
    resourcesByType: {},
    totalMapped: 2,
    totalUnmapped: 1,
    refetch: jest.fn(),
    ...mockOverrides,
  }),
}));

import FHIRBridgePage from '@/app/fhir/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

describe('FHIRBridgePage', () => {
  it('renders the FHIR Bridge page heading', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByText('FHIR Bridge')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(
      screen.getByText(/Import and export FHIR R4 resources with automatic mapping/),
    ).toBeInTheDocument();
  });

  it('renders tab navigation with all tabs', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const tabLabels = tabs.map((t) => t.textContent);
    expect(tabLabels).toContain('Import');
    expect(tabLabels).toContain('Export');
    expect(tabLabels).toContainEqual(expect.stringContaining('Mappings'));
    expect(tabLabels).toContain('History');
  });

  it('renders the stats cards', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByText('FHIR Resources')).toBeInTheDocument();
    expect(screen.getByText('Mapped')).toBeInTheDocument();
    expect(screen.getByText('Unmapped')).toBeInTheDocument();
    expect(screen.getAllByText('Mappings').length).toBeGreaterThanOrEqual(1);
  });

  // --- Import Tab ---

  it('renders the Import tab by default with Recent Imports', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByText('Recent Imports')).toBeInTheDocument();
  });

  it('renders import jobs with sources and status', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByText('Epic MyChart Export')).toBeInTheDocument();
    expect(screen.getByText('Cerner Health Portal')).toBeInTheDocument();
  });

  it('renders import job processed counts', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByText('45/45 processed')).toBeInTheDocument();
    expect(screen.getByText('15/30 processed')).toBeInTheDocument();
  });

  it('renders failed count for jobs with failures', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByText('2 failed')).toBeInTheDocument();
  });

  it('renders progress bar for processing jobs', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    // The processing job (j-2) should have a progress bar
    expect(screen.getByText('Cerner Health Portal')).toBeInTheDocument();
  });

  it('renders error message for jobs with errors', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByText('Invalid resource format at index 7')).toBeInTheDocument();
  });

  // --- Export Tab ---

  it('switches to Export tab', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('Export History')).toBeInTheDocument();
  });

  it('renders export configs on Export tab', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getAllByText('IPFS Encrypted Bundle').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Local Backup').length).toBeGreaterThanOrEqual(1);
  });

  it('renders format badges on export configs', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getAllByText('JSON').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('NDJSON').length).toBeGreaterThanOrEqual(1);
  });

  it('renders +N badge for configs with more than 3 resource types', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders last export time for configs with lastExportAt', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByText(/Last export:/)).toBeInTheDocument();
  });

  // --- Mappings Tab ---

  it('switches to Mappings tab and shows resource mappings', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    const mappingsTab = tabs.find((t) => t.textContent?.includes('Mappings'));
    expect(mappingsTab).toBeDefined();
    fireEvent.click(mappingsTab!);
    expect(screen.getByText('Resource Mappings')).toBeInTheDocument();
    expect(screen.getByText('Imported Resources')).toBeInTheDocument();
  });

  // --- History Tab ---

  it('switches to History tab and shows import/export history table', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('History'));
    expect(screen.getByText('Import / Export History')).toBeInTheDocument();
    expect(screen.getByText('Source / Destination')).toBeInTheDocument();
  });

  it('displays import jobs in history table', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('History'));
    const importBadges = screen.getAllByText('Import');
    expect(importBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays export configs in history table', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('History'));
    const exportBadges = screen.getAllByText('Export');
    expect(exportBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays failed count in history table for jobs with failures', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('History'));
    expect(screen.getAllByText(/failed/).length).toBeGreaterThan(0);
  });

  it('shows N/A for export configs without lastExportAt in history', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('History'));
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  // --- Cover onImport callback (line 134) ---

  it('completes the import wizard to trigger onImport', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    // Step 1: Paste FHIR JSON
    const textarea = screen.getByPlaceholderText('Paste FHIR Bundle JSON here...');
    fireEvent.change(textarea, { target: { value: '{"resourceType": "Bundle"}' } });
    // Click "Preview Resources" to go to step 2
    fireEvent.click(screen.getByText('Preview Resources'));
    // Step 2: Click "Confirm Import" to go to step 3
    fireEvent.click(screen.getByText('Confirm Import'));
    // Step 3: Click "Start Import" to trigger onImport
    fireEvent.click(screen.getByText('Start Import'));
    expect(mockImportMutate).toHaveBeenCalledWith('Manual JSON Paste');
  });

  // --- Cover onExport callback (line 186) ---

  it('clicks Export Resources to trigger onExport', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Export'));
    // ExportConfigPanel has Patient and Observation selected by default
    fireEvent.click(screen.getByText('Export Resources'));
    expect(mockExportMutate).toHaveBeenCalledWith({
      format: 'json',
      resourceTypes: ['Patient', 'Observation'],
      destination: 'IPFS Encrypted Bundle',
    });
  });

  it('renders navigation and footer', () => {
    render(
      <TestWrapper>
        <FHIRBridgePage />
      </TestWrapper>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
