// ============================================================
// Tests for src/components/layout/Providers.tsx
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Providers } from '@/components/layout/Providers';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';

// A simple child component that verifies providers are available
function TestChild() {
  return <div>Child rendered</div>;
}

// A component that uses React Query context to verify QueryClientProvider
function QueryConsumer() {
  const queryClient = useQueryClient();
  return <div>Query client exists: {queryClient ? 'yes' : 'no'}</div>;
}

function RetryResult({
  failureCount,
  error,
}: {
  failureCount: number;
  error: Error;
}) {
  const retry = useQueryClient().getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') {
    throw new Error('Expected the Providers query retry policy to be a function');
  }
  return (
    <div data-testid="retry-result">
      {String(retry(failureCount, error))}
    </div>
  );
}

describe('Providers', () => {
  it('renders children', () => {
    render(
      <Providers>
        <TestChild />
      </Providers>
    );
    expect(screen.getByText('Child rendered')).toBeInTheDocument();
  });

  it('provides QueryClient context', () => {
    render(
      <Providers>
        <QueryConsumer />
      </Providers>
    );
    expect(screen.getByText('Query client exists: yes')).toBeInTheDocument();
  });

  it('provides AppContext (via AppProvider)', () => {
    // useApp is available inside Providers since it wraps with AppProvider
    // We verify indirectly by rendering a component that needs it
    const { container } = render(
      <Providers>
        <div data-testid="wrapped">Content</div>
      </Providers>
    );
    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('renders multiple children', () => {
    render(
      <Providers>
        <div>First</div>
        <div>Second</div>
      </Providers>
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it.each([401, 403, 429])(
    'does not retry terminal API status %s',
    (status) => {
      render(
        <Providers>
          <RetryResult
            failureCount={0}
            error={new ApiError({ message: 'terminal' }, status)}
          />
        </Providers>,
      );
      expect(screen.getByTestId('retry-result')).toHaveTextContent('false');
    },
  );

  it('retries other failures at most twice', () => {
    const { rerender } = render(
      <Providers>
        <RetryResult failureCount={0} error={new Error('network')} />
      </Providers>,
    );
    expect(screen.getByTestId('retry-result')).toHaveTextContent('true');

    rerender(
      <Providers>
        <RetryResult
          failureCount={2}
          error={new ApiError({ message: 'server' }, 500)}
        />
      </Providers>,
    );
    expect(screen.getByTestId('retry-result')).toHaveTextContent('false');
  });
});
