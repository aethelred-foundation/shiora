// Verifies the SymptomLogger seals the free-text note client-side (selective
// E2E) before emitting it, when the user has unlocked encryption.

const mockFieldKeyState = {
  fieldKey: null as CryptoKey | null,
  isUnlocked: false,
  isUnlocking: false,
  unlock: jest.fn(),
  lock: jest.fn(),
};

jest.mock('@/hooks/useFieldKey', () => ({ useFieldKey: () => mockFieldKeyState }));

jest.mock('@/lib/crypto/client-field-encryption', () => ({
  ...jest.requireActual('@/lib/crypto/client-field-encryption'),
  sealSensitiveField: jest.fn(),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SymptomLogger } from '@/components/vault/VaultComponents';
import { sealSensitiveField } from '@/lib/crypto/client-field-encryption';
import { SYMPTOM_CATEGORIES } from '@/lib/constants';

const mockSeal = sealSensitiveField as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFieldKeyState.fieldKey = null;
  mockFieldKeyState.isUnlocked = false;
  mockFieldKeyState.isUnlocking = false;
});

describe('SymptomLogger client-side sealing', () => {
  it('seals the note on-device before emitting it when unlocked', async () => {
    mockFieldKeyState.fieldKey = { type: 'secret' } as unknown as CryptoKey;
    mockFieldKeyState.isUnlocked = true;
    mockSeal.mockResolvedValue('SEALED-ENVELOPE');

    const onLog = jest.fn();
    render(<SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={onLog} recentLogs={[]} />);

    fireEvent.click(screen.getByText('Pain'));
    fireEvent.change(screen.getByPlaceholderText('Add any additional details...'), {
      target: { value: 'private note' },
    });
    fireEvent.click(screen.getByText('Log Symptom'));

    await waitFor(() => expect(onLog).toHaveBeenCalled());
    expect(mockSeal).toHaveBeenCalledWith('private note', mockFieldKeyState.fieldKey, 'vault:symptom-note');
    expect(onLog.mock.calls[0][0].notes).toBe('SEALED-ENVELOPE');
  });

  it('shows the encrypted indicator once unlocked', () => {
    mockFieldKeyState.isUnlocked = true;
    render(<SymptomLogger categories={SYMPTOM_CATEGORIES} onLog={jest.fn()} recentLogs={[]} />);
    fireEvent.click(screen.getByText('Pain'));
    expect(screen.getByText(/Encrypted on your device before sending/)).toBeInTheDocument();
  });
});
