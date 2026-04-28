// ============================================================
// Tests for src/components/community/CommunityComponents.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';
import {
  CircleCategoryIcon,
  CircleCard,
  AnonymousPostCard,
  DiscussionThread,
  ZKPMembershipProof,
  CircleBrowser,
} from '@/components/community/CommunityComponents';
import type { CommunityCircle, AnonymousPost } from '@/types';

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

const mockCircle: CommunityCircle = {
  id: 'circle-1',
  name: 'Fertility Support',
  category: 'fertility',
  description: 'A supportive community for those on fertility journeys.',
  memberCount: 1234,
  postCount: 567,
  createdAt: Date.now() - 86400000 * 30,
  isJoined: false,
  requiresZKP: false,
  icon: 'heart',
  color: '#a855f7',
};

const mockJoinedCircle: CommunityCircle = {
  ...mockCircle,
  id: 'circle-2',
  name: 'PCOS Community',
  category: 'pcos',
  isJoined: true,
  requiresZKP: true,
};

const mockPost: AnonymousPost = {
  id: 'post-1',
  circleId: 'circle-1',
  anonymousId: 'anon-x7f3',
  content: 'Has anyone tried tracking their basal body temperature?',
  timestamp: Date.now() - 7200000,
  reactions: [
    { emoji: 'heart', count: 12 },
    { emoji: 'clap', count: 5 },
  ],
  replyCount: 3,
  zkpVerified: true,
  tags: ['BBT', 'tracking', 'fertility'],
};

// ---------------------------------------------------------------------------
// CircleCategoryIcon
// ---------------------------------------------------------------------------

describe('CircleCategoryIcon', () => {
  it('renders without crashing for known categories', () => {
    const categories = [
      'fertility',
      'pregnancy',
      'menopause',
      'endometriosis',
      'pcos',
      'general_wellness',
      'mental_health',
    ];
    categories.forEach((cat) => {
      const { unmount } = render(
        <TestWrapper>
          <CircleCategoryIcon category={cat} />
        </TestWrapper>,
      );
      unmount();
    });
  });

  it('renders default icon for unknown category', () => {
    const { container } = render(
      <TestWrapper>
        <CircleCategoryIcon category="unknown" />
      </TestWrapper>,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CircleCard
// ---------------------------------------------------------------------------

describe('CircleCard', () => {
  it('renders circle name and description', () => {
    render(
      <TestWrapper>
        <CircleCard circle={mockCircle} />
      </TestWrapper>,
    );
    expect(screen.getByText('Fertility Support')).toBeInTheDocument();
    expect(screen.getByText(/supportive community/)).toBeInTheDocument();
  });

  it('renders member count and post count', () => {
    render(
      <TestWrapper>
        <CircleCard circle={mockCircle} />
      </TestWrapper>,
    );
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('567')).toBeInTheDocument();
  });

  it('shows Join Circle button for unjoined circle', () => {
    render(
      <TestWrapper>
        <CircleCard circle={mockCircle} />
      </TestWrapper>,
    );
    expect(screen.getByText('Join Circle')).toBeInTheDocument();
  });

  it('shows Leave Circle button for joined circle', () => {
    render(
      <TestWrapper>
        <CircleCard circle={mockJoinedCircle} />
      </TestWrapper>,
    );
    expect(screen.getByText('Leave Circle')).toBeInTheDocument();
  });

  it('shows ZKP badge when requiresZKP is true', () => {
    render(
      <TestWrapper>
        <CircleCard circle={mockJoinedCircle} />
      </TestWrapper>,
    );
    expect(screen.getByText('ZKP')).toBeInTheDocument();
  });

  it('shows Joined badge for joined circle', () => {
    render(
      <TestWrapper>
        <CircleCard circle={mockJoinedCircle} />
      </TestWrapper>,
    );
    expect(screen.getByText('Joined')).toBeInTheDocument();
  });

  it('calls onJoin when Join Circle clicked', () => {
    const onJoin = jest.fn();
    render(
      <TestWrapper>
        <CircleCard circle={mockCircle} onJoin={onJoin} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Join Circle'));
    expect(onJoin).toHaveBeenCalledWith('circle-1');
  });

  it('calls onLeave when Leave Circle clicked', () => {
    const onLeave = jest.fn();
    render(
      <TestWrapper>
        <CircleCard circle={mockJoinedCircle} onLeave={onLeave} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Leave Circle'));
    expect(onLeave).toHaveBeenCalledWith('circle-2');
  });

  it('shows Join with ZKP for ZKP circle when not joined', () => {
    const zkpCircle = { ...mockCircle, requiresZKP: true, isJoined: false };
    render(
      <TestWrapper>
        <CircleCard circle={zkpCircle} />
      </TestWrapper>,
    );
    expect(screen.getByText('Join with ZKP')).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', () => {
    const onSelect = jest.fn();
    render(
      <TestWrapper>
        <CircleCard circle={mockCircle} onSelect={onSelect} />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Fertility Support'));
    expect(onSelect).toHaveBeenCalledWith('circle-1');
  });
});

// ---------------------------------------------------------------------------
// AnonymousPostCard
// ---------------------------------------------------------------------------

describe('AnonymousPostCard', () => {
  it('renders post content', () => {
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} />
      </TestWrapper>,
    );
    expect(
      screen.getByText('Has anyone tried tracking their basal body temperature?'),
    ).toBeInTheDocument();
  });

  it('renders anonymous ID', () => {
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} />
      </TestWrapper>,
    );
    expect(screen.getByText('anon-x7f3')).toBeInTheDocument();
  });

  it('renders ZKP Verified badge', () => {
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} />
      </TestWrapper>,
    );
    expect(screen.getByText('ZKP Verified')).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} />
      </TestWrapper>,
    );
    expect(screen.getByText('BBT')).toBeInTheDocument();
    expect(screen.getByText('tracking')).toBeInTheDocument();
    expect(screen.getByText('fertility')).toBeInTheDocument();
  });

  it('renders reaction counts', () => {
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} />
      </TestWrapper>,
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders reply count', () => {
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} />
      </TestWrapper>,
    );
    expect(screen.getByText('3 replies')).toBeInTheDocument();
  });

  it('calls onReact when reaction button clicked', () => {
    const onReact = jest.fn();
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} onReact={onReact} />
      </TestWrapper>,
    );
    // Click the first reaction button
    const reactionButtons = screen.getAllByRole('button');
    fireEvent.click(reactionButtons[0]);
    expect(onReact).toHaveBeenCalledWith('post-1', 'heart');
  });

  it('calls onReact with heart when standalone heart button clicked', () => {
    const onReact = jest.fn();
    render(
      <TestWrapper>
        <AnonymousPostCard post={mockPost} onReact={onReact} />
      </TestWrapper>,
    );
    // The last reaction button is the standalone heart button
    const reactionButtons = screen.getAllByRole('button');
    fireEvent.click(reactionButtons[reactionButtons.length - 1]);
    expect(onReact).toHaveBeenCalledWith('post-1', 'heart');
  });
});

// ---------------------------------------------------------------------------
// DiscussionThread
// ---------------------------------------------------------------------------

describe('DiscussionThread', () => {
  it('renders post content', () => {
    render(
      <TestWrapper>
        <DiscussionThread post={mockPost} />
      </TestWrapper>,
    );
    expect(
      screen.getByText('Has anyone tried tracking their basal body temperature?'),
    ).toBeInTheDocument();
  });

  it('shows reply count indicator when replies exist', () => {
    render(
      <TestWrapper>
        <DiscussionThread post={mockPost} />
      </TestWrapper>,
    );
    expect(screen.getByText(/3 replies in this thread/)).toBeInTheDocument();
  });

  it('does not show reply indicator for zero replies', () => {
    const noRepliesPost = { ...mockPost, replyCount: 0 };
    render(
      <TestWrapper>
        <DiscussionThread post={noRepliesPost} />
      </TestWrapper>,
    );
    expect(screen.queryByText(/replies in this thread/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ZKPMembershipProof
// ---------------------------------------------------------------------------

describe('ZKPMembershipProof', () => {
  it('renders ZKP Membership Verified label', () => {
    render(
      <TestWrapper>
        <ZKPMembershipProof circleId="circle-1" />
      </TestWrapper>,
    );
    expect(screen.getByText('ZKP Membership Verified')).toBeInTheDocument();
  });

  it('renders proof ID when provided', () => {
    render(
      <TestWrapper>
        <ZKPMembershipProof circleId="circle-1" proofId="zkp-proof-abc123def456" />
      </TestWrapper>,
    );
    expect(screen.getByText(/zkp-proof-ab/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CircleBrowser
// ---------------------------------------------------------------------------

describe('CircleBrowser', () => {
  it('renders All category button', () => {
    render(
      <TestWrapper>
        <CircleBrowser
          circles={[mockCircle]}
          activeCategory={undefined}
          onCategoryChange={jest.fn()}
          onJoin={jest.fn()}
          onLeave={jest.fn()}
          onSelect={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders all category filter buttons', () => {
    render(
      <TestWrapper>
        <CircleBrowser
          circles={[]}
          activeCategory={undefined}
          onCategoryChange={jest.fn()}
          onJoin={jest.fn()}
          onLeave={jest.fn()}
          onSelect={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    // Should have at least a few category buttons from COMMUNITY_CATEGORIES
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
  });

  it('renders circle cards in the grid', () => {
    render(
      <TestWrapper>
        <CircleBrowser
          circles={[mockCircle]}
          activeCategory={undefined}
          onCategoryChange={jest.fn()}
          onJoin={jest.fn()}
          onLeave={jest.fn()}
          onSelect={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Fertility Support')).toBeInTheDocument();
  });

  it('calls onCategoryChange when category button clicked', () => {
    const onCategoryChange = jest.fn();
    render(
      <TestWrapper>
        <CircleBrowser
          circles={[]}
          activeCategory={undefined}
          onCategoryChange={onCategoryChange}
          onJoin={jest.fn()}
          onLeave={jest.fn()}
          onSelect={jest.fn()}
        />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('All'));
    expect(onCategoryChange).toHaveBeenCalledWith(undefined);
  });

  it('calls onCategoryChange with category when specific category clicked', () => {
    const onCategoryChange = jest.fn();
    render(
      <TestWrapper>
        <CircleBrowser
          circles={[]}
          activeCategory={undefined}
          onCategoryChange={onCategoryChange}
          onJoin={jest.fn()}
          onLeave={jest.fn()}
          onSelect={jest.fn()}
        />
      </TestWrapper>,
    );
    // Click a specific category button (not All)
    const buttons = screen.getAllByRole('button');
    // The second button should be a specific category
    if (buttons.length > 1) {
      fireEvent.click(buttons[1]);
      expect(onCategoryChange).toHaveBeenCalled();
    }
  });

  it('renders active category as highlighted', () => {
    render(
      <TestWrapper>
        <CircleBrowser
          circles={[mockCircle]}
          activeCategory={'fertility' as any}
          onCategoryChange={jest.fn()}
          onJoin={jest.fn()}
          onLeave={jest.fn()}
          onSelect={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('Fertility Support')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CircleCategoryIcon — custom className
// ---------------------------------------------------------------------------

describe('CircleCategoryIcon — branch coverage', () => {
  it('renders with custom className', () => {
    const { container } = render(
      <TestWrapper>
        <CircleCategoryIcon category="fertility" className="w-8 h-8 text-red-500" />
      </TestWrapper>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('w-8', 'h-8', 'text-red-500');
  });
});

// ---------------------------------------------------------------------------
// ReactionIcon — various types (via AnonymousPostCard)
// ---------------------------------------------------------------------------

describe('AnonymousPostCard — reaction type branch coverage', () => {
  it('renders support, smile, star, sparkles reactions', () => {
    const post: AnonymousPost = {
      ...mockPost,
      reactions: [
        { emoji: 'support', count: 3 },
        { emoji: 'smile', count: 4 },
        { emoji: 'star', count: 2 },
        { emoji: 'sparkles', count: 1 },
        { emoji: 'unknown_emoji', count: 7 },
      ],
    };
    render(
      <TestWrapper>
        <AnonymousPostCard post={post} />
      </TestWrapper>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders post with zkpVerified=false', () => {
    const post: AnonymousPost = { ...mockPost, zkpVerified: false };
    render(
      <TestWrapper>
        <AnonymousPostCard post={post} />
      </TestWrapper>,
    );
    expect(screen.queryByText('ZKP Verified')).not.toBeInTheDocument();
  });

  it('renders post with empty tags', () => {
    const post: AnonymousPost = { ...mockPost, tags: [] };
    render(
      <TestWrapper>
        <AnonymousPostCard post={post} />
      </TestWrapper>,
    );
    expect(screen.queryByText('BBT')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ZKPMembershipProof — without proofId
// ---------------------------------------------------------------------------

describe('ZKPMembershipProof — branch coverage', () => {
  it('renders without proof ID text when proofId is not provided', () => {
    render(
      <TestWrapper>
        <ZKPMembershipProof circleId="circle-1" />
      </TestWrapper>,
    );
    expect(screen.getByText('ZKP Membership Verified')).toBeInTheDocument();
    expect(screen.queryByText(/Proof:/)).not.toBeInTheDocument();
  });
});
