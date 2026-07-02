/**
 * Tests for src/app/global-error.tsx — the root-layout error boundary (GAP-23).
 *
 * Rendered when the root layout itself throws: it replaces the whole document
 * (own <html>/<body>, inline styles only — the layout stylesheet may be gone),
 * logs the error, shows the digest, and offers a reset action.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalError from '@/app/global-error';

describe('GlobalError', () => {
  const baseError = Object.assign(new Error('Root layout exploded'), { digest: 'dg-777' });
  const resetFn = jest.fn();
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Silence both the component's own log and React's DOM-nesting warning
    // (rendering <html> inside the jsdom test container is expected here).
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    resetFn.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the branded unrecoverable-error message', () => {
    render(<GlobalError error={baseError} reset={resetFn} />);
    expect(screen.getByText('Shiora')).toBeInTheDocument();
    expect(screen.getByText('The application hit an unrecoverable error')).toBeInTheDocument();
    expect(screen.getByText(/Reloading usually resolves it/)).toBeInTheDocument();
  });

  it('logs the error on mount', () => {
    render(<GlobalError error={baseError} reset={resetFn} />);
    expect(errorSpy).toHaveBeenCalledWith('[Shiora Global Error]', baseError);
  });

  it('shows the error digest when present', () => {
    render(<GlobalError error={baseError} reset={resetFn} />);
    expect(screen.getByText('dg-777')).toBeInTheDocument();
  });

  it('omits the digest row when absent', () => {
    render(<GlobalError error={new Error('no digest')} reset={resetFn} />);
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  it('calls reset when "Reload application" is clicked', () => {
    render(<GlobalError error={baseError} reset={resetFn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reload application' }));
    expect(resetFn).toHaveBeenCalledTimes(1);
  });
});
