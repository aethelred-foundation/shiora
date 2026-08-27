import { renderHook, act, waitFor } from '@testing-library/react';

const mockSignMessage = jest.fn();
jest.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({ signMessage: mockSignMessage }),
}));

jest.mock('@/lib/crypto/client-field-encryption', () => ({
  ...jest.requireActual('@/lib/crypto/client-field-encryption'),
  deriveFieldKey: jest.fn(),
}));

import { useFieldKey } from '@/hooks/useFieldKey';
import { deriveFieldKey, FIELD_KEY_MESSAGE } from '@/lib/crypto/client-field-encryption';

const mockDerive = deriveFieldKey as jest.Mock;
const FAKE_KEY = { type: 'secret' } as unknown as CryptoKey;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useFieldKey', () => {
  it('starts locked', () => {
    const { result } = renderHook(() => useFieldKey());
    expect(result.current.fieldKey).toBeNull();
    expect(result.current.isUnlocked).toBe(false);
  });

  it('derives the key from a wallet signature on unlock', async () => {
    mockSignMessage.mockResolvedValue({ signature: 'sig-abc' });
    mockDerive.mockResolvedValue(FAKE_KEY);

    const { result } = renderHook(() => useFieldKey());
    await act(async () => {
      await result.current.unlock();
    });

    expect(mockSignMessage).toHaveBeenCalledWith({ message: FIELD_KEY_MESSAGE });
    expect(mockDerive).toHaveBeenCalledWith('sig-abc');
    await waitFor(() => expect(result.current.isUnlocked).toBe(true));
    expect(result.current.fieldKey).toBe(FAKE_KEY);
  });

  it('captures an Error thrown during unlock', async () => {
    mockSignMessage.mockRejectedValue(new Error('user rejected'));
    const { result } = renderHook(() => useFieldKey());
    await act(async () => {
      await result.current.unlock();
    });
    await waitFor(() => expect(result.current.error?.message).toBe('user rejected'));
    expect(result.current.isUnlocked).toBe(false);
  });

  it('wraps a non-Error rejection in a default error', async () => {
    mockSignMessage.mockRejectedValue('weird non-error');
    const { result } = renderHook(() => useFieldKey());
    await act(async () => {
      await result.current.unlock();
    });
    await waitFor(() => expect(result.current.error?.message).toBe('Failed to derive field key'));
  });

  it('locks (forgets the key)', async () => {
    mockSignMessage.mockResolvedValue({ signature: 'sig' });
    mockDerive.mockResolvedValue(FAKE_KEY);
    const { result } = renderHook(() => useFieldKey());

    await act(async () => {
      await result.current.unlock();
    });
    await waitFor(() => expect(result.current.isUnlocked).toBe(true));

    act(() => {
      result.current.lock();
    });
    expect(result.current.fieldKey).toBeNull();
  });
});
