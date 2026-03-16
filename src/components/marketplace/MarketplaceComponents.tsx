/**
 * Shiora on Aethelred — Marketplace Components
 * Reusable components for the Health Data Marketplace feature.
 */

'use client';

import React, { useState } from 'react';
import {
  ShoppingCart, TrendingUp, BarChart3, Users,
  ShieldCheck, Tag, Database, Calendar,
  Heart, TestTube2, HeartPulse, Watch,
  ScanLine, ClipboardCheck, Pill, CheckCircle,
  X, AlertTriangle, Store,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { MedicalCard, ChartTooltip, StatusBadge } from '@/components/ui/PagePrimitives';
import { Badge, Modal, ProgressRing } from '@/components/ui/SharedComponents';
import { MARKETPLACE_CATEGORIES, EXTENDED_STATUS_STYLES } from '@/lib/constants';
import { formatNumber, formatDate, truncateAddress } from '@/lib/utils';
import type { DataListing, MarketplaceStats, MarketplaceCategory } from '@/types';

// ============================================================
// Icon map for categories
// ============================================================

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  menstrual_cycles: <Calendar className="w-4 h-4" />,
  fertility_data: <Heart className="w-4 h-4" />,
  lab_results: <TestTube2 className="w-4 h-4" />,
  vitals_timeseries: <HeartPulse className="w-4 h-4" />,
  wearable_data: <Watch className="w-4 h-4" />,
  imaging_anonymized: <ScanLine className="w-4 h-4" />,
  clinical_outcomes: <ClipboardCheck className="w-4 h-4" />,
  medication_responses: <Pill className="w-4 h-4" />,
};

function getCategoryMeta(categoryId: string) {
  const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === categoryId);
  return {
    label: cat?.label ?? categoryId,
    color: cat?.color ?? '#94a3b8',
    icon: CATEGORY_ICON_MAP[categoryId] ?? <Database className="w-4 h-4" />,
  };
}

// ============================================================
// QualityScoreBadge — Circular score display
// ============================================================

export function QualityScoreBadge({ score, size = 44 }: { score: number; size?: number }) {
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#8B1538' : score >= 60 ? '#fb923c' : '#f43f5e';
  return (
    <ProgressRing value={score} max={100} size={size} strokeWidth={3} color={color}>
      <span className="text-xs font-bold text-slate-900">{score}</span>
    </ProgressRing>
  );
}

// ============================================================
// DataListingCard
// ============================================================

export function DataListingCard({
  listing,
  onPurchase,
  isOwner = false,
  onWithdraw,
}: {
  listing: DataListing;
  onPurchase?: (id: string) => void;
  isOwner?: boolean;
  onWithdraw?: (id: string) => void;
}) {
  const cat = getCategoryMeta(listing.category);

  return (
    <MedicalCard>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: cat.color }}
        >
          {cat.icon}
        </div>
        <QualityScoreBadge score={listing.qualityScore} />
      </div>

      <h3 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-2">{listing.title}</h3>
      <p className="text-xs text-slate-500 mb-3">{cat.label}</p>

      {/* Quality bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Quality</span>
          <span className="font-medium text-slate-700">{listing.qualityScore}/100</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${listing.qualityScore}%`,
              backgroundColor: listing.qualityScore >= 90 ? '#10b981' : listing.qualityScore >= 75 ? '#8B1538' : '#fb923c',
            }}
          />
        </div>
      </div>

      {/* Data points */}
      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
        <Database className="w-3.5 h-3.5" />
        <span>{formatNumber(listing.dataPoints)} data points</span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {listing.teeVerified && (
          <Badge variant="success" dot>TEE Verified</Badge>
        )}
        <Badge variant="medical">{listing.anonymizationLevel}</Badge>
      </div>

      {/* Price + Action */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div>
          <span className="text-lg font-bold text-slate-900">{listing.price.toFixed(2)}</span>
          <span className="text-xs text-slate-400 ml-1">AETHEL</span>
        </div>
        {isOwner ? (
          listing.status === 'active' && onWithdraw ? (
            <button
              onClick={() => onWithdraw(listing.id)}
              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              Withdraw
            </button>
          ) : (
            <StatusBadge status={listing.status} styles={EXTENDED_STATUS_STYLES} />
          )
        ) : (
          listing.status === 'active' && onPurchase ? (
            <button
              onClick={() => onPurchase(listing.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Purchase
            </button>
          ) : (
            <StatusBadge status={listing.status} styles={EXTENDED_STATUS_STYLES} />
          )
        )}
      </div>
    </MedicalCard>
  );
}

// ============================================================
// MarketplaceStatsBar
// ============================================================

export function MarketplaceStatsBar({ stats }: { stats: MarketplaceStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <MedicalCard>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <Store className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Listings</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalListings}</p>
          </div>
        </div>
      </MedicalCard>
      <MedicalCard>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Volume</p>
            <p className="text-lg font-bold text-slate-900">{formatNumber(stats.totalVolume)} AETHEL</p>
          </div>
        </div>
      </MedicalCard>
      <MedicalCard>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Tag className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Avg Price</p>
            <p className="text-lg font-bold text-slate-900">{stats.averagePrice.toFixed(2)} AETHEL</p>
          </div>
        </div>
      </MedicalCard>
      <MedicalCard>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Sellers</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalSellers}</p>
          </div>
        </div>
      </MedicalCard>
    </div>
  );
}

// ============================================================
// PurchaseModal
// ============================================================

export function PurchaseModal({
  listing,
  open,
  onClose,
  onConfirm,
  isLoading,
  aethelBalance = 1000,
}: {
  listing: DataListing | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  aethelBalance?: number;
}) {
  if (!listing) return null;
  const cat = getCategoryMeta(listing.category);
  const canAfford = aethelBalance >= listing.price;

  return (
    <Modal open={open} onClose={onClose} title="Confirm Purchase" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: cat.color }}
          >
            {cat.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{listing.title}</p>
            <p className="text-xs text-slate-500">{cat.label}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Price</span>
            <span className="font-semibold text-slate-900">{listing.price.toFixed(2)} AETHEL</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Your Balance</span>
            <span className={`font-semibold ${canAfford ? 'text-emerald-600' : 'text-red-600'}`}>
              {aethelBalance.toFixed(2)} AETHEL
            </span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
            <span className="text-slate-500">Remaining</span>
            <span className="font-semibold text-slate-700">
              {(aethelBalance - listing.price).toFixed(2)} AETHEL
            </span>
          </div>
        </div>

        {!canAfford && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">Insufficient AETHEL balance for this purchase.</p>
          </div>
        )}

        {listing.teeVerified && (
          <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-700">
              This dataset is TEE-verified. Data was anonymized inside a secure enclave.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canAfford || isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Confirm Purchase'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// RevenueChart
// ============================================================

export function RevenueChart({
  data,
}: {
  data: { day: string; revenue: number; transactions: number }[];
}) {
  return (
    <MedicalCard padding={false}>
      <div className="p-5 pb-0">
        <h3 className="text-base font-semibold text-slate-900">Marketplace Revenue</h3>
        <p className="text-xs text-slate-400 mt-0.5">AETHEL volume over 30 days</p>
      </div>
      <div className="px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B1538" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8B1538" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={6} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip formatValue={(v) => `${v} AETHEL`} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#8B1538"
              fill="url(#revenueGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#8B1538' }}
              name="Revenue"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </MedicalCard>
  );
}
