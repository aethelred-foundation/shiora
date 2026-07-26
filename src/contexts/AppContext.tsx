/**
 * AppContext — authenticated wallet state and application-wide UI controls.
 *
 * Domain data belongs to owner-scoped API hooks. Chain and confidential-
 * compute telemetry belongs to their live service hooks. Keeping those values
 * out of this context prevents placeholder counters from being presented as
 * production facts.
 */

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { WalletProvider } from '@/types';

export interface WalletState {
  connected: boolean;
  address: string;
  /** AETHEL balance, or null while no live balance source is configured. */
  aethelBalance: number | null;
  /** Wallet extension used for the authenticated session. */
  provider?: WalletProvider | null;
  /** Chain ID recorded during wallet authentication. */
  chainId?: string | null;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export interface AppContextValue {
  wallet: WalletState;
  connectWalletWithData: (
    address: string,
    balance: number | null,
    provider?: WalletProvider | null,
    chainId?: string | null,
  ) => void;
  disconnectWallet: () => void;
  notifications: Notification[];
  addNotification: (type: Notification['type'], title: string, message: string) => void;
  removeNotification: (id: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const DEFAULT_WALLET: WalletState = {
  connected: false,
  address: '',
  aethelBalance: null,
  provider: null,
  chainId: null,
};

let notificationCounter = 0;

function nextNotificationId(): string {
  notificationCounter += 1;
  return `notification-${Date.now()}-${notificationCounter}`;
}

function clearPersistedWallet(): void {
  try {
    localStorage.removeItem('shiora_wallet');
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(DEFAULT_WALLET);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const notificationTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('shiora_wallet');
      if (!stored) return;

      const raw = JSON.parse(stored) as Partial<WalletState>;
      const restored: WalletState | null =
        raw.connected === true &&
        typeof raw.address === 'string' &&
        raw.address.length > 0 &&
        raw.chainId === '7332'
          ? {
              connected: true,
              address: raw.address,
              aethelBalance: typeof raw.aethelBalance === 'number' ? raw.aethelBalance : null,
              provider: raw.provider ?? null,
              chainId: '7332',
            }
          : null;

      if (!restored) {
        clearPersistedWallet();
        return;
      }

      setWallet(restored);
      fetch('/api/wallet/connect', {
        credentials: 'include',
        cache: 'no-store',
      })
        .then(async (response) => {
          if (!response.ok) {
            setWallet(DEFAULT_WALLET);
            clearPersistedWallet();
            return;
          }

          const payload = (await response.json()) as {
            data?: { address?: string };
          };
          if (
            typeof payload.data?.address !== 'string' ||
            payload.data.address.toLowerCase() !== restored.address.toLowerCase()
          ) {
            setWallet(DEFAULT_WALLET);
            clearPersistedWallet();
          }
        })
        .catch(() => {
          // A transient network error does not forge a session. Protected API
          // routes still validate the signed cookie before returning data.
        });
    } catch {
      clearPersistedWallet();
    }
  }, []);

  const connectWalletWithData = useCallback(
    (
      address: string,
      balance: number | null,
      provider?: WalletProvider | null,
      chainId?: string | null,
    ) => {
      if (chainId !== '7332') {
        throw new Error(
          'Shiora accepts authenticated sessions only on the Aethelred public testnet.',
        );
      }
      const nextWallet: WalletState = {
        connected: true,
        address,
        aethelBalance: balance,
        provider: provider ?? null,
        chainId,
      };
      setWallet(nextWallet);
      try {
        localStorage.setItem('shiora_wallet', JSON.stringify(nextWallet));
      } catch {
        // The signed server session remains authoritative if storage is blocked.
      }
    },
    [],
  );

  const disconnectWallet = useCallback(() => {
    setWallet(DEFAULT_WALLET);
    clearPersistedWallet();
    void fetch('/api/wallet/connect', {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => {
      // Local state is cleared even if the best-effort server logout fails.
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
    const timer = notificationTimers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete notificationTimers.current[id];
    }
  }, []);

  const addNotification = useCallback(
    (type: Notification['type'], title: string, message: string) => {
      const id = nextNotificationId();
      setNotifications((current) => [
        ...current,
        { id, type, title, message, timestamp: Date.now() },
      ]);
      notificationTimers.current[id] = setTimeout(() => removeNotification(id), 5000);
    },
    [removeNotification],
  );

  useEffect(() => {
    const timers = notificationTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      wallet,
      connectWalletWithData,
      disconnectWallet,
      notifications,
      addNotification,
      removeNotification,
      searchOpen,
      setSearchOpen,
    }),
    [
      wallet,
      connectWalletWithData,
      disconnectWallet,
      notifications,
      addNotification,
      removeNotification,
      searchOpen,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an <AppProvider>');
  }
  return context;
}
