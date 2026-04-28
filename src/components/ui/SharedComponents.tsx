'use client';

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  X,
  Search,
  ChevronDown,
  Bell,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  Shield,
  Activity,
  Heart,
  Menu,
  Home,
  FolderLock,
  Brain,
  KeyRound,
  Settings,
  LayoutDashboard,
  FileHeart,
  MessageSquare,
  Lock,
  Store,
  Vote,
  Watch,
  Link as LinkIcon,
  Users,
  Microscope,
  Stethoscope,
  ShieldCheck,
  Cpu,
  Dna,
  Fingerprint,
  Network,
  Siren,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { WalletConnect } from '@/components/modals/WalletConnect';
import { PRIMARY_NAV_LINKS, SECONDARY_NAV_LINKS, TERTIARY_NAV_LINKS } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';

// ============================================================
// Nav Icon Mapping — Maps icon string names to Lucide components
// ============================================================

const NAV_ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  FileHeart: <FileHeart className="w-4 h-4" />,
  MessageSquare: <MessageSquare className="w-4 h-4" />,
  Lock: <Lock className="w-4 h-4" />,
  Brain: <Brain className="w-4 h-4" />,
  Store: <Store className="w-4 h-4" />,
  Vote: <Vote className="w-4 h-4" />,
  Watch: <Watch className="w-4 h-4" />,
  Link: <LinkIcon className="w-4 h-4" />,
  Bell: <Bell className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  Microscope: <Microscope className="w-4 h-4" />,
  Shield: <Shield className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  FolderLock: <FolderLock className="w-4 h-4" />,
  KeyRound: <KeyRound className="w-4 h-4" />,
  Stethoscope: <Stethoscope className="w-4 h-4" />,
  ShieldCheck: <ShieldCheck className="w-4 h-4" />,
  Cpu: <Cpu className="w-4 h-4" />,
  Dna: <Dna className="w-4 h-4" />,
  Fingerprint: <Fingerprint className="w-4 h-4" />,
  Network: <Network className="w-4 h-4" />,
  Siren: <Siren className="w-4 h-4" />,
};

// ============================================================
// LiveDot — Pulsing status indicator
// ============================================================

export function LiveDot({
  color = 'bg-emerald-500',
  className = '',
}: {
  color?: string;
  className?: string;
}) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`} aria-hidden="true">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}
      />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

// ============================================================
// Badge — Inline status badge
// ============================================================

const BADGE_VARIANTS: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  error: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  info: 'bg-accent-50 text-accent-700 ring-accent-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  medical: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}: {
  children: React.ReactNode;
  variant?: keyof typeof BADGE_VARIANTS;
  dot?: boolean;
  className?: string;
}) {
  const colors = BADGE_VARIANTS[variant] || /* istanbul ignore next */ BADGE_VARIANTS.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${colors} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${variant === 'success' ? 'bg-emerald-500' : variant === 'error' ? 'bg-red-500' : variant === 'warning' ? 'bg-amber-500' : variant === 'info' ? 'bg-accent-500' : variant === 'brand' ? 'bg-brand-500' : variant === 'medical' ? 'bg-violet-500' : 'bg-slate-400'}`}
        />
      )}
      {children}
    </span>
  );
}

// ============================================================
// ProgressRing — Circular progress indicator
// ============================================================

export function ProgressRing({
  value,
  max = 100,
  size = 40,
  strokeWidth = 3,
  color = '#8B1538',
  trackColor = '#e2e8f0',
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference * (1 - progress);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

// ============================================================
// AnimatedNumber — Counting animation for stats
// ============================================================

export function AnimatedNumber({
  value,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (Math.abs(diff) < 0.01) {
      setDisplay(value);
      return;
    }

    const startTime = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + diff * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    prevRef.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {display.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      {suffix}
    </span>
  );
}

// ============================================================
// Tabs — Generic tab component
// ============================================================

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className = '',
}: {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 p-1 bg-slate-100 rounded-xl ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-1.5 text-xs ${activeTab === tab.id ? 'text-brand-600' : 'text-slate-400'}`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Modal — Full-featured modal dialog
// ============================================================

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showClose?: boolean;
}

const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative bg-white rounded-2xl shadow-float border border-slate-200 w-full ${MODAL_SIZES[size]} max-h-[90vh] flex flex-col animate-scale-in`}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div>
              {title && (
                <h3 id="modal-title" className="text-lg font-semibold text-slate-900">
                  {title}
                </h3>
              )}
              {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// ConfirmDialog — Specialized confirmation modal
// ============================================================

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" showClose={false}>
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${variant === 'danger' ? 'bg-red-50' : 'bg-brand-50'}`}
          >
            <AlertTriangle
              className={`w-6 h-6 ${variant === 'danger' ? 'text-red-500' : 'text-brand-600'}`}
            />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        {description && <p className="text-sm text-slate-500 mb-6">{description}</p>}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-brand-500 hover:bg-brand-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Drawer — Side panel overlay
// ============================================================

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export function Drawer({ open, onClose, title, children, width = 'max-w-lg' }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'drawer-title' : undefined}
    >
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative bg-white ${width} w-full h-full shadow-float border-l border-slate-200 flex flex-col animate-slide-in-right overflow-hidden`}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
            <h3 id="drawer-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// ToastContainer — Notification toast stack
// ============================================================

const TOAST_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-accent-500" />,
};

const TOAST_BORDERS: Record<string, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-accent-500',
};

export function ToastContainer() {
  const { notifications, removeNotification } = useApp();

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto bg-white border border-slate-200 ${TOAST_BORDERS[n.type] || /* istanbul ignore next */ ''} border-l-4 rounded-xl p-4 shadow-float animate-slide-up flex gap-3`}
        >
          <div className="shrink-0 mt-0.5">{TOAST_ICONS[n.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{n.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            className="shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SearchOverlay — Command-K search panel
// ============================================================

const SEARCH_ITEMS = [
  // ── Pages (21 total) ──
  {
    label: 'Dashboard',
    href: '/',
    section: 'Pages',
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    label: 'Health Records',
    href: '/records',
    section: 'Pages',
    icon: <FileHeart className="w-4 h-4" />,
  },
  {
    label: 'Health AI Chat',
    href: '/chat',
    section: 'Pages',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    label: 'AI Insights',
    href: '/insights',
    section: 'Pages',
    icon: <Brain className="w-4 h-4" />,
  },
  {
    label: 'Clinical Decision Support',
    href: '/clinical',
    section: 'Pages',
    icon: <Stethoscope className="w-4 h-4" />,
  },
  { label: 'Data Vault', href: '/vault', section: 'Pages', icon: <Lock className="w-4 h-4" /> },
  {
    label: 'Marketplace',
    href: '/marketplace',
    section: 'Pages',
    icon: <Store className="w-4 h-4" />,
  },
  {
    label: 'Governance',
    href: '/governance',
    section: 'Pages',
    icon: <Vote className="w-4 h-4" />,
  },
  {
    label: 'Compliance Center',
    href: '/compliance',
    section: 'Pages',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  {
    label: 'TEE Explorer',
    href: '/tee-explorer',
    section: 'Pages',
    icon: <Cpu className="w-4 h-4" />,
  },
  { label: 'Wearables', href: '/wearables', section: 'Pages', icon: <Watch className="w-4 h-4" /> },
  { label: 'FHIR Bridge', href: '/fhir', section: 'Pages', icon: <LinkIcon className="w-4 h-4" /> },
  { label: 'Alerts', href: '/alerts', section: 'Pages', icon: <Bell className="w-4 h-4" /> },
  { label: 'Community', href: '/community', section: 'Pages', icon: <Users className="w-4 h-4" /> },
  {
    label: 'Research',
    href: '/research',
    section: 'Pages',
    icon: <Microscope className="w-4 h-4" />,
  },
  { label: 'Genomics Lab', href: '/genomics', section: 'Pages', icon: <Dna className="w-4 h-4" /> },
  {
    label: 'Digital Health Twin',
    href: '/twin',
    section: 'Pages',
    icon: <Fingerprint className="w-4 h-4" />,
  },
  { label: 'MPC Lab', href: '/mpc', section: 'Pages', icon: <Network className="w-4 h-4" /> },
  { label: 'Emergency', href: '/emergency', section: 'Pages', icon: <Siren className="w-4 h-4" /> },
  {
    label: 'Access Control',
    href: '/access',
    section: 'Pages',
    icon: <Shield className="w-4 h-4" />,
  },
  {
    label: 'Settings',
    href: '/settings',
    section: 'Pages',
    icon: <Settings className="w-4 h-4" />,
  },
  // ── Actions ──
  {
    label: 'Upload Health Data',
    href: '/records',
    section: 'Actions',
    icon: <FolderLock className="w-4 h-4" />,
  },
  {
    label: 'Explore TEE Attestations',
    href: '/tee-explorer',
    section: 'Actions',
    icon: <Cpu className="w-4 h-4" />,
  },
  {
    label: 'Manage Provider Access',
    href: '/access',
    section: 'Actions',
    icon: <KeyRound className="w-4 h-4" />,
  },
  {
    label: 'Cycle Predictions',
    href: '/insights',
    section: 'Actions',
    icon: <Brain className="w-4 h-4" />,
  },
  {
    label: 'Chat with AI',
    href: '/chat',
    section: 'Actions',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    label: 'Browse Marketplace',
    href: '/marketplace',
    section: 'Actions',
    icon: <Store className="w-4 h-4" />,
  },
  {
    label: 'Vote on Proposals',
    href: '/governance',
    section: 'Actions',
    icon: <Vote className="w-4 h-4" />,
  },
  {
    label: 'Check Drug Interactions',
    href: '/clinical',
    section: 'Actions',
    icon: <Stethoscope className="w-4 h-4" />,
  },
  {
    label: 'Run Twin Simulation',
    href: '/twin',
    section: 'Actions',
    icon: <Fingerprint className="w-4 h-4" />,
  },
  {
    label: 'View Compliance Report',
    href: '/compliance',
    section: 'Actions',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  {
    label: 'Emergency Card',
    href: '/emergency',
    section: 'Actions',
    icon: <Siren className="w-4 h-4" />,
  },
  {
    label: 'Genomic Profile',
    href: '/genomics',
    section: 'Actions',
    icon: <Dna className="w-4 h-4" />,
  },
];

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen, setSearchOpen]);

  if (!searchOpen) return null;

  const filtered = query
    ? SEARCH_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : SEARCH_ITEMS;

  const sections = Array.from(new Set(filtered.map((i) => i.section)));

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center pt-[20vh]"
      role="search"
      aria-label="Site search"
    >
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={() => setSearchOpen(false)}
      />
      <div className="relative bg-white rounded-2xl shadow-float border border-slate-200 w-full max-w-lg animate-scale-in overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions..."
            className="w-full py-3.5 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-slate-400 bg-slate-100 border border-slate-200 rounded">
            esc
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No results found</p>
          )}
          {sections.map((section) => (
            <div key={section}>
              <p className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
                {section}
              </p>
              {filtered
                .filter((i) => i.section === section)
                .map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors text-sm"
                  >
                    <span className="text-slate-400">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TopNav — Primary navigation bar
// ============================================================

function ShioraLogo() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="text-lg font-extrabold tracking-wider text-brand-500 uppercase"
        style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '0.08em' }}
      >
        SHIORA
      </span>
      <span className="w-2 h-2 rounded-full bg-accent-500" />
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { realTime, setSearchOpen } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const platformMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Close Platform dropdown when clicking outside
  useEffect(() => {
    if (!platformMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (platformMenuRef.current && !platformMenuRef.current.contains(e.target as Node)) {
        setPlatformMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [platformMenuOpen]);

  // Close More dropdown when clicking outside
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  const isSecondaryActive = SECONDARY_NAV_LINKS.some((link) => isActive(link.href));
  const isTertiaryActive = TERTIARY_NAV_LINKS.some((link) => isActive(link.href));
  /* istanbul ignore next -- only active when on tertiary route; test render is always at '/' */
  const moreButtonClass = isTertiaryActive
    ? 'text-brand-600 bg-brand-50'
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50';

  return (
    <nav
      className="sticky top-0 z-40 bg-surface-50/95 backdrop-blur-xl border-b border-surface-200"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center shrink-0">
              <ShioraLogo />
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {PRIMARY_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive(link.href)
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-slate-400">{NAV_ICON_MAP[link.icon]}</span>
                  {link.label}
                  {isActive(link.href) && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-brand-500 rounded-full" />
                  )}
                </Link>
              ))}

              {/* Platform dropdown */}
              <div className="relative" ref={platformMenuRef}>
                <button
                  onClick={() => {
                    setPlatformMenuOpen(!platformMenuOpen);
                    setMoreMenuOpen(false);
                  }}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    /* istanbul ignore next -- active styling depends on current route */
                    isSecondaryActive
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Platform
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${platformMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {platformMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-float p-2 w-52 animate-scale-in">
                    {SECONDARY_NAV_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setPlatformMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          /* istanbul ignore next -- active styling depends on current route */
                          isActive(link.href)
                            ? 'text-brand-600 bg-brand-50 font-medium'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-slate-400">{NAV_ICON_MAP[link.icon]}</span>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* More dropdown */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => {
                    setMoreMenuOpen(!moreMenuOpen);
                    setPlatformMenuOpen(false);
                  }}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${moreButtonClass}`}
                >
                  More
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {moreMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-float p-2 w-52 max-h-80 overflow-y-auto animate-scale-in">
                    {TERTIARY_NAV_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMoreMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          /* istanbul ignore next -- active styling depends on current route */
                          isActive(link.href)
                            ? 'text-brand-600 bg-brand-50 font-medium'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-slate-400">{NAV_ICON_MAP[link.icon]}</span>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Block height */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
              <LiveDot color="bg-emerald-500" />
              <span className="text-slate-500">Block</span>
              <span className="font-mono font-medium text-slate-700">
                {formatNumber(realTime.blockHeight)}
              </span>
            </div>

            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              aria-label="Search"
            >
              <Search className="w-4.5 h-4.5" />
            </button>

            {/* Wallet */}
            <WalletConnect />

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white animate-slide-down max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {[...PRIMARY_NAV_LINKS, ...SECONDARY_NAV_LINKS].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-slate-400">{NAV_ICON_MAP[link.icon]}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

// ============================================================
// Footer — Site footer
// ============================================================

export function Footer() {
  const { realTime } = useApp();

  const sections = [
    {
      title: 'Platform',
      links: [
        { label: 'Dashboard', href: '/' },
        { label: 'Health Records', href: '/records' },
        { label: 'AI Insights', href: '/insights' },
        { label: 'Access Control', href: '/access' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '#' },
        { label: 'API Reference', href: '#' },
        { label: 'TEE Verification', href: '#' },
        { label: 'Smart Contracts', href: '#' },
      ],
    },
    {
      title: 'Privacy & Security',
      links: [
        { label: 'HIPAA Compliance', href: '#' },
        { label: 'Encryption Guide', href: '#' },
        { label: 'Audit Reports', href: '#' },
        { label: 'Bug Bounty', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Terms of Service', href: '#' },
        { label: 'Privacy Policy', href: '#' },
        { label: 'Cookie Policy', href: '#' },
        { label: 'Disclaimer', href: '#' },
      ],
    },
  ];

  return (
    <footer className="bg-surface-50 border-t border-surface-200 mt-auto" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12">
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-brand-600 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShioraLogo />
            <div>
              <span className="text-sm font-semibold text-slate-900">Shiora</span>
              <span className="text-xs text-slate-400 ml-2">on Aethelred</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <LiveDot color="bg-emerald-500" />
              <span>Network Operational</span>
            </div>
            <span>|</span>
            <span>Epoch {realTime.epoch}</span>
            <span>|</span>
            <span>{formatNumber(realTime.tps)} TPS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
