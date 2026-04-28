// ============================================================
// Tests for src/components/privacy/PrivacyRightsComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import {
  PrivacyRequestCard,
  DataExportPanel,
  ErasureRequestPanel,
} from '@/components/privacy/PrivacyRightsComponents';
import type { PrivacyRequest } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockRequest: PrivacyRequest = {
  id: 'priv-req-1',
  type: 'access',
  status: 'completed',
  details: 'Request for all health records and AI inference logs.',
  dataCategories: ['Health Records', 'AI Inferences'],
  requestedAt: Date.now() - 86400000 * 3,
  completedAt: Date.now() - 86400000,
};

const pendingRequest: PrivacyRequest = {
  id: 'priv-req-2',
  type: 'portability',
  status: 'pending',
  details: 'Data portability request.',
  dataCategories: ['Lab Results'],
  requestedAt: Date.now() - 86400000 * 2,
  completedAt: undefined as unknown as number,
};

const processingRequest: PrivacyRequest = {
  id: 'priv-req-3',
  type: 'erasure',
  status: 'processing',
  details: 'Erasure processing.',
  dataCategories: ['Wearable Data'],
  requestedAt: Date.now() - 86400000,
};

const deniedRequest: PrivacyRequest = {
  id: 'priv-req-4',
  type: 'rectification',
  status: 'denied',
  details: 'Rectification denied.',
  dataCategories: ['Clinical Notes'],
  requestedAt: Date.now() - 86400000 * 5,
};

// ---------------------------------------------------------------------------
// PrivacyRequestCard
// ---------------------------------------------------------------------------

describe('PrivacyRequestCard', () => {
  it('renders request type and status', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={mockRequest} />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Data Access').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders details and data categories', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={mockRequest} />
      </TestWrapper>,
    );
    expect(screen.getByText(/Request for all health records/)).toBeInTheDocument();
    expect(screen.getByText('Health Records')).toBeInTheDocument();
    expect(screen.getByText('AI Inferences')).toBeInTheDocument();
  });

  it('renders request ID', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={mockRequest} />
      </TestWrapper>,
    );
    expect(screen.getByText('ID: priv-req-1')).toBeInTheDocument();
  });

  it('shows View Details button when callback is provided', () => {
    const onViewDetails = jest.fn();
    render(
      <TestWrapper>
        <PrivacyRequestCard request={mockRequest} onViewDetails={onViewDetails} />
      </TestWrapper>,
    );
    const button = screen.getByText('View Details');
    fireEvent.click(button);
    expect(onViewDetails).toHaveBeenCalledWith(mockRequest);
  });

  it('does not show View Details button when no callback', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={mockRequest} />
      </TestWrapper>,
    );
    expect(screen.queryByText('View Details')).not.toBeInTheDocument();
  });

  it('shows completed date when completedAt exists', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={mockRequest} />
      </TestWrapper>,
    );
    // "Completed" badge + "Completed <date>" timestamp
    const completedElements = screen.getAllByText(/Completed/);
    expect(completedElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows time ago when completedAt does not exist', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={pendingRequest} />
      </TestWrapper>,
    );
    // Should show time ago instead of completed date
    expect(screen.queryByText(/Completed /)).not.toBeInTheDocument();
  });

  it('renders portability type correctly', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={pendingRequest} />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Data Portability').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders erasure type correctly', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={processingRequest} />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Data Erasure').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('renders rectification type with denied status', () => {
    render(
      <TestWrapper>
        <PrivacyRequestCard request={deniedRequest} />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Rectification').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DataExportPanel
// ---------------------------------------------------------------------------

describe('DataExportPanel', () => {
  it('renders export panel heading', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('Export Your Data')).toBeInTheDocument();
    expect(screen.getByText(/GDPR Article 15/)).toBeInTheDocument();
  });

  it('renders export format options', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('JSON (FHIR R4)')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('XML (CDA)')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('Request Data Export')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} isLoading />
      </TestWrapper>,
    );
    expect(screen.getByText('Submitting Request...')).toBeInTheDocument();
  });

  // ─── toggleCategory (lines 166-167) ───

  it('toggles categories when checkboxes are clicked', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    // Open categories dropdown
    fireEvent.click(screen.getByText('Select categories...'));
    // Click a category checkbox
    fireEvent.click(screen.getByLabelText('Health Records'));
    expect(screen.getByText('1 category selected')).toBeInTheDocument();
    // Click another
    fireEvent.click(screen.getByLabelText('Lab Results'));
    expect(screen.getByText('2 categories selected')).toBeInTheDocument();
    // Deselect first one
    fireEvent.click(screen.getByLabelText('Health Records'));
    expect(screen.getByText('1 category selected')).toBeInTheDocument();
  });

  // ─── selectAll (lines 172) ───

  it('selects all categories and deselects all', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    // Click Select All
    fireEvent.click(screen.getByText('Select All'));
    expect(screen.getByText('10 categories selected')).toBeInTheDocument();
    // Now should show Deselect All
    fireEvent.click(screen.getByText('Deselect All'));
    expect(screen.getByText('Select categories...')).toBeInTheDocument();
  });

  // ─── handleSubmit (lines 178-180) ───

  it('submits with selected categories and format', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={onSubmit} />
      </TestWrapper>,
    );
    // Open categories and select some
    fireEvent.click(screen.getByText('Select categories...'));
    fireEvent.click(screen.getByLabelText('Health Records'));

    // Select CSV format
    fireEvent.click(screen.getByText('CSV'));

    // Submit
    fireEvent.click(screen.getByText('Request Data Export'));
    expect(onSubmit).toHaveBeenCalledWith(['Health Records'], 'csv');
  });

  it('does not submit when no categories selected', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={onSubmit} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Request Data Export'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('resets categories after successful submit', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={onSubmit} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Select categories...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    fireEvent.click(screen.getByText('Request Data Export'));
    // After submit, categories should be reset
    expect(screen.getByText('Select categories...')).toBeInTheDocument();
  });

  // ─── Format selection (lines 205-255) ───

  it('switches export format', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    // Click on XML format
    fireEvent.click(screen.getByText('XML (CDA)'));
    // Description should show
    expect(screen.getByText('Clinical Document Architecture format')).toBeInTheDocument();
  });

  // ─── showCategories toggle (lines 234) ───

  it('toggles category dropdown visibility', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    // Click to open
    fireEvent.click(screen.getByText('Select categories...'));
    expect(screen.getByLabelText('Health Records')).toBeInTheDocument();
    // Click again to close
    fireEvent.click(screen.getByText('Select categories...'));
    expect(screen.queryByLabelText('Health Records')).not.toBeInTheDocument();
  });

  // ─── Plural/singular category text ───

  it('shows singular "category" for 1 selection', () => {
    render(
      <TestWrapper>
        <DataExportPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Select categories...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    expect(screen.getByText('1 category selected')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ErasureRequestPanel
// ---------------------------------------------------------------------------

describe('ErasureRequestPanel', () => {
  it('renders erasure panel heading', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('Request Data Erasure')).toBeInTheDocument();
    expect(screen.getByText(/GDPR Article 17/)).toBeInTheDocument();
  });

  it('renders permanent deletion warning', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('Permanent Deletion Warning')).toBeInTheDocument();
    expect(screen.getByText(/Data erasure is irreversible/)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByText('Submit Erasure Request')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} isLoading />
      </TestWrapper>,
    );
    expect(screen.getByText('Submitting Erasure Request...')).toBeInTheDocument();
  });

  // ─── toggleCategory (lines 303-306) ───

  it('toggles erasure categories', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    // Open categories
    fireEvent.click(screen.getByText('Select categories to erase...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    expect(screen.getByText('1 category selected for deletion')).toBeInTheDocument();
    // Deselect
    fireEvent.click(screen.getByLabelText('Health Records'));
    expect(screen.getByText('Select categories to erase...')).toBeInTheDocument();
  });

  it('resets confirmed state when category is toggled', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    // Open and select a category
    fireEvent.click(screen.getByText('Select categories to erase...'));
    fireEvent.click(screen.getByLabelText('Health Records'));

    // Confirm the checkbox
    const confirmCheckbox = screen.getByLabelText(/I understand that this action/);
    fireEvent.click(confirmCheckbox);
    expect(confirmCheckbox).toBeChecked();

    // Toggle another category - should reset confirmed
    fireEvent.click(screen.getByLabelText('Lab Results'));
    expect(confirmCheckbox).not.toBeChecked();
  });

  // ─── handleSubmit (lines 310-314) ───

  it('submits erasure request when confirmed', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={onSubmit} />
      </TestWrapper>,
    );
    // Select categories
    fireEvent.click(screen.getByText('Select categories to erase...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    fireEvent.click(screen.getByLabelText('Lab Results'));

    // Confirm
    fireEvent.click(screen.getByLabelText(/I understand that this action/));

    // Submit
    fireEvent.click(screen.getByText('Submit Erasure Request'));
    expect(onSubmit).toHaveBeenCalledWith(['Health Records', 'Lab Results']);
  });

  it('does not submit without confirmation', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={onSubmit} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Select categories to erase...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    // Don't confirm
    fireEvent.click(screen.getByText('Submit Erasure Request'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit with no categories even if confirmed', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={onSubmit} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Submit Erasure Request'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('resets form after submission', () => {
    const onSubmit = jest.fn();
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={onSubmit} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Select categories to erase...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    fireEvent.click(screen.getByLabelText(/I understand that this action/));
    fireEvent.click(screen.getByText('Submit Erasure Request'));
    // After submit, categories and confirmed should be reset
    expect(screen.getByText('Select categories to erase...')).toBeInTheDocument();
  });

  // ─── showCategories toggle (line 351) ───

  it('toggles categories dropdown', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Select categories to erase...'));
    expect(screen.getByLabelText('Health Records')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Select categories to erase...'));
    expect(screen.queryByLabelText('Health Records')).not.toBeInTheDocument();
  });

  // ─── Confirmation checkbox visibility (line 383) ───

  it('shows confirmation checkbox only when categories are selected', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    // Initially no confirmation checkbox
    expect(screen.queryByLabelText(/I understand/)).not.toBeInTheDocument();
    // Select a category
    fireEvent.click(screen.getByText('Select categories to erase...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    // Now confirmation should appear
    expect(screen.getByLabelText(/I understand/)).toBeInTheDocument();
  });

  // ─── Plural text for multiple categories ───

  it('shows plural text for multiple categories', () => {
    render(
      <TestWrapper>
        <ErasureRequestPanel onSubmit={jest.fn()} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Select categories to erase...'));
    fireEvent.click(screen.getByLabelText('Health Records'));
    fireEvent.click(screen.getByLabelText('Lab Results'));
    expect(screen.getByText('2 categories selected for deletion')).toBeInTheDocument();
  });
});
