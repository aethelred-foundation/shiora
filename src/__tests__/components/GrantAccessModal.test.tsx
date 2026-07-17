// ============================================================
// Tests for src/components/modals/GrantAccessModal.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GrantAccessModal } from '@/components/modals/GrantAccessModal';

const PROVIDER = 'Dr. Sarah Chen, OB-GYN';
const PROVIDER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

function selectProviderWithAddress() {
  fireEvent.click(screen.getByText(PROVIDER));
  fireEvent.change(screen.getByPlaceholderText('0x...'), {
    target: { value: PROVIDER_ADDRESS },
  });
}

function dateFromToday(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('GrantAccessModal', () => {
  it('does not render when open is false', () => {
    render(<GrantAccessModal open={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Select Provider')).not.toBeInTheDocument();
  });

  it('renders provider step when open', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    expect(screen.getByText('Select Provider')).toBeInTheDocument();
    expect(screen.getByText('Choose a healthcare provider to grant access')).toBeInTheDocument();
  });

  it('renders provider search input', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    expect(screen.getByPlaceholderText('Search healthcare providers...')).toBeInTheDocument();
  });

  it('renders manual address input', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument();
  });

  it('requires a provider address before continuing', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Provider address is required')).toBeInTheDocument();
  });

  it('does not auto-generate an address when a provider is selected', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText(PROVIDER));
    expect(screen.getByPlaceholderText('0x...')).toHaveValue('');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Provider address is required')).toBeInTheDocument();
  });

  it('shows address validation error for invalid address', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(addressInput, { target: { value: 'invalid' } });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Invalid Aethelred address/)).toBeInTheDocument();
  });

  it('renders progress dots', () => {
    const { container } = render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const dots = container.querySelectorAll('.rounded-full.w-2\\.5');
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it('navigates to permissions step after selecting a provider', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
  });

  it('renders permissions step with scope, permissions, and duration', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Data Scope')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('renders permission toggles on permissions step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('renders duration options on permissions step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
    expect(screen.getByText('90 Days')).toBeInTheDocument();
    expect(screen.getByText('1 Year')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('navigates back from permissions to provider step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Select Provider')).toBeInTheDocument();
  });

  it('navigates to review step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
    expect(screen.getByText('Access Grant Summary')).toBeInTheDocument();
  });

  it('shows Grant Access button on review step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByRole('button', { name: 'Sign & Grant Access' })).toBeInTheDocument();
  });

  // ─── resetForm (lines 88-99) ───

  it('resets form when modal is closed', () => {
    const onClose = jest.fn();
    render(<GrantAccessModal open={true} onClose={onClose} />);
    // Navigate to step 2
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    // Close via escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // ─── handleClose (lines 103-104) ───

  it('calls handleClose and resets when close button is clicked', () => {
    const onClose = jest.fn();
    render(<GrantAccessModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  // ─── validateAddress (lines 109-110) ───

  it('validates empty address shows required error', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    // Don't select provider, leave address empty
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Provider address is required')).toBeInTheDocument();
  });

  it('rejects a malformed/too-short address', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(addressInput, { target: { value: 'aeth1short' } });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Invalid Aethelred address/)).toBeInTheDocument();
  });

  it('accepts valid address and proceeds', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(addressInput, {
      target: { value: '0x1234567890abcdef1234567890abcdef12345678' },
    });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
  });

  // ─── Clears address error on input change ───

  it('clears address error when user types', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(addressInput, { target: { value: 'bad' } });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Invalid Aethelred address/)).toBeInTheDocument();
    // Type again to clear error
    fireEvent.change(addressInput, { target: { value: 'aeth1' } });
    expect(screen.queryByText(/Invalid Aethelred address/)).not.toBeInTheDocument();
  });

  // ─── Provider search filtering ───

  it('filters providers by search', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const searchInput = screen.getByPlaceholderText('Search healthcare providers...');
    fireEvent.change(searchInput, { target: { value: 'sarah' } });
    expect(screen.getByText('Dr. Sarah Chen, OB-GYN')).toBeInTheDocument();
  });

  // ─── Async submission ───

  it('waits for the async grant, then shows success and the returned grant ID', async () => {
    let resolveGrant!: (result: { id: string }) => void;
    const onGrantComplete = jest.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveGrant = resolve;
        }),
    );
    render(<GrantAccessModal open={true} onClose={jest.fn()} onGrantComplete={onGrantComplete} />);

    // Select provider
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));

    // Set permissions
    fireEvent.click(screen.getByText('Download'));
    fireEvent.click(screen.getByText('Share'));

    // Go to review
    fireEvent.click(screen.getByText('Review'));

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Sign & Grant Access' }));

    expect(screen.getByText('Confirm Access Grant')).toBeInTheDocument();
    expect(screen.getByText(/Approve the wallet signature request/)).toBeInTheDocument();
    expect(screen.queryByText('Access Granted')).not.toBeInTheDocument();

    await act(async () => {
      resolveGrant({ id: 'grant-real-123' });
    });

    expect(await screen.findByText('Access Granted')).toBeInTheDocument();
    expect(screen.getByText('Grant ID')).toBeInTheDocument();
    expect(screen.getByText('grant-real-123')).toBeInTheDocument();

    expect(onGrantComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: PROVIDER,
        address: PROVIDER_ADDRESS,
        permissions: { view: true, download: true, share: true },
      }),
    );
  });

  it('shows the callback error and never reports success when granting fails', async () => {
    const onGrantComplete = jest.fn().mockRejectedValue(new Error('Request validation failed'));
    render(<GrantAccessModal open={true} onClose={jest.fn()} onGrantComplete={onGrantComplete} />);

    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign & Grant Access' }));

    expect(await screen.findByText('Grant Failed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Request validation failed');
    expect(screen.queryByText('Access Granted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
  });

  // ─── Success state Done button (line 224 area) ───

  it('closes modal from success state when Done is clicked', async () => {
    const onClose = jest.fn();
    const onGrantComplete = jest.fn().mockResolvedValue({ id: 'grant-1' });
    render(<GrantAccessModal open={true} onClose={onClose} onGrantComplete={onGrantComplete} />);

    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign & Grant Access' }));
    expect(await screen.findByText('Access Granted')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  // ─── Review step back button (line 509) ───

  it('navigates back from review to permissions', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
  });

  // ─── Custom duration (lines 419-436) ───

  it('shows date picker when Custom duration is selected', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    // Date input should appear
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
  });

  it('sets custom expiry date', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const expiry = dateFromToday(30);
    fireEvent.change(dateInput, { target: { value: expiry } });
    expect(dateInput.value).toBe(expiry);
  });

  // ─── Custom expiry in review step ───

  it('requires a custom expiry date and keeps the error visible', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    fireEvent.click(screen.getByText('Review'));

    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an expiry date');
    expect(document.querySelector('input[type="date"]')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects a custom expiry that is not in the future', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    fireEvent.change(document.querySelector('input[type="date"]')!, {
      target: { value: dateFromToday(0) },
    });
    fireEvent.click(screen.getByText('Review'));

    expect(screen.getByRole('alert')).toHaveTextContent('Expiry date must be in the future');
    expect(screen.queryByText('Review & Confirm')).not.toBeInTheDocument();
  });

  it('rejects a custom expiry more than 365 days away', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    fireEvent.change(document.querySelector('input[type="date"]')!, {
      target: { value: dateFromToday(366) },
    });
    fireEvent.click(screen.getByText('Review'));

    expect(screen.getByRole('alert')).toHaveTextContent('Expiry date must be within 365 days');
    expect(screen.queryByText('Review & Confirm')).not.toBeInTheDocument();
  });

  it('accepts a valid future custom expiry and shows it in review', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const expiry = dateFromToday(30);
    fireEvent.change(dateInput, { target: { value: expiry } });
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText(expiry)).toBeInTheDocument();
  });

  // ─── Data scope selection (line 366) ───

  it('selects different data scopes', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Lab Results Only'));
    // Navigate to review to verify
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Lab Results Only')).toBeInTheDocument();
  });

  // ─── Permission toggles (line 388) ───

  it('requires view permission before reviewing a grant', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));

    // An empty permission set cannot proceed.
    fireEvent.click(screen.getByText('View').closest('button')!);
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enable View permission to create an access grant',
    );

    // Download/share also require View, matching the server policy.
    fireEvent.click(screen.getByText('Download').closest('button')!);
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'View permission is required before records can be downloaded or shared',
    );

    // Restoring View clears the validation error and allows review.
    fireEvent.click(screen.getByText('View').closest('button')!);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  // ─── Review step custom-provider label ───

  it('uses a nonempty Custom provider label when only an address is supplied', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(addressInput, { target: { value: PROVIDER_ADDRESS } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Custom provider')).toBeInTheDocument();
  });

  // ─── Wallet-signature notice on review step ───

  it('explains the wallet signature without transaction or gas claims', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText(/wallet will ask you to sign this access grant/i)).toBeInTheDocument();
    expect(screen.getByText(/no transaction is sent and no gas is charged/i)).toBeInTheDocument();
    expect(screen.queryByText(/TEE smart contracts/i)).not.toBeInTheDocument();
  });

  // ─── Honest success details ───

  it('success state shows provider and scope without a fabricated transaction hash', async () => {
    const onGrantComplete = jest.fn().mockResolvedValue(undefined);
    render(<GrantAccessModal open={true} onClose={jest.fn()} onGrantComplete={onGrantComplete} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign & Grant Access' }));
    expect(await screen.findByText('Access Granted')).toBeInTheDocument();

    expect(screen.getByText(PROVIDER)).toBeInTheDocument();
    expect(screen.getByText('Full Records')).toBeInTheDocument();
    expect(screen.queryByText('Transaction Hash')).not.toBeInTheDocument();
    expect(screen.queryByText('Grant ID')).not.toBeInTheDocument();
  });

  // ─── Duration selection on permissions step ───

  it('selects different duration options', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    selectProviderWithAddress();
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('7 Days'));
    fireEvent.click(screen.getByText('90 Days'));
    fireEvent.click(screen.getByText('1 Year'));
    // Verify last selection sticks
    expect(screen.getByText('1 Year')).toBeInTheDocument();
  });

  // ─── selectProvider resets search (line 82-83 area) ───

  it('clears search when a provider is selected', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const searchInput = screen.getByPlaceholderText('Search healthcare providers...');
    fireEvent.change(searchInput, { target: { value: 'sarah' } });
    selectProviderWithAddress();
    // Search should be cleared
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  // ─── Empty search shows all providers (line 81) ───

  it('shows all providers when search is empty', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    // With empty search, all providers should be shown
    expect(screen.getByText('Dr. Sarah Chen, OB-GYN')).toBeInTheDocument();
    expect(screen.getByText("Metro Women's Health")).toBeInTheDocument();
  });

  // ─── goToPermissions with provider address validation (line 133) ───

  it('validates address on goToPermissions when address is provided but invalid', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(addressInput, { target: { value: 'aeth1abc' } }); // too short
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Invalid Aethelred address/)).toBeInTheDocument();
  });

  // ─── Validate address with empty string (lines 109-110) ───

  it('shows error for empty address when no provider selected', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    // No provider selected, no address entered
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Provider address is required')).toBeInTheDocument();
  });
});
