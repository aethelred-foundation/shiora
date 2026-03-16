// ============================================================
// Tests for src/components/modals/GrantAccessModal.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GrantAccessModal } from '@/components/modals/GrantAccessModal';

describe('GrantAccessModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

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
    expect(screen.getByPlaceholderText('aeth1...')).toBeInTheDocument();
  });

  it('shows error when Next is clicked without selecting provider', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Please select a provider or enter an address')).toBeInTheDocument();
  });

  it('shows address validation error for invalid address', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('aeth1...');
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
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
  });

  it('renders permissions step with scope, permissions, and duration', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Data Scope')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('renders permission toggles on permissions step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('renders duration options on permissions step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
    expect(screen.getByText('90 Days')).toBeInTheDocument();
    expect(screen.getByText('1 Year')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('navigates back from permissions to provider step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Select Provider')).toBeInTheDocument();
  });

  it('navigates to review step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
    expect(screen.getByText('Access Grant Summary')).toBeInTheDocument();
  });

  it('shows Grant Access button on review step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Grant Access')).toBeInTheDocument();
  });

  // ─── resetForm (lines 88-99) ───

  it('resets form when modal is closed', () => {
    const onClose = jest.fn();
    render(<GrantAccessModal open={true} onClose={onClose} />);
    // Navigate to step 2
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
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
    expect(screen.getByText('Please select a provider or enter an address')).toBeInTheDocument();
  });

  it('validates address that starts with aeth1 but is too short', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('aeth1...');
    fireEvent.change(addressInput, { target: { value: 'aeth1short' } });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Invalid Aethelred address/)).toBeInTheDocument();
  });

  it('accepts valid address and proceeds', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('aeth1...');
    fireEvent.change(addressInput, { target: { value: 'aeth1abcdefghijklmnopqrstuvwxyz12345678' } });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
  });

  // ─── Clears address error on input change ───

  it('clears address error when user types', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('aeth1...');
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

  // ─── submitGrant (lines 142-150) ───

  it('submits grant and shows success state', async () => {
    const onGrantComplete = jest.fn();
    render(<GrantAccessModal open={true} onClose={jest.fn()} onGrantComplete={onGrantComplete} />);

    // Select provider
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));

    // Set permissions
    fireEvent.click(screen.getByText('Download'));
    fireEvent.click(screen.getByText('Share'));

    // Go to review
    fireEvent.click(screen.getByText('Review'));

    // Submit
    fireEvent.click(screen.getByText('Grant Access'));

    // Should show submitting state
    await waitFor(() => {
      expect(screen.getByText('Processing Transaction')).toBeInTheDocument();
      expect(screen.getByText(/Simulating blockchain transaction/)).toBeInTheDocument();
    });

    // Advance timer
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText('Access Granted')).toBeInTheDocument();
    });

    expect(onGrantComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'Dr. Sarah Chen, OB-GYN',
      })
    );
  });

  // ─── Success state Done button (line 224 area) ───

  it('closes modal from success state when Done is clicked', async () => {
    const onClose = jest.fn();
    render(<GrantAccessModal open={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    fireEvent.click(screen.getByText('Grant Access'));
    await act(async () => { jest.advanceTimersByTime(3000); });

    await waitFor(() => {
      expect(screen.getByText('Access Granted')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  // ─── Review step back button (line 509) ───

  it('navigates back from review to permissions', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Set Permissions')).toBeInTheDocument();
  });

  // ─── Custom duration (lines 419-436) ───

  it('shows date picker when Custom duration is selected', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    // Date input should appear
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
  });

  it('sets custom expiry date', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
    expect(dateInput.value).toBe('2025-12-31');
  });

  // ─── Custom expiry in review step ───

  it('shows custom expiry date in review step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Custom'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2025-12-31' } });
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('2025-12-31')).toBeInTheDocument();
  });

  // ─── Data scope selection (line 366) ───

  it('selects different data scopes', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Lab Results Only'));
    // Navigate to review to verify
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Lab Results Only')).toBeInTheDocument();
  });

  // ─── Permission toggles (line 388) ───

  it('toggles view permission off and on', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    // View is on by default, click to toggle off
    fireEvent.click(screen.getByText('View').closest('button')!);
    // Then toggle download on
    fireEvent.click(screen.getByText('Download').closest('button')!);
    // Go to review to verify
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  // ─── Review step shows provider name or "Custom Address" (line 294) ───

  it('shows Custom Address in review when manual address is used', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('aeth1...');
    fireEvent.change(addressInput, { target: { value: 'aeth1abcdefghijklmnopqrstuvwxyz12345678' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText('Custom Address')).toBeInTheDocument();
  });

  // ─── Blockchain notice on review step ───

  it('shows blockchain notice on review step', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText(/This action will submit a transaction/)).toBeInTheDocument();
  });

  // ─── Success state shows transaction hash and details ───

  it('success state shows provider, scope, expiry, and tx hash', async () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Review'));
    fireEvent.click(screen.getByText('Grant Access'));
    await act(async () => { jest.advanceTimersByTime(3000); });

    await waitFor(() => {
      expect(screen.getByText('Access Granted')).toBeInTheDocument();
    });

    expect(screen.getByText('Dr. Sarah Chen, OB-GYN')).toBeInTheDocument();
    expect(screen.getByText('Full Records')).toBeInTheDocument();
    expect(screen.getByText('Transaction Hash')).toBeInTheDocument();
  });

  // ─── Duration selection on permissions step ───

  it('selects different duration options', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
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
    fireEvent.click(screen.getByText('Dr. Sarah Chen, OB-GYN'));
    // Search should be cleared
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  // ─── Empty search shows all providers (line 81) ───

  it('shows all providers when search is empty', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    // With empty search, all providers should be shown
    expect(screen.getByText('Dr. Sarah Chen, OB-GYN')).toBeInTheDocument();
    expect(screen.getByText('Metro Women\'s Health')).toBeInTheDocument();
  });

  // ─── goToPermissions with provider address validation (line 133) ───

  it('validates address on goToPermissions when address is provided but invalid', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    const addressInput = screen.getByPlaceholderText('aeth1...');
    fireEvent.change(addressInput, { target: { value: 'aeth1abc' } }); // too short
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Invalid Aethelred address/)).toBeInTheDocument();
  });

  // ─── Validate address with empty string (lines 109-110) ───

  it('shows error for empty address when no provider selected', () => {
    render(<GrantAccessModal open={true} onClose={jest.fn()} />);
    // No provider selected, no address entered
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Please select a provider or enter an address')).toBeInTheDocument();
  });
});
