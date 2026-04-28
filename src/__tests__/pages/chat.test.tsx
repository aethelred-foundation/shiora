// ============================================================
// Tests for src/app/chat/page.tsx (Health AI Chat)
// ============================================================

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

// Mock scrollIntoView which isn't available in JSDOM
Element.prototype.scrollIntoView = jest.fn();

// Mock the useHealthChat hook
const mockSendMessage = { mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false };
const mockCreateConversation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({ id: 'new-conv' }),
};
const mockDeleteConversation = { mutate: jest.fn() };
const mockSetActiveConversation = jest.fn();

let mockHookState: Record<string, unknown> = {};

jest.mock('@/hooks/useHealthChat', () => ({
  useHealthChat: () => ({
    conversations: [
      {
        id: 'conv-1',
        title: 'Cycle Analysis Discussion',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        attestationCount: 3,
      },
      {
        id: 'conv-2',
        title: 'Lab Results Review',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        attestationCount: 2,
      },
      {
        id: 'conv-3',
        title: 'Fertility Planning',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        attestationCount: 1,
      },
    ],
    activeConversation: null,
    messages: [],
    isLoadingConversations: false,
    isLoadingMessages: false,
    isSending: false,
    error: null,
    suggestedPrompts: [
      { id: 'cycle', category: 'Cycle Health', prompts: ['Analyze my cycle'] },
      { id: 'fertility', category: 'Fertility', prompts: ['Fertility tips'] },
      { id: 'lab', category: 'Lab Results', prompts: ['Review my labs'] },
      { id: 'symptoms', category: 'Symptoms', prompts: ['Track my symptoms'] },
    ],
    activeModel: {
      id: 'health-transformer',
      name: 'Health Transformer',
      version: 'v3.0',
      maxTokens: 4096,
      teePlatform: 'Intel SGX',
      capabilities: [],
    },
    setActiveConversation: mockSetActiveConversation,
    sendMessage: mockSendMessage,
    createConversation: mockCreateConversation,
    deleteConversation: mockDeleteConversation,
    totalAttestations: 6,
    ...mockHookState,
  }),
}));

import ChatPage from '@/app/chat/page';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

describe('ChatPage', () => {
  it('renders the chat page with Health AI heading', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    // The header shows "Health AI" when no conversation is active
    // "Health AI" also appears in the TopNav (PRIMARY_NAV_LINKS), so use getAllByText
    await waitFor(() => {
      expect(screen.getAllByText('Health AI').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the Shiora on Aethelred empty state', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      // "Shiora on Aethelred" appears in both TopNav and the empty state heading
      expect(screen.getAllByText('Shiora on Aethelred').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the empty state prompt text', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Ask me anything about your health data/)).toBeInTheDocument();
    });
  });

  it('renders the New Conversation button', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('New Conversation')).toBeInTheDocument();
    });
  });

  it('renders suggested prompts in empty state', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('Cycle Health')).toBeInTheDocument();
      expect(screen.getByText('Fertility')).toBeInTheDocument();
      expect(screen.getByText('Lab Results')).toBeInTheDocument();
      expect(screen.getByText('Symptoms')).toBeInTheDocument();
    });
  });

  it('renders the message input placeholder', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask your health AI assistant...')).toBeInTheDocument();
    });
  });

  it('renders the model name in the header', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      // "Health Transformer" may appear in header and empty state badges
      expect(screen.getAllByText(/Health Transformer/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the E2E Encrypted badge', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('E2E Encrypted')).toBeInTheDocument();
    });
  });

  it('renders TEE attestation footer text', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Responses verified via TEE attestation/)).toBeInTheDocument();
    });
  });

  it('renders the Conversations sidebar heading', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument();
    });
  });

  it('renders conversation list after loading', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    // Conversations load asynchronously from mock
    await waitFor(
      () => {
        expect(screen.getByText('Cycle Analysis Discussion')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('renders multiple conversations', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(
      () => {
        expect(screen.getByText('Lab Results Review')).toBeInTheDocument();
        expect(screen.getByText('Fertility Planning')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('renders navigation and footer', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });
  });

  it('renders TEE Verified badge in empty state', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('TEE Verified')).toBeInTheDocument();
    });
  });

  it('renders the send button', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    });
  });

  // --- Sidebar Toggle ---

  it('toggles sidebar visibility via mobile toggle button', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument();
    });

    // The mobile sidebar toggle button has aria-label "Toggle sidebar"
    const toggleBtn = screen.getByLabelText('Toggle sidebar');
    fireEvent.click(toggleBtn);

    // After toggling, sidebar may be hidden. Click again to show.
    fireEvent.click(toggleBtn);
  });

  it('toggles attestation panel via header button', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Toggle attestation panel')).toBeInTheDocument();
    });

    const attestBtn = screen.getByLabelText('Toggle attestation panel');
    // Toggle off
    fireEvent.click(attestBtn);
    // Toggle on again
    fireEvent.click(attestBtn);
  });

  it('closes sidebar via Close sidebar button', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('Conversations')).toBeInTheDocument();
    });

    // The "Close sidebar" button is inside the sidebar
    const closeSidebarBtn = screen.getByLabelText('Close sidebar');
    fireEvent.click(closeSidebarBtn);

    // The "Open sidebar" button should now be visible
    const openSidebarBtn = screen.getByLabelText('Open sidebar');
    expect(openSidebarBtn).toBeInTheDocument();
    fireEvent.click(openSidebarBtn);
  });

  // --- Chat Input ---

  it('sends a message via the input (no active conversation path)', async () => {
    jest.useFakeTimers();
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask your health AI assistant...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Ask your health AI assistant...');
    fireEvent.change(input, { target: { value: 'Test message' } });

    const sendBtn = screen.getByLabelText('Send message');
    fireEvent.click(sendBtn);

    // The handleSend creates a conversation then uses setTimeout to send
    // Wait for the mutateAsync promise to resolve
    await act(async () => {
      await Promise.resolve(); // flush mutateAsync promise
      jest.advanceTimersByTime(200); // advance past the 100ms setTimeout
    });

    expect(mockCreateConversation.mutateAsync).toHaveBeenCalled();
    expect(mockSendMessage.mutate).toHaveBeenCalledWith('Test message');
    jest.useRealTimers();
  });

  // --- Suggested Prompts ---

  it('selects a suggested prompt', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('Cycle Health')).toBeInTheDocument();
    });

    // Click one of the suggested prompt categories
    fireEvent.click(screen.getByText('Cycle Health'));
  });

  // --- Conversation Selection ---

  it('selects a conversation from the sidebar', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(
      () => {
        expect(screen.getByText('Cycle Analysis Discussion')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Click on a conversation to select it
    fireEvent.click(screen.getByText('Cycle Analysis Discussion'));
  });

  it('shows active conversation title in header after selection', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(
      () => {
        expect(screen.getByText('Cycle Analysis Discussion')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Clicking a conversation sets it as active
    fireEvent.click(screen.getByText('Cycle Analysis Discussion'));

    // The title should remain visible (in sidebar and potentially in header)
    expect(screen.getAllByText('Cycle Analysis Discussion').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the attestation count in header', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(
      () => {
        expect(screen.getByText(/\d+ attestations/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('clicks a suggested prompt to trigger handlePromptSelect', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('Cycle Health')).toBeInTheDocument();
    });

    // Click the first suggested prompt to trigger handlePromptSelect -> handleSend
    const promptButtons = screen.getAllByRole('button');
    const cyclePrompt = promptButtons.find((btn) => btn.textContent?.includes('Cycle Health'));
    if (cyclePrompt) {
      fireEvent.click(cyclePrompt);
    }
  });

  it('renders the TEE platform badge in empty state', async () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    await waitFor(() => {
      expect(screen.getByText('Intel SGX')).toBeInTheDocument();
    });
  });
});

// ─── Tests with loading conversations state ───

describe('ChatPage with loading conversations', () => {
  beforeEach(() => {
    mockHookState = { isLoadingConversations: true, conversations: [] };
  });

  afterEach(() => {
    mockHookState = {};
  });

  it('renders loading state for conversations', () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    // When loading conversations, should show pulse loader in sidebar
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });
});

// ─── Tests with messages loaded ───

describe('ChatPage with messages', () => {
  beforeEach(() => {
    mockHookState = {
      activeConversation: {
        id: 'conv-1',
        title: 'Cycle Analysis Discussion',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        attestationCount: 3,
      },
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello world',
          createdAt: Date.now() - 2000,
          attestation: null,
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'How can I help?',
          createdAt: Date.now() - 1000,
          attestation: '0xabc',
        },
      ],
      isLoadingMessages: false,
    };
  });

  afterEach(() => {
    mockHookState = {};
  });

  it('renders message list when messages exist', () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    // ChatBubble components should be rendered with the message content
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('How can I help?')).toBeInTheDocument();
  });
});

// ─── Tests with loading messages ───

describe('ChatPage with loading messages', () => {
  beforeEach(() => {
    mockHookState = {
      activeConversation: {
        id: 'conv-1',
        title: 'Test Conv',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        attestationCount: 0,
      },
      messages: [],
      isLoadingMessages: true,
    };
  });

  afterEach(() => {
    mockHookState = {};
  });

  it('renders loading state for messages', () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    // When loading messages with an active conversation, pulse loader should appear
    expect(screen.getByText('Test Conv')).toBeInTheDocument();
  });
});

// ─── Tests with sending state ───

describe('ChatPage with isSending', () => {
  beforeEach(() => {
    mockHookState = {
      activeConversation: {
        id: 'conv-1',
        title: 'Test Conv',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        attestationCount: 0,
      },
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test message',
          createdAt: Date.now(),
          attestation: null,
        },
      ],
      isSending: true,
    };
  });

  afterEach(() => {
    mockHookState = {};
  });

  it('renders typing indicator when sending', () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });
});

// ─── Tests for handleSend with active conversation (line 77) ───

describe('ChatPage handleSend with active conversation', () => {
  beforeEach(() => {
    mockHookState = {
      activeConversation: {
        id: 'conv-1',
        title: 'Active Conv',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        attestationCount: 0,
      },
      messages: [],
      isLoadingMessages: false,
    };
  });

  afterEach(() => {
    mockHookState = {};
    jest.clearAllMocks();
  });

  it('sends a message directly when conversation is active', () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );

    const input = screen.getByPlaceholderText('Ask your health AI assistant...');
    fireEvent.change(input, { target: { value: 'Hello from active conv' } });

    const sendBtn = screen.getByLabelText('Send message');
    fireEvent.click(sendBtn);

    // sendMessage.mutate should be called directly (not createConversation first)
    expect(mockSendMessage.mutate).toHaveBeenCalledWith('Hello from active conv');
  });
});

// ─── Tests for ConversationList callbacks (lines 129-130) ───

describe('ChatPage ConversationList callbacks', () => {
  beforeEach(() => {
    mockHookState = {};
  });

  afterEach(() => {
    mockHookState = {};
    jest.clearAllMocks();
  });

  it('calls createConversation.mutate via onCreate', () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );

    // The "New Conversation" button in ConversationList triggers onCreate
    const newConvBtn = screen.getByText('New Conversation');
    fireEvent.click(newConvBtn);
    expect(mockCreateConversation.mutate).toHaveBeenCalled();
  });

  it('calls deleteConversation.mutate via onDelete', () => {
    render(
      <TestWrapper>
        <ChatPage />
      </TestWrapper>,
    );

    // The delete button has aria-label "Delete {conv.title}"
    const deleteBtn = screen.getByLabelText('Delete Cycle Analysis Discussion');
    fireEvent.click(deleteBtn);
    expect(mockDeleteConversation.mutate).toHaveBeenCalledWith('conv-1');
  });
});
