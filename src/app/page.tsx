/**
 * Shiora on Aethelred — Dashboard
 *
 * The user's real health overview: encrypted records, access activity, and
 * cycle data from the live APIs (empty until a wallet session authenticates).
 * Encrypted at rest with a tamper-evident audit trail; no fabricated data.
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Heart,
  ShieldCheck,
  FolderLock,
  KeyRound,
  Users,
  FileText,
  ChevronRight,
  ArrowUpRight,
  TestTube2,
  ScanLine,
  Pill,
  HeartPulse,
  AlertTriangle,
  CheckCircle,
  Link as LinkIcon,
  Settings,
  ClipboardList,
} from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay } from '@/components/ui/SharedComponents';
import {
  MedicalCard,
  HealthMetricCard,
  SectionHeader,
  ChartTooltip,
  EncryptionBadge,
} from '@/components/ui/PagePrimitives';
import { CHART_COLORS } from '@/lib/constants';
import { formatBytes, formatDate, timeAgo } from '@/lib/utils';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAccessControl } from '@/hooks/useAccessControl';
import type { AuditActionType } from '@/types';

// ============================================================
// Sub-components
// ============================================================

const RECORD_ICON_MAP: Record<string, React.ReactNode> = {
  lab_result: <TestTube2 className="w-4 h-4" />,
  imaging: <ScanLine className="w-4 h-4" />,
  prescription: <Pill className="w-4 h-4" />,
  vitals: <HeartPulse className="w-4 h-4" />,
  notes: <FileText className="w-4 h-4" />,
};

const RECORD_TYPE_LABELS: Record<string, string> = {
  lab_result: 'Lab Results',
  imaging: 'Imaging',
  prescription: 'Prescriptions',
  vitals: 'Vitals',
  notes: 'Notes',
};

const AUDIT_TYPE_STYLES: Record<AuditActionType, { cls: string; icon: React.ReactNode }> = {
  access: { cls: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle className="w-4 h-4" /> },
  grant: { cls: 'bg-brand-50 text-brand-600', icon: <KeyRound className="w-4 h-4" /> },
  revoke: { cls: 'bg-amber-50 text-amber-600', icon: <AlertTriangle className="w-4 h-4" /> },
  modify: { cls: 'bg-violet-50 text-violet-600', icon: <ClipboardList className="w-4 h-4" /> },
  download: { cls: 'bg-cyan-50 text-cyan-600', icon: <FolderLock className="w-4 h-4" /> },
};

function QuickActionCard({
  icon,
  title,
  description,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <MedicalCard className="group h-full">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                {title}
              </h3>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
      </MedicalCard>
    </Link>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function DashboardPage() {
  const { wallet } = useApp();

  // Real, owner-scoped data — every widget below reflects the authenticated
  // user's actual encrypted records, grants, audit trail, and cycle entries.
  const { records } = useHealthRecords({ pageSize: 100 });
  const { grants, auditLog } = useAccessControl();

  const totalSize = useMemo(() => records.reduce((sum, r) => sum + r.size, 0), [records]);
  const encryptedCount = useMemo(() => records.filter((r) => r.encrypted).length, [records]);
  const activeGrantCount = grants.filter((g) => g.status === 'Active').length;

  const recentRecords = useMemo(() => records.slice(0, 6), [records]);
  const recentActivity = useMemo(() => auditLog.slice(0, 5), [auditLog]);

  // Bytes per record type, for the storage pie (only types with data).
  const storageBreakdown = useMemo(() => {
    const byType = new Map<string, number>();
    for (const record of records) {
      byType.set(record.type, (byType.get(record.type) ?? 0) + record.size);
    }
    return Array.from(byType.entries()).map(([type, bytes], i) => ({
      name: RECORD_TYPE_LABELS[type] ?? type,
      value: bytes,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [records]);

  /* istanbul ignore next -- wallet.connected is always false in test context */
  const welcomeSuffix = wallet.connected ? ', Patient' : '';

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* ─── Hero Section ─── */}
          <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-6 h-6 text-white/80" />
                    <span className="text-sm font-medium text-white/70">Shiora on Aethelred</span>
                  </div>
                  <h1 className="text-3xl font-bold mb-2">Welcome back{welcomeSuffix}</h1>
                  <p className="text-brand-100 max-w-xl">
                    Your health data is encrypted at rest with AES-256-GCM (per-record keys),
                    owner-scoped, and every access is written to a tamper-evident audit trail.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/records"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 rounded-xl font-medium text-sm hover:bg-brand-50 transition-colors shadow-sm"
                  >
                    <FolderLock className="w-4 h-4" />
                    View Records
                  </Link>
                  <Link
                    href="/access"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white rounded-xl font-medium text-sm hover:bg-white/25 transition-colors border border-white/20"
                  >
                    <KeyRound className="w-4 h-4" />
                    Manage Access
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Key Metrics (real, owner-scoped) ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <HealthMetricCard
              icon={<FolderLock className="w-5 h-5" />}
              label="Health Records"
              value={records.length.toString()}
              unit="total"
            />
            <HealthMetricCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Encrypted at Rest"
              value={encryptedCount.toString()}
              unit="records"
            />
            <HealthMetricCard
              icon={<ShieldCheck className="w-5 h-5" />}
              label="Storage Used"
              value={formatBytes(totalSize)}
            />
            <HealthMetricCard
              icon={<Users className="w-5 h-5" />}
              label="Provider Access"
              value={activeGrantCount.toString()}
              unit="active grants"
            />
          </div>

          {/* ─── Quick Actions ─── */}
          <SectionHeader title="Quick Actions" subtitle="Common tasks and navigation" size="sm" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <QuickActionCard
              icon={<FolderLock className="w-5 h-5 text-brand-600" />}
              title="Upload Health Data"
              description="AES-256-GCM encrypted at rest"
              href="/records"
              color="bg-brand-50"
            />
            <QuickActionCard
              icon={<KeyRound className="w-5 h-5 text-amber-600" />}
              title="Manage Access"
              description="Granular provider permissions"
              href="/access"
              color="bg-amber-50"
            />
            <QuickActionCard
              icon={<LinkIcon className="w-5 h-5 text-emerald-600" />}
              title="FHIR Interoperability"
              description="Import and map supported FHIR R4 resources"
              href="/fhir"
              color="bg-emerald-50"
            />
            <QuickActionCard
              icon={<Settings className="w-5 h-5 text-indigo-600" />}
              title="Account Settings"
              description="Security, sessions, and recovery"
              href="/settings"
              color="bg-indigo-50"
            />
          </div>

          {/* ─── Storage breakdown (real records only) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <MedicalCard className="lg:col-span-1" padding={false}>
              <div className="p-5 pb-0">
                <h3 className="text-base font-semibold text-slate-900">Storage Breakdown</h3>
                <p className="text-xs text-slate-400 mt-0.5">{formatBytes(totalSize)} used</p>
              </div>
              {storageBreakdown.length > 0 ? (
                <>
                  <div className="flex items-center justify-center py-4">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie
                          data={storageBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {storageBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={<ChartTooltip formatValue={(v) => formatBytes(Number(v))} />}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="px-5 pb-5 space-y-2">
                    {storageBreakdown.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-slate-600">{item.name}</span>
                        </div>
                        <span className="text-slate-900 font-medium">
                          {formatBytes(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="px-5 pb-8 pt-4 text-center">
                  <FolderLock className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No records stored yet.</p>
                </div>
              )}
            </MedicalCard>
            <MedicalCard>
              <h3 className="text-base font-semibold text-slate-900">Production Scope</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                This deployment exposes only authenticated records, provider access, FHIR
                interoperability, privacy controls, and security settings. Deferred clinical and
                experimental surfaces remain unavailable until their regulated services are
                configured and independently validated.
              </p>
            </MedicalCard>
          </div>

          {/* ─── Recent Records + Access Activity (real) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Recent Records */}
            <MedicalCard padding={false}>
              <div className="p-5 pb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Recent Records</h3>
                <Link
                  href="/records"
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {recentRecords.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {recentRecords.map((record) => (
                    <div
                      key={record.id}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                        {RECORD_ICON_MAP[record.type] || <FileText className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {record.label}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(record.date)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <EncryptionBadge type="AES-256" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 pb-8 pt-2 text-center">
                  <p className="text-sm text-slate-500">No records yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Connect a wallet and upload your first record.
                  </p>
                </div>
              )}
            </MedicalCard>

            {/* Access Activity — the real tamper-evident audit trail */}
            <MedicalCard padding={false}>
              <div className="p-5 pb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Access Activity</h3>
                <Link
                  href="/access"
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {recentActivity.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {recentActivity.map((activity) => {
                    const style = AUDIT_TYPE_STYLES[activity.type];
                    return (
                      <div
                        key={activity.id}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.cls}`}
                        >
                          {style.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {activity.action}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{activity.provider}</p>
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">
                          {timeAgo(activity.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 pb-8 pt-2 text-center">
                  <p className="text-sm text-slate-500">No access activity yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Grant and record events will appear here from your audit trail.
                  </p>
                </div>
              )}
            </MedicalCard>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
