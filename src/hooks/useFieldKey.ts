'use client';

// ============================================================
// Shiora on Aethelred — useFieldKey
//
// Bridges the wallet to client-side field encryption: the user signs the fixed
// FIELD_KEY_MESSAGE once ("unlock"), and the derived AES-256-GCM key is held in
// memory only (never persisted, never sent to the server). Components seal/open
// sensitive fields with this key.
// ============================================================

import { useState, useCallback } from 'react';

import { useWallet } from '@/hooks/useWallet';
import { deriveFieldKey, FIELD_KEY_MESSAGE } from '@/lib/crypto/client-field-encryption';

export interface UseFieldKeyReturn {
  /** The in-memory field-encryption key, or null until unlocked. */
  fieldKey: CryptoKey | null;
  isUnlocked: boolean;
  isUnlocking: boolean;
  error: Error | null;
  /** Sign FIELD_KEY_MESSAGE and derive the key. */
  unlock: () => Promise<void>;
  /** Forget the key (e.g. on sign-out). */
  lock: () => void;
}

export function useFieldKey(): UseFieldKeyReturn {
  const { signMessage } = useWallet();
  const [fieldKey, setFieldKey] = useState<CryptoKey | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unlock = useCallback(async () => {
    setIsUnlocking(true);
    setError(null);
    try {
      const { signature } = await signMessage({ message: FIELD_KEY_MESSAGE });
      setFieldKey(await deriveFieldKey(signature));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to derive field key'));
    } finally {
      setIsUnlocking(false);
    }
  }, [signMessage]);

  const lock = useCallback(() => setFieldKey(null), []);

  return {
    fieldKey,
    isUnlocked: fieldKey !== null,
    isUnlocking,
    error,
    unlock,
    lock,
  };
}
