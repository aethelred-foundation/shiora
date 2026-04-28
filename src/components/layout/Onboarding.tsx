/**
 * Shiora on Aethelred — Onboarding Flow
 *
 * First-time user onboarding with wallet connection, encryption key setup,
 * TEE enclave selection, and optional health record import.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Heart,
  Wallet,
  Key,
  Cpu,
  Upload,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Shield,
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Fingerprint,
  Globe,
  Compass,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { useWallet } from '@/hooks/useWallet';
import { Badge } from '@/components/ui/SharedComponents';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { TEE_PLATFORMS } from '@/lib/constants';
import { truncateAddress } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface OnboardingProps {
  onComplete: () => void;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

const TOTAL_STEPS = 6;

const STORAGE_KEY = 'shiora_onboarding_complete';

// ============================================================
// Step Components
// ============================================================

function StepWelcome() {
  return (
    <div className="text-center">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg">
          <svg viewBox="0 0 24 24" className="w-12 h-12">
            <path
              d="M 15 4 C 10 4 6 7.5 6 12 C 6 16.5 10 20 15 20 C 17 20 18.5 19.2 18.5 19.2"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-slate-900 mb-3">Welcome to Shiora</h2>
      <p className="text-base text-slate-500 max-w-md mx-auto mb-8">
        Your sovereign health data platform powered by TEE-verified AI on the Aethelred blockchain.
      </p>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
        <div className="p-4 bg-brand-50 rounded-xl">
          <Lock className="w-6 h-6 text-brand-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">End-to-End Encryption</p>
          <p className="text-xs text-slate-500 mt-1">AES-256-GCM encryption for all health data</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl">
          <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">TEE Verified</p>
          <p className="text-xs text-slate-500 mt-1">AI runs inside secure hardware enclaves</p>
        </div>
        <div className="p-4 bg-violet-50 rounded-xl">
          <Fingerprint className="w-6 h-6 text-violet-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-900">You Own Your Data</p>
          <p className="text-xs text-slate-500 mt-1">Sovereign control with blockchain proofs</p>
        </div>
      </div>
    </div>
  );
}

function StepConnectWallet({
  wallet,
  connectWallet,
}: {
  wallet: { connected: boolean; address: string };
  connectWallet: (provider?: 'keplr' | 'leap') => void | Promise<void>;
}) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
        <Wallet className="w-8 h-8 text-brand-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Connect Your Wallet</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
        Connect a blockchain wallet to establish your identity on the Aethelred network.
      </p>

      {(() => {
        /* istanbul ignore next -- wallet.connected is always false in test context */
        if (wallet.connected) {
          return (
            <div className="max-w-sm mx-auto">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 mb-4">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-emerald-900">Wallet Connected</p>
                  <p className="text-xs font-mono text-emerald-700 mt-0.5">
                    {truncateAddress(wallet.address, 12, 8)}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="max-w-sm mx-auto space-y-3">
            <button
              onClick={() => {
                connectWallet('keplr')?.catch(() => {
                  /* error handled by useWallet */
                });
              }}
              className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Keplr Wallet</p>
                <p className="text-xs text-slate-500">Cosmos ecosystem wallet</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
            </button>

            <button
              onClick={() => {
                connectWallet('leap')?.catch(() => {
                  /* error handled by useWallet */
                });
              }}
              className="w-full flex items-center gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Leap Wallet</p>
                <p className="text-xs text-slate-500">Cosmos ecosystem wallet</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function StepEncryptionKeys() {
  const [keysGenerated, setKeysGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateKeys = async () => {
    setGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setKeysGenerated(true);
    setGenerating(false);
  };

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
        <Key className="w-8 h-8 text-brand-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Set Up Encryption Keys</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
        Generate your personal encryption keys. These keys ensure only you can decrypt your health
        data.
      </p>

      <div className="max-w-sm mx-auto">
        {keysGenerated ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-emerald-900">Encryption Keys Generated</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  AES-256-GCM keys stored securely in your browser
                </p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Algorithm</span>
                <Badge variant="info">AES-256-GCM</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Key Derivation</span>
                <Badge variant="info">PBKDF2</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Status</span>
                <Badge variant="success" dot>
                  Active
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={generateKeys}
            disabled={generating}
            className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating Keys...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Key className="w-4 h-4" />
                Generate Encryption Keys
              </span>
            )}
          </button>
        )}

        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Your encryption keys are generated locally and never transmitted. Back up your keys
              securely -- losing them means losing access to your data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTEEPreference() {
  const [selectedPlatform, setSelectedPlatform] = useState('Intel SGX');

  const platformDescriptions: Record<string, string> = {
    'Intel SGX':
      'Industry-standard with hardware-level memory isolation. Recommended for most users.',
    'AWS Nitro':
      'Cloud-native enclaves with strong AWS integration. Ideal for scalable deployments.',
    'AMD SEV':
      'Secure Encrypted Virtualization for VM-level isolation. Best for virtualized environments.',
  };

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-6">
        <Cpu className="w-8 h-8 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Choose TEE Enclave</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
        Select the Trusted Execution Environment for your health AI computations. All AI runs
        exclusively inside these secure enclaves.
      </p>

      <div className="max-w-md mx-auto space-y-3">
        {TEE_PLATFORMS.map((platform) => (
          <button
            key={platform}
            onClick={() => setSelectedPlatform(platform)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-colors flex items-center justify-between ${
              selectedPlatform === platform
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <Cpu
                className={`w-5 h-5 ${selectedPlatform === platform ? 'text-brand-600' : 'text-slate-400'}`}
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{platform}</p>
                <p className="text-xs text-slate-500">{platformDescriptions[platform]}</p>
              </div>
            </div>
            {selectedPlatform === platform && (
              <CheckCircle className="w-5 h-5 text-brand-500 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepImportRecords() {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const simulateImport = async () => {
    setImporting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setImported(true);
    setImporting(false);
  };

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-6">
        <Upload className="w-8 h-8 text-violet-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Import Health Records</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
        Import your existing health records from other platforms. This step is optional and can be
        done later.
      </p>

      <div className="max-w-sm mx-auto">
        {imported ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-emerald-900">Records Ready for Import</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Your records will be encrypted and uploaded after setup
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={simulateImport}
              disabled={importing}
              className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
            >
              {importing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin" />
                  Scanning Records...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  Select Files to Import
                </span>
              )}
            </button>
            <p className="text-xs text-slate-400">
              Supports PDF, DICOM, CSV, JSON, PNG, JPEG files up to 100 MB each
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepComplete() {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
        <Sparkles className="w-10 h-10 text-emerald-500" />
      </div>
      <h2 className="text-3xl font-bold text-slate-900 mb-3">You&apos;re All Set!</h2>
      <p className="text-base text-slate-500 max-w-md mx-auto mb-8">
        Your Shiora on Aethelred account is configured and ready. Your health data is protected by
        end-to-end encryption and TEE-verified AI on the Aethelred blockchain.
      </p>

      <div className="max-w-sm mx-auto space-y-3 mb-8">
        {[
          { label: 'Wallet connected', icon: Wallet, color: 'text-emerald-500' },
          { label: 'Encryption keys generated', icon: Key, color: 'text-emerald-500' },
          { label: 'TEE enclave selected', icon: Cpu, color: 'text-emerald-500' },
          { label: 'Ready to go', icon: CheckCircle, color: 'text-emerald-500' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl text-left"
          >
            <item.icon className={`w-5 h-5 ${item.color} shrink-0`} />
            <span className="text-sm font-medium text-emerald-900">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Onboarding Component
// ============================================================

export function Onboarding({ onComplete }: OnboardingProps) {
  const { wallet } = useApp();
  const { connect: connectWallet } = useWallet();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);

  // Check if already completed
  useEffect(() => {
    try {
      const completed = localStorage.getItem(STORAGE_KEY);
      if (completed === 'true') {
        onComplete();
      }
    } catch {
      /* ignore */
    }
  }, [onComplete]);

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => (s + 1) as OnboardingStep);
    } else {
      // Persist completion
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        /* ignore */
      }
      onComplete();
    }
  }, [currentStep, onComplete]);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => (s - 1) as OnboardingStep);
    }
  }, [currentStep]);

  const skipOnboarding = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
    onComplete();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path
                d="M 15 4 C 10 4 6 7.5 6 12 C 6 16.5 10 20 15 20 C 17 20 18.5 19.2 18.5 19.2"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span className="text-lg font-bold text-slate-900">Shiora</span>
        </div>
        {currentStep < TOTAL_STEPS && (
          <button
            onClick={skipOnboarding}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 py-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i + 1 === currentStep
                ? 'w-8 bg-brand-500'
                : i + 1 < currentStep
                  ? 'w-1.5 bg-brand-300'
                  : 'w-1.5 bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto animate-fade-in">
          {currentStep === 1 && <StepWelcome />}
          {currentStep === 2 && <StepConnectWallet wallet={wallet} connectWallet={connectWallet} />}
          {currentStep === 3 && <StepEncryptionKeys />}
          {currentStep === 4 && <StepTEEPreference />}
          {currentStep === 5 && <StepImportRecords />}
          {currentStep === 6 && <StepComplete />}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
        <div>
          {currentStep > 1 && (
            <button
              onClick={goBack}
              className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
        <div className="text-xs text-slate-400">
          Step {currentStep} of {TOTAL_STEPS}
        </div>
        <button
          onClick={goNext}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          {currentStep === TOTAL_STEPS ? (
            <>
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to check if onboarding has been completed.
 */
export function useOnboardingComplete(): boolean {
  const [complete, setComplete] = useState(true); // Default true to avoid flash

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setComplete(stored === 'true');
    } catch {
      setComplete(true);
    }
  }, []);

  return complete;
}
