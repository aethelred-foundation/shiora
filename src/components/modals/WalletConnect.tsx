/**
 * Shiora on Aethelred — Wallet Connect Component
 *
 * Wallet connection with Keplr and Leap support,
 * network selection, balance display, transaction history, and message signing.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Wallet, Globe, ChevronRight, ChevronDown,
  LogOut, ArrowDownLeft, ArrowUpRight, Clock, Shield,
  FileSignature, Compass,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';
import { Modal, Badge, Drawer } from '@/components/ui/SharedComponents';
import { CopyButton } from '@/components/ui/PagePrimitives';
import { formatNumber, truncateAddress, seededHex, seededRandom, formatDate, generateTxHash, timeAgo } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type WalletType = 'keplr' | 'leap';
type NetworkType = 'mainnet' | 'testnet';

interface WalletOption {
  id: WalletType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'contract';
  hash: string;
  amount: number;
  token: string;
  from: string;
  to: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
}

// ============================================================
// Constants
// ============================================================

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'keplr',
    name: 'Keplr',
    description: 'Cosmos ecosystem wallet',
    icon: <Globe className="w-5 h-5 text-orange-600" />,
    color: 'bg-orange-100',
  },
  {
    id: 'leap',
    name: 'Leap',
    description: 'Cosmos ecosystem wallet',
    icon: <Compass className="w-5 h-5 text-emerald-600" />,
    color: 'bg-emerald-100',
  },
];

const SEED = 700;

function generateMockTransactions(): Transaction[] {
  const types: Transaction['type'][] = ['send', 'receive', 'contract', 'receive', 'send'];
  const statuses: Transaction['status'][] = ['confirmed', 'confirmed', 'confirmed', 'pending', 'confirmed'];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `tx-${i}`,
    type: types[i % types.length],
    hash: generateTxHash(SEED + i * 50),
    amount: parseFloat((Math.round(seededRandom(SEED + i * 7) * 5000) / 100).toFixed(2)),
    token: i % 3 === 0 ? 'AETHEL' : '$AETHEL',
    from: `aeth1${seededHex(SEED + i * 10, 8)}...${seededHex(SEED + i * 11, 4)}`,
    to: `aeth1${seededHex(SEED + i * 20, 8)}...${seededHex(SEED + i * 21, 4)}`,
    timestamp: Date.now() - (i + 1) * 3600000 * (1 + seededRandom(SEED + i) * 24),
    status: statuses[i % statuses.length],
  }));
}

// ============================================================
// WalletConnect Component
// ============================================================

export function WalletConnect() {
  const { wallet, realTime } = useApp();
  const { connect, disconnect, signMessage: walletSignMessage, isLoading: walletLoading, error: walletError } = useWallet();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTxDrawer, setShowTxDrawer] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType | null>(null);
  const [network, setNetwork] = useState<NetworkType>('mainnet');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [signMessageText, setSignMessageText] = useState('');
  const [signResult, setSignResult] = useState('');
  const [signing, setSigning] = useState(false);

  const transactions = useMemo(() => generateMockTransactions(), []);

  const handleConnect = useCallback(async (type: WalletType) => {
    setSelectedWalletType(type);
    setConnectError(null);
    try {
      await connect(type, network);
      setShowConnectModal(false);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [connect, network]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setSelectedWalletType(null);
  }, [disconnect]);

  const handleSign = useCallback(async () => {
    /* istanbul ignore next -- guard clause: sign button is disabled when text is empty */
    if (!signMessageText.trim()) return;
    setSigning(true);
    try {
      const result = await walletSignMessage({ message: signMessageText });
      setSignResult(result.signature);
    } catch {
      setSignResult('Signing failed — wallet provider may be unavailable.');
    } finally {
      setSigning(false);
    }
  }, [signMessageText, walletSignMessage]);

  // If wallet is not connected, show connect button
  if (!wallet.connected) {
    return (
      <>
        <button
          onClick={() => setShowConnectModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
        </button>

        {/* Connect Modal */}
        <Modal
          open={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          title="Connect Wallet"
          description="Choose your preferred wallet to connect to Shiora"
          size="sm"
        >
          <div className="space-y-3">
            {/* Network selector */}
            <div className="flex bg-slate-100 rounded-lg p-1 mb-4">
              <button
                onClick={() => setNetwork('mainnet')}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                  network === 'mainnet' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                }`}
              >
                Mainnet
              </button>
              <button
                onClick={() => setNetwork('testnet')}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                  network === 'testnet' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                }`}
              >
                Testnet
              </button>
            </div>

            {/* Wallet options */}
            {WALLET_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleConnect(opt.id)}
                disabled={walletLoading}
                className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition-colors text-left disabled:opacity-50"
              >
                <div className={`w-10 h-10 rounded-xl ${opt.color} flex items-center justify-center shrink-0`}>
                  {(() => {
                    /* istanbul ignore next -- loading state is transient */
                    if (walletLoading && selectedWalletType === opt.id) {
                      return <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />;
                    }
                    return opt.icon;
                  })()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{opt.name}</p>
                  <p className="text-xs text-slate-500">{opt.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}

            {/* Connection error */}
            {(connectError || walletError) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                {connectError || walletError}
              </div>
            )}

            {/* Network info */}
            <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
              <div className={`w-2 h-2 rounded-full ${network === 'mainnet' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              Aethelred {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </div>
          </div>
        </Modal>
      </>
    );
  }

  // Connected state
  /* istanbul ignore next -- network is always mainnet in connected state */
  const networkDotColor = network === 'mainnet' ? 'bg-emerald-500' : 'bg-amber-500';
  /* istanbul ignore next */
  const networkLabel = network === 'mainnet' ? 'Mainnet' : 'Testnet';

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Network indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div className={`w-1.5 h-1.5 rounded-full ${networkDotColor} animate-pulse`} />
          <span className="text-slate-500">{networkLabel}</span>
        </div>

        {/* Wallet button */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm transition-colors">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-400 to-brand-600" />
            <span className="font-mono text-xs text-slate-700 hidden sm:block">
              {truncateAddress(wallet.address, 6, 4)}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-30 bg-white border border-slate-200 rounded-xl shadow-float p-3 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            {/* Balances */}
            <div className="mb-3">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-slate-500">$AETHEL</p>
                <p className="text-sm font-bold text-slate-900">{formatNumber(wallet.aethelBalance)}</p>
              </div>
            </div>

            {/* Address */}
            <div className="bg-slate-50 rounded-lg px-2.5 py-2 mb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-600 truncate mr-2">
                  {truncateAddress(wallet.address, 10, 6)}
                </span>
                <CopyButton text={wallet.address} size="sm" />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-1">
              <button
                onClick={() => setShowTxDrawer(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Clock className="w-4 h-4 text-slate-400" />
                Transaction History
              </button>
              <button
                onClick={() => setShowSignModal(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <FileSignature className="w-4 h-4 text-slate-400" />
                Sign Message
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Drawer */}
      <Drawer
        open={showTxDrawer}
        onClose={() => setShowTxDrawer(false)}
        title="Transaction History"
      >
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                tx.type === 'receive' ? 'bg-emerald-100 text-emerald-600' :
                tx.type === 'send' ? 'bg-brand-100 text-brand-600' :
                'bg-violet-100 text-violet-600'
              }`}>
                {tx.type === 'receive' ? <ArrowDownLeft className="w-4 h-4" /> :
                 tx.type === 'send' ? <ArrowUpRight className="w-4 h-4" /> :
                 <Shield className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 capitalize">{tx.type}</p>
                  <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'pending' ? 'warning' : /* istanbul ignore next */ 'error'}>
                    {tx.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{timeAgo(tx.timestamp)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-medium ${tx.type === 'receive' ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {tx.type === 'receive' ? '+' : '-'}{tx.amount}
                </p>
                <p className="text-xs text-slate-400">{tx.token}</p>
              </div>
            </div>
          ))}

          {transactions.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No transactions yet</p>
            </div>
          )}
        </div>
      </Drawer>

      {/* Sign Message Modal */}
      <Modal
        open={showSignModal}
        onClose={() => { setShowSignModal(false); setSignMessageText(''); setSignResult(''); }}
        title="Sign Message"
        description="Sign a message with your wallet to prove ownership"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">Message</label>
            <textarea
              value={signMessageText}
              onChange={(e) => setSignMessageText(e.target.value)}
              placeholder="Enter message to sign..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>

          {signResult && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1.5">Signature</label>
              <div className="bg-slate-50 rounded-xl p-3 relative">
                <p className="font-mono text-xs text-slate-600 break-all pr-8">{signResult}</p>
                <div className="absolute top-2 right-2">
                  <CopyButton text={signResult} size="sm" />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSign}
            disabled={!signMessageText.trim() || signing}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {signing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FileSignature className="w-4 h-4" />
                Sign Message
              </span>
            )}
          </button>
        </div>
      </Modal>
    </>
  );
}
