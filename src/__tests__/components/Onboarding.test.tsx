// ============================================================
// Tests for src/components/layout/Onboarding.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import { Onboarding, useOnboardingComplete } from '@/components/layout/Onboarding';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
  (localStorage.getItem as jest.Mock).mockClear();
  (localStorage.setItem as jest.Mock).mockClear();
});

describe('Onboarding', () => {
  it('renders the welcome step initially', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Welcome to Shiora')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('renders feature highlights on welcome step', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('End-to-End Encryption')).toBeInTheDocument();
    expect(screen.getByText('TEE Verified')).toBeInTheDocument();
    expect(screen.getByText('You Own Your Data')).toBeInTheDocument();
  });

  it('navigates to step 2 when Next is clicked', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
  });

  it('shows Back button from step 2 onward', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    // Step 1: no Back button
    expect(screen.queryByText('Back')).not.toBeInTheDocument();

    // Go to step 2
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('navigates back when Back is clicked', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Welcome to Shiora')).toBeInTheDocument();
  });

  it('shows Skip button on non-final steps', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('calls onComplete when Skip is clicked', () => {
    const onComplete = jest.fn();
    render(
      <TestWrapper>
        <Onboarding onComplete={onComplete} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Skip'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('navigates through all steps', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    // Step 1: Welcome
    expect(screen.getByText('Welcome to Shiora')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next'));
    // Step 2: Connect Wallet
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next'));
    // Step 3: Encryption Keys
    expect(screen.getByText('Set Up Encryption Keys')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next'));
    // Step 4: TEE Preference
    expect(screen.getByText('Choose TEE Enclave')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next'));
    // Step 5: Import Records
    expect(screen.getByText('Import Health Records')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next'));
    // Step 6: Complete
    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
  });

  it('shows Go to Dashboard on the final step', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    // Navigate to step 6
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('calls onComplete when Go to Dashboard is clicked', () => {
    const onComplete = jest.fn();
    render(
      <TestWrapper>
        <Onboarding onComplete={onComplete} />
      </TestWrapper>
    );
    // Navigate to step 6
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    fireEvent.click(screen.getByText('Go to Dashboard'));
    expect(onComplete).toHaveBeenCalled();
  });

  it('calls onComplete immediately if already completed in localStorage', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('true');
    const onComplete = jest.fn();
    render(
      <TestWrapper>
        <Onboarding onComplete={onComplete} />
      </TestWrapper>
    );
    expect(onComplete).toHaveBeenCalled();
  });

  it('renders wallet provider options on step 2', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Keplr Wallet')).toBeInTheDocument();
    expect(screen.getByText('Leap Wallet')).toBeInTheDocument();
  });

  it('clicks Keplr Wallet button on step 2', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Keplr Wallet'));
    // Should not crash; the .catch handler is triggered
  });

  it('clicks Leap Wallet button on step 2', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Leap Wallet'));
  });

  it('generates encryption keys on step 3', async () => {
    jest.useFakeTimers();
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    // Navigate to step 3
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Set Up Encryption Keys')).toBeInTheDocument();

    // Click generate keys
    fireEvent.click(screen.getByText('Generate Encryption Keys'));
    expect(screen.getByText('Generating Keys...')).toBeInTheDocument();

    // Advance timers
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(screen.getByText('Encryption Keys Generated')).toBeInTheDocument();
    expect(screen.getByText('AES-256-GCM')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('selects different TEE platform on step 4', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    // Navigate to step 4
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    expect(screen.getByText('Choose TEE Enclave')).toBeInTheDocument();

    // Click AWS Nitro
    fireEvent.click(screen.getByText('AWS Nitro'));
    expect(screen.getByText(/Cloud-native enclaves/)).toBeInTheDocument();

    // Click AMD SEV
    fireEvent.click(screen.getByText('AMD SEV'));
    expect(screen.getByText(/Secure Encrypted Virtualization/)).toBeInTheDocument();
  });

  it('simulates import on step 5', async () => {
    jest.useFakeTimers();
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    // Navigate to step 5
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    expect(screen.getByText('Import Health Records')).toBeInTheDocument();

    // Click import
    fireEvent.click(screen.getByText('Select Files to Import'));
    expect(screen.getByText('Scanning Records...')).toBeInTheDocument();

    // Advance timers
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(screen.getByText('Records Ready for Import')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('sets localStorage when completing final step', () => {
    const onComplete = jest.fn();
    render(
      <TestWrapper>
        <Onboarding onComplete={onComplete} />
      </TestWrapper>
    );
    // Navigate to step 6
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    // Click Go to Dashboard
    fireEvent.click(screen.getByText('Go to Dashboard'));
    expect(localStorage.setItem).toHaveBeenCalledWith('shiora_onboarding_complete', 'true');
    expect(onComplete).toHaveBeenCalled();
  });

  it('does not show Skip button on final step', () => {
    render(
      <TestWrapper>
        <Onboarding onComplete={jest.fn()} />
      </TestWrapper>
    );
    // Navigate to step 6
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText('Next'));
    }
    expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// useOnboardingComplete hook
// ---------------------------------------------------------------------------
describe('useOnboardingComplete', () => {
  function HookConsumer() {
    const complete = useOnboardingComplete();
    return <div>Complete: {complete ? 'yes' : 'no'}</div>;
  }

  it('returns true by default (avoids flash)', () => {
    render(<HookConsumer />);
    // Initially true, then updates based on localStorage
    expect(screen.getByText(/Complete:/)).toBeInTheDocument();
  });

  it('returns false when localStorage has no completion flag', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
    render(<HookConsumer />);
    expect(screen.getByText('Complete: no')).toBeInTheDocument();
  });

  it('returns true when localStorage has completion flag', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('true');
    render(<HookConsumer />);
    expect(screen.getByText('Complete: yes')).toBeInTheDocument();
  });

  it('returns true when localStorage throws', () => {
    (localStorage.getItem as jest.Mock).mockImplementation(() => {
      throw new Error('storage error');
    });
    render(<HookConsumer />);
    expect(screen.getByText('Complete: yes')).toBeInTheDocument();
  });
});
