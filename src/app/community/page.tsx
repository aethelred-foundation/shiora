/**
 * Shiora on Aethelred — Anonymous Community Circles Page
 *
 * Privacy-preserving community health discussions with ZKP-verified
 * anonymous membership and post creation.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Users, MessageCircle, ShieldCheck, Hash, Send,
  Heart, ChevronLeft, Plus, Search, Lock,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs } from '@/components/ui/SharedComponents';
import { MedicalCard, SectionHeader, StatusBadge, HealthMetricCard } from '@/components/ui/PagePrimitives';
import {
  CircleCard,
  AnonymousPostCard,
  DiscussionThread,
  ZKPMembershipProof,
  CircleBrowser,
  CircleCategoryIcon,
} from '@/components/community/CommunityComponents';
import { useCommunity } from '@/hooks/useCommunity';
import { BRAND, COMMUNITY_CATEGORIES } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';

// ============================================================
// Main Page
// ============================================================

export default function CommunityPage() {
  const { wallet } = useApp();
  const community = useCommunity();

  const [newPostContent, setNewPostContent] = useState('');

  const selectedCircle = community.circles.find((c) => c.id === community.selectedCircleId);

  const handleCreatePost = () => {
    if (newPostContent.trim() && community.selectedCircleId) {
      community.createPost.mutate({
        circleId: community.selectedCircleId,
        content: newPostContent.trim(),
      });
      setNewPostContent('');
    }
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-6 h-6 text-violet-500" />
                <h1 className="text-2xl font-bold text-slate-900">Community Circles</h1>
              </div>
              <p className="text-sm text-slate-500">
                Anonymous, ZKP-verified health community discussions. Your identity is never revealed.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="success" dot>
                {community.joinedCount} circles joined
              </Badge>
              <Badge variant="medical">
                <ShieldCheck className="w-3 h-3 mr-1" />
                ZKP Protected
              </Badge>
            </div>
          </div>

          {/* View: Circle selected or Browse */}
          {community.selectedCircleId && selectedCircle ? (
            /* ─── Circle Detail View ─── */
            <div className="space-y-6">
              {/* Back button + circle info */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => community.setSelectedCircleId(null)}
                  className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Circles
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                {/* Main feed */}
                <div className="flex-1 space-y-4">
                  {/* Circle header */}
                  <MedicalCard>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${selectedCircle.color}15` }}
                      >
                        <CircleCategoryIcon category={selectedCircle.category} className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-slate-900">{selectedCircle.name}</h2>
                        <p className="text-xs text-slate-500">{selectedCircle.description}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {selectedCircle.memberCount.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> {selectedCircle.postCount}
                        </span>
                      </div>
                    </div>
                  </MedicalCard>

                  {/* ZKP membership proof */}
                  {selectedCircle.isJoined && selectedCircle.requiresZKP && (
                    <ZKPMembershipProof circleId={selectedCircle.id} />
                  )}

                  {/* Create post */}
                  {selectedCircle.isJoined && (
                    <MedicalCard>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-brand-400 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">AN</span>
                        </div>
                        <div className="flex-1">
                          <textarea
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            placeholder="Share your thoughts anonymously..."
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                            rows={3}
                          />
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <ShieldCheck className="w-3 h-3 text-emerald-500" />
                              Posted anonymously with ZKP verification
                            </div>
                            <button
                              onClick={handleCreatePost}
                              disabled={!newPostContent.trim() || community.createPost.isLoading}
                              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              Post
                            </button>
                          </div>
                        </div>
                      </div>
                    </MedicalCard>
                  )}

                  {/* Posts feed */}
                  <div className="space-y-3">
                    {community.posts.map((post) => (
                      <AnonymousPostCard
                        key={post.id}
                        post={post}
                        onReact={(postId, emoji) => community.reactToPost.mutate({ postId, emoji })}
                      />
                    ))}
                  </div>

                  {community.posts.length === 0 && (
                    <div className="text-center py-12">
                      <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No posts in this circle yet. Be the first to share!</p>
                    </div>
                  )}
                </div>

                {/* Sidebar: joined circles */}
                <div className="w-full lg:w-72 shrink-0 space-y-4">
                  <MedicalCard>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Your Circles</h4>
                    <div className="space-y-2">
                      {community.circles
                        .filter((c) => c.isJoined)
                        .map((circle) => (
                          <button
                            key={circle.id}
                            onClick={() => community.setSelectedCircleId(circle.id)}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                              circle.id === community.selectedCircleId ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <CircleCategoryIcon category={circle.category} className="w-4 h-4" />
                            <span className="text-xs font-medium truncate">{circle.name}</span>
                          </button>
                        ))}
                    </div>
                  </MedicalCard>
                </div>
              </div>
            </div>
          ) : (
            /* ─── Browse View ─── */
            <CircleBrowser
              circles={community.circles}
              activeCategory={community.categoryFilter}
              onCategoryChange={community.setCategoryFilter}
              onJoin={(id) => community.joinCircle.mutate(id)}
              onLeave={(id) => community.leaveCircle.mutate(id)}
              onSelect={(id) => community.setSelectedCircleId(id)}
            />
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
