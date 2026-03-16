/**
 * Shiora on Aethelred — Settings Page
 *
 * Comprehensive settings with tabs for Profile, Security, Privacy,
 * Notifications, Connected Apps, Data Export, and Network configuration.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Settings, User, Shield, Eye, Bell, Link2, Download, Wifi,
  Camera, Copy, Check, Lock, Smartphone, Monitor, Globe,
  Key, QrCode, Trash2, AlertTriangle, CheckCircle,
  Mail, BellRing, BellOff, Clock, ToggleLeft, ToggleRight,
  Building2, Unplug, FileJson, FileSpreadsheet, Database,
  Server, Cpu, ShieldCheck, ExternalLink, ChevronRight,
  LogOut, HardDrive, Fingerprint, History,
} from 'lucide-react';

import { useApp } from '@/contexts/AppContext';
import { TopNav, Footer, ToastContainer, SearchOverlay, Badge, Tabs, Modal, ConfirmDialog } from '@/components/ui/SharedComponents';
import { MedicalCard, SectionHeader, TruncatedHash, CopyButton } from '@/components/ui/PagePrimitives';
import { PROVIDER_NAMES, TEE_PLATFORMS } from '@/lib/constants';
import { truncateAddress } from '@/lib/utils';

// ============================================================
// Settings Tab Definitions
// ============================================================

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'connected', label: 'Connected Apps' },
  { id: 'export', label: 'Data Export' },
  { id: 'network', label: 'Network' },
];

// ============================================================
// Form input components
// ============================================================

function FormField({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-900">
        {label}
      </label>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      {children}
    </div>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  pattern,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  pattern?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      pattern={pattern}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 transition-colors"
    />
  );
}

function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none transition-colors"
    />
  );
}

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-brand-500' : 'bg-slate-200'
        }`}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function SelectInput({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================
// Tab Content Components
// ============================================================

function ProfileTab({ wallet }: { wallet: { connected: boolean; address: string } }) {
  const [name, setName] = useState('Patient User');
  const [email, setEmail] = useState('patient@shiora.health');
  const [bio, setBio] = useState('Health data sovereign. Privacy advocate.');

  return (
    <div className="space-y-8">
      {/* Avatar Section */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {name.charAt(0).toUpperCase()}
          </div>
          <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors">
            <Camera className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          <p className="text-sm text-slate-500">{email}</p>
          {wallet.connected && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-mono text-slate-400">
                {truncateAddress(wallet.address, 8, 4)}
              </span>
              <CopyButton text={wallet.address} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Profile Form */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-5">Personal Information</h4>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Display Name" htmlFor="name">
              <TextInput id="name" value={name} onChange={setName} placeholder="Your name" />
            </FormField>
            <FormField label="Email Address" htmlFor="email">
              <TextInput id="email" value={email} onChange={setEmail} type="email" placeholder="name@example.com" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" />
            </FormField>
          </div>
          <FormField label="Bio" description="A brief description shown on your profile" htmlFor="bio">
            <TextArea id="bio" value={bio} onChange={setBio} placeholder="Tell us about yourself..." />
          </FormField>
        </div>
      </MedicalCard>

      {/* Wallet Address */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-3">Wallet Address</h4>
        <p className="text-xs text-slate-500 mb-4">Your blockchain identity on the Aethelred network</p>
        {wallet.connected ? (
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-slate-700 break-all">{wallet.address}</span>
              <CopyButton text={wallet.address} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="success" dot>Connected</Badge>
              <Badge variant="info">Aethelred Mainnet</Badge>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            No wallet connected. Connect your wallet to enable blockchain features.
          </div>
        )}
      </MedicalCard>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
          Save Changes
        </button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const mockSessions = [
    { id: '1', device: 'MacBook Pro', browser: 'Chrome 120', location: 'San Francisco, CA', lastActive: 'Active now', current: true },
    { id: '2', device: 'iPhone 15', browser: 'Safari Mobile', location: 'San Francisco, CA', lastActive: '2 hours ago', current: false },
    { id: '3', device: 'Windows PC', browser: 'Firefox 121', location: 'New York, NY', lastActive: '3 days ago', current: false },
  ];

  return (
    <div className="space-y-8">
      {/* 2FA Setup */}
      <MedicalCard>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-base font-semibold text-slate-900">Two-Factor Authentication</h4>
            <p className="text-xs text-slate-500 mt-1">Add an extra layer of security to your account</p>
          </div>
          <Badge variant={twoFactorEnabled ? 'success' : 'warning'} dot>
            {twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        {twoFactorEnabled ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-900">2FA is active</p>
              <p className="text-xs text-emerald-700 mt-0.5">Your account is protected with authenticator app verification.</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShow2FAModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Set Up Two-Factor Authentication
          </button>
        )}
      </MedicalCard>

      {/* Password Change */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-5">Change Password</h4>
        <div className="space-y-4">
          <FormField label="Current Password" htmlFor="current-password">
            <TextInput id="current-password" value={currentPassword} onChange={setCurrentPassword} type="password" placeholder="Enter current password" />
          </FormField>
          <FormField label="New Password" htmlFor="new-password">
            <TextInput id="new-password" value={newPassword} onChange={setNewPassword} type="password" placeholder="Enter new password" />
          </FormField>
          <FormField label="Confirm New Password" htmlFor="confirm-password">
            <TextInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Confirm new password" />
          </FormField>
          <div className="flex justify-end">
            <button className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors">
              Update Password
            </button>
          </div>
        </div>
      </MedicalCard>

      {/* Session Management */}
      <MedicalCard padding={false}>
        <div className="p-5 pb-3">
          <h4 className="text-base font-semibold text-slate-900">Active Sessions</h4>
          <p className="text-xs text-slate-500 mt-1">Manage your active login sessions across devices</p>
        </div>
        <div className="divide-y divide-slate-100">
          {mockSessions.map((session) => (
            <div key={session.id} className="px-5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                {session.device.includes('iPhone') ? (
                  <Smartphone className="w-5 h-5 text-slate-500" />
                ) : (
                  <Monitor className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{session.device}</p>
                  {session.current && <Badge variant="success">Current</Badge>}
                </div>
                <p className="text-xs text-slate-500">{session.browser} &middot; {session.location}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400">{session.lastActive}</span>
                {!session.current && (
                  <button className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </MedicalCard>

      {/* 2FA Modal */}
      <Modal open={show2FAModal} onClose={() => setShow2FAModal(false)} title="Set Up 2FA" size="sm">
        <div className="text-center space-y-4">
          <div className="w-48 h-48 mx-auto bg-slate-100 rounded-xl flex items-center justify-center">
            <QrCode className="w-24 h-24 text-slate-300" />
          </div>
          <p className="text-sm text-slate-600">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-1">Manual entry key</p>
            <p className="font-mono text-sm text-slate-700 select-all">JBSWY3DPEHPK3PXP</p>
          </div>
          <FormField label="Verification Code" htmlFor="2fa-code">
            <TextInput id="2fa-code" value="" onChange={() => {}} placeholder="Enter 6-digit code" pattern="[0-9]{6}" />
          </FormField>
          <button
            onClick={() => { setTwoFactorEnabled(true); setShow2FAModal(false); }}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Enable 2FA
          </button>
        </div>
      </Modal>
    </div>
  );
}

function PrivacyTab() {
  const [shareAnalytics, setShareAnalytics] = useState(false);
  const [shareUsageData, setShareUsageData] = useState(false);
  const [shareCrashReports, setShareCrashReports] = useState(true);
  const [essentialCookies] = useState(true);
  const [analyticsCookies, setAnalyticsCookies] = useState(false);
  const [marketingCookies, setMarketingCookies] = useState(false);
  const [shareWithProviders, setShareWithProviders] = useState(true);
  const [shareWithResearch, setShareWithResearch] = useState(false);

  return (
    <div className="space-y-8">
      {/* Data Sharing */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">Data Sharing Preferences</h4>
        <p className="text-xs text-slate-500 mb-4">Control how your health data is shared and used</p>
        <div className="divide-y divide-slate-100">
          <Toggle
            enabled={shareWithProviders}
            onChange={setShareWithProviders}
            label="Share with Healthcare Providers"
            description="Allow authorized providers to access your health records within TEE enclaves"
          />
          <Toggle
            enabled={shareWithResearch}
            onChange={setShareWithResearch}
            label="Anonymous Research Contribution"
            description="Contribute anonymized health data to medical research (fully de-identified within TEE)"
          />
        </div>
      </MedicalCard>

      {/* Analytics */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">Analytics & Usage</h4>
        <p className="text-xs text-slate-500 mb-4">Help us improve Shiora by sharing usage information</p>
        <div className="divide-y divide-slate-100">
          <Toggle
            enabled={shareAnalytics}
            onChange={setShareAnalytics}
            label="Analytics Data"
            description="Share anonymous usage analytics to help improve the platform"
          />
          <Toggle
            enabled={shareUsageData}
            onChange={setShareUsageData}
            label="Feature Usage Data"
            description="Share which features you use to help prioritize development"
          />
          <Toggle
            enabled={shareCrashReports}
            onChange={setShareCrashReports}
            label="Crash Reports"
            description="Automatically send crash reports to help fix bugs"
          />
        </div>
      </MedicalCard>

      {/* Cookie Settings */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">Cookie Preferences</h4>
        <p className="text-xs text-slate-500 mb-4">Manage cookie settings for your browsing experience</p>
        <div className="divide-y divide-slate-100">
          <Toggle
            enabled={essentialCookies}
            onChange={() => {}}
            label="Essential Cookies"
            description="Required for core functionality (cannot be disabled)"
          />
          <Toggle
            enabled={analyticsCookies}
            onChange={setAnalyticsCookies}
            label="Analytics Cookies"
            description="Help us understand how you interact with the platform"
          />
          <Toggle
            enabled={marketingCookies}
            onChange={setMarketingCookies}
            label="Marketing Cookies"
            description="Used for targeted advertising and personalization"
          />
        </div>
      </MedicalCard>

      {/* Privacy Notice */}
      <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-900">Your Privacy Matters</p>
            <p className="text-xs text-brand-700 mt-1">
              All health data is encrypted end-to-end with AES-256-GCM. AI inference happens exclusively inside TEE enclaves.
              Your data never leaves the enclave unencrypted. We are fully HIPAA compliant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [accessAlerts, setAccessAlerts] = useState(true);
  const [recordUploads, setRecordUploads] = useState(true);
  const [insightReady, setInsightReady] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [frequency, setFrequency] = useState('realtime');

  return (
    <div className="space-y-8">
      {/* Notification Channels */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">Notification Channels</h4>
        <p className="text-xs text-slate-500 mb-4">Choose how you want to receive notifications</p>
        <div className="divide-y divide-slate-100">
          <Toggle
            enabled={emailNotifications}
            onChange={setEmailNotifications}
            label="Email Notifications"
            description="Receive notifications via email"
          />
          <Toggle
            enabled={pushNotifications}
            onChange={setPushNotifications}
            label="Push Notifications"
            description="Receive notifications in your browser"
          />
        </div>
      </MedicalCard>

      {/* Notification Frequency */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-3">Notification Frequency</h4>
        <FormField label="How often should we send notification digests?" htmlFor="frequency">
          <SelectInput
            id="frequency"
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: 'realtime', label: 'Real-time (as they happen)' },
              { value: 'hourly', label: 'Hourly digest' },
              { value: 'daily', label: 'Daily digest' },
              { value: 'weekly', label: 'Weekly digest' },
            ]}
          />
        </FormField>
      </MedicalCard>

      {/* Notification Types */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">Notification Types</h4>
        <p className="text-xs text-slate-500 mb-4">Choose which events trigger notifications</p>
        <div className="divide-y divide-slate-100">
          <Toggle
            enabled={accessAlerts}
            onChange={setAccessAlerts}
            label="Access Alerts"
            description="When a provider accesses your health data"
          />
          <Toggle
            enabled={recordUploads}
            onChange={setRecordUploads}
            label="Record Upload Confirmations"
            description="When a health record is successfully uploaded and encrypted"
          />
          <Toggle
            enabled={insightReady}
            onChange={setInsightReady}
            label="AI Insight Ready"
            description="When a new AI insight is available from TEE analysis"
          />
          <Toggle
            enabled={weeklyDigest}
            onChange={setWeeklyDigest}
            label="Weekly Health Summary"
            description="Weekly digest of your health data and insights"
          />
          <Toggle
            enabled={securityAlerts}
            onChange={setSecurityAlerts}
            label="Security Alerts"
            description="Unusual login activity or security-related events"
          />
          <Toggle
            enabled={marketingEmails}
            onChange={setMarketingEmails}
            label="Product Updates"
            description="New features, improvements, and platform news"
          />
        </div>
      </MedicalCard>
    </div>
  );
}

function ConnectedAppsTab() {
  const connectedApps = [
    { id: '1', name: 'Dr. Sarah Chen, OB-GYN', type: 'Healthcare Provider', status: 'Connected', connectedAt: 'Mar 2, 2026', icon: Building2, color: 'bg-brand-50 text-brand-600' },
    { id: '2', name: 'Metro Women\'s Health', type: 'Healthcare System', status: 'Connected', connectedAt: 'Feb 15, 2026', icon: Building2, color: 'bg-emerald-50 text-emerald-600' },
    { id: '3', name: 'Apple Health', type: 'Fitness Tracker', status: 'Connected', connectedAt: 'Jan 10, 2026', icon: HardDrive, color: 'bg-slate-100 text-slate-600' },
    { id: '4', name: 'Fitbit', type: 'Wearable Device', status: 'Disconnected', connectedAt: 'Dec 5, 2025', icon: HardDrive, color: 'bg-violet-50 text-violet-600' },
    { id: '5', name: 'MyFitnessPal', type: 'Nutrition Tracker', status: 'Connected', connectedAt: 'Nov 20, 2025', icon: HardDrive, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-8">
      <MedicalCard padding={false}>
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Connected Applications</h4>
              <p className="text-xs text-slate-500 mt-1">Manage healthcare providers and apps connected to your Shiora account</p>
            </div>
            <button className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
              Connect App
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {connectedApps.map((app) => {
            const Icon = app.icon;
            return (
              <div key={app.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div className={`w-11 h-11 rounded-xl ${app.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-semibold text-slate-900">{app.name}</h5>
                    <Badge variant={app.status === 'Connected' ? 'success' : 'neutral'} dot>
                      {app.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{app.type} &middot; Connected {app.connectedAt}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {app.status === 'Connected' ? (
                    <>
                      <button className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        Manage
                      </button>
                      <button className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button className="px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </MedicalCard>

      {/* Security Info */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-900">Secure Connections</p>
            <p className="text-xs text-emerald-700 mt-1">
              All app connections use end-to-end encryption. Provider access is controlled through
              blockchain-verified smart contracts and enforced by TEE enclaves.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataExportTab() {
  const [exportFormat, setExportFormat] = useState('json');
  const [exportStarted, setExportStarted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="space-y-8">
      {/* Export Health Data */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">Export Health Data</h4>
        <p className="text-xs text-slate-500 mb-5">Download all your health records in a portable format</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <button
            onClick={() => setExportFormat('json')}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${
              exportFormat === 'json'
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <FileJson className={`w-5 h-5 ${exportFormat === 'json' ? 'text-brand-600' : 'text-slate-400'}`} />
              <span className="text-sm font-semibold text-slate-900">JSON Format</span>
            </div>
            <p className="text-xs text-slate-500">Structured data format compatible with most health platforms and FHIR standard</p>
          </button>

          <button
            onClick={() => setExportFormat('csv')}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${
              exportFormat === 'csv'
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <FileSpreadsheet className={`w-5 h-5 ${exportFormat === 'csv' ? 'text-brand-600' : 'text-slate-400'}`} />
              <span className="text-sm font-semibold text-slate-900">CSV Format</span>
            </div>
            <p className="text-xs text-slate-500">Spreadsheet-compatible format for analysis in Excel, Google Sheets, or R</p>
          </button>
        </div>

        <button
          onClick={() => setExportStarted(true)}
          disabled={exportStarted}
          className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {exportStarted ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin" />
              Preparing Export...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Export as {exportFormat.toUpperCase()}
            </span>
          )}
        </button>
      </MedicalCard>

      {/* Data Statistics */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-4">Data Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">147</p>
            <p className="text-xs text-slate-500">Total Records</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">2.4 GB</p>
            <p className="text-xs text-slate-500">Storage Used</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">47</p>
            <p className="text-xs text-slate-500">IPFS Nodes</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">100%</p>
            <p className="text-xs text-slate-500">Encrypted</p>
          </div>
        </div>
      </MedicalCard>

      {/* Danger Zone */}
      <MedicalCard className="border-red-200">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-base font-semibold text-red-900">Danger Zone</h4>
            <p className="text-xs text-red-600 mt-0.5">These actions are irreversible. Proceed with extreme caution.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
            <div>
              <p className="text-sm font-medium text-red-900">Delete Account</p>
              <p className="text-xs text-red-600">Permanently delete your account, all health records, and encryption keys</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
            >
              Delete Account
            </button>
          </div>
        </div>
      </MedicalCard>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => setShowDeleteConfirm(false)}
        title="Delete Account?"
        description="This will permanently delete all your health records, encryption keys, and account data. This action cannot be undone."
        confirmLabel="Delete Everything"
        variant="danger"
      />
    </div>
  );
}

function NetworkTab() {
  const [rpcEndpoint, setRpcEndpoint] = useState('https://rpc.aethelred.network');
  const [wsEndpoint, setWsEndpoint] = useState('wss://ws.aethelred.network');
  const [teePlatform, setTeePlatform] = useState('Intel SGX');
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [gasPrice, setGasPrice] = useState('auto');

  return (
    <div className="space-y-8">
      {/* RPC Configuration */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">RPC Endpoint Configuration</h4>
        <p className="text-xs text-slate-500 mb-5">Configure your blockchain node connection</p>
        <div className="space-y-4">
          <FormField label="RPC Endpoint" description="HTTP endpoint for blockchain queries" htmlFor="rpc">
            <TextInput id="rpc" value={rpcEndpoint} onChange={setRpcEndpoint} placeholder="https://rpc.aethelred.network" />
          </FormField>
          <FormField label="WebSocket Endpoint" description="WebSocket endpoint for real-time updates" htmlFor="ws">
            <TextInput id="ws" value={wsEndpoint} onChange={setWsEndpoint} placeholder="wss://ws.aethelred.network" />
          </FormField>
          <FormField label="Gas Price Strategy" htmlFor="gas">
            <SelectInput
              id="gas"
              value={gasPrice}
              onChange={setGasPrice}
              options={[
                { value: 'auto', label: 'Automatic (recommended)' },
                { value: 'low', label: 'Low (slower, cheaper)' },
                { value: 'medium', label: 'Medium (balanced)' },
                { value: 'high', label: 'High (faster, more expensive)' },
              ]}
            />
          </FormField>
        </div>
      </MedicalCard>

      {/* TEE Enclave Preferences */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-1">TEE Enclave Preferences</h4>
        <p className="text-xs text-slate-500 mb-5">Choose your preferred Trusted Execution Environment</p>

        <div className="space-y-3 mb-5">
          {TEE_PLATFORMS.map((platform) => (
            <button
              key={platform}
              onClick={() => setTeePlatform(platform)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors flex items-center justify-between ${
                teePlatform === platform
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Cpu className={`w-5 h-5 ${teePlatform === platform ? 'text-brand-600' : 'text-slate-400'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{platform}</p>
                  <p className="text-xs text-slate-500">
                    {platform === 'Intel SGX' && 'Industry-standard enclave technology with hardware-level isolation'}
                    {platform === 'AWS Nitro' && 'Cloud-native enclaves with AWS integration and scalability'}
                    {platform === 'AMD SEV' && 'Memory encryption technology for virtual machine isolation'}
                  </p>
                </div>
              </div>
              {teePlatform === platform && (
                <CheckCircle className="w-5 h-5 text-brand-500 shrink-0" />
              )}
            </button>
          ))}
        </div>

        <Toggle
          enabled={autoSwitch}
          onChange={setAutoSwitch}
          label="Auto-switch TEE Platform"
          description="Automatically switch to a different TEE platform if the preferred one is unavailable"
        />
      </MedicalCard>

      {/* Network Status */}
      <MedicalCard>
        <h4 className="text-base font-semibold text-slate-900 mb-4">Network Status</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Connection</span>
            <Badge variant="success" dot>Connected</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Chain ID</span>
            <span className="text-sm font-mono font-medium text-slate-900">aethelred-1</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Latency</span>
            <span className="text-sm font-medium text-emerald-600">32ms</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-500">TEE Enclave</span>
            <Badge variant="success" dot>{teePlatform} Active</Badge>
          </div>
        </div>
      </MedicalCard>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
          Save Network Settings
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main Settings Page
// ============================================================

export default function SettingsPage() {
  const { wallet } = useApp();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <>
      <TopNav />
      <SearchOverlay />
      <ToastContainer />

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-6 h-6 text-slate-500" />
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          </div>
          <p className="text-sm text-slate-500 mb-8">
            Manage your account, privacy, security, and platform preferences
          </p>

          {/* Layout: Sidebar Tabs + Content */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Nav (desktop) / Horizontal Tabs (mobile) */}
            <div className="lg:w-56 shrink-0">
              {/* Mobile: horizontal scrolling tabs */}
              <div className="lg:hidden">
                <Tabs tabs={SETTINGS_TABS} activeTab={activeTab} onChange={setActiveTab} />
              </div>

              {/* Desktop: vertical sidebar */}
              <nav className="hidden lg:block space-y-1" aria-label="Settings navigation">
                {SETTINGS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                      activeTab === tab.id
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {tab.id === 'profile' && <User className="w-4 h-4" />}
                    {tab.id === 'security' && <Shield className="w-4 h-4" />}
                    {tab.id === 'privacy' && <Eye className="w-4 h-4" />}
                    {tab.id === 'notifications' && <Bell className="w-4 h-4" />}
                    {tab.id === 'connected' && <Link2 className="w-4 h-4" />}
                    {tab.id === 'export' && <Download className="w-4 h-4" />}
                    {tab.id === 'network' && <Wifi className="w-4 h-4" />}
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              {activeTab === 'profile' && <ProfileTab wallet={wallet} />}
              {activeTab === 'security' && <SecurityTab />}
              {activeTab === 'privacy' && <PrivacyTab />}
              {activeTab === 'notifications' && <NotificationsTab />}
              {activeTab === 'connected' && <ConnectedAppsTab />}
              {activeTab === 'export' && <DataExportTab />}
              {activeTab === 'network' && <NetworkTab />}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
