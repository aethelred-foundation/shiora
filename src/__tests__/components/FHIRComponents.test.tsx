// ============================================================
// Tests for src/components/fhir/FHIRComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  FHIRBadge,
  ResourceViewer,
  MappingTable,
  ImportWizard,
  ExportConfigPanel,
} from '@/components/fhir/FHIRComponents';
import type { FHIRResource, FHIRMapping, FHIRResourceType } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(QueryClientProvider, { client: qc },
    React.createElement(AppProvider, null, children));
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockResource: FHIRResource = {
  id: 'res-001',
  resourceType: 'Patient',
  status: 'active',
  lastUpdated: Date.now() - 86400000,
  rawJson: JSON.stringify({ resourceType: 'Patient', id: 'res-001', name: [{ family: 'Doe', given: ['Jane'] }] }),
  mappedRecordId: 'record-123',
};

const mockUnmappedResource: FHIRResource = {
  id: 'res-002',
  resourceType: 'Observation',
  status: 'final',
  lastUpdated: Date.now() - 3600000,
  rawJson: JSON.stringify({ resourceType: 'Observation', id: 'res-002' }),
};

const mockMappings: FHIRMapping[] = [
  {
    id: 'map-1',
    fhirResourceType: 'Patient',
    shioraRecordType: 'vitals',
    fieldMappings: [
      { fhirPath: 'name', shioraField: 'label' },
      { fhirPath: 'birthDate', shioraField: 'date' },
    ],
    isDefault: true,
  },
  {
    id: 'map-2',
    fhirResourceType: 'Observation',
    shioraRecordType: 'lab_result',
    fieldMappings: [
      { fhirPath: 'valueQuantity', shioraField: 'description' },
    ],
    isDefault: false,
  },
];

// ---------------------------------------------------------------------------
// FHIRBadge
// ---------------------------------------------------------------------------

describe('FHIRBadge', () => {
  it('renders resource type label for Patient', () => {
    render(
      <TestWrapper>
        <FHIRBadge resourceType="Patient" />
      </TestWrapper>
    );
    expect(screen.getByText('Patient')).toBeInTheDocument();
  });

  it('renders resource type label for Observation', () => {
    render(
      <TestWrapper>
        <FHIRBadge resourceType="Observation" />
      </TestWrapper>
    );
    expect(screen.getByText('Observation')).toBeInTheDocument();
  });

  it('renders all common FHIR resource types without crashing', () => {
    const types: FHIRResourceType[] = ['Patient', 'Observation', 'MedicationRequest', 'Condition', 'DiagnosticReport', 'Immunization', 'Procedure', 'AllergyIntolerance'];
    types.forEach((type) => {
      const { unmount } = render(
        <TestWrapper>
          <FHIRBadge resourceType={type} />
        </TestWrapper>
      );
      unmount();
    });
  });
});

// ---------------------------------------------------------------------------
// ResourceViewer
// ---------------------------------------------------------------------------

describe('ResourceViewer', () => {
  it('renders resource type', () => {
    render(
      <TestWrapper>
        <ResourceViewer resource={mockResource} />
      </TestWrapper>
    );
    expect(screen.getByText('Patient')).toBeInTheDocument();
  });

  it('renders resource ID', () => {
    render(
      <TestWrapper>
        <ResourceViewer resource={mockResource} />
      </TestWrapper>
    );
    expect(screen.getByText('res-001')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(
      <TestWrapper>
        <ResourceViewer resource={mockResource} />
      </TestWrapper>
    );
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows mapped to Shiora as Yes when mappedRecordId is present', () => {
    render(
      <TestWrapper>
        <ResourceViewer resource={mockResource} />
      </TestWrapper>
    );
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('shows mapped to Shiora as No when mappedRecordId is absent', () => {
    render(
      <TestWrapper>
        <ResourceViewer resource={mockUnmappedResource} />
      </TestWrapper>
    );
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('toggles raw FHIR JSON display', () => {
    render(
      <TestWrapper>
        <ResourceViewer resource={mockResource} />
      </TestWrapper>
    );
    expect(screen.getByText('Show Raw FHIR JSON')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show Raw FHIR JSON'));
    expect(screen.getByText('Hide Raw FHIR JSON')).toBeInTheDocument();
    // Raw JSON content should now be visible
    expect(screen.getByText(/Jane/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MappingTable
// ---------------------------------------------------------------------------

describe('MappingTable', () => {
  it('renders FHIR to Shiora Mappings heading', () => {
    render(
      <TestWrapper>
        <MappingTable mappings={mockMappings} />
      </TestWrapper>
    );
    expect(screen.getByText('FHIR to Shiora Mappings')).toBeInTheDocument();
  });

  it('renders mapping count', () => {
    render(
      <TestWrapper>
        <MappingTable mappings={mockMappings} />
      </TestWrapper>
    );
    expect(screen.getByText('2 resource type mappings configured')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(
      <TestWrapper>
        <MappingTable mappings={mockMappings} />
      </TestWrapper>
    );
    expect(screen.getByText('FHIR Type')).toBeInTheDocument();
    expect(screen.getByText('Shiora Type')).toBeInTheDocument();
    expect(screen.getByText('Fields')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders field mapping counts', () => {
    render(
      <TestWrapper>
        <MappingTable mappings={mockMappings} />
      </TestWrapper>
    );
    expect(screen.getByText('2 fields')).toBeInTheDocument();
    expect(screen.getByText('1 fields')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ImportWizard
// ---------------------------------------------------------------------------

describe('ImportWizard', () => {
  it('renders Import FHIR Resources heading', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Import FHIR Resources')).toBeInTheDocument();
  });

  it('renders step indicators', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('renders textarea for FHIR JSON paste', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/)).toBeInTheDocument();
  });

  it('renders FHIR Server URL input', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByPlaceholderText(/https:\/\/fhir.example.com/)).toBeInTheDocument();
  });

  it('Preview Resources button is disabled with empty inputs', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Preview Resources')).toBeDisabled();
  });

  it('Preview Resources button is enabled when FHIR JSON is entered', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/), {
      target: { value: '{"resourceType":"Bundle"}' },
    });
    expect(screen.getByText('Preview Resources')).not.toBeDisabled();
  });

  it('advances to step 2 on Preview Resources click', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/), {
      target: { value: '{"resourceType":"Bundle"}' },
    });
    fireEvent.click(screen.getByText('Preview Resources'));
    expect(screen.getByText('Resources to Import')).toBeInTheDocument();
  });

  it('navigates back from step 2 to step 1', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/), {
      target: { value: '{"resourceType":"Bundle"}' },
    });
    fireEvent.click(screen.getByText('Preview Resources'));
    expect(screen.getByText('Resources to Import')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/)).toBeInTheDocument();
  });

  it('advances to step 3 (confirm) from step 2', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/), {
      target: { value: '{"resourceType":"Bundle"}' },
    });
    fireEvent.click(screen.getByText('Preview Resources'));
    fireEvent.click(screen.getByText('Confirm Import'));
    expect(screen.getByText('Ready to Import')).toBeInTheDocument();
  });

  it('navigates back to step 2 from step 3 when Back is clicked', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/), {
      target: { value: '{"resourceType":"Bundle"}' },
    });
    fireEvent.click(screen.getByText('Preview Resources'));
    fireEvent.click(screen.getByText('Confirm Import'));
    expect(screen.getByText('Ready to Import')).toBeInTheDocument();
    // Click Back
    fireEvent.click(screen.getByText('Back'));
    // Should go back to step 2
    expect(screen.getByText('Confirm Import')).toBeInTheDocument();
  });

  it('calls onImport when Start Import is clicked on step 3', () => {
    const onImport = jest.fn();
    render(
      <TestWrapper>
        <ImportWizard onImport={onImport} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/), {
      target: { value: '{"resourceType":"Bundle"}' },
    });
    fireEvent.click(screen.getByText('Preview Resources'));
    fireEvent.click(screen.getByText('Confirm Import'));
    fireEvent.click(screen.getByText('Start Import'));
    expect(onImport).toHaveBeenCalled();
  });

  it('shows Importing... text when loading on step 3', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={true} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/Paste FHIR Bundle JSON/), {
      target: { value: '{"resourceType":"Bundle"}' },
    });
    fireEvent.click(screen.getByText('Preview Resources'));
    fireEvent.click(screen.getByText('Confirm Import'));
    expect(screen.getByText('Importing...')).toBeInTheDocument();
  });

  it('enables Preview Resources when FHIR Server URL is entered', () => {
    render(
      <TestWrapper>
        <ImportWizard onImport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/fhir.example.com/), {
      target: { value: 'https://fhir.server.com/api' },
    });
    expect(screen.getByText('Preview Resources')).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// ExportConfigPanel
// ---------------------------------------------------------------------------

describe('ExportConfigPanel', () => {
  it('renders Export FHIR Resources heading', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Export FHIR Resources')).toBeInTheDocument();
  });

  it('renders format toggle buttons', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    // Rendered in lowercase (CSS uppercase is visual only)
    expect(screen.getByText('json')).toBeInTheDocument();
    expect(screen.getByText('xml')).toBeInTheDocument();
  });

  it('renders resource type buttons', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Resource Types')).toBeInTheDocument();
    // Multiple FHIR resource type labels should appear
    expect(screen.getAllByRole('button').length).toBeGreaterThan(2);
  });

  it('renders destination select', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Destination')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders Export Resources button', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    expect(screen.getByText('Export Resources')).toBeInTheDocument();
  });

  it('calls onExport when Export Resources clicked', () => {
    const onExport = jest.fn();
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={onExport} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Export Resources'));
    expect(onExport).toHaveBeenCalled();
  });

  it('shows Exporting text when loading', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading />
      </TestWrapper>
    );
    expect(screen.getByText('Exporting...')).toBeInTheDocument();
  });

  it('toggles resource type selection', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    // Click on a resource type button to toggle it
    const buttons = screen.getAllByRole('button');
    // Patient should be initially selected - click to deselect
    const patientBtn = buttons.find(b => b.textContent === 'Patient');
    if (patientBtn) fireEvent.click(patientBtn);
    // Click again to reselect
    if (patientBtn) fireEvent.click(patientBtn);
  });

  it('toggles format between json and xml', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('xml'));
    // xml should now be selected (brand-600 style)
    fireEvent.click(screen.getByText('json'));
  });

  it('changes destination select', () => {
    render(
      <TestWrapper>
        <ExportConfigPanel onExport={jest.fn()} isLoading={false} />
      </TestWrapper>
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Epic MyChart' } });
    expect(select).toHaveValue('Epic MyChart');
  });
});
