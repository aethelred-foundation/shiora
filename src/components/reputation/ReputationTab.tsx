/**
 * Shiora on Aethelred — Reputation Tab Component
 *
 * Self-contained reputation management tab to be embedded
 * in the Access Control page. Uses the useProviderReputation hook
 * and renders provider cards, reviews, history charts, and the review modal.
 */

'use client';

import React, { useState } from 'react';
import {
  Search, ChevronDown, ChevronLeft, Loader2,
  Shield, ShieldCheck, Star, AlertTriangle, X, Filter,
} from 'lucide-react';

import type { ProviderReputation, ProviderReview, TrustLevel } from '@/types';
import { useProviderReputation } from '@/hooks/useProviderReputation';
import { MedicalCard } from '@/components/ui/PagePrimitives';
import { Modal, Badge } from '@/components/ui/SharedComponents';
import {
  ProviderProfile,
  ReputationScore,
  TrustBadge,
  ReviewCard,
  ReputationHistory,
  StarRating,
} from '@/components/reputation/ReputationComponents';

// ============================================================
// Review Submit Modal
// ============================================================

function SubmitReviewModal({
  open,
  onClose,
  providerName,
  providerAddress,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  providerName: string;
  providerAddress: string;
  onSubmit: (params: {
    address: string;
    rating: 1 | 2 | 3 | 4 | 5;
    categories: ProviderReview['categories'];
    comment: string;
  }) => void;
  isLoading: boolean;
}) {
  const [rating, setRating] = useState<number>(4);
  const [communication, setCommunication] = useState(4);
  const [dataHandling, setDataHandling] = useState(4);
  const [timeliness, setTimeliness] = useState(4);
  const [professionalism, setProfessionalism] = useState(4);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    onSubmit({
      address: providerAddress,
      rating: Math.max(1, Math.min(5, rating)) as 1 | 2 | 3 | 4 | 5,
      categories: {
        communication,
        dataHandling,
        timeliness,
        professionalism,
      },
      comment,
    });
  };

  const categories = [
    { label: 'Communication', value: communication, set: setCommunication },
    { label: 'Data Handling', value: dataHandling, set: setDataHandling },
    { label: 'Timeliness', value: timeliness, set: setTimeliness },
    { label: 'Professionalism', value: professionalism, set: setProfessionalism },
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Review ${providerName}`} size="md">
      <div className="space-y-5">
        {/* Overall rating */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Overall Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className="p-0.5"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    n <= rating ? 'text-amber-400' : 'text-slate-200'
                  }`}
                  fill={n <= rating ? '#fbbf24' : '#e2e8f0'}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Category ratings */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">Category Ratings</label>
          {categories.map((cat) => (
            <div key={cat.label} className="flex items-center justify-between">
              <span className="text-sm text-slate-600">{cat.label}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => cat.set(n)}
                    className="p-0.5"
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        n <= cat.value ? 'text-amber-400' : 'text-slate-200'
                      }`}
                      fill={n <= cat.value ? '#fbbf24' : '#e2e8f0'}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Comment */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this provider..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !comment.trim()}
            className="flex-1 py-2.5 px-4 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// ReputationTab — Main component
// ============================================================

export default function ReputationTab() {
  const {
    providers,
    isLoading,
    error,
    useReviews,
    submitReview,
    topProviders,
    averageScore,
    getScoreHistory,
  } = useProviderReputation();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [trustFilter, setTrustFilter] = useState<TrustLevel | 'all'>('all');
  const [selectedProvider, setSelectedProvider] = useState<ProviderReputation | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ProviderReputation | null>(null);

  // Filter dropdown
  const [filterOpen, setFilterOpen] = useState(false);

  const trustOptions: { value: TrustLevel | 'all'; label: string }[] = [
    { value: 'all', label: 'All Trust Levels' },
    { value: 'gold', label: 'Gold' },
    { value: 'silver', label: 'Silver' },
    { value: 'bronze', label: 'Bronze' },
    { value: 'unrated', label: 'Unrated' },
  ];

  // Filtered providers
  const filteredProviders = React.useMemo(() => {
    let result = providers;
    if (trustFilter !== 'all') {
      result = result.filter((p) => p.trustLevel === trustFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.specialty.toLowerCase().includes(q)
      );
    }
    return result;
  }, [providers, trustFilter, searchQuery]);

  // Reviews for selected provider
  const { reviews, isLoading: reviewsLoading } = useReviews(selectedProvider?.address ?? null);

  const handleSubmitReview = (params: Parameters<typeof submitReview.mutate>[0]) => {
    submitReview.mutate(params);
    setReviewModalOpen(false);
  };

  // Provider detail view
  if (selectedProvider) {
    const scoreHistory = getScoreHistory(selectedProvider.address);

    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedProvider(null)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Providers
        </button>

        {/* Provider header */}
        <MedicalCard>
          <div className="flex flex-col md:flex-row items-start gap-6">
            <ReputationScore
              score={selectedProvider.overallScore}
              trustLevel={selectedProvider.trustLevel}
              size="lg"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-slate-900">{selectedProvider.name}</h3>
                <TrustBadge trustLevel={selectedProvider.trustLevel} size="md" />
              </div>
              <p className="text-sm text-slate-500 mb-3">{selectedProvider.specialty}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Reviews</p>
                  <p className="text-sm font-bold text-slate-900">{selectedProvider.reviewCount}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Accesses</p>
                  <p className="text-sm font-bold text-slate-900">{selectedProvider.totalAccesses}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">On-Time Revocations</p>
                  <p className="text-sm font-bold text-slate-900">{selectedProvider.onTimeRevocations}%</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Data Breaches</p>
                  <p className={`text-sm font-bold ${selectedProvider.dataBreaches > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {selectedProvider.dataBreaches}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => { setReviewTarget(selectedProvider); setReviewModalOpen(true); }}
              className="px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors shrink-0"
            >
              Write Review
            </button>
          </div>
        </MedicalCard>

        {/* Score history chart */}
        <ReputationHistory data={scoreHistory} />

        {/* Reviews */}
        <div>
          <h4 className="text-base font-semibold text-slate-900 mb-4">Reviews</h4>
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-8 text-center">
              <Star className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No reviews yet for this provider</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>

        {/* Review modal */}
        {reviewTarget && (
          <SubmitReviewModal
            open={reviewModalOpen}
            onClose={() => setReviewModalOpen(false)}
            providerName={reviewTarget.name}
            providerAddress={reviewTarget.address}
            onSubmit={handleSubmitReview}
            isLoading={submitReview.isLoading}
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Providers</p>
              <p className="text-xl font-bold text-slate-900">{providers.length}</p>
            </div>
          </div>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Average Score</p>
              <p className="text-xl font-bold text-slate-900">{averageScore}</p>
            </div>
          </div>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Gold Providers</p>
              <p className="text-xl font-bold text-slate-900">
                {providers.filter((p) => p.trustLevel === 'gold').length}
              </p>
            </div>
          </div>
        </MedicalCard>
        <MedicalCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Breach Reports</p>
              <p className="text-xl font-bold text-slate-900">
                {providers.reduce((sum, p) => sum + p.dataBreaches, 0)}
              </p>
            </div>
          </div>
        </MedicalCard>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Trust level filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              {trustFilter === 'all' ? 'All Trust Levels' : trustOptions.find((o) => o.value === trustFilter)?.label}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-44">
                  {trustOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setTrustFilter(opt.value); setFilterOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        trustFilter === opt.value
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search providers..."
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent w-56"
            />
          </div>
        </div>
      </div>

      {/* Provider cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-sm text-red-500">Failed to load providers</p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="py-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No providers match your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProviders.map((provider) => (
            <ProviderProfile
              key={provider.address}
              provider={provider}
              onClick={() => setSelectedProvider(provider)}
            />
          ))}
        </div>
      )}

      {/* Review modal (for when triggered from list view) */}
      {reviewTarget && (
        <SubmitReviewModal
          open={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          providerName={reviewTarget.name}
          providerAddress={reviewTarget.address}
          onSubmit={handleSubmitReview}
          isLoading={submitReview.isLoading}
        />
      )}
    </div>
  );
}
