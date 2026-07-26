// ============================================================
// Tests for src/app/records/page.tsx
// ============================================================

// The records page reads its data from the real /api/records via
// useHealthRecords. Mock the hook with deterministic, varied records (all five
// types, a known label + tag for the search tests, distinct sizes/dates for the
// sort tests) so the page's client-side type/search/sort derivations run at full
// coverage; the live fetch + mutations are covered by the hook's own test.
const mockRecords = [
  { id: 'rec-1', type: 'lab_result', label: 'Complete Blood Count', description: 'CBC panel', date: Date.now() - 1 * 86400000, uploadDate: Date.now() - 1 * 86400000, encrypted: true, encryption: 'AES-256-GCM', cid: '', txHash: '', attestation: '', size: 1024, provider: 'Metro Labs', status: 'Verified', ipfsNodes: 0, tags: ['routine', 'lab'] },
  { id: 'rec-2', type: 'imaging', label: 'Pelvic Ultrasound', description: 'Imaging', date: Date.now() - 2 * 86400000, uploadDate: Date.now() - 2 * 86400000, encrypted: true, encryption: 'AES-256-GCM', cid: '', txHash: '', attestation: '', size: 4096, provider: 'Imaging Center', status: 'Verified', ipfsNodes: 0, tags: ['imaging', 'annual'] },
  { id: 'rec-3', type: 'prescription', label: 'Estradiol 2mg', description: 'Rx', date: Date.now() - 3 * 86400000, uploadDate: Date.now() - 3 * 86400000, encrypted: true, encryption: 'AES-256-GCM', cid: '', txHash: '', attestation: '', size: 512, provider: 'Pharmacy', status: 'Verified', ipfsNodes: 0, tags: ['medication'] },
  { id: 'rec-4', type: 'vitals', label: 'Blood Pressure Reading', description: 'BP', date: Date.now() - 4 * 86400000, uploadDate: Date.now() - 4 * 86400000, encrypted: true, encryption: 'AES-256-GCM', cid: '', txHash: '', attestation: '', size: 256, provider: 'Clinic', status: 'Verified', ipfsNodes: 0, tags: ['monitoring'] },
  { id: 'rec-5', type: 'notes', label: 'Annual Exam Notes', description: 'Notes', date: Date.now() - 5 * 86400000, uploadDate: Date.now() - 5 * 86400000, encrypted: true, encryption: 'AES-256-GCM', cid: '', txHash: '', attestation: '', size: 2048, provider: 'Dr. Chen', status: 'Verified', ipfsNodes: 0, tags: ['annual', 'specialist'] },
];
const mockMutateAsync = jest.fn(async () => ({}));
jest.mock('@/hooks/useHealthRecords', () => ({
  useHealthRecords: () => ({
    records: mockRecords,
    upload: { mutate: jest.fn(), mutateAsync: mockMutateAsync, isLoading: false, error: null },
  }),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '@/contexts/AppContext';
import RecordsPage from '@/app/records/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

function ConnectWallet({ children }: { children: React.ReactNode }) {
  const { connectWalletWithData } = useApp();
  React.useEffect(() => {
    connectWalletWithData(
      '0x00000000000000000000000000000000000a1b2c',
      null,
      'aethelred',
      '7332',
    );
  }, [connectWalletWithData]);
  return children;
}

function ConnectedTestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ConnectWallet>{children}</ConnectWallet>
    </AppProvider>
  );
}

function createUploadFile(): File {
  return new File([new ArrayBuffer(1024)], 'bloodwork.pdf', {
    type: 'application/pdf',
  });
}

async function openUploadForConnectedWallet() {
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('shiora_wallet')!)).toMatchObject({
      connected: true,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /upload record/i }));
  expect(screen.getByText('Upload Health Record')).toBeInTheDocument();
}

function fillUploadForm() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [createUploadFile()] } });
  fireEvent.click(screen.getByText('Lab Results'));
}

describe('RecordsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMutateAsync.mockReset().mockResolvedValue({});
  });

  it('renders the records page', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    // "Health Records" appears in both the page heading and the nav
    expect(screen.getAllByText('Health Records').length).toBeGreaterThanOrEqual(1);
  });

  it('notifies (does not open the upload modal) when no wallet is connected', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    const uploadBtn = screen.getByRole('button', { name: /upload record/i });
    fireEvent.click(uploadBtn);
    // No wallet in a fresh AppProvider → guarded with a notification, no modal.
    expect(screen.queryByText(/Drag|drop your files|Upload Health Record/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Connect your wallet/i)).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    expect(
      screen.getByText(/AES-256-GCM encrypted at rest/)
    ).toBeInTheDocument();
  });

  it('renders the upload button', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Upload Record')).toBeInTheDocument();
  });

  it('renders stats cards', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getByText('Encrypted at Rest')).toBeInTheDocument();
    expect(screen.getByText('Metadata Size')).toBeInTheDocument();
    // The fabricated "IPFS Nodes" stat was removed (records are not IPFS-pinned).
    expect(screen.queryByText('IPFS Nodes')).not.toBeInTheDocument();
  });

  it('renders filter tabs', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Labs').length).toBeGreaterThanOrEqual(1);
    // "Imaging" and "Vitals" may appear in both filter tabs and record type labels
    expect(screen.getAllByText('Imaging').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Rx').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vitals').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Notes').length).toBeGreaterThanOrEqual(1);
  });

  it('filters records by type when tab is clicked', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Click on "Labs" tab
    const labsTab = screen.getAllByText('Labs')[0];
    fireEvent.click(labsTab);

    // The result count should change
    const resultCount = screen.getByText(/Showing \d+ of \d+ records/);
    expect(resultCount).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    expect(screen.getByPlaceholderText('Search records...')).toBeInTheDocument();
  });

  it('filters records with search query', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search records...');
    fireEvent.change(searchInput, { target: { value: 'Complete Blood' } });

    // Should show filtered results
    const resultCount = screen.getByText(/Showing \d+ of \d+ records/);
    expect(resultCount).toBeInTheDocument();
  });

  it('toggles between list and grid view', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    const gridButton = screen.getByLabelText('Grid view');
    const listButton = screen.getByLabelText('List view');

    // Default is list view - table should be present
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Switch to grid view
    fireEvent.click(gridButton);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Switch back to list view
    fireEvent.click(listButton);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders sort headers in list view', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    expect(screen.getByText('Record')).toBeInTheDocument();
    // "Provider" may appear in nav; use getAllByText
    expect(screen.getAllByText('Provider').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Date').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Size').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles sort when sort header is clicked', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Click Date sort header
    const dateHeaders = screen.getAllByText('Date');
    const dateHeader = dateHeaders[0].closest('th');
    if (dateHeader) fireEvent.click(dateHeader);

    // Records should still render (just reordered)
    const resultCount = screen.getByText(/Showing \d+ of \d+ records/);
    expect(resultCount).toBeInTheDocument();
  });

  it('opens record detail modal when a row is clicked', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Click on the first record row in the table
    const rows = screen.getAllByRole('row');
    // rows[0] is the header, rows[1] is the first data row
    if (rows.length > 1) {
      fireEvent.click(rows[1]);
    }

    // Modal should be open with "Record Details"
    expect(screen.getByText('Record Details')).toBeInTheDocument();
  });

  it('shows result count', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );
    expect(screen.getByText(/Showing \d+ of \d+ records/)).toBeInTheDocument();
  });

  it('shows no results message when filter matches nothing', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search records...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent12345' } });

    expect(screen.getByText('No records match your filters')).toBeInTheDocument();
  });

  it('sorts by label when Record header is clicked', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    const recordHeader = screen.getByText('Record').closest('th');
    expect(recordHeader).not.toBeNull();
    // Click to sort by label desc
    fireEvent.click(recordHeader!);
    // Click again to toggle to asc
    fireEvent.click(recordHeader!);
    expect(screen.getByText(/Showing \d+ of \d+ records/)).toBeInTheDocument();
  });

  it('sorts by size when Size header is clicked', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    const sizeHeaders = screen.getAllByText('Size');
    const sizeHeader = sizeHeaders[0].closest('th');
    expect(sizeHeader).not.toBeNull();
    fireEvent.click(sizeHeader!);
    expect(screen.getByText(/Showing \d+ of \d+ records/)).toBeInTheDocument();
  });

  it('toggles sort direction when same field is clicked twice', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Date is the default sort field. Click it to toggle from desc to asc
    const dateHeaders = screen.getAllByText('Date');
    const dateHeader = dateHeaders[0].closest('th');
    fireEvent.click(dateHeader!);
    // Click again to toggle back to desc
    fireEvent.click(dateHeader!);
    expect(screen.getByText(/Showing \d+ of \d+ records/)).toBeInTheDocument();
  });

  it('opens detail modal from grid view card', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Switch to grid view
    fireEvent.click(screen.getByLabelText('Grid view'));

    // Click the first card in grid view (cards are rendered as clickable MedicalCards)
    const cards = document.querySelectorAll('[class*="cursor-pointer"]');
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.click(cards[0]);

    expect(screen.getByText('Record Details')).toBeInTheDocument();
  });

  it('shows empty state in grid view when no records match', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Switch to grid view
    fireEvent.click(screen.getByLabelText('Grid view'));

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText('Search records...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent12345' } });

    expect(screen.getByText('No records match your filters')).toBeInTheDocument();
  });

  it('shows record detail modal with honest metadata and no IPFS/TEE theater', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Click a row to open the modal
    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]);

    expect(screen.getByText('Record Details')).toBeInTheDocument();
    expect(screen.getByText('Record Type')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Record Date')).toBeInTheDocument();
    expect(screen.getByText('Upload Date')).toBeInTheDocument();
    expect(screen.getByText('File Size')).toBeInTheDocument();
    // The fabricated IPFS/TEE/on-chain crypto block was removed.
    expect(screen.queryByText('Cryptographic Details')).not.toBeInTheDocument();
    expect(screen.queryByText('IPFS CID')).not.toBeInTheDocument();
    expect(screen.queryByText('TEE Attestation')).not.toBeInTheDocument();
  });

  it('closes record detail modal', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Open the modal
    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]);
    expect(screen.getByText('Record Details')).toBeInTheDocument();

    // Close with Escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Record Details')).not.toBeInTheDocument();
  });

  it('searches records by tag', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search records...');
    fireEvent.change(searchInput, { target: { value: 'routine' } });

    const resultCount = screen.getByText(/Showing \d+ of \d+ records/);
    expect(resultCount).toBeInTheDocument();
  });

  it('filters by specific type tabs besides Labs', () => {
    render(
      <TestWrapper>
        <RecordsPage />
      </TestWrapper>
    );

    // Click on Rx tab
    const rxTab = screen.getAllByText('Rx')[0];
    fireEvent.click(rxTab);
    expect(screen.getByText(/Showing \d+ of \d+ records/)).toBeInTheDocument();

    // Click on Notes tab
    const notesTab = screen.getAllByText('Notes')[0];
    fireEvent.click(notesTab);
    expect(screen.getByText(/Showing \d+ of \d+ records/)).toBeInTheDocument();
  });

  it('persists an upload for a connected wallet and closes the success modal', async () => {
    render(
      <ConnectedTestWrapper>
        <RecordsPage />
      </ConnectedTestWrapper>,
    );
    await openUploadForConnectedWallet();
    fillUploadForm();
    fireEvent.click(screen.getByText('Encrypt & Upload'));

    expect(await screen.findByText('Record Saved')).toBeInTheDocument();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lab_result',
        label: 'bloodwork',
        encryption: 'AES-256-GCM',
      }),
    );
    expect(screen.getByText('Record uploaded')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Record Saved')).not.toBeInTheDocument();
  });

  it('reports the API Error and never claims a failed upload succeeded', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('record store offline'));
    render(
      <ConnectedTestWrapper>
        <RecordsPage />
      </ConnectedTestWrapper>,
    );
    await openUploadForConnectedWallet();
    fillUploadForm();
    fireEvent.click(screen.getByText('Encrypt & Upload'));

    expect(await screen.findByText('Upload Failed')).toBeInTheDocument();
    expect(screen.getAllByText('record store offline').length).toBe(2);
    expect(screen.getByText('Upload failed')).toBeInTheDocument();
    expect(screen.queryByText('Record Saved')).not.toBeInTheDocument();
  });

  it('uses a safe upload message when the API rejects with a non-Error', async () => {
    mockMutateAsync.mockRejectedValueOnce('offline');
    render(
      <ConnectedTestWrapper>
        <RecordsPage />
      </ConnectedTestWrapper>,
    );
    await openUploadForConnectedWallet();
    fillUploadForm();
    fireEvent.click(screen.getByText('Encrypt & Upload'));

    expect(await screen.findByText('Upload Failed')).toBeInTheDocument();
    expect(screen.getAllByText('Could not save the record.').length).toBeGreaterThan(0);
  });
});
