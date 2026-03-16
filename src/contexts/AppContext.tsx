/**
 * AppContext — Global application state for Shiora on Aethelred.
 *
 * Provides wallet state, TEE status, health data overview, real-time
 * blockchain simulation, a notification queue, and global search state
 * to every page via React context.
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

import { seededRandom, seededAddress } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletState {
  connected: boolean;
  address: string;
  aethelBalance: number;
  /** Which wallet extension was used to connect (persisted for re-enable on reload). */
  provider?: 'keplr' | 'leap' | null;
  /** Chain ID used during authentication (persisted for signing after reload). */
  chainId?: string | null;
}

export interface HealthDataState {
  totalRecords: number;
  encryptedRecords: number;
  lastUpload: number;
  storageUsed: number; // bytes
  ipfsNodes: number;
}

export interface TEEState {
  status: 'operational' | 'degraded' | 'offline';
  platform: string;
  attestationsToday: number;
  lastAttestation: number;
  enclaveUptime: number;
  inferencesCompleted: number;
}

export interface RealTimeState {
  blockHeight: number;
  tps: number;
  epoch: number;
  networkLoad: number;
  aethelPrice: number;
  lastBlockTime: number;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

export interface ConsentState {
  activeConsents: number;
  pendingRequests: number;
  revokedToday: number;
}

export interface ChatState {
  activeConversationId: string | null;
  unreadCount: number;
  totalConversations: number;
}

export interface VaultState {
  compartmentCount: number;
  lockedCount: number;
  privacyScore: number;
  lastAccessed: number;
}

export interface GovernanceState {
  activeProposals: number;
  votingPower: number;
  delegatedPower: number;
  totalProposals: number;
}

export interface StakingState {
  stakedAmount: number;
  pendingRewards: number;
  currentAPY: number;
  unstakingAmount: number;
}

export interface MarketplaceState {
  activeListings: number;
  totalEarnings: number;
  pendingPurchases: number;
}

export interface RewardsState {
  totalEarned: number;
  pendingRewards: number;
  currentStreak: number;
  level: number;
}

export interface AppContextValue {
  wallet: WalletState;
  connectWallet: () => void;
  connectWalletWithData: (address: string, balance: number, provider?: 'keplr' | 'leap' | null, chainId?: string | null) => void;
  disconnectWallet: () => void;
  healthData: HealthDataState;
  teeState: TEEState;
  realTime: RealTimeState;
  notifications: Notification[];
  addNotification: (type: Notification['type'], title: string, message: string) => void;
  removeNotification: (id: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  consentState: ConsentState;
  chatState: ChatState;
  vaultState: VaultState;
  governanceState: GovernanceState;
  stakingState: StakingState;
  marketplaceState: MarketplaceState;
  rewardsState: RewardsState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let notifCounter = 0;
function nextNotifId(): string {
  notifCounter += 1;
  return `notif-${Date.now()}-${notifCounter}`;
}

// ---------------------------------------------------------------------------
// Defaults (deterministic so the server and client agree)
// ---------------------------------------------------------------------------

const SEED = 42;

const DEFAULT_WALLET: WalletState = {
  connected: false,
  address: '',
  aethelBalance: 0,
};

const DEFAULT_HEALTH: HealthDataState = {
  totalRecords: 147,
  encryptedRecords: 147,
  lastUpload: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
  storageUsed: 2.4 * 1024 * 1024 * 1024, // 2.4 GB
  ipfsNodes: 47,
};

const DEFAULT_TEE: TEEState = {
  status: 'operational',
  platform: 'Intel SGX',
  attestationsToday: Math.round(280 + seededRandom(SEED + 50) * 120),
  lastAttestation: Date.now() - 1000 * 60 * 2, // 2 min ago
  enclaveUptime: 99.97,
  inferencesCompleted: Math.round(12400 + seededRandom(SEED + 60) * 800),
};

const DEFAULT_REALTIME: RealTimeState = {
  blockHeight: 2847391,
  tps: Math.round(1800 + seededRandom(SEED + 10) * 1000),
  epoch: 247,
  networkLoad: Math.round(60 + seededRandom(SEED + 30) * 25),
  aethelPrice: parseFloat((1.24 + (seededRandom(SEED + 40) - 0.5) * 0.1).toFixed(4)),
  lastBlockTime: 0,
};

const DEFAULT_CONSENT: ConsentState = {
  activeConsents: Math.round(8 + seededRandom(SEED + 70) * 7),
  pendingRequests: Math.round(1 + seededRandom(SEED + 71) * 3),
  revokedToday: Math.round(seededRandom(SEED + 72) * 2),
};

const DEFAULT_CHAT: ChatState = {
  activeConversationId: null,
  unreadCount: Math.round(seededRandom(SEED + 73) * 5),
  totalConversations: Math.round(8 + seededRandom(SEED + 74) * 12),
};

const DEFAULT_VAULT: VaultState = {
  compartmentCount: 8,
  lockedCount: Math.round(5 + seededRandom(SEED + 75) * 3),
  privacyScore: Math.round(82 + seededRandom(SEED + 76) * 15),
  lastAccessed: Date.now() - 1000 * 60 * 30,
};

const DEFAULT_GOVERNANCE: GovernanceState = {
  activeProposals: Math.round(3 + seededRandom(SEED + 77) * 5),
  votingPower: Math.round(48250 + seededRandom(SEED + 78) * 5000),
  delegatedPower: Math.round(12000 + seededRandom(SEED + 79) * 3000),
  totalProposals: Math.round(47 + seededRandom(SEED + 80) * 20),
};

const DEFAULT_STAKING: StakingState = {
  stakedAmount: Math.round(35000 + seededRandom(SEED + 81) * 10000),
  pendingRewards: parseFloat((125 + seededRandom(SEED + 82) * 75).toFixed(2)),
  currentAPY: parseFloat((8.5 + seededRandom(SEED + 83) * 4).toFixed(1)),
  unstakingAmount: 0,
};

const DEFAULT_MARKETPLACE: MarketplaceState = {
  activeListings: Math.round(3 + seededRandom(SEED + 84) * 5),
  totalEarnings: parseFloat((1250 + seededRandom(SEED + 85) * 2000).toFixed(2)),
  pendingPurchases: Math.round(seededRandom(SEED + 86) * 3),
};

const DEFAULT_REWARDS: RewardsState = {
  totalEarned: parseFloat((450 + seededRandom(SEED + 87) * 300).toFixed(2)),
  pendingRewards: parseFloat((25 + seededRandom(SEED + 88) * 50).toFixed(2)),
  currentStreak: Math.round(5 + seededRandom(SEED + 89) * 15),
  level: Math.round(3 + seededRandom(SEED + 90) * 5),
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: React.ReactNode }) {
  // --- Wallet ---------------------------------------------------------------
  const [wallet, setWallet] = useState<WalletState>(DEFAULT_WALLET);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('shiora_wallet');
      if (stored) {
        const parsed = JSON.parse(stored) as WalletState;
        if (parsed.connected) {
          setWallet(parsed);

          // Validate the server session is still valid and matches the
          // locally stored address; auto-disconnect or reconcile if not.
          fetch('/api/wallet/connect', { credentials: 'include' })
            .then(async (res) => {
              if (!res.ok) {
                setWallet(DEFAULT_WALLET);
                try { localStorage.removeItem('shiora_wallet'); } catch { /* ignore */ }
                return;
              }
              try {
                const data = (await res.json()) as { data?: { address?: string } };
                const serverAddr = data?.data?.address;
                if (serverAddr && serverAddr !== parsed.address) {
                  // Session cookie belongs to a different wallet — clear stale state.
                  setWallet(DEFAULT_WALLET);
                  try { localStorage.removeItem('shiora_wallet'); } catch { /* ignore */ }
                }
              } catch { /* ignore parse errors — session is valid */ }
            })
            .catch(() => {
              // Network error — keep local state, next API call will handle it.
            });
        }
      }
    } catch { /* ignore */ }
  }, []);

  const persistWallet = useCallback((w: WalletState) => {
    setWallet(w);
    try { localStorage.setItem('shiora_wallet', JSON.stringify(w)); } catch { /* ignore */ }
  }, []);

  // Quick-connect with a generated address (dev/test convenience, no server auth).
  const connectWallet = useCallback(() => {
    const seed = Date.now();
    persistWallet({
      connected: true,
      address: seededAddress(seed),
      aethelBalance: 48250.75,
    });
  }, [persistWallet]);

  // Authenticated connect: called by useWallet after a successful server
  // challenge-response handshake so the UI reflects real wallet data.
  const connectWalletWithData = useCallback((
    address: string,
    balance: number,
    provider?: 'keplr' | 'leap' | null,
    chainId?: string | null,
  ) => {
    persistWallet({
      connected: true,
      address,
      aethelBalance: balance,
      provider: provider ?? null,
      chainId: chainId ?? null,
    });
  }, [persistWallet]);

  const disconnectWallet = useCallback(() => {
    setWallet(DEFAULT_WALLET);
    try { localStorage.removeItem('shiora_wallet'); } catch { /* ignore */ }

    if (typeof fetch === 'function') {
      void fetch('/api/wallet/connect', {
        method: 'DELETE',
        credentials: 'same-origin',
      }).catch(/* istanbul ignore next */ () => {
        // Clearing the server cookie is best-effort during local development.
      });
    }
  }, []);

  // --- Health Data -----------------------------------------------------------
  const [healthData] = useState<HealthDataState>(DEFAULT_HEALTH);

  // --- TEE State -------------------------------------------------------------
  const [teeState, setTeeState] = useState<TEEState>(DEFAULT_TEE);

  // --- Real-time data -------------------------------------------------------
  const [realTime, setRealTime] = useState<RealTimeState>(DEFAULT_REALTIME);

  useEffect(() => {
    const interval = setInterval(() => {
      setRealTime((prev) => ({
        blockHeight: prev.blockHeight + 1,
        tps: Math.round(1800 + Math.random() * 1000),
        epoch: prev.epoch + (prev.blockHeight % 1000 === 0 ? 1 : 0),
        networkLoad: Math.round(60 + Math.random() * 25),
        aethelPrice: parseFloat((1.24 + (Math.random() - 0.5) * 0.1).toFixed(4)),
        lastBlockTime: Date.now(),
      }));

      setTeeState((prev) => ({
        ...prev,
        attestationsToday: prev.attestationsToday + (Math.random() > 0.7 ? 1 : 0),
        lastAttestation: Math.random() > 0.7 ? Date.now() : prev.lastAttestation,
        inferencesCompleted: prev.inferencesCompleted + (Math.random() > 0.5 ? 1 : 0),
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // --- Notifications --------------------------------------------------------
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timerMap = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (timerMap.current[id]) {
      clearTimeout(timerMap.current[id]);
      delete timerMap.current[id];
    }
  }, []);

  const addNotification = useCallback(
    (type: Notification['type'], title: string, message: string) => {
      const id = nextNotifId();
      const notif: Notification = { id, type, title, message, timestamp: Date.now() };
      setNotifications((prev) => [...prev, notif]);
      timerMap.current[id] = setTimeout(() => removeNotification(id), 5000);
    },
    [removeNotification],
  );

  useEffect(() => {
    const timers = timerMap.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  // --- Consent --------------------------------------------------------------
  const [consentState] = useState<ConsentState>(DEFAULT_CONSENT);

  // --- Chat ----------------------------------------------------------------
  const [chatState] = useState<ChatState>(DEFAULT_CHAT);

  // --- Vault ---------------------------------------------------------------
  const [vaultState] = useState<VaultState>(DEFAULT_VAULT);

  // --- Governance ----------------------------------------------------------
  const [governanceState] = useState<GovernanceState>(DEFAULT_GOVERNANCE);

  // --- Staking -------------------------------------------------------------
  const [stakingState] = useState<StakingState>(DEFAULT_STAKING);

  // --- Marketplace ---------------------------------------------------------
  const [marketplaceState] = useState<MarketplaceState>(DEFAULT_MARKETPLACE);

  // --- Rewards -------------------------------------------------------------
  const [rewardsState] = useState<RewardsState>(DEFAULT_REWARDS);

  // --- Search ---------------------------------------------------------------
  const [searchOpen, setSearchOpen] = useState(false);

  // --- Memoised context value -----------------------------------------------
  const value = useMemo<AppContextValue>(
    () => ({
      wallet, connectWallet, connectWalletWithData, disconnectWallet,
      healthData, teeState, realTime,
      notifications, addNotification, removeNotification,
      searchOpen, setSearchOpen,
      consentState, chatState, vaultState,
      governanceState, stakingState, marketplaceState, rewardsState,
    }),
    [
      wallet, connectWallet, connectWalletWithData, disconnectWallet,
      healthData, teeState, realTime,
      notifications, addNotification, removeNotification,
      searchOpen,
      consentState, chatState, vaultState,
      governanceState, stakingState, marketplaceState, rewardsState,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an <AppProvider>');
  return ctx;
}
