/**
 * Shiora on Aethelred — Global Error Boundary (GAP-23)
 *
 * Rendered when the ROOT layout itself throws — the case app/error.tsx cannot
 * catch. It replaces the entire document, so it must provide its own <html>/
 * <body> and cannot rely on the layout's stylesheet being present: styling is
 * inline and dependency-free by design, not by oversight.
 */

'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Shiora Global Error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#faf8f7',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        }}
      >
        <main
          style={{
            maxWidth: '28rem',
            width: '100%',
            margin: '2rem',
            padding: '2rem',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '1rem',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#8B1538',
              fontWeight: 700,
            }}
          >
            Shiora
          </p>
          <h1 style={{ fontSize: '1.25rem', color: '#0f172a', margin: '0.75rem 0 0.5rem' }}>
            The application hit an unrecoverable error
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem' }}>
            Nothing you entered was lost server-side, and the failure has been logged.
            Reloading usually resolves it.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 1.5rem' }}>
              Error ID:{' '}
              <code
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  backgroundColor: '#f1f5f9',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                }}
              >
                {error.digest}
              </code>
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.625rem 1.5rem',
              backgroundColor: '#8B1538',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload application
          </button>
        </main>
      </body>
    </html>
  );
}
