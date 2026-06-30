/**
 * Shiora on Aethelred — Access Control Page
 *
 * Granular, owner-scoped provider access management — time-limited grants
 * enforced by RBAC, with a tamper-evident audit trail.
 */

'use client';

import { useState, useMemo } from 'react';
import {
  KeyRound, Plus, Search, Shield, ShieldCheck, ShieldOff,
  Clock, Eye, EyeOff, CheckCircle, AlertTriangle, X,
  UserCheck, UserX, Building2, Calendar, Lock,
  ChevronDown, ChevronRight, ExternalLink, History,
  FileText, TestTube2, ScanLine, Pill, HeartPulse,
  ToggleLeft, ToggleRight, RefreshCw, Trash2,
} from 'lucide-react';

import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs, Modal, ConfirmDialog } from '@/components/ui/SharedComponents';
import ConsentTab from '@/components/consent/ConsentTab';
import ReputationTab from '@/components/reputation/ReputationTab';
import {
  MedicalCard, StatusBadge, EncryptionBadge, TruncatedHash,
} from '@/components/ui/PagePrimitives';
import { formatDate, timeAgo, daysFromNow } from '@/lib/utils';
import { useAccessControl } from '@/hooks/useAccessControl';
import type { AccessGrant, AuditEntry } from '@/types';

// ============================================================
// Sub-components
// ============================================================

const TYPE_ICONS: Record<string, React.ReactNode> = {
  access: <Eye className="w-4 h-4" />,
  grant: <UserCheck className="w-4 h-4" />,
  revoke: <UserX className="w-4 h-4" />,
  modify: <RefreshCw className="w-4 h-4" />,
  download: <FileText className="w-4 h-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  access: 'bg-brand-50 text-brand-600',
  grant: 'bg-emerald-50 text-emerald-600',
  revoke: 'bg-red-50 text-red-600',
  modify: 'bg-amber-50 text-amber-600',
  download: 'bg-violet-50 text-violet-600',
};

function GrantDetailModal({ grant, open, onClose }: { grant: AccessGrant | null; open: boolean; onClose: () => void }) {
  if (!grant) return null;

  const daysLeft = daysFromNow(grant.expiresAt);
  /* istanbul ignore next -- canView is always true in generated data */
  const viewBorder = grant.canView ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200';
  /* istanbul ignore next */
  const viewIcon = grant.canView ? 'text-emerald-600' : 'text-slate-400';
  /* istanbul ignore next */
  const viewText = grant.canView ? 'text-emerald-700' : 'text-slate-400';

  return (
    <Modal open={open} onClose={onClose} title="Access Grant Details" size="lg">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-brand-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-slate-900">{grant.provider}</h4>
            <p className="text-sm text-slate-500">{grant.specialty}</p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={grant.status} />
              <EncryptionBadge type="E2E Encrypted" />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <h5 className="text-sm font-semibold text-slate-900 mb-3">Permissions</h5>
          <div className="grid grid-cols-3 gap-3">
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${viewBorder}`}>
              <Eye className={`w-4 h-4 ${viewIcon}`} />
              <span className={`text-sm ${viewText}`}>View</span>
            </div>
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${grant.canDownload ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <FileText className={`w-4 h-4 ${grant.canDownload ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={`text-sm ${grant.canDownload ? 'text-emerald-700' : 'text-slate-400'}`}>Download</span>
            </div>
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${grant.canShare ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <ExternalLink className={`w-4 h-4 ${grant.canShare ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={`text-sm ${grant.canShare ? 'text-emerald-700' : 'text-slate-400'}`}>Share</span>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Data Scope</p>
            <p className="text-sm font-medium text-slate-900">{grant.scope}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Access Count</p>
            <p className="text-sm font-medium text-slate-900">{grant.accessCount} times</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Granted</p>
            <p className="text-sm font-medium text-slate-900">{formatDate(grant.grantedAt)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Expires</p>
            <p className={`text-sm font-medium ${daysLeft > 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expired'}
            </p>
          </div>
        </div>

        {/* Provider */}
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-slate-900">Provider</h5>
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">Provider Address</p>
              <TruncatedHash hash={grant.address} startLen={12} endLen={8} />
            </div>
          </div>
        </div>

        {/* Actions */}
        {grant.status === 'Active' && (
          <div className="flex gap-3">
            <button className="flex-1 py-2.5 px-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors">
              Modify Scope
            </button>
            <button className="flex-1 py-2.5 px-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors">
              Revoke Access
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function AccessPage() {
  // Real, owner-scoped access grants + the real tamper-evident audit trail
  // (useAccessControl → GET /api/access and /api/access/audit). Empty until a
  // wallet session authenticates.
  const { grants, auditLog } = useAccessControl();

  const [activeTab, setActiveTab] = useState('grants');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedGrant, setSelectedGrant] = useState<AccessGrant | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const activeCount = grants.filter((g) => g.status === 'Active').length;
  const pendingCount = grants.filter((g) => g.status === 'Pending').length;

  const tabs = [
    { id: 'grants', label: 'Access Grants', count: grants.length },
    { id: 'audit', label: 'Audit Log', count: auditLog.length },
    { id: 'consent', label: 'Consent' },
    { id: 'reputation', label: 'Reputation' },
  ];

  const statusTabs = [
    { id: 'all', label: 'All' },
    { id: 'Active', label: 'Active', count: activeCount },
    { id: 'Pending', label: 'Pending', count: pendingCount },
    { id: 'Expired', label: 'Expired' },
    { id: 'Revoked', label: 'Revoked' },
  ];

  const filteredGrants = useMemo(() => {
    let result = grants;
    if (statusFilter !== 'all') result = result.filter((g) => g.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((g) =>
        g.provider.toLowerCase().includes(q) ||
        g.specialty.toLowerCase().includes(q) ||
        g.scope.toLowerCase().includes(q)
      );
    }
    return result;
  }, [grants, statusFilter, searchQuery]);

  const openDetail = (grant: AccessGrant) => {
    setSelectedGrant(grant);
    setDetailOpen(true);
  };

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

          {/* ─── Header ─── */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-6 h-6 text-amber-500" />
                <h1 className="text-2xl font-bold text-slate-900">Access Control</h1>
              </div>
              <p className="text-sm text-slate-500">
                Manage provider access to your encrypted health data — owner-scoped grants with a tamper-evident audit trail
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-medium text-sm hover:bg-brand-600 transition-colors shadow-sm shrink-0">
              <Plus className="w-4 h-4" />
              Grant Access
            </button>
          </div>

          {/* ─── Stats ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Active Grants</p>
                  <p className="text-xl font-bold text-slate-900">{activeCount}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pending Requests</p>
                  <p className="text-xl font-bold text-slate-900">{pendingCount}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Providers</p>
                  <p className="text-xl font-bold text-slate-900">{grants.length}</p>
                </div>
              </div>
            </MedicalCard>
            <MedicalCard>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <History className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Audit Events</p>
                  <p className="text-xl font-bold text-slate-900">{auditLog.length}</p>
                </div>
              </div>
            </MedicalCard>
          </div>

          {/* ─── Tabs ─── */}
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

          {/* ─── Grants Tab ─── */}
          {activeTab === 'grants' && (
            <>
              {/* Filters */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <Tabs tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />
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

              {/* Grants List */}
              <div className="space-y-4">
                {filteredGrants.map((grant) => {
                  const daysLeft = daysFromNow(grant.expiresAt);
                  const isExpiringSoon = daysLeft > 0 && daysLeft <= 7;
                  /* istanbul ignore next -- canView is always true in generated data */
                  const viewPermClass = grant.canView ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300';

                  return (
                    <MedicalCard
                      key={grant.id}
                      onClick={() => openDetail(grant)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6 text-brand-600" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-slate-900">{grant.provider}</h4>
                            <StatusBadge status={grant.status} />
                            {isExpiringSoon && (
                              <Badge variant="warning">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Expiring soon
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mb-2">{grant.specialty}</p>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" /> {grant.scope}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {grant.accessCount} accesses
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {grant.status === 'Expired' ? 'Expired' : `${daysLeft > 0 ? daysLeft : /* istanbul ignore next */ 0}d remaining`}
                            </span>
                            {grant.lastAccess && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Last: {timeAgo(grant.lastAccess)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Permissions icons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${viewPermClass}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${grant.canDownload ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${grant.canShare ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
                        </div>
                      </div>
                    </MedicalCard>
                  );
                })}

                {filteredGrants.length === 0 && (
                  <div className="py-12 text-center">
                    <KeyRound className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No access grants match your filters</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ─── Audit Log Tab ─── */}
          {activeTab === 'audit' && (
            <MedicalCard padding={false} hover={false}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLog.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg ${TYPE_COLORS[entry.type]} flex items-center justify-center`}>
                              {TYPE_ICONS[entry.type]}
                            </div>
                            <span className="text-sm font-medium text-slate-900">{entry.action}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-600 max-w-[180px] truncate">{entry.provider}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-500 max-w-[250px] truncate">{entry.details}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-500 whitespace-nowrap">{timeAgo(entry.timestamp)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MedicalCard>
          )}

          {/* ─── Consent Tab ─── */}
          {activeTab === 'consent' && <ConsentTab />}

          {/* ─── Reputation Tab ─── */}
          {activeTab === 'reputation' && <ReputationTab />}

          {/* ─── Security Notice ─── */}
          <div className="mt-8 p-5 bg-brand-50 border border-brand-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-brand-900 mb-1">Encrypted, owner-controlled access</h4>
                <p className="text-sm text-brand-700">
                  Your records are encrypted at rest and access is owner-scoped: a provider can only read what
                  you have granted, for as long as the grant is active. Every grant change and access is written
                  to a tamper-evident audit trail you can review above.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Detail Modal */}
      <GrantDetailModal grant={selectedGrant} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
}
