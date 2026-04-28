'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useApp } from '@/contexts/AppContext';
import { api } from '@/lib/api/client';
import type {
  WalletState,
  WalletProvider,
  Transaction,
  SignMessageParams,
  SignMessageResult,
} from '@/types';

// ---------------------------------------------------------------------------
// Keplr / MetaMask window type augmentations
// ---------------------------------------------------------------------------

/** Minimal Keplr-like provider interface for type-safe window access. */
export interface KeplrProvider {
  enable: (chainId: string) => Promise<void>;
  getKey: (chainId: string) => Promise<{
    name: string;
    algo: string;
    pubKey: Uint8Array;
    address: Uint8Array;
    bech32Address: string;
  }>;
  signArbitrary: (
    chainId: string,
    signer: string,
    data: string,
  ) => Promise<{ signature: string; pub_key: { value: string } }>;
}

// ---------------------------------------------------------------------------
// Challenge response type (mirrors server response shape)
// ---------------------------------------------------------------------------

interface ChallengeResponse {
  message: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  hmac: string;
}

// ---------------------------------------------------------------------------
// Connect response type (mirrors server response shape)
// ---------------------------------------------------------------------------

interface ConnectResponse {
  address: string;
  expiresAt: number;
  expiresIn: string;
  balances: { aethel: number };
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseWalletReturn {
  /** Current wallet connection state. */
  wallet: WalletState;
  /** Whether the wallet is currently connected. */
  isConnected: boolean;
  /** Truncated address for UI display. */
  displayAddress: string;
  /** Connect a wallet (optionally specifying provider and network). */
  connect: (provider?: WalletProvider, network?: string) => Promise<void>;
  /** Disconnect the current wallet. */
  disconnect: () => void;
  /** Sign an arbitrary message. Returns the signature. */
  signMessage: (params: SignMessageParams) => Promise<SignMessageResult>;
  /** Sign and broadcast a transaction. Returns a mock tx hash. */
  signTransaction: (tx: Omit<Transaction, 'hash' | 'status' | 'timestamp'>) => Promise<string>;
  /** Check if a specific wallet provider is available in the browser. */
  isProviderAvailable: (provider: WalletProvider) => boolean;
  /** The currently active provider, if any. */
  activeProvider: WalletProvider | null;
  /** Whether a wallet operation is in progress. */
  isLoading: boolean;
  /** Last wallet error, if any. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Wallet provider helpers
// ---------------------------------------------------------------------------

const CHAIN_IDS: Record<string, string> = {
  mainnet: 'aethelred-1',
  testnet: 'aethelred-testnet-1',
};

function getKeplr(): KeplrProvider | null {
  /* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
  if (typeof window === 'undefined') return null;
  return (window as unknown as { keplr?: KeplrProvider }).keplr ?? null;
}

function getLeap(): KeplrProvider | null {
  /* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
  if (typeof window === 'undefined') return null;
  // Leap exposes the same API shape as Keplr
  return (window as unknown as { leap?: KeplrProvider }).leap ?? null;
}

function getCosmosProvider(provider: WalletProvider): KeplrProvider | null {
  switch (provider) {
    case 'keplr':
      return getKeplr();
    case 'leap':
      return getLeap();
    default:
      return null;
  }
}

/**
 * Convert a base64-encoded byte string to hex.
 * Used for Keplr/Leap pub_key.value (base64 of 33-byte compressed key)
 * and signature (base64 of 64-byte raw r||s).
 */
function base64ToHex(b64: string): string {
  const raw = atob(b64);
  let hex = '';
  for (let i = 0; i < raw.length; i++) {
    hex += raw.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWallet(): UseWalletReturn {
  const { wallet, connectWalletWithData, disconnectWallet, addNotification } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise provider/chain from persisted wallet state so signing works
  // after a page reload without requiring a full reconnect.
  const [activeProvider, setActiveProvider] = useState<WalletProvider | null>(
    (wallet.provider as WalletProvider | null) ?? null,
  );
  const [activeChainId, setActiveChainId] = useState<string>(wallet.chainId ?? CHAIN_IDS.mainnet);
  const [providerRestored, setProviderRestored] = useState(false);

  // Ref to track the latest sign seed for mock tx hashes
  const seedRef = useRef(Date.now());

  // On mount, if we have a persisted provider, silently re-enable the wallet
  // extension so that signArbitrary is available without a full reconnect.
  useEffect(() => {
    if (providerRestored || !wallet.connected || !activeProvider) return;
    setProviderRestored(true);

    const cosmosProvider = getCosmosProvider(activeProvider);
    if (!cosmosProvider) return;

    // Best-effort re-enable; if the extension rejects we still keep the session.
    cosmosProvider.enable(activeChainId).catch(() => {
      // Extension not available or user rejected — signing will show a clear error.
    });
  }, [wallet.connected, activeProvider, activeChainId, providerRestored]);

  /** Check whether a wallet extension is injected into the window. */
  const isProviderAvailable = useCallback((provider: WalletProvider): boolean => {
    /* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
    if (typeof window === 'undefined') return false;
    switch (provider) {
      case 'keplr':
        return 'keplr' in window;
      case 'leap':
        return 'leap' in window;
      default:
        return false;
    }
  }, []);

  /** Truncated address for display (e.g. `aeth1ab3c...x9z0`). */
  const displayAddress = useMemo(() => {
    if (!wallet.address) return '';
    if (wallet.address.length <= 16) return wallet.address;
    return `${wallet.address.slice(0, 10)}...${wallet.address.slice(-6)}`;
  }, [wallet.address]);

  /**
   * Connect to a wallet provider using challenge-response auth flow.
   * 1. Enable the wallet extension and get address + pubkey
   * 2. GET /api/wallet/challenge?address=<addr> -> challenge
   * 3. Sign the challenge message with the wallet (signArbitrary)
   * 4. POST /api/wallet/connect with <pubKeyHex>.<sigHex> + challenge data
   */
  const connect = useCallback(
    async (provider: WalletProvider = 'keplr', network: string = 'mainnet') => {
      setIsLoading(true);
      setError(null);
      try {
        const cosmosProvider = getCosmosProvider(provider);
        if (!cosmosProvider) {
          throw new Error(`${provider} wallet is not supported. Please use Keplr or Leap.`);
        }

        const chainId = CHAIN_IDS[network] ?? CHAIN_IDS.mainnet;

        // Step 1: Enable the wallet and get the key info
        await cosmosProvider.enable(chainId);
        const key = await cosmosProvider.getKey(chainId);
        const address = key.bech32Address;

        // Step 2: Request a challenge from the server
        const challenge = await api.get<ChallengeResponse>('/api/wallet/challenge', {
          address,
        });

        // Step 3: Sign the challenge message with the wallet extension
        const signResult = await cosmosProvider.signArbitrary(chainId, address, challenge.message);

        // Convert base64 pub_key and signature to hex for the backend
        const pubKeyHex = base64ToHex(signResult.pub_key.value);
        const sigHex = base64ToHex(signResult.signature);

        // Step 4: Submit signed challenge to authenticate
        // Backend expects signature in "<compressedPubKeyHex>.<signatureHex>" format
        const connectResult = await api.post<ConnectResponse>('/api/wallet/connect', {
          address,
          signature: `${pubKeyHex}.${sigHex}`,
          timestamp: Date.now(),
          chainId,
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          expiresAt: challenge.expiresAt,
          hmac: challenge.hmac,
        });

        // Step 5: Update local state with server-confirmed data
        // Persist provider & chainId so signing survives page reloads.
        connectWalletWithData(
          connectResult.address,
          connectResult.balances.aethel,
          provider as 'keplr' | 'leap',
          chainId,
        );

        setActiveProvider(provider);
        setActiveChainId(chainId);
        seedRef.current = Date.now();
        addNotification('success', 'Wallet Connected', `Connected via ${provider}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to connect wallet';
        setError(message);
        addNotification('error', 'Connection Failed', message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [connectWalletWithData, addNotification],
  );

  /** Disconnect the wallet and clear server session. */
  const disconnect = useCallback(() => {
    // Best-effort server-side disconnect
    api.delete('/api/wallet/connect').catch(() => {
      // Ignore errors — local state is cleared regardless
    });
    disconnectWallet();
    setActiveProvider(null);
    setError(null);
    addNotification('info', 'Wallet Disconnected', 'Your wallet has been disconnected');
  }, [disconnectWallet, addNotification]);

  /** Sign an arbitrary string message using the active wallet provider. */
  const signMessage = useCallback(
    async (params: SignMessageParams): Promise<SignMessageResult> => {
      if (!wallet.connected) {
        throw new Error('Wallet not connected');
      }
      setIsLoading(true);
      try {
        const cosmosProvider = activeProvider ? getCosmosProvider(activeProvider) : null;
        if (!cosmosProvider) {
          throw new Error('No wallet provider available for signing');
        }

        const result = await cosmosProvider.signArbitrary(
          activeChainId,
          params.signer ?? wallet.address,
          params.message,
        );

        return {
          message: params.message,
          signature: result.signature,
          publicKey: result.pub_key.value,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [wallet.connected, wallet.address, activeProvider, activeChainId],
  );

  /** Sign and broadcast a transaction (mock for dev). Returns a tx hash. */
  const signTransaction = useCallback(
    async (tx: Omit<Transaction, 'hash' | 'status' | 'timestamp'>): Promise<string> => {
      if (!wallet.connected) {
        throw new Error('Wallet not connected');
      }
      setIsLoading(true);
      try {
        await new Promise((r) => setTimeout(r, 800));
        const seed = seedRef.current + tx.amount + tx.blockHeight;
        const hex = Math.abs(seed).toString(16).padStart(8, '0');
        const hash = `0x${hex.repeat(8)}`;
        addNotification('success', 'Transaction Signed', `Tx ${hash.slice(0, 14)}... submitted`);
        return hash;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet.connected, addNotification],
  );

  return {
    wallet,
    isConnected: wallet.connected,
    displayAddress,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    isProviderAvailable,
    activeProvider,
    isLoading,
    error,
  };
}
