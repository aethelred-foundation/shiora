/**
 * Shiora on Aethelred — Health Data Marketplace Page
 *
 * Browse, list, purchase, and analyze anonymized health data
 * on the Aethelred blockchain with TEE verification.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Store, Search, Filter, Plus, Download,
  ShoppingCart, TrendingUp, BarChart3,
  Calendar, Heart, TestTube2, HeartPulse,
  Watch, ScanLine, ClipboardCheck, Pill,
  Database, Tag,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs } from '@/components/ui/SharedComponents';
import { MedicalCard, SectionHeader, StatusBadge, HealthMetricCard, ChartTooltip } from '@/components/ui/PagePrimitives';
import {
  DataListingCard,
  MarketplaceStatsBar,
  PurchaseModal,
  RevenueChart,
  QualityScoreBadge,
} from '@/components/marketplace/MarketplaceComponents';
import { useMarketplace } from '@/hooks/useMarketplace';
import { MARKETPLACE_CATEGORIES, CHART_COLORS, EXTENDED_STATUS_STYLES, BRAND } from '@/lib/constants';
import { formatNumber, formatDate, truncateAddress, seededRandom, seededInt } from '@/lib/utils';
import type { DataListing, MarketplaceCategory } from '@/types';

// ============================================================
// Constants
// ============================================================

const SEED = 910;

const TAB_ITEMS = [
  { id: 'browse', label: 'Browse' },
  { id: 'my-listings', label: 'My Listings' },
  { id: 'my-purchases', label: 'My Purchases' },
  { id: 'analytics', label: 'Analytics' },
];

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

// ============================================================
// Helpers
// ============================================================

function generateCategoryVolume() {
  return MARKETPLACE_CATEGORIES.map((cat, i) => ({
    name: cat.label.replace(/ /g, '\n'),
    shortName: cat.label.split(' ')[0],
    volume: seededInt(SEED + i * 7, 500, 5000),
    color: cat.color,
  }));
}

function generateCategoryDistribution() {
  return MARKETPLACE_CATEGORIES.map((cat, i) => ({
    name: cat.label,
    value: seededInt(SEED + 100 + i * 5, 5, 25),
    color: cat.color,
  }));
}

// ============================================================
// Main Page
// ============================================================

export default function MarketplacePage() {
  const { wallet } = useApp();
  const marketplace = useMarketplace();

  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | undefined>();
  const [minQuality, setMinQuality] = useState<number | undefined>();
  const [purchaseTarget, setPurchaseTarget] = useState<DataListing | null>(null);

  const categoryVolume = useMemo(() => generateCategoryVolume(), []);
  const categoryDistribution = useMemo(() => generateCategoryDistribution(), []);

  // ---- Filter handlers ----
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    marketplace.setSearch(q);
  };

  const handleCategoryFilter = (cat: MarketplaceCategory | undefined) => {
    setSelectedCategory(cat);
    marketplace.setCategoryFilter(cat);
  };

  const handleQualityFilter = (min: number | undefined) => {
    setMinQuality(min);
    marketplace.setQualityFilter(min);
  };

  // ---- Derived data ----
  const myListings = marketplace.listings.filter(
    (l) => l.seller === wallet.address || true, // Show all in mock mode
  ).slice(0, 6);

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ---- Header ---- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Store className="w-6 h-6 text-brand-600" />
                <h1 className="text-2xl font-bold text-slate-900">Health Data Marketplace</h1>
              </div>
              <p className="text-sm text-slate-500">
                Buy and sell anonymized, TEE-verified health datasets on the Aethelred blockchain
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Create Listing
            </button>
          </div>

          {/* ---- Stats Bar ---- */}
          {marketplace.stats && (
            <div className="mb-8">
              <MarketplaceStatsBar stats={marketplace.stats} />
            </div>
          )}

          {/* ---- Tabs ---- */}
          <Tabs tabs={TAB_ITEMS} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

          {/* ============================================================ */}
          {/* Browse Tab */}
          {/* ============================================================ */}
          {activeTab === 'browse' && (
            <>
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search datasets..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={selectedCategory ?? ''}
                  onChange={(e) => handleCategoryFilter(e.target.value ? e.target.value as MarketplaceCategory : undefined)}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All Categories</option>
                  {MARKETPLACE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
                <select
                  value={minQuality ?? ''}
                  onChange={(e) => handleQualityFilter(e.target.value ? Number(e.target.value) : undefined)}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Any Quality</option>
                  <option value="90">90+ Excellent</option>
                  <option value="75">75+ Good</option>
                  <option value="60">60+ Fair</option>
                </select>
              </div>

              {/* Listings Grid */}
              {marketplace.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton rounded-2xl h-72 border border-slate-200" />
                  ))}
                </div>
              ) : marketplace.listings.length === 0 ? (
                <MedicalCard>
                  <div className="text-center py-12">
                    <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No listings found</h3>
                    <p className="text-sm text-slate-500">Try adjusting your filters or search query</p>
                  </div>
                </MedicalCard>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {marketplace.listings.map((listing) => (
                    <DataListingCard
                      key={listing.id}
                      listing={listing}
                      onPurchase={(id) => {
                        const target = marketplace.listings.find((l) => l.id === id);
                        if (target) setPurchaseTarget(target);
                      }}
                    />
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-400 mt-4 text-center">
                Showing {marketplace.listings.length} listings
              </p>
            </>
          )}

          {/* ============================================================ */}
          {/* My Listings Tab */}
          {/* ============================================================ */}
          {activeTab === 'my-listings' && (
            <>
              <SectionHeader
                title="My Listings"
                subtitle="Datasets you have listed for sale"
                size="sm"
              />
              {myListings.length === 0 ? (
                <MedicalCard>
                  <div className="text-center py-12">
                    <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No listings yet</h3>
                    <p className="text-sm text-slate-500">Create your first listing to start earning AETHEL</p>
                  </div>
                </MedicalCard>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myListings.map((listing) => (
                    <DataListingCard
                      key={listing.id}
                      listing={listing}
                      isOwner
                      onWithdraw={(id) => marketplace.withdraw.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* My Purchases Tab */}
          {/* ============================================================ */}
          {activeTab === 'my-purchases' && (
            <>
              <SectionHeader
                title="My Purchases"
                subtitle="Datasets you have purchased"
                size="sm"
              />
              {marketplace.purchases.length === 0 ? (
                <MedicalCard>
                  <div className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No purchases yet</h3>
                    <p className="text-sm text-slate-500">Browse the marketplace to find datasets</p>
                  </div>
                </MedicalCard>
              ) : (
                <MedicalCard padding={false}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Dataset</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Price</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Purchased</th>
                          <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Downloads</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {marketplace.purchases.map((p) => {
                          const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === p.category);
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-medium text-slate-900 truncate max-w-[200px]">{p.title}</p>
                                <p className="text-xs text-slate-400 font-mono">{truncateAddress(p.txHash, 8, 6)}</p>
                              </td>
                              <td className="px-5 py-3">
                                <Badge variant="medical">{cat?.label ??
                                  /* istanbul ignore next -- cat always found for seeded categories */
                                  p.category}</Badge>
                              </td>
                              <td className="px-5 py-3 font-semibold text-slate-900">{p.price.toFixed(2)} AETHEL</td>
                              <td className="px-5 py-3 text-slate-500">{formatDate(p.purchasedAt)}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-700">{p.downloadCount}</span>
                                  <button className="p-1 rounded hover:bg-slate-100 transition-colors">
                                    <Download className="w-4 h-4 text-brand-600" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </MedicalCard>
              )}
            </>
          )}

          {/* ============================================================ */}
          {/* Analytics Tab */}
          {/* ============================================================ */}
          {activeTab === 'analytics' && (
            <>
              <SectionHeader
                title="Marketplace Analytics"
                subtitle="Revenue, categories, and volume trends"
                size="sm"
              />

              {/* Revenue Chart */}
              <div className="mb-8">
                <RevenueChart data={marketplace.revenueData} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Categories Pie */}
                <MedicalCard padding={false}>
                  <div className="p-5 pb-0">
                    <h3 className="text-base font-semibold text-slate-900">Category Distribution</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Listings by category</p>
                  </div>
                  <div className="flex items-center justify-center py-4">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={categoryDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip formatValue={(v) => `${v}%`} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="px-5 pb-5 space-y-2">
                    {categoryDistribution.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600 truncate max-w-[150px]">{item.name}</span>
                        </div>
                        <span className="text-slate-900 font-medium">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </MedicalCard>

                {/* Volume Bar Chart */}
                <MedicalCard padding={false}>
                  <div className="p-5 pb-0">
                    <h3 className="text-base font-semibold text-slate-900">Volume by Category</h3>
                    <p className="text-xs text-slate-400 mt-0.5">AETHEL traded per category</p>
                  </div>
                  <div className="px-2 pb-4 pt-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={categoryVolume} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="shortName" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip formatValue={(v) => `${v} AETHEL`} />} />
                        <Bar dataKey="volume" radius={[4, 4, 0, 0]} barSize={20} name="Volume">
                          {categoryVolume.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </MedicalCard>
              </div>
            </>
          )}

        </div>
      </main>

      <Footer />

      {/* Purchase Modal */}
      <PurchaseModal
        listing={purchaseTarget}
        open={!!purchaseTarget}
        onClose={() => setPurchaseTarget(null)}
        onConfirm={() => {
          if (purchaseTarget) {
            marketplace.purchase.mutate(purchaseTarget.id);
            setPurchaseTarget(null);
          }
        }}
        isLoading={marketplace.purchase.isLoading}
        aethelBalance={wallet.aethelBalance}
      />
    </>
  );
}
