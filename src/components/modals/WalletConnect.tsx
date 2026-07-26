/**
 * Shiora on Aethelred — Wallet Connect Component
 *
 * Wallet connection for the Aethelred public testnet, balance display, and
 * message signing.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Wallet, ChevronRight, ChevronDown, LogOut, Shield, FileSignature } from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';
import { Modal } from '@/components/ui/SharedComponents';
import { CopyButton } from '@/components/ui/PagePrimitives';
import { formatNumber, truncateAddress } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type WalletType = 'aethelred' | 'metamask';
interface WalletOption {
  id: WalletType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  recommended?: boolean;
}

// ============================================================
// Constants
// ============================================================

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'aethelred',
    name: 'Aethelred Wallet',
    description: 'The one wallet for the Aethelred ecosystem',
    icon: <Shield className="w-5 h-5 text-rose-600" />,
    color: 'bg-rose-100',
    recommended: true,
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    description: 'Connect with the MetaMask browser extension',
    icon: <Wallet className="w-5 h-5 text-amber-600" />,
    color: 'bg-amber-100',
  },
];

// ============================================================
// WalletConnect Component
// ============================================================

export function WalletConnect() {
  const { wallet } = useApp();
  const {
    connect,
    disconnect,
    signMessage: walletSignMessage,
    isLoading: walletLoading,
    error: walletError,
  } = useWallet();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedWalletType, setSelectedWalletType] = useState<WalletType | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [signMessageText, setSignMessageText] = useState('');
  const [signResult, setSignResult] = useState('');
  const [signing, setSigning] = useState(false);

  const handleConnect = useCallback(
    async (type: WalletType) => {
      setSelectedWalletType(type);
      setConnectError(null);
      try {
        await connect(type, 'testnet');
        setShowConnectModal(false);
      } catch (err) {
        setConnectError(err instanceof Error ? err.message : 'Connection failed');
      }
    },
    [connect],
  );

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
            {/* Wallet options */}
            {WALLET_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleConnect(opt.id)}
                disabled={walletLoading}
                className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition-colors text-left disabled:opacity-50"
              >
                <div
                  className={`w-10 h-10 rounded-xl ${opt.color} flex items-center justify-center shrink-0`}
                >
                  {(() => {
                    /* istanbul ignore next -- loading state is transient */
                    if (walletLoading && selectedWalletType === opt.id) {
                      return (
                        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      );
                    }
                    return opt.icon;
                  })()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    {opt.name}
                    {opt.recommended && (
                      <span className="text-[10px] uppercase tracking-widest text-brand-600 font-semibold">
                        Recommended
                      </span>
                    )}
                  </p>
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
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Aethelred Public Testnet
            </div>
          </div>
        </Modal>
      </>
    );
  }

  // Connected state
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Network indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-slate-500">Public Testnet</span>
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
                <p className="text-sm font-bold text-slate-900">
                  {wallet.aethelBalance === null ? '—' : formatNumber(wallet.aethelBalance)}
                </p>
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

      {/* Sign Message Modal */}
      <Modal
        open={showSignModal}
        onClose={() => {
          setShowSignModal(false);
          setSignMessageText('');
          setSignResult('');
        }}
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
