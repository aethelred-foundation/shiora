'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, Lock, ShieldCheck, TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { BRAND, STATUS_STYLES } from '@/lib/constants';
import { copyToClipboard, formatFullNumber } from '@/lib/utils';

// ============================================================
// MedicalCard — Light-themed card container
// ============================================================

interface MedicalCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: boolean;
}

export function MedicalCard({ children, className = '', hover = true, onClick, padding = true }: MedicalCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-2xl shadow-card ${
        hover ? 'hover:shadow-card-hover hover:border-slate-300 transition-all duration-300' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${padding ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// ============================================================
// CopyButton — Clipboard copy with visual feedback
// ============================================================

interface CopyButtonProps {
  text: string;
  onCopied?: () => void;
  size?: 'sm' | 'md';
  stopPropagation?: boolean;
}

export function CopyButton({ text, onCopied, size = 'sm', stopPropagation = true }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const handleCopy = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    copyToClipboard(text);
    setCopied(true);
    onCopied?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      title="Copy to clipboard"
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className={`${iconSize} text-emerald-500`} />
      ) : (
        <Copy className={`${iconSize} text-slate-400 hover:text-slate-600`} />
      )}
    </button>
  );
}

// ============================================================
// SectionHeader — Consistent section titles with optional action
// ============================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'lg';
  icon?: LucideIcon;
}

export function SectionHeader({ title, subtitle, action, size = 'lg', icon: Icon }: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between ${size === 'lg' ? 'mb-8' : 'mb-6'}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`${size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} text-brand-600`} />}
        <div>
          <h2 className={`font-bold text-slate-900 tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-xl'}`}>
            {title}
          </h2>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ============================================================
// Sparkline — Mini inline chart with hydration safety
// ============================================================

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showGradient?: boolean;
}

export function Sparkline({ data, color = BRAND.sky, height = 32, width = 80, showGradient = false }: SparklineProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <svg width={width} height={height} aria-hidden="true" />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');

  const gradientId = `sparkGrad-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      {showGradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================
// ChartTooltip — Shared recharts custom tooltip (light theme)
// ============================================================

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number | string }>;
  label?: string;
  formatValue?: (value: number | string) => string;
}

export function ChartTooltip({ active, payload, label, formatValue }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmt = formatValue || ((v: number | string) => (typeof v === 'number' ? formatFullNumber(v) : v));
  return (
    <div className="bg-white text-slate-900 px-3 py-2 rounded-lg text-xs shadow-xl border border-slate-200">
      {label && <p className="font-medium mb-1 text-slate-700">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>{' '}
          <span className="font-medium">{fmt(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ============================================================
// StatusBadge — Generic status indicator badge (light theme)
// ============================================================

interface StatusBadgeProps {
  status: string;
  styles?: Record<string, { bg: string; text: string; dot: string }>;
}

export function StatusBadge({ status, styles }: StatusBadgeProps) {
  const styleMap = styles || STATUS_STYLES;
  const s = styleMap[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${(STATUS_STYLES as any)[status]?.border || 'border-slate-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'Active' || status === 'Operational' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
}

// ============================================================
// EncryptionBadge — Shows encryption status
// ============================================================

interface EncryptionBadgeProps {
  type?: string;
  className?: string;
}

export function EncryptionBadge({ type = 'AES-256', className = '' }: EncryptionBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200 ${className}`}>
      <Lock className="w-3 h-3" />
      {type}
    </span>
  );
}

// ============================================================
// TEEBadge — Shows TEE attestation info
// ============================================================

interface TEEBadgeProps {
  platform?: string;
  verified?: boolean;
  className?: string;
}

export function TEEBadge({ platform = 'Intel SGX', verified = true, className = '' }: TEEBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
      verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
    } ${className}`}>
      <ShieldCheck className="w-3 h-3" />
      {platform}{verified ? ' Verified' : ' Pending'}
    </span>
  );
}

// ============================================================
// HealthMetricCard — Specialized card for health metrics
// ============================================================

interface HealthMetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  className?: string;
}

export function HealthMetricCard({
  icon,
  label,
  value,
  unit,
  trend,
  trendLabel,
  sparklineData,
  sparklineColor = BRAND.sky,
  className = '',
}: HealthMetricCardProps) {
  const TrendIcon = trend && trend > 0 ? TrendingUp : trend && trend < 0 ? TrendingDown : Minus;
  const trendColor = trend && trend > 0 ? 'text-emerald-600' : trend && trend < 0 ? 'text-rose-600' : 'text-slate-400';

  return (
    <MedicalCard className={className}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
          {icon}
        </div>
        {sparklineData && (
          <Sparkline data={sparklineData} color={sparklineColor} width={60} height={28} />
        )}
      </div>
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {(trend !== undefined || trendLabel) && (
        <div className="flex items-center gap-1 mt-2">
          <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
          <span className={`text-xs font-medium ${trendColor}`}>
            {trend !== undefined ? `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%` : ''}
          </span>
          {trendLabel && <span className="text-xs text-slate-400 ml-1">{trendLabel}</span>}
        </div>
      )}
    </MedicalCard>
  );
}

// ============================================================
// TruncatedHash — Display truncated hash/address with copy
// ============================================================

interface TruncatedHashProps {
  hash: string;
  startLen?: number;
  endLen?: number;
  className?: string;
}

export function TruncatedHash({ hash, startLen = 10, endLen = 6, className = '' }: TruncatedHashProps) {
  if (!hash) return null;
  const display = hash.length <= startLen + endLen + 3
    ? hash
    : `${hash.slice(0, startLen)}...${hash.slice(-endLen)}`;

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs text-slate-600 ${className}`}>
      {display}
      <CopyButton text={hash} size="sm" />
    </span>
  );
}
