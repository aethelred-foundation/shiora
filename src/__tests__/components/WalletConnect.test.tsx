// ============================================================
// Tests for src/components/modals/WalletConnect.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AppProvider } from '@/contexts/AppContext';
import { WalletConnect } from '@/components/modals/WalletConnect';

// Mock useWallet to control connected state
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockSignMessage = jest.fn();
let mockWalletLoading = false;
let mockWalletError: string | null = null;

jest.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    signMessage: mockSignMessage,
    isLoading: mockWalletLoading,
    error: mockWalletError,
  }),
}));

// Mock useApp - we need to control wallet.connected for connected state tests
const mockUseApp = jest.fn();
jest.mock('@/contexts/AppContext', () => {
  const originalModule = jest.requireActual('@/contexts/AppContext');
  return {
    ...originalModule,
    useApp: (...args: any[]) => mockUseApp(...args),
  };
});

const defaultDisconnectedApp = {
  wallet: { connected: false, address: '', balance: 0, aethelBalance: 0 },
  notifications: [],
  addNotification: jest.fn(),
  removeNotification: jest.fn(),
  searchOpen: false,
  setSearchOpen: jest.fn(),
  connectWalletWithData: jest.fn(),
  disconnectWallet: jest.fn(),
};

const defaultConnectedApp = {
  ...defaultDisconnectedApp,
  wallet: {
    connected: true,
    address: 'aeth1abcdef1234567890abcdef1234567890abcdef',
    balance: 1000,
    aethelBalance: 500.5,
  },
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
  mockDisconnect.mockReturnValue(undefined);
  mockSignMessage.mockResolvedValue({ signature: 'mocksig123abc' });
  mockWalletLoading = false;
  mockWalletError = null;
  mockUseApp.mockReturnValue(defaultDisconnectedApp);
});

describe('WalletConnect - disconnected state', () => {
  it('renders Connect Wallet button when disconnected', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('opens connect modal when button is clicked', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(
      screen.getByText('Choose your preferred wallet to connect to Shiora'),
    ).toBeInTheDocument();
  });

  it('shows wallet options in connect modal', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(screen.getByText('Aethelred Wallet')).toBeInTheDocument();
    expect(screen.getByText('Aethelred Wallet')).toBeInTheDocument();
  });

  it('pins the connect modal to the public testnet', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(screen.getByText('Aethelred Public Testnet')).toBeInTheDocument();
    expect(screen.queryByText('Mainnet')).not.toBeInTheDocument();
  });

  it('renders wallet descriptions', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    const descriptions = screen.getAllByText('The one wallet for the Aethelred ecosystem');
    expect(descriptions.length).toBe(1);
  });

  it('closes connect modal when onClose is triggered', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(screen.getByText('Aethelred Wallet')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByText('Choose your preferred wallet to connect to Shiora'),
    ).not.toBeInTheDocument();
  });

  it('attempts to connect when the Aethelred Wallet is clicked', async () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    fireEvent.click(screen.getByText('Aethelred Wallet'));
    expect(mockConnect).toHaveBeenCalledWith('aethelred', 'testnet');
  });

  it('offers MetaMask as a second wallet option and connects with it', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(screen.getByText('MetaMask')).toBeInTheDocument();
    expect(screen.getByText('Connect with the MetaMask browser extension')).toBeInTheDocument();

    fireEvent.click(screen.getByText('MetaMask'));
    expect(mockConnect).toHaveBeenCalledWith('metamask', 'testnet');
  });

  it('marks the Aethelred Wallet as the recommended option', () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('invokes connect with the selected network', async () => {
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    fireEvent.click(screen.getByText('Aethelred Wallet'));
    expect(mockConnect).toHaveBeenCalledWith('aethelred', 'testnet');
  });

  // ─── handleConnect error (line 113, 115) ───

  it('shows connection error when connect fails', async () => {
    mockConnect.mockRejectedValue(new Error('Connection rejected'));
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    await act(async () => {
      fireEvent.click(screen.getByText('Aethelred Wallet'));
    });
    await waitFor(() => {
      expect(screen.getByText('Connection rejected')).toBeInTheDocument();
    });
  });

  it('shows generic error when connect fails with non-Error', async () => {
    mockConnect.mockRejectedValue('Unknown error');
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    await act(async () => {
      fireEvent.click(screen.getByText('Aethelred Wallet'));
    });
    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  // ─── walletError display (line 113 area) ───

  it('shows walletError when present', () => {
    mockWalletError = 'Wallet extension not found';
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(screen.getByText('Wallet extension not found')).toBeInTheDocument();
  });

  // ─── Modal closes after successful connection (line 113) ───

  it('closes modal after successful connection', async () => {
    mockConnect.mockResolvedValue(undefined);
    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));
    await act(async () => {
      fireEvent.click(screen.getByText('Aethelred Wallet'));
    });
    // Modal should close after connect succeeds
    await waitFor(() => {
      expect(
        screen.queryByText('Choose your preferred wallet to connect to Shiora'),
      ).not.toBeInTheDocument();
    });
  });
});

// ─── Connected state (lines 262-346) ───
// We mock useApp to return a connected wallet state

describe('WalletConnect - connected state', () => {
  beforeEach(() => {
    mockUseApp.mockReturnValue(defaultConnectedApp);
  });

  it('shows wallet address when connected', () => {
    render(<WalletConnect />);
    expect(screen.queryByText('Connect Wallet')).not.toBeInTheDocument();
  });

  it('shows sign message button in dropdown', () => {
    render(<WalletConnect />);
    expect(screen.getByText('Sign Message')).toBeInTheDocument();
  });

  it('shows disconnect button in dropdown', () => {
    render(<WalletConnect />);
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('calls disconnect when Disconnect is clicked', () => {
    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Disconnect'));
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('opens sign message modal', () => {
    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Sign Message'));
    expect(
      screen.getByText('Sign a message with your wallet to prove ownership'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter message to sign...')).toBeInTheDocument();
  });

  it('signs a message successfully', async () => {
    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Sign Message'));

    const textarea = screen.getByPlaceholderText('Enter message to sign...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    const signButtons = screen.getAllByText('Sign Message');
    fireEvent.click(signButtons[signButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('mocksig123abc')).toBeInTheDocument();
    });
  });

  it('shows signing error on failure', async () => {
    mockSignMessage.mockRejectedValueOnce(new Error('Sign failed'));
    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Sign Message'));

    const textarea = screen.getByPlaceholderText('Enter message to sign...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    const signButtons = screen.getAllByText('Sign Message');
    fireEvent.click(signButtons[signButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/Signing failed/)).toBeInTheDocument();
    });
  });

  it('does not sign when message is empty', () => {
    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Sign Message'));

    const signButtons = screen.getAllByText('Sign Message');
    const signBtn = signButtons[signButtons.length - 1].closest('button');
    expect(signBtn).toBeDisabled();
  });

  it('shows network indicator', () => {
    render(<WalletConnect />);
    expect(screen.getByText('Public Testnet')).toBeInTheDocument();
  });

  it('shows $AETHEL balance', () => {
    render(<WalletConnect />);
    expect(screen.getByText('$AETHEL')).toBeInTheDocument();
    expect(screen.getByText('501')).toBeInTheDocument(); // formatNumber(500.5), no dash
  });

  it('shows an em-dash when the balance is unknown, never an invented number (audit L-01)', () => {
    mockUseApp.mockReturnValue({
      ...defaultConnectedApp,
      wallet: { ...defaultConnectedApp.wallet, aethelBalance: null },
    });
    render(<WalletConnect />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('closes sign modal and clears state', () => {
    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Sign Message'));
    expect(screen.getByPlaceholderText('Enter message to sign...')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Enter message to sign...')).not.toBeInTheDocument();
  });

  it('shows Signing... state while signing', async () => {
    // Make signMessage hang so we can capture the signing state
    let resolveSign!: (value: { signature: string }) => void;
    mockSignMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveSign = resolve;
      }),
    );

    render(<WalletConnect />);
    fireEvent.click(screen.getByText('Sign Message'));

    const textarea = screen.getByPlaceholderText('Enter message to sign...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    const signButtons = screen.getAllByText('Sign Message');
    await act(async () => {
      fireEvent.click(signButtons[signButtons.length - 1]);
    });

    expect(screen.getByText('Signing...')).toBeInTheDocument();

    // Resolve to clean up
    await act(async () => {
      resolveSign({ signature: 'sig123' });
    });
  });
});

// ---------------------------------------------------------------------------
// WalletConnect — loading state branch coverage
// ---------------------------------------------------------------------------

describe('WalletConnect — loading state', () => {
  it('shows loading spinner on the selected wallet option', () => {
    mockWalletLoading = true;
    mockUseApp.mockReturnValue(defaultDisconnectedApp);

    render(
      <TestWrapper>
        <WalletConnect />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Connect Wallet'));

    // Wallet options should be visible and disabled
    const walletButton = screen.getByText('Aethelred Wallet').closest('button');
    expect(walletButton).toBeDisabled();
  });
});
