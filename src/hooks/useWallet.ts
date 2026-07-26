'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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
  isMetaMask?: boolean;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

// ---------------------------------------------------------------------------
// EIP-6963 wallet discovery
// ---------------------------------------------------------------------------
//
// window.ethereum is a single slot that installed extensions race for —
// with MetaMask and the Aethelred Wallet both installed, MetaMask usually
// wins it. EIP-6963 sidesteps the race: every wallet announces itself with
// a stable rdns, and the dApp picks by identity instead of by slot. The
// store below is module-level so discovery happens once per page, not per
// hook instance.

export const AETHELRED_WALLET_RDNS = 'org.aethelred.wallet';
export const METAMASK_RDNS = 'io.metamask';

interface Eip6963AnnounceDetail {
  info?: { rdns?: string };
  provider?: Eip1193Provider;
}

const discoveredProviders = new Map<string, Eip1193Provider>();

/* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (event) => {
    const detail = (event as CustomEvent<Eip6963AnnounceDetail>).detail;
    if (detail?.info?.rdns && detail.provider) {
      discoveredProviders.set(detail.info.rdns, detail.provider);
    }
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
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
// Shiora is pinned to the Aethelred public testnet until the audited mainnet
// release gate is explicitly cleared.
// ---------------------------------------------------------------------------

const CHAIN_IDS: Record<string, string> = {
  testnet: '7332',
};

const AETHELRED_TESTNET_CHAIN_ID_HEX = '0x1ca4';

function chainIdNumber(value: unknown): number | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    return null;
  }
  try {
    const parsed = BigInt(value);
    return parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
  } catch {
    return null;
  }
}

function providerErrorCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

/**
 * Prove that the selected wallet is operating on the public testnet before
 * authentication or transaction broadcast. A client-supplied literal is not a
 * network boundary; the provider itself must report EIP-155 chain 7332.
 */
async function ensureAethelredTestnet(provider: Eip1193Provider): Promise<void> {
  const initial = await provider.request({ method: 'eth_chainId' });
  if (chainIdNumber(initial) === Number(CHAIN_IDS.testnet)) {
    return;
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: AETHELRED_TESTNET_CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (providerErrorCode(error) === 4902) {
      throw new Error(
        'The Aethelred public testnet is not configured in this wallet. ' +
          'Add the official chain 7332 network profile, then reconnect.',
      );
    }
    throw new Error('Switch the wallet to the Aethelred public testnet (chain 7332) to continue.');
  }

  const confirmed = await provider.request({ method: 'eth_chainId' });
  if (chainIdNumber(confirmed) !== Number(CHAIN_IDS.testnet)) {
    throw new Error('The wallet did not switch to the Aethelred public testnet (chain 7332).');
  }
}

function aethelToWeiHex(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Transaction amount must be a positive finite number');
  }

  const [whole, fraction] = amount.toFixed(18).split('.') as [string, string];
  const wei = BigInt(`${whole}${fraction.padEnd(18, '0')}`);
  return `0x${wei.toString(16)}`;
}

/**
 * Resolve the injected EIP-1193 provider for a wallet choice, by identity:
 *
 *   aethelred → EIP-6963 announcement (org.aethelred.wallet)
 *             → window.aethelred (extension-specific handle, present even
 *               when another wallet owns window.ethereum)
 *             → window.ethereum as a last resort, so the flow still works
 *               on single-extension setups and older extension builds
 *   metamask  → EIP-6963 announcement (io.metamask)
 *             → window.ethereum only when it self-identifies as MetaMask
 *
 * Without the identity-first lookup, "Connect Aethelred Wallet" silently
 * signed via whichever extension won the window.ethereum race.
 */
function resolveProvider(kind: WalletProvider): Eip1193Provider | null {
  /* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    ethereum?: Eip1193Provider;
    aethelred?: Eip1193Provider;
  };

  if (kind === 'metamask') {
    const announced = discoveredProviders.get(METAMASK_RDNS);
    if (announced) return announced;
    return w.ethereum?.isMetaMask ? w.ethereum : null;
  }

  if (kind === 'aethelred') {
    return (
      discoveredProviders.get(AETHELRED_WALLET_RDNS) ??
      w.aethelred ??
      (w.ethereum?.isAethelred ? w.ethereum : null) ??
      null
    );
  }

  // walletconnect (and any future kind) has no injected provider path yet.
  return null;
}

export function useWallet(): UseWalletReturn {
  const { wallet, connectWalletWithData, disconnectWallet, addNotification } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeProvider, setActiveProvider] = useState<WalletProvider | null>(
    (wallet.provider as WalletProvider | null) ?? null,
  );
  const [activeChainId, setActiveChainId] = useState<string>(wallet.chainId ?? CHAIN_IDS.testnet);

  /** Check whether the requested wallet's EIP-1193 provider is injected. */
  const isProviderAvailable = useCallback((provider: WalletProvider): boolean => {
    /* istanbul ignore next -- @preserve SSR guard, untestable in jsdom */
    if (typeof window === 'undefined') return false;
    return resolveProvider(provider) !== null;
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
    async (provider: WalletProvider = 'aethelred', network: string = 'testnet') => {
      setIsLoading(true);
      setError(null);
      try {
        const eip1193 = resolveProvider(provider);
        if (!eip1193) {
          throw new Error(
            provider === 'metamask'
              ? 'MetaMask not found. Install the MetaMask extension to continue.'
              : 'Aethelred Wallet not found. Install the Aethelred Wallet extension to continue.',
          );
        }

        if (network !== 'testnet') {
          throw new Error('Shiora currently supports only the Aethelred public testnet.');
        }
        const chainId = CHAIN_IDS.testnet;

        // Step 1: request the account.
        const accounts = (await eip1193.request({
          method: 'eth_requestAccounts',
        })) as string[];
        const address = accounts?.[0]?.toLowerCase();
        if (!address) {
          throw new Error('No account was authorised in the wallet.');
        }

        // Step 2: prove the wallet is on the only network Shiora accepts.
        await ensureAethelredTestnet(eip1193);

        // Step 3: server-issued challenge (nonce + HMAC + expiry).
        const challenge = await api.get<ChallengeResponse>('/api/wallet/challenge', {
          address,
        });

        // Step 4: personal_sign (EIP-191) the exact challenge message.
        const signature = (await eip1193.request({
          method: 'personal_sign',
          params: [challenge.message, address],
        })) as string;

        // Step 5: submit the signature to authenticate.
        const connectResult = await api.post<ConnectResponse>('/api/wallet/connect', {
          address,
          signature,
          chainId,
          nonce: challenge.nonce,
          issuedAt: challenge.issuedAt,
          expiresAt: challenge.expiresAt,
          hmac: challenge.hmac,
        });

        // Step 6: prove the session actually took hold before declaring
        // success. A Secure-only cookie on a plain-http origin is silently
        // dropped by the browser — connect then "succeeds" while every
        // authenticated request 401s. Fail loudly instead.
        try {
          await api.get('/api/me');
        } catch {
          throw new Error(
            'Signed in, but the browser did not keep the session cookie — every ' +
              'request would stay unauthorized. This happens on plain-HTTP ' +
              'origins with a production (non-evaluation) server. Serve the app ' +
              'with SHIORA_PREFLIGHT_MODE=evaluation, put it behind HTTPS, or ' +
              'open it via http://localhost (SSH tunnel).',
          );
        }

        // Balance stays null (unknown): the server authenticates the wallet but
        // does not know chain balances, and we never display an invented number.
        connectWalletWithData(connectResult.address, null, provider, chainId);

        setActiveProvider(provider);
        setActiveChainId(chainId);
        addNotification(
          'success',
          'Wallet Connected',
          provider === 'metamask' ? 'Connected via MetaMask' : 'Connected via Aethelred Wallet',
        );
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
        // Sign with the SAME wallet the session was opened with — falling
        // back to the Aethelred resolution order for restored sessions.
        const eip1193 = resolveProvider(activeProvider ?? 'aethelred');
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
    [wallet.connected, wallet.address, activeProvider],
  );

  /** Ask the active wallet to sign and broadcast an EVM transaction. */
  const signTransaction = useCallback(
    async (tx: Omit<Transaction, 'hash' | 'status' | 'timestamp'>): Promise<string> => {
      if (!wallet.connected) {
        throw new Error('Wallet not connected');
      }
      setIsLoading(true);
      try {
        const eip1193 = resolveProvider(activeProvider ?? 'aethelred');
        if (!eip1193) {
          throw new Error('No wallet provider available for transactions');
        }
        await ensureAethelredTestnet(eip1193);
        if (tx.from.toLowerCase() !== wallet.address.toLowerCase()) {
          throw new Error('Transaction sender does not match the connected wallet');
        }
        if (!/^0x[0-9a-fA-F]{40}$/.test(tx.to)) {
          throw new Error('Transaction recipient must be a valid EVM address');
        }

        const hash = (await eip1193.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: wallet.address,
              to: tx.to,
              value: aethelToWeiHex(tx.amount),
            },
          ],
        })) as string;

        if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
          throw new Error('Wallet returned an invalid transaction hash');
        }

        addNotification(
          'success',
          'Transaction Submitted',
          `Tx ${hash.slice(0, 14)}... is awaiting confirmation`,
        );
        return hash;
      } finally {
        setIsLoading(false);
      }
    },
    [wallet.connected, wallet.address, activeProvider, addNotification],
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
