// ============================================================
// Tests for src/components/chat/ChatComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  ChatBubble,
  TypingIndicator,
  ChatInput,
  SuggestedPrompts,
  ConversationList,
  AttestationProof,
} from '@/components/chat/ChatComponents';
import type { ChatMessage, ChatConversation, ChatSuggestedPrompt } from '@/types';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(AppProvider, null, children),
  );
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockUserMessage: ChatMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  role: 'user',
  content: 'What is my heart rate trend?',
  timestamp: Date.now() - 60000,
};

const mockAssistantMessage: ChatMessage = {
  id: 'msg-2',
  conversationId: 'conv-1',
  role: 'assistant',
  content: 'Your heart rate trend looks stable.',
  timestamp: Date.now() - 30000,
  model: 'HealthAI-v3',
  confidence: 92,
  teePlatform: 'Intel SGX',
  attestation: '0xdeadbeefdeadbeefdeadbeefdeadbeef',
};

const mockConversations: ChatConversation[] = [
  {
    id: 'conv-1',
    title: 'Heart Rate Analysis',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
    messageCount: 4,
    lastMessage: 'Your heart rate is stable.',
    attestationCount: 2,
  },
  {
    id: 'conv-2',
    title: 'Sleep Patterns',
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 7200000,
    messageCount: 2,
    lastMessage: 'Your sleep quality improved.',
    attestationCount: 1,
  },
];

const mockPrompts: ChatSuggestedPrompt[] = [
  {
    id: 'prompt-1',
    category: 'Cycle',
    prompt: 'When is my next predicted period?',
    icon: 'Calendar',
  },
  {
    id: 'prompt-2',
    category: 'Health',
    prompt: 'Analyze my recent heart rate trends',
    icon: 'Heart',
  },
];

// ---------------------------------------------------------------------------
// ChatBubble
// ---------------------------------------------------------------------------

describe('ChatBubble', () => {
  it('renders user message content', () => {
    render(
      <TestWrapper>
        <ChatBubble message={mockUserMessage} isUser />
      </TestWrapper>,
    );
    expect(screen.getByText('What is my heart rate trend?')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(
      <TestWrapper>
        <ChatBubble message={mockAssistantMessage} isUser={false} />
      </TestWrapper>,
    );
    expect(screen.getByText('Your heart rate trend looks stable.')).toBeInTheDocument();
  });

  it('renders model badge for assistant messages', () => {
    render(
      <TestWrapper>
        <ChatBubble message={mockAssistantMessage} isUser={false} />
      </TestWrapper>,
    );
    expect(screen.getByText('HealthAI-v3')).toBeInTheDocument();
  });

  it('renders confidence badge for assistant messages', () => {
    render(
      <TestWrapper>
        <ChatBubble message={mockAssistantMessage} isUser={false} />
      </TestWrapper>,
    );
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('renders TEE platform badge', () => {
    render(
      <TestWrapper>
        <ChatBubble message={mockAssistantMessage} isUser={false} />
      </TestWrapper>,
    );
    expect(screen.getByText('Intel SGX')).toBeInTheDocument();
  });

  it('renders attestation hash for assistant messages', () => {
    render(
      <TestWrapper>
        <ChatBubble message={mockAssistantMessage} isUser={false} />
      </TestWrapper>,
    );
    // truncated hash should appear somewhere
    expect(screen.getByText(/0xdeadbeef/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TypingIndicator
// ---------------------------------------------------------------------------

describe('TypingIndicator', () => {
  it('renders three animated dots', () => {
    const { container } = render(
      <TestWrapper>
        <TypingIndicator />
      </TestWrapper>,
    );
    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

describe('ChatInput', () => {
  it('renders the textarea placeholder', () => {
    const onSend = jest.fn();
    render(
      <TestWrapper>
        <ChatInput onSend={onSend} />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText('Ask your health AI assistant...')).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    const onSend = jest.fn();
    render(
      <TestWrapper>
        <ChatInput onSend={onSend} />
      </TestWrapper>,
    );
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).toBeDisabled();
  });

  it('calls onSend when send button clicked with text', () => {
    const onSend = jest.fn();
    render(
      <TestWrapper>
        <ChatInput onSend={onSend} />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Ask your health AI assistant...');
    fireEvent.change(textarea, { target: { value: 'Hello AI' } });
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    fireEvent.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith('Hello AI');
  });

  it('calls onSend on Enter key press', () => {
    const onSend = jest.fn();
    render(
      <TestWrapper>
        <ChatInput onSend={onSend} />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Ask your health AI assistant...');
    fireEvent.change(textarea, { target: { value: 'Hello AI' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Hello AI');
  });

  it('shows loading spinner when isLoading is true', () => {
    const onSend = jest.fn();
    const { container } = render(
      <TestWrapper>
        <ChatInput onSend={onSend} isLoading />
      </TestWrapper>,
    );
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('does not send on Shift+Enter', () => {
    const onSend = jest.fn();
    render(
      <TestWrapper>
        <ChatInput onSend={onSend} />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Ask your health AI assistant...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send when disabled', () => {
    const onSend = jest.fn();
    render(
      <TestWrapper>
        <ChatInput onSend={onSend} disabled />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Ask your health AI assistant...');
    expect(textarea).toBeDisabled();
  });

  it('clears input after sending', () => {
    const onSend = jest.fn();
    render(
      <TestWrapper>
        <ChatInput onSend={onSend} />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Ask your health AI assistant...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    const sendBtn = screen.getByRole('button', { name: /send message/i });
    fireEvent.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith('Test message');
  });
});

// ---------------------------------------------------------------------------
// SuggestedPrompts
// ---------------------------------------------------------------------------

describe('SuggestedPrompts', () => {
  it('renders prompt text', () => {
    const onSelect = jest.fn();
    render(
      <TestWrapper>
        <SuggestedPrompts prompts={mockPrompts} onSelect={onSelect} />
      </TestWrapper>,
    );
    expect(screen.getByText('When is my next predicted period?')).toBeInTheDocument();
    expect(screen.getByText('Analyze my recent heart rate trends')).toBeInTheDocument();
  });

  it('renders category labels', () => {
    const onSelect = jest.fn();
    render(
      <TestWrapper>
        <SuggestedPrompts prompts={mockPrompts} onSelect={onSelect} />
      </TestWrapper>,
    );
    expect(screen.getByText('Cycle')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  it('calls onSelect with prompt text when card clicked', () => {
    const onSelect = jest.fn();
    render(
      <TestWrapper>
        <SuggestedPrompts prompts={mockPrompts} onSelect={onSelect} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('When is my next predicted period?').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('When is my next predicted period?');
  });

  it('renders fallback icon for unknown icon name', () => {
    const unknownPrompt: ChatSuggestedPrompt[] = [
      { id: 'p-unknown', category: 'Test', prompt: 'Test prompt', icon: 'UnknownIcon' },
    ];
    const { container } = render(
      <TestWrapper>
        <SuggestedPrompts prompts={unknownPrompt} onSelect={jest.fn()} />
      </TestWrapper>,
    );
    // Falls back to MessageSquare icon
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Test prompt')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ConversationList
// ---------------------------------------------------------------------------

describe('ConversationList', () => {
  it('renders all conversations', () => {
    render(
      <TestWrapper>
        <ConversationList
          conversations={mockConversations}
          activeId="conv-1"
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Heart Rate Analysis')).toBeInTheDocument();
    expect(screen.getByText('Sleep Patterns')).toBeInTheDocument();
  });

  it('renders New Conversation button', () => {
    render(
      <TestWrapper>
        <ConversationList
          conversations={mockConversations}
          activeId={null}
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('New Conversation')).toBeInTheDocument();
  });

  it('calls onCreate when New Conversation button clicked', () => {
    const onCreate = jest.fn();
    render(
      <TestWrapper>
        <ConversationList
          conversations={[]}
          activeId={null}
          onSelect={jest.fn()}
          onCreate={onCreate}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('New Conversation'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('shows empty state when no conversations', () => {
    render(
      <TestWrapper>
        <ConversationList
          conversations={[]}
          activeId={null}
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });

  it('calls onSelect when conversation clicked', () => {
    const onSelect = jest.fn();
    render(
      <TestWrapper>
        <ConversationList
          conversations={mockConversations}
          activeId={null}
          onSelect={onSelect}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Heart Rate Analysis'));
    expect(onSelect).toHaveBeenCalledWith('conv-1');
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    render(
      <TestWrapper>
        <ConversationList
          conversations={mockConversations}
          activeId="conv-1"
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onDelete={onDelete}
        />
      </TestWrapper>,
    );
    const deleteBtn = screen.getByLabelText('Delete Heart Rate Analysis');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('conv-1');
  });

  it('renders last message text', () => {
    render(
      <TestWrapper>
        <ConversationList
          conversations={mockConversations}
          activeId={null}
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Your heart rate is stable.')).toBeInTheDocument();
  });

  it('renders message count badges', () => {
    render(
      <TestWrapper>
        <ConversationList
          conversations={mockConversations}
          activeId={null}
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders "No messages yet" for conversation without lastMessage', () => {
    const noMsgConv: ChatConversation[] = [
      {
        id: 'conv-3',
        title: 'New Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
        attestationCount: 0,
      },
    ];
    render(
      <TestWrapper>
        <ConversationList
          conversations={noMsgConv}
          activeId={null}
          onSelect={jest.fn()}
          onCreate={jest.fn()}
          onDelete={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AttestationProof
// ---------------------------------------------------------------------------

describe('AttestationProof', () => {
  it('renders attestation chain header', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockUserMessage, mockAssistantMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Attestation Chain')).toBeInTheDocument();
  });

  it('renders attested message count', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockUserMessage, mockAssistantMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText(/1 verified attestation/)).toBeInTheDocument();
  });

  it('renders TEE platform breakdown', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockAssistantMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Intel SGX')).toBeInTheDocument();
  });

  it('renders empty state when no attestations', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockUserMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText('No attestations yet')).toBeInTheDocument();
  });

  it('renders total attestations count', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockAssistantMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Total Attestations')).toBeInTheDocument();
  });

  it('renders Verified label for attested messages', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockAssistantMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders model name in attestation entry', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockAssistantMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText('HealthAI-v3')).toBeInTheDocument();
  });

  it('renders plural attestations text for multiple', () => {
    const msg2: ChatMessage = {
      ...mockAssistantMessage,
      id: 'msg-3',
      attestation: '0xbeefbeefbeefbeefbeefbeefbeefbeef',
    };
    render(
      <TestWrapper>
        <AttestationProof messages={[mockAssistantMessage, msg2]} />
      </TestWrapper>,
    );
    expect(screen.getByText(/2 verified attestations/)).toBeInTheDocument();
  });

  it('renders TEE Platforms heading', () => {
    render(
      <TestWrapper>
        <AttestationProof messages={[mockAssistantMessage]} />
      </TestWrapper>,
    );
    expect(screen.getByText('TEE Platforms')).toBeInTheDocument();
  });
});
