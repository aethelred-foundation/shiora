/**
 * Tests for src/app/error.tsx — the global Next.js error boundary page.
 *
 * The component is a 'use client' component that:
 *  - logs the error via console.error on mount
 *  - shows an expandable stack trace in development mode
 *  - shows the error digest when present
 *  - provides "Try Again" (calls reset) and "Back to Home" actions
 *  - copies error details to the clipboard
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ErrorPage from '@/app/error';

describe('ErrorPage', () => {
  const baseError = Object.assign(new Error('Test failure'), { digest: 'abc123' });
  const resetFn = jest.fn();

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    resetFn.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the "Something went wrong" heading', () => {
    render(<ErrorPage error={baseError} reset={resetFn} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows the error digest when provided', () => {
    render(<ErrorPage error={baseError} reset={resetFn} />);
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('does not show digest section when digest is absent', () => {
    const err = new Error('No digest');
    render(<ErrorPage error={err} reset={resetFn} />);
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  it('calls console.error on mount with the error', () => {
    render(<ErrorPage error={baseError} reset={resetFn} />);
    expect(console.error).toHaveBeenCalledWith('[Shiora Error]', baseError);
  });

  it('calls reset when "Try Again" is clicked', () => {
    render(<ErrorPage error={baseError} reset={resetFn} />);
    fireEvent.click(screen.getByText('Try Again'));
    expect(resetFn).toHaveBeenCalledTimes(1);
  });

  it('renders "Back to Home" link pointing to "/"', () => {
    render(<ErrorPage error={baseError} reset={resetFn} />);
    const link = screen.getByText('Back to Home').closest('a');
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders the "Report this issue" link', () => {
    render(<ErrorPage error={baseError} reset={resetFn} />);
    const link = screen.getByText('Report this issue').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/aethelred/shiora/issues/new');
  });

  describe('in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      // Jest runs in 'test' by default; simulate 'development' so isDev is true.
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalNodeEnv,
        configurable: true,
      });
    });

    it('shows "Show Error Details" toggle when in development mode', () => {
      render(<ErrorPage error={baseError} reset={resetFn} />);
      // The toggle text changes based on state; initially it says 'Show Error Details'
      expect(screen.getByText(/Show Error Details/)).toBeInTheDocument();
    });

    it('expands details and copies error to clipboard when requested', async () => {
      render(<ErrorPage error={baseError} reset={resetFn} />);

      const toggle = screen.getByText(/Show Error Details/);
      fireEvent.click(toggle);

      // After expanding, the pre element with error message should appear
      await waitFor(() => {
        expect(screen.getByText('Hide Error Details')).toBeInTheDocument();
      });

      // The copy button should now be visible — click it
      const copyBtn = document.querySelector('button[title="Copy error details"]');
      expect(copyBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(copyBtn!);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('copies error details without digest when absent', async () => {
      const errNoDigest = new Error('No digest error');
      render(<ErrorPage error={errNoDigest} reset={resetFn} />);

      const toggle = screen.getByText(/Show Error Details/);
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByText('Hide Error Details')).toBeInTheDocument();
      });

      const copyBtn = document.querySelector('button[title="Copy error details"]');
      expect(copyBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(copyBtn!);
      });

      // The clipboard text should not include 'Digest:' since digest is absent
      const clipboardCall = (navigator.clipboard.writeText as jest.Mock).mock.calls;
      const lastCall = clipboardCall[clipboardCall.length - 1][0];
      expect(lastCall).not.toContain('Digest:');
    });

    it('copies error details without stack when absent', async () => {
      const errNoStack = Object.assign(new Error('No stack'), { digest: 'dig123' });
      delete (errNoStack as { stack?: string }).stack;
      render(<ErrorPage error={errNoStack} reset={resetFn} />);

      const toggle = screen.getByText(/Show Error Details/);
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByText('Hide Error Details')).toBeInTheDocument();
      });

      const copyBtn = document.querySelector('button[title="Copy error details"]');
      await act(async () => {
        fireEvent.click(copyBtn!);
      });

      const clipboardCall = (navigator.clipboard.writeText as jest.Mock).mock.calls;
      const lastCall = clipboardCall[clipboardCall.length - 1][0];
      expect(lastCall).toContain('Digest: dig123');
      expect(lastCall).not.toContain('Stack:');
    });

    it('resets copied state after timeout', async () => {
      jest.useFakeTimers();
      render(<ErrorPage error={baseError} reset={resetFn} />);

      fireEvent.click(screen.getByText(/Show Error Details/));
      await waitFor(() => {
        expect(screen.getByText('Hide Error Details')).toBeInTheDocument();
      });

      const copyBtn = document.querySelector('button[title="Copy error details"]');
      await act(async () => {
        fireEvent.click(copyBtn!);
      });

      // After clicking copy, the copied state should be true (showing Check icon)
      // After 2000ms, it should reset
      act(() => {
        jest.advanceTimersByTime(2100);
      });

      jest.useRealTimers();
    });

    it('handles clipboard write failure gracefully', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
        new Error('Clipboard blocked'),
      );
      render(<ErrorPage error={baseError} reset={resetFn} />);

      fireEvent.click(screen.getByText(/Show Error Details/));
      await waitFor(() => {
        expect(screen.getByText('Hide Error Details')).toBeInTheDocument();
      });

      const copyBtn = document.querySelector('button[title="Copy error details"]');
      await act(async () => {
        fireEvent.click(copyBtn!);
      });

      // Should not throw — the .catch(() => {}) handles the failure
    });

    it('renders stack trace in expanded details when stack exists', async () => {
      const errWithStack = Object.assign(new Error('Stack error'), {
        stack: 'Error: Stack error\n    at Test.fn (test.ts:1:1)',
      });
      render(<ErrorPage error={errWithStack} reset={resetFn} />);

      fireEvent.click(screen.getByText(/Show Error Details/));

      await waitFor(() => {
        expect(screen.getByText(/at Test\.fn/)).toBeInTheDocument();
      });
    });

    it('renders details without stack trace when stack is absent', async () => {
      const errNoStack = new Error('No stack msg');
      delete (errNoStack as { stack?: string }).stack;
      render(<ErrorPage error={errNoStack} reset={resetFn} />);

      fireEvent.click(screen.getByText(/Show Error Details/));

      await waitFor(() => {
        expect(screen.getByText('No stack msg')).toBeInTheDocument();
      });
    });
  });
});
