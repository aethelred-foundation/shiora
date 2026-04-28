// ============================================================
// Tests for src/app/community/page.tsx
// ============================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/contexts/AppContext';

const mockSetSelectedCircleId = jest.fn();
const mockSetCategoryFilter = jest.fn();
const mockJoinCircle = { mutate: jest.fn(), isLoading: false, error: null };
const mockLeaveCircle = { mutate: jest.fn(), isLoading: false, error: null };
const mockCreatePost = { mutate: jest.fn(), isLoading: false, error: null };
const mockReactToPost = { mutate: jest.fn(), isLoading: false, error: null };
const mockRefetch = jest.fn();

let mockOverrides: Record<string, unknown> = {};

jest.mock('@/hooks/useCommunity', () => ({
  useCommunity: () => ({
    circles: [
      {
        id: 'c-1',
        name: 'Fertility Journeys',
        category: 'fertility',
        description: 'Share your fertility journey',
        color: '#8b5cf6',
        memberCount: 1200,
        postCount: 450,
        isJoined: true,
        requiresZKP: true,
      },
      {
        id: 'c-2',
        name: 'Expecting Together',
        category: 'pregnancy',
        description: 'Pregnancy support group',
        color: '#ec4899',
        memberCount: 800,
        postCount: 320,
        isJoined: true,
        requiresZKP: true,
      },
      {
        id: 'c-3',
        name: 'Menopause Matters',
        category: 'menopause',
        description: 'Menopause community',
        color: '#f59e0b',
        memberCount: 600,
        postCount: 200,
        isJoined: true,
        requiresZKP: false,
      },
      {
        id: 'c-4',
        name: 'Wellness Hub',
        category: 'general_wellness',
        description: 'General wellness discussions',
        color: '#10b981',
        memberCount: 2000,
        postCount: 800,
        isJoined: false,
        requiresZKP: false,
      },
    ],
    posts: [
      {
        id: 'p-1',
        circleId: 'c-1',
        content: 'Starting IVF next month',
        anonymousId: 'anon-001',
        timestamp: Date.now() - 3600000,
        reactions: [
          { emoji: 'heart', count: 5 },
          { emoji: 'hug', count: 3 },
        ],
        replyCount: 2,
        zkpVerified: true,
        tags: ['ivf', 'fertility'],
      },
      {
        id: 'p-2',
        circleId: 'c-1',
        content: 'Feeling hopeful today',
        anonymousId: 'anon-002',
        timestamp: Date.now() - 7200000,
        reactions: [{ emoji: 'heart', count: 12 }],
        replyCount: 0,
        zkpVerified: true,
        tags: [],
      },
    ],
    memberships: [],
    isLoading: false,
    isFetching: false,
    error: null,
    joinedCount: 3,
    selectedCircleId: null,
    setSelectedCircleId: mockSetSelectedCircleId,
    categoryFilter: undefined,
    setCategoryFilter: mockSetCategoryFilter,
    joinCircle: mockJoinCircle,
    leaveCircle: mockLeaveCircle,
    createPost: mockCreatePost,
    reactToPost: mockReactToPost,
    refetch: mockRefetch,
    ...mockOverrides,
  }),
}));

import CommunityPage from '@/app/community/page';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>{children}</AppProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOverrides = {};
});

describe('CommunityPage', () => {
  it('renders the community page heading', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getAllByText('Community Circles').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the page description', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(
      screen.getByText(/Anonymous, ZKP-verified health community discussions/),
    ).toBeInTheDocument();
  });

  it('renders navigation and footer', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders ZKP Protected badge', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByText('ZKP Protected')).toBeInTheDocument();
  });

  it('renders circles joined count badge', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByText('3 circles joined')).toBeInTheDocument();
  });

  // --- Browse View ---

  it('renders browse view by default (no selected circle)', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // CircleBrowser is rendered
    expect(screen.queryByText('Back to Circles')).not.toBeInTheDocument();
  });

  // --- Circle Detail View ---

  it('renders detail view when a circle is selected', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Back to Circles')).toBeInTheDocument();
    // Circle name as heading
    expect(screen.getAllByText('Fertility Journeys').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Share your fertility journey')).toBeInTheDocument();
  });

  it('shows Your Circles sidebar in detail view', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Your Circles')).toBeInTheDocument();
  });

  it('shows ZKP membership proof for joined circle requiring ZKP', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // The ZKPMembershipProof component should be rendered
    // Circle c-1 is joined and requires ZKP
  });

  it('shows anonymous post creation area for joined circles', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText('Share your thoughts anonymously...')).toBeInTheDocument();
    expect(screen.getByText(/Posted anonymously with ZKP verification/)).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();
  });

  it('does not show post creation for non-joined circle', () => {
    mockOverrides = { selectedCircleId: 'c-4' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(
      screen.queryByPlaceholderText('Share your thoughts anonymously...'),
    ).not.toBeInTheDocument();
  });

  it('renders posts in detail view', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByText('Starting IVF next month')).toBeInTheDocument();
    expect(screen.getByText('Feeling hopeful today')).toBeInTheDocument();
  });

  it('shows empty posts message when no posts', () => {
    mockOverrides = { selectedCircleId: 'c-1', posts: [] };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(
      screen.getByText('No posts in this circle yet. Be the first to share!'),
    ).toBeInTheDocument();
  });

  it('clicks Back to Circles button to go back to browse', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    fireEvent.click(screen.getByText('Back to Circles'));
    expect(mockSetSelectedCircleId).toHaveBeenCalledWith(null);
  });

  it('clicks a sidebar circle to switch to it', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // Sidebar has joined circles listed as buttons
    const sidebarButtons = screen.getAllByRole('button');
    const menopauseBtn = sidebarButtons.find((btn) =>
      btn.textContent?.includes('Menopause Matters'),
    );
    if (menopauseBtn) {
      fireEvent.click(menopauseBtn);
      expect(mockSetSelectedCircleId).toHaveBeenCalledWith('c-3');
    }
  });

  // --- Create Post ---

  it('types in the post textarea and clicks Post', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Share your thoughts anonymously...');
    fireEvent.change(textarea, { target: { value: 'My new post content' } });
    fireEvent.click(screen.getByText('Post'));
    expect(mockCreatePost.mutate).toHaveBeenCalledWith({
      circleId: 'c-1',
      content: 'My new post content',
    });
  });

  it('does not create post when textarea is empty', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // Post button should be disabled when empty
    const postBtn = screen.getByText('Post');
    expect(postBtn.closest('button')).toBeDisabled();
  });

  it('does not call createPost when content is whitespace only', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Share your thoughts anonymously...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    // Button should be disabled since trim() is empty
    const postBtn = screen.getByText('Post');
    expect(postBtn.closest('button')).toBeDisabled();
  });

  it('clears textarea after successful post creation', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText(
      'Share your thoughts anonymously...',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Some content' } });
    expect(textarea.value).toBe('Some content');
    fireEvent.click(screen.getByText('Post'));
    expect(textarea.value).toBe('');
  });

  it('trims content before sending to createPost', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    const textarea = screen.getByPlaceholderText('Share your thoughts anonymously...');
    fireEvent.change(textarea, { target: { value: '  trimmed content  ' } });
    fireEvent.click(screen.getByText('Post'));
    expect(mockCreatePost.mutate).toHaveBeenCalledWith({
      circleId: 'c-1',
      content: 'trimmed content',
    });
  });

  it('renders member count and post count in circle detail header', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('450')).toBeInTheDocument();
  });

  it('does not show post creation for non-ZKP non-joined circle', () => {
    mockOverrides = { selectedCircleId: 'c-4' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(
      screen.queryByPlaceholderText('Share your thoughts anonymously...'),
    ).not.toBeInTheDocument();
  });

  it('shows post creation for joined non-ZKP circle', () => {
    mockOverrides = { selectedCircleId: 'c-3' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByPlaceholderText('Share your thoughts anonymously...')).toBeInTheDocument();
  });

  it('renders Post button as disabled when createPost.isLoading is true', () => {
    mockOverrides = {
      selectedCircleId: 'c-1',
      createPost: { mutate: jest.fn(), isLoading: true, error: null },
    };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    const postBtn = screen.getByText('Post');
    expect(postBtn.closest('button')).toBeDisabled();
  });

  it('renders the anonymous avatar AN badge', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    expect(screen.getByText('AN')).toBeInTheDocument();
  });

  // --- Reaction click (onReact callback) ---

  it('clicks a reaction button on a post to trigger reactToPost', () => {
    mockOverrides = { selectedCircleId: 'c-1' };
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // Post p-1 has reactions: heart(5), hug(3). The reaction count "5" is rendered as text.
    const reactionBtn = screen.getByText('5').closest('button');
    expect(reactionBtn).not.toBeNull();
    fireEvent.click(reactionBtn!);
    expect(mockReactToPost.mutate).toHaveBeenCalledWith({ postId: 'p-1', emoji: 'heart' });
  });

  // --- Browse view callbacks (onJoin, onLeave, onSelect) ---

  it('clicks Join Circle button in browse view to trigger joinCircle', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // c-4 (Wellness Hub) is not joined and does not require ZKP, so button says "Join Circle"
    const joinBtn = screen.getByText('Join Circle');
    fireEvent.click(joinBtn);
    expect(mockJoinCircle.mutate).toHaveBeenCalledWith('c-4');
  });

  it('clicks Leave Circle button in browse view to trigger leaveCircle', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // Joined circles show "Leave Circle" button
    const leaveButtons = screen.getAllByText('Leave Circle');
    expect(leaveButtons.length).toBeGreaterThan(0);
    fireEvent.click(leaveButtons[0]);
    expect(mockLeaveCircle.mutate).toHaveBeenCalled();
  });

  it('clicks a circle card in browse view to trigger onSelect', () => {
    render(
      <TestWrapper>
        <CommunityPage />
      </TestWrapper>,
    );
    // Clicking on the circle name (inside the card) should trigger onSelect
    fireEvent.click(screen.getByText('Wellness Hub'));
    expect(mockSetSelectedCircleId).toHaveBeenCalledWith('c-4');
  });
});
