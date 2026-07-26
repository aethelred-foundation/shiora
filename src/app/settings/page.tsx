/**
 * Shiora account and security settings.
 *
 * This production page intentionally exposes only state and actions backed by
 * the authenticated wallet session or live operational APIs.
 */

'use client';

import Link from 'next/link';
import {
  Activity,
  BookOpen,
  ExternalLink,
  FileHeart,
  KeyRound,
  Languages,
  Link as LinkIcon,
  LogOut,
  Network,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { useNetwork } from '@/hooks/useNetwork';
import {
  Footer,
  SearchOverlay,
  ToastContainer,
  TopNav,
  Badge,
} from '@/components/ui/SharedComponents';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { truncateAddress } from '@/lib/utils';

const OPERATIONAL_LINKS = [
  {
    href: '/api/health/ready',
    label: 'Readiness',
    description: 'Production dependency and datastore readiness',
    icon: ShieldCheck,
  },
  {
    href: '/api/system/status',
    label: 'Service status',
    description: 'Deployment profile and capability maturity',
    icon: Activity,
  },
  {
    href: '/api/openapi',
    label: 'API schema',
    description: 'Machine-readable OpenAPI contract',
    icon: BookOpen,
  },
  {
    href: '/.well-known/security.txt',
    label: 'Security contact',
    description: 'Coordinated vulnerability disclosure channel',
    icon: KeyRound,
  },
] as const;

function statusVariant(
  health: ReturnType<typeof useNetwork>['health'],
): 'success' | 'warning' | 'error' | 'neutral' {
  if (health === 'healthy') return 'success';
  if (health === 'degraded') return 'warning';
  if (health === 'critical') return 'error';
  return 'neutral';
}

export default function SettingsPage() {
  const { wallet, disconnectWallet, addNotification } = useApp();
  const network = useNetwork();

  const disconnect = () => {
    disconnectWallet();
    addNotification(
      'success',
      'Wallet disconnected',
      'The local wallet state and server session were cleared.',
    );
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="mt-2 text-sm text-slate-500">
              Review your authenticated wallet session, public-testnet connection, and production
              service endpoints.
            </p>
          </header>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MedicalCard>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Wallet session</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      The signed server session is authoritative for protected requests.
                    </p>
                  </div>
                </div>
                <Badge variant={wallet.connected ? 'success' : 'neutral'} dot>
                  {wallet.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-500">Address</dt>
                  <dd className="break-all text-right font-mono text-slate-800">
                    {wallet.connected ? truncateAddress(wallet.address, 10, 8) : 'Unavailable'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Network</dt>
                  <dd className="font-medium text-slate-800">Aethelred Public Testnet</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Chain ID</dt>
                  <dd className="font-mono text-slate-800">{wallet.chainId ?? '7332'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Wallet provider</dt>
                  <dd className="text-slate-800">{wallet.provider ?? 'Unavailable'}</dd>
                </div>
              </dl>

              {wallet.connected ? (
                <button
                  type="button"
                  onClick={disconnect}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect wallet
                </button>
              ) : (
                <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  Use <strong>Connect Wallet</strong> in the navigation bar to establish an
                  authenticated public-testnet session.
                </p>
              )}
            </MedicalCard>

            <MedicalCard>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Network className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">Network telemetry</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Values are read from the configured Aethelred JSON-RPC endpoint.
                    </p>
                  </div>
                </div>
                <Badge variant={statusVariant(network.health)} dot>
                  {network.health}
                </Badge>
              </div>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Latest block</dt>
                  <dd className="font-mono text-slate-800">{network.formattedBlockHeight}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Transaction rate</dt>
                  <dd className="font-mono text-slate-800">
                    {network.state.tps === null
                      ? network.formattedTps
                      : `${network.formattedTps} TPS`}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Network load</dt>
                  <dd className="font-mono text-slate-800">{network.formattedLoad}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={network.reconnect}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh telemetry
              </button>
            </MedicalCard>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Data and access</h2>
            <p className="mt-1 text-sm text-slate-500">
              Account-scoped operations use the same authenticated session and audit boundary.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  href: '/records',
                  label: 'Health records',
                  icon: FileHeart,
                },
                {
                  href: '/access',
                  label: 'Provider access',
                  icon: KeyRound,
                },
                {
                  href: '/fhir',
                  label: 'FHIR bridge',
                  icon: LinkIcon,
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-200"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-slate-800">
                    <item.icon className="h-4 w-4 text-brand-600" />
                    {item.label}
                  </span>
                  <ExternalLink className="h-4 w-4 text-slate-300 transition-colors group-hover:text-brand-500" />
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <MedicalCard>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <Languages className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900">Language and reading direction</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the interface language. The preference is stored on this device and
                    applied across the application.
                  </p>
                  <LocaleSwitcher className="mt-4 max-w-sm" />
                </div>
              </div>
            </MedicalCard>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Operational resources</h2>
            <p className="mt-1 text-sm text-slate-500">
              These endpoints expose the deployed service state without fabricated health or chain
              values.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {OPERATIONAL_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-200"
                >
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
                  </span>
                  <ExternalLink className="h-4 w-4 text-slate-300 transition-colors group-hover:text-brand-500" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
