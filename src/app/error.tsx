/**
 * Shiora on Aethelred — Error Boundary Page
 *
 * Enhanced error page with friendly messaging, stack trace in dev mode,
 * retry and navigation actions, and a report bug link.
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    console.error('[Shiora Error]', error);
  }, [error]);

  const copyErrorDetails = () => {
    const details = [
      `Error: ${error.message}`,
      error.digest ? `Digest: ${error.digest}` : '',
      error.stack ? `\nStack:\n${error.stack}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(details).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-red-500/5 blur-3xl" />
      </div>

      <div className="relative bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full text-center shadow-card-lg">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-6">
          An unexpected error occurred while loading this page. This has been logged for investigation.
        </p>

        {/* Error digest */}
        {error.digest && (
          <p className="text-xs text-slate-400 mb-4">
            Error ID: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{error.digest}</code>
          </p>
        )}

        {/* Dev mode: expandable stack trace */}
        {isDev && error?.message && (
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-500 hover:text-slate-700 transition-colors mb-2"
            >
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showDetails ? 'Hide' : 'Show'} Error Details
            </button>
            {showDetails && (
              <div className="relative">
                <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 text-left overflow-auto max-h-48 border border-red-100">
                  {error.message}
                  {error.stack && (
                    <>
                      {'\n\n'}
                      {error.stack}
                    </>
                  )}
                </pre>
                <button
                  onClick={copyErrorDetails}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 hover:bg-white border border-red-100 transition-colors"
                  title="Copy error details"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-red-400" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>

        {/* Report bug link */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <a
            href="https://github.com/aethelred/shiora/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Bug className="w-3.5 h-3.5" />
            Report this issue
          </a>
        </div>
      </div>
    </div>
  );
}
