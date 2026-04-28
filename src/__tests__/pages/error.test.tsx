// ============================================================
// Tests for src/app/error.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import ErrorPage from '@/app/error';

const mockReset = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ErrorPage', () => {
  const baseError = Object.assign(new Error('Test error message'), {
    stack: 'Error: Test error\n    at Object.<anonymous> (test.tsx:1:1)',
  });

  it('renders the error page with heading', () => {
    render(<ErrorPage error={baseError} reset={mockReset} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders the error description', () => {
    render(<ErrorPage error={baseError} reset={mockReset} />);
    expect(
      screen.getByText(/An unexpected error occurred while loading this page/),
    ).toBeInTheDocument();
  });

  it('renders Try Again button and calls reset on click', () => {
    render(<ErrorPage error={baseError} reset={mockReset} />);
    const tryAgainBtn = screen.getByText('Try Again');
    fireEvent.click(tryAgainBtn);
    expect(mockReset).toHaveBeenCalled();
  });

  it('renders Back to Home link', () => {
    render(<ErrorPage error={baseError} reset={mockReset} />);
    expect(screen.getByText('Back to Home')).toBeInTheDocument();
  });

  it('renders Report this issue link', () => {
    render(<ErrorPage error={baseError} reset={mockReset} />);
    expect(screen.getByText('Report this issue')).toBeInTheDocument();
  });

  it('renders error digest when present', () => {
    const errorWithDigest = Object.assign(new Error('Test error'), {
      digest: 'abc123',
    });
    render(<ErrorPage error={errorWithDigest} reset={mockReset} />);
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('does not render error digest when absent', () => {
    render(<ErrorPage error={baseError} reset={mockReset} />);
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  // In dev mode (NODE_ENV=test which Jest sets), isDev is false.
  // We need to test the dev mode behavior.
  // Since process.env.NODE_ENV is 'test' in Jest, isDev check (=== 'development') is false.
  // Let me check if the error details toggle is shown.

  it('shows Show Error Details button in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    render(<ErrorPage error={baseError} reset={mockReset} />);
    expect(screen.getByText('Show Error Details')).toBeInTheDocument();
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('toggles error details visibility', () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    render(<ErrorPage error={baseError} reset={mockReset} />);

    // Click to show details
    fireEvent.click(screen.getByText('Show Error Details'));
    expect(screen.getByText('Hide Error Details')).toBeInTheDocument();
    expect(screen.getByText(/Test error message/)).toBeInTheDocument();

    // Click to hide details
    fireEvent.click(screen.getByText('Hide Error Details'));
    expect(screen.getByText('Show Error Details')).toBeInTheDocument();

    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('copies error details to clipboard', () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    render(<ErrorPage error={baseError} reset={mockReset} />);

    // Show details first
    fireEvent.click(screen.getByText('Show Error Details'));

    // Click copy button
    const copyBtn = screen.getByTitle('Copy error details');
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();

    // After timeout, copied state resets
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('renders error without stack trace', () => {
    const errorNoStack = Object.assign(new Error('No stack'), {
      stack: undefined,
    });
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    render(<ErrorPage error={errorNoStack as any} reset={mockReset} />);
    fireEvent.click(screen.getByText('Show Error Details'));
    expect(screen.getByText('No stack')).toBeInTheDocument();
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('renders error with digest in copy', () => {
    const errorWithDigest = Object.assign(new Error('Test error'), {
      digest: 'digest123',
      stack: 'at test:1',
    });
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    render(<ErrorPage error={errorWithDigest} reset={mockReset} />);
    fireEvent.click(screen.getByText('Show Error Details'));
    const copyBtn = screen.getByTitle('Copy error details');
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Digest: digest123'),
    );
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('copies error details without digest', () => {
    const errorNoDigest = Object.assign(new Error('No digest error'), {
      stack: 'at test:1',
    });
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    render(<ErrorPage error={errorNoDigest as any} reset={mockReset} />);
    fireEvent.click(screen.getByText('Show Error Details'));
    const copyBtn = screen.getByTitle('Copy error details');
    fireEvent.click(copyBtn);
    // Should not include "Digest:" in the copied text
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.not.stringContaining('Digest:'),
    );
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('copies error without stack trace', () => {
    const errorNoStack = new Error('Simple error');
    errorNoStack.stack = undefined;
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    render(<ErrorPage error={errorNoStack as any} reset={mockReset} />);
    fireEvent.click(screen.getByText('Show Error Details'));
    const copyBtn = screen.getByTitle('Copy error details');
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.not.stringContaining('Stack:'),
    );
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('handles clipboard writeText failure gracefully', async () => {
    const originalEnv = process.env.NODE_ENV;
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    // Make clipboard.writeText reject
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('Clipboard denied'),
    );
    render(<ErrorPage error={baseError} reset={mockReset} />);
    fireEvent.click(screen.getByText('Show Error Details'));
    const copyBtn = screen.getByTitle('Copy error details');
    fireEvent.click(copyBtn);
    // Should not throw
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });

  it('logs error to console on mount', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    render(<ErrorPage error={baseError} reset={mockReset} />);
    expect(consoleSpy).toHaveBeenCalledWith('[Shiora Error]', baseError);
    consoleSpy.mockRestore();
  });
});
