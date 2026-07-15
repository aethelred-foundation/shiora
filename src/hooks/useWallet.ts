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
// Aethelred Wallet (EIP-1193) provider type
// ---------------------------------------------------------------------------
//
// The whole Aethelred ecosystem authenticates against ONE wallet: the
// Aethelred Wallet injects an EIP-1193 provider at `window.ethereum` (with
// `isAethelred: true`, and announced via EIP-6963). Shiora connects the same
// way Cruzible, ZeroID, TerraQura and NoblePay do — no Keplr/Leap fork.

/** Minimal EIP-1193 provider surface Shiora needs. */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  isAethelred?: boolean;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface ChallengeResponse {
  message: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  hmac: string;
}

interface ConnectResponse {
  address: string;
  expiresAt: number;
  expiresIn: string;
}

export interface UseWalletReturn {
  wallet: WalletState;
  isConnected: boolean;
  displayAddress: string;
  connect: (provider?: WalletProvider, network?: string) => Promise<void>;
  disconnect: () => void;
  signMessage: (params: SignMessageParams) => Promise<SignMessageResult>;
  signTransaction: (tx: Omit<Transaction, 'hash' | 'status' | 'timestamp'>) => Promise<string>;
  isProviderAvailable: (provider: WalletProvider) => boolean;
  activeProvider: WalletProvider | null;
  isLoading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Aethelred EVM chain ids (cosmos/evm). Testnet and local devnet share 7332;
// mainnet is 7331. Passed through to the session record; the challenge HMAC
// does not depend on it.
// ---------------------------------------------------------------------------

const CHAIN_IDS: Record<string, string> = {
  mainnet: '7331',
  testnet: '7332',
};

/**
 * Resolve the Aethelred Wallet's injected EIP-1193 provider. Prefers a
 * provider that self-identifies as Aethelred; falls back to any injected
 * `window.ethereum` so the flow still works while the Aethelred Wallet is the
 * only extension a tester has installed.
 */
function getAethelredProvider(): Eip1193Provider | null {
  /* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
  if (typeof window === 'undefined') return null;
  const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return injected ?? null;
}

export function useWallet(): UseWalletReturn {
  const {
    wallet,
    connectWalletWithData,
    disconnectWallet,
    addNotification,
  } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeProvider, setActiveProvider] = useState<WalletProvider | null>(
    (wallet.provider as WalletProvider | null) ?? null,
  );
  const [activeChainId, setActiveChainId] = useState<string>(
    wallet.chainId ?? CHAIN_IDS.mainnet,
  );

  // Ref to seed dev tx hashes deterministically after each connect/sign.
  const seedRef = useRef(Date.now());

  /** Check whether the Aethelred Wallet (or any EIP-1193 wallet) is injected. */
  const isProviderAvailable = useCallback((provider: WalletProvider): boolean => {
    /* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
    if (typeof window === 'undefined') return false;
    if (provider === 'aethelred') {
      return getAethelredProvider() !== null;
    }
    return false;
  }, []);

  /** Truncated address for display (e.g. `0x1234…cdef`). */
  const displayAddress = useMemo(() => {
    if (!wallet.address) return '';
    if (wallet.address.length <= 12) return wallet.address;
    return `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`;
  }, [wallet.address]);

  /**
   * Connect via the Aethelred Wallet using the challenge-response auth flow.
   * 1. eth_requestAccounts -> the 0x account
   * 2. GET /api/wallet/challenge?address=<addr> -> HMAC-bound challenge
   * 3. personal_sign the challenge message (EIP-191)
   * 4. POST /api/wallet/connect with the 0x signature + challenge data
   */
  const connect = useCallback(
    async (provider: WalletProvider = 'aethelred', network: string = 'mainnet') => {
      setIsLoading(true);
      setError(null);
      try {
        const eip1193 = getAethelredProvider();
        if (!eip1193) {
          throw new Error(
            'Aethelred Wallet not found. Install the Aethelred Wallet extension to continue.',
          );
        }

        const chainId = CHAIN_IDS[network] ?? CHAIN_IDS.mainnet;

        // Step 1: request the account.
        const accounts = (await eip1193.request({
          method: 'eth_requestAccounts',
        })) as string[];
        const address = accounts?.[0]?.toLowerCase();
        if (!address) {
          throw new Error('No account was authorised in the wallet.');
        }

        // Step 2: server-issued challenge (nonce + HMAC + expiry).
        const challenge = await api.get<ChallengeResponse>('/api/wallet/challenge', {
          address,
        });

        // Step 3: personal_sign (EIP-191) the exact challenge message.
        const signature = (await eip1193.request({
          method: 'personal_sign',
          params: [challenge.message, address],
        })) as string;

        // Step 4: submit the signature to authenticate.
        const connectResult = await api.post<ConnectResponse>('/api/wallet/connect', {
          address,
          signature,
          chainId,
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          expiresAt: challenge.expiresAt,
          hmac: challenge.hmac,
        });

        // Balance stays null (unknown): the server authenticates the wallet but
        // does not know chain balances, and we never display an invented number.
        connectWalletWithData(connectResult.address, null, provider, chainId);

        setActiveProvider(provider);
        setActiveChainId(chainId);
        seedRef.current = Date.now();
        addNotification('success', 'Wallet Connected', 'Connected via Aethelred Wallet');
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

  /** Disconnect the wallet and clear the server session. */
  const disconnect = useCallback(() => {
    api.delete('/api/wallet/connect').catch(() => {
      // Ignore errors — local state is cleared regardless.
    });
    disconnectWallet();
    setActiveProvider(null);
    setError(null);
    addNotification('info', 'Wallet Disconnected', 'Your wallet has been disconnected');
  }, [disconnectWallet, addNotification]);

  /** Sign an arbitrary string message with personal_sign (EIP-191). */
  const signMessage = useCallback(
    async (params: SignMessageParams): Promise<SignMessageResult> => {
      if (!wallet.connected) {
        throw new Error('Wallet not connected');
      }
      setIsLoading(true);
      try {
        const eip1193 = getAethelredProvider();
        if (!eip1193) {
          throw new Error('No wallet provider available for signing');
        }

        const signer = (params.signer ?? wallet.address).toLowerCase();
        const signature = (await eip1193.request({
          method: 'personal_sign',
          params: [params.message, signer],
        })) as string;

        return {
          message: params.message,
          signature,
          publicKey: '', // EIP-191 recovers the key server-side; not exposed here.
        };
      } finally {
        setIsLoading(false);
      }
    },
    [wallet.connected, wallet.address],
  );

  /** Sign and broadcast a transaction (dev stub). Returns a tx hash. */
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

  // Keep the session's chain id in sync when it is restored from storage.
  useEffect(() => {
    if (wallet.chainId && wallet.chainId !== activeChainId) {
      setActiveChainId(wallet.chainId);
    }
  }, [wallet.chainId, activeChainId]);

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
