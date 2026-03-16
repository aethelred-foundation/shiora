'use client';

import React, { useState } from 'react';
import {
  Users, MessageCircle, ShieldCheck, Hash, Send,
  Heart, ThumbsUp, Smile, Star, Sparkles,
  ChevronRight, UserCheck, Lock,
  Baby, Flame, Ribbon, CircleDot, Leaf, Brain, Apple, HeartHandshake,
} from 'lucide-react';

import type { CommunityCircle, AnonymousPost, CircleCategory } from '@/types';
import { MedicalCard, StatusBadge } from '@/components/ui/PagePrimitives';
import { Badge } from '@/components/ui/SharedComponents';
import { COMMUNITY_CATEGORIES } from '@/lib/constants';
import { timeAgo, truncateAddress } from '@/lib/utils';

// ============================================================
// Icon helpers
// ============================================================

/** Map circle category to a Lucide icon component */
export function CircleCategoryIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case 'fertility': return <Heart className={className ?? 'w-5 h-5 text-purple-500'} />;
    case 'pregnancy': return <Baby className={className ?? 'w-5 h-5 text-pink-500'} />;
    case 'menopause': return <Flame className={className ?? 'w-5 h-5 text-orange-500'} />;
    case 'endometriosis': return <Ribbon className={className ?? 'w-5 h-5 text-yellow-500'} />;
    case 'pcos': return <CircleDot className={className ?? 'w-5 h-5 text-teal-500'} />;
    case 'general_wellness': return <Leaf className={className ?? 'w-5 h-5 text-green-500'} />;
    case 'mental_health': return <Brain className={className ?? 'w-5 h-5 text-blue-500'} />;
    default: return <Apple className={className ?? 'w-5 h-5 text-red-500'} />;
  }
}

/** Map reaction key strings to Lucide icon components */
/* istanbul ignore next -- className fallback branches are unreachable; component is always called without className */
function ReactionIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case 'heart': return <Heart className={className ?? 'w-4 h-4'} />;
    case 'clap': return <ThumbsUp className={className ?? 'w-4 h-4'} />;
    case 'support': return <HeartHandshake className={className ?? 'w-4 h-4'} />;
    case 'smile': return <Smile className={className ?? 'w-4 h-4'} />;
    case 'star': return <Star className={className ?? 'w-4 h-4'} />;
    case 'sparkles': return <Sparkles className={className ?? 'w-4 h-4'} />;
    default: return <Heart className={className ?? 'w-4 h-4'} />;
  }
}

// ============================================================
// CircleCard
// ============================================================

interface CircleCardProps {
  circle: CommunityCircle;
  onJoin?: (id: string) => void;
  onLeave?: (id: string) => void;
  onSelect?: (id: string) => void;
}

export function CircleCard({ circle, onJoin, onLeave, onSelect }: CircleCardProps) {
  return (
    <MedicalCard
      onClick={() => onSelect?.(circle.id)}
      className={circle.isJoined ? 'ring-2 ring-brand-200' : ''}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${circle.color}15` }}
        >
          <CircleCategoryIcon category={circle.category} />
        </div>
        <div className="flex items-center gap-1.5">
          {circle.requiresZKP && (
            <Badge variant="medical">
              <ShieldCheck className="w-3 h-3 mr-0.5" />
              ZKP
            </Badge>
          )}
          {circle.isJoined && (
            <Badge variant="success" dot>Joined</Badge>
          )}
        </div>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-1">{circle.name}</h4>
      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{circle.description}</p>

      <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" /> {circle.memberCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> {circle.postCount}
        </span>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        {circle.isJoined ? (
          <button
            onClick={() => onLeave?.(circle.id)}
            className="w-full py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Leave Circle
          </button>
        ) : (
          <button
            onClick={() => onJoin?.(circle.id)}
            className="w-full py-2 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            {circle.requiresZKP ? 'Join with ZKP' : 'Join Circle'}
          </button>
        )}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// AnonymousPostCard
// ============================================================

interface AnonymousPostCardProps {
  post: AnonymousPost;
  onReact?: (postId: string, emoji: string) => void;
}

export function AnonymousPostCard({ post, onReact }: AnonymousPostCardProps) {
  return (
    <MedicalCard hover={false}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-brand-400 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{post.anonymousId.slice(-2).toUpperCase()}</span>
        </div>
        <span className="text-xs font-mono text-slate-500">{post.anonymousId}</span>
        {post.zkpVerified && (
          <Badge variant="success">
            <ShieldCheck className="w-3 h-3 mr-0.5" />
            ZKP Verified
          </Badge>
        )}
        <span className="ml-auto text-xs text-slate-400">{timeAgo(post.timestamp)}</span>
      </div>

      <p className="text-sm text-slate-700 mb-3 leading-relaxed">{post.content}</p>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-2xs text-slate-500">
              <Hash className="w-2.5 h-2.5" /> {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {post.reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => onReact?.(post.id, reaction.emoji)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors text-xs"
            >
              <ReactionIcon name={reaction.emoji} className="w-3.5 h-3.5" />
              <span className="text-slate-500">{reaction.count}</span>
            </button>
          ))}
          <button
            onClick={() => onReact?.(post.id, 'heart')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors text-xs text-slate-400"
          >
            <Heart className="w-3.5 h-3.5" />
          </button>
        </div>
        <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> {post.replyCount} replies
        </span>
      </div>
    </MedicalCard>
  );
}

// ============================================================
// DiscussionThread (simplified)
// ============================================================

interface DiscussionThreadProps {
  post: AnonymousPost;
  onReact?: (postId: string, emoji: string) => void;
}

export function DiscussionThread({ post, onReact }: DiscussionThreadProps) {
  return (
    <div>
      <AnonymousPostCard post={post} onReact={onReact} />
      {post.replyCount > 0 && (
        <div className="ml-6 mt-2 pl-4 border-l-2 border-slate-200">
          <p className="text-xs text-slate-400 py-2">
            {post.replyCount} replies in this thread
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ZKPMembershipProof
// ============================================================

interface ZKPMembershipProofProps {
  circleId: string;
  proofId?: string;
}

export function ZKPMembershipProof({ circleId, proofId }: ZKPMembershipProofProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
      <div>
        <p className="text-xs font-medium text-emerald-800">ZKP Membership Verified</p>
        <p className="text-2xs text-emerald-600">
          Your membership is cryptographically verified without revealing your identity.
          {proofId && <> Proof: <span className="font-mono">{proofId.slice(0, 12)}...</span></>}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// CircleBrowser (category tabs + filter)
// ============================================================

interface CircleBrowserProps {
  circles: CommunityCircle[];
  activeCategory: CircleCategory | undefined;
  onCategoryChange: (cat: CircleCategory | undefined) => void;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onSelect: (id: string) => void;
}

export function CircleBrowser({ circles, activeCategory, onCategoryChange, onJoin, onLeave, onSelect }: CircleBrowserProps) {
  return (
    <div>
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => onCategoryChange(undefined)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            !activeCategory ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {COMMUNITY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id as CircleCategory)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeCategory === cat.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Circle grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {circles.map((circle) => (
          <CircleCard
            key={circle.id}
            circle={circle}
            onJoin={onJoin}
            onLeave={onLeave}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
