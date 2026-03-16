/**
 * Shiora on Aethelred — 404 Not Found Page
 *
 * Enhanced 404 with Shiora branding, suggested links,
 * search bar, and return home button.
 */

import Link from 'next/link';
import { Home, Search, FolderLock, Brain, KeyRound, Settings, ArrowRight } from 'lucide-react';

const SUGGESTED_LINKS = [
  { href: '/', label: 'Dashboard', description: 'Health overview and metrics', icon: Home },
  { href: '/records', label: 'Health Records', description: 'Encrypted health data', icon: FolderLock },
  { href: '/insights', label: 'AI Insights', description: 'TEE-verified analysis', icon: Brain },
  { href: '/access', label: 'Access Control', description: 'Provider permissions', icon: KeyRound },
  { href: '/settings', label: 'Settings', description: 'Account preferences', icon: Settings },
];

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      <div className="relative text-center max-w-2xl w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" className="w-8 h-8">
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

        {/* 404 number */}
        <h1 className="text-8xl font-bold text-slate-200 mb-4 tracking-tight">404</h1>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Try searching or browse the links below.
        </p>

        {/* Search bar */}
        <div className="max-w-md mx-auto mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Shiora..."
              className="w-full pl-11 pr-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
              readOnly
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-2 py-0.5 text-xs text-slate-400 bg-slate-100 border border-slate-200 rounded">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Suggested links */}
        <div className="mb-10">
          <p className="text-sm font-medium text-slate-500 mb-4">Or try one of these pages</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-xl mx-auto">
            {SUGGESTED_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors">
                  <link.icon className="w-4 h-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 group-hover:text-brand-600 transition-colors">{link.label}</p>
                  <p className="text-xs text-slate-400">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Return Home */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Footer text */}
        <p className="mt-8 text-xs text-slate-400">
          Shiora on Aethelred
        </p>
      </div>
    </div>
  );
}
