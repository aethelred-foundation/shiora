// ============================================================
// Tests for src/components/ui/ErrorBoundary.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Component that throws on render
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Normal content</div>;
}

// Suppress console.error for expected errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Test error message') ||
        args[0].includes('[Shiora ErrorBoundary]') ||
        args[0].includes('The above error'))
    ) {
      return;
    }
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
  });

  it('shows error message in development mode', () => {
    const env = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Test error message')).toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', { value: env, writable: true });
  });

  it('renders Try Again button that resets the error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    const tryAgainButton = screen.getByText('Try Again');
    expect(tryAgainButton).toBeInTheDocument();

    // Clicking Try Again resets the error, but since ThrowingComponent
    // still throws, it will immediately show the error again
    fireEvent.click(tryAgainButton);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error fallback</div>}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
