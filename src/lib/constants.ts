// ============================================================
// Shiora on Aethelred — Shared Constants
// Brand colors, chart palettes, and common data
// ============================================================

/** Brand color palette */
export const BRAND = {
  sky: '#8B1538',
  skyDark: '#6E1130',
  skyLight: '#fdf2f4',
  skyGlow: 'rgba(139, 21, 56, 0.15)',
  gold: '#C9A227',
  goldLight: '#fdf9eb',
  cream: '#FFF8F0',
  dark: '#1A1A1A',
} as const;

/** Medical accent colors */
export const MEDICAL = {
  mint: '#10b981',
  coral: '#f43f5e',
  lavender: '#a78bfa',
  peach: '#fb923c',
  sage: '#84cc16',
} as const;

/** Chart color palette for multi-series visualizations */
export const CHART_COLORS = [
  '#8B1538',
  '#C9A227',
  '#10b981',
  '#a78bfa',
  '#f43f5e',
  '#fb923c',
  '#84cc16',
  '#6E1130',
  '#e6b82a',
  '#06b6d4',
] as const;

/** Cycle phase colors for health charts */
export const CYCLE_PHASE_COLORS = {
  menstrual: { fill: '#fecdd3', stroke: '#f43f5e', label: 'Menstrual' },
  follicular: { fill: '#a5f3fc', stroke: '#06b6d4', label: 'Follicular' },
  ovulation: { fill: '#ddd6fe', stroke: '#a78bfa', label: 'Ovulation' },
  luteal: { fill: '#fed7aa', stroke: '#fb923c', label: 'Luteal' },
} as const;

/** AI model metadata */
export const AI_MODELS = [
  {
    id: 'lstm',
    name: 'Cycle LSTM',
    version: 'v2.1',
    type: 'LSTM',
    accuracy: 96.2,
    description: 'Predicts menstrual cycle timing using Long Short-Term Memory neural network',
  },
  {
    id: 'anomaly',
    name: 'Anomaly Detector',
    version: 'v1.4',
    type: 'Isolation Forest',
    accuracy: 93.8,
    description: 'Detects unusual health patterns using Isolation Forest algorithm',
  },
  {
    id: 'fertility',
    name: 'Fertility XGBoost',
    version: 'v1.7',
    type: 'XGBoost',
    accuracy: 91.5,
    description: 'Predicts fertile windows using gradient-boosted decision trees',
  },
  {
    id: 'insights',
    name: 'Health Transformer',
    version: 'v3.0',
    type: 'Transformer',
    accuracy: 94.7,
    description: 'Generates personalized health recommendations using transformer architecture',
  },
] as const;

/** TEE platform options */
export const TEE_PLATFORMS = ['Intel SGX', 'AWS Nitro', 'AMD SEV'] as const;

/** Healthcare provider names */
export const PROVIDER_NAMES = [
  'Dr. Sarah Chen, OB-GYN',
  "Metro Women's Health",
  'Dr. James Liu, Endocrinology',
  'Fertility Clinic of Boston',
  "Stanford Women's Care",
  'Dr. Maria Garcia, Primary Care',
  'Pacific Reproductive Center',
  'Dr. Aisha Patel, Gynecology',
  "Bay Area Women's Health",
  'Dr. Emily Nakamura, Reproductive Med',
] as const;

/** Provider specialties */
export const SPECIALTIES = [
  'OB-GYN',
  'Endocrinology',
  'Reproductive Medicine',
  'Primary Care',
  'Gynecology',
  'Fertility Specialist',
] as const;

/** Health record types */
export const RECORD_TYPES = [
  { id: 'lab_result', label: 'Lab Results', icon: 'TestTube2' },
  { id: 'imaging', label: 'Imaging', icon: 'ScanLine' },
  { id: 'prescription', label: 'Prescriptions', icon: 'Pill' },
  { id: 'vitals', label: 'Vitals', icon: 'HeartPulse' },
  { id: 'notes', label: 'Clinical Notes', icon: 'FileText' },
] as const;

/** Status color mappings for light theme */
export const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Verified: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Active: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Encrypted: {
    bg: 'bg-brand-50',
    text: 'text-brand-700',
    border: 'border-brand-200',
    dot: 'bg-brand-500',
  },
  Processing: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Pinning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Pinned: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Revoked: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  Expired: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  Anomaly: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  Normal: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  High: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  Medium: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Low: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  Operational: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Degraded: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Offline: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
} as const;

/** Data scope options for access grants */
export const DATA_SCOPES = [
  'Full Records',
  'Lab Results Only',
  'Imaging Only',
  'Vitals Only',
  'Prescriptions Only',
  'Clinical Notes Only',
] as const;

/** Navigation links */
export const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/records', label: 'Records' },
  { href: '/insights', label: 'Insights' },
  { href: '/access', label: 'Access' },
  { href: '/settings', label: 'Settings' },
] as const;

/** Consent scope labels */
export const CONSENT_SCOPES = [
  { id: 'cycle_data', label: 'Cycle Data', icon: 'Calendar' },
  { id: 'fertility_markers', label: 'Fertility Markers', icon: 'Heart' },
  { id: 'lab_results', label: 'Lab Results', icon: 'TestTube2' },
  { id: 'imaging', label: 'Imaging', icon: 'ScanLine' },
  { id: 'prescriptions', label: 'Prescriptions', icon: 'Pill' },
  { id: 'vitals', label: 'Vitals', icon: 'HeartPulse' },
  { id: 'clinical_notes', label: 'Clinical Notes', icon: 'FileText' },
  { id: 'wearable_data', label: 'Wearable Data', icon: 'Watch' },
  { id: 'ai_inferences', label: 'AI Inferences', icon: 'Brain' },
  { id: 'full_access', label: 'Full Access', icon: 'Shield' },
] as const;

/** Chat AI suggested prompts */
export const CHAT_SUGGESTED_PROMPTS = [
  {
    id: 'cycle-analysis',
    category: 'Cycle Health',
    prompt: 'Analyze my recent cycle patterns and identify any irregularities',
    icon: 'Calendar',
  },
  {
    id: 'fertility-window',
    category: 'Fertility',
    prompt: 'When is my predicted fertile window this month?',
    icon: 'Heart',
  },
  {
    id: 'lab-interpret',
    category: 'Lab Results',
    prompt: 'Help me understand my latest blood work results',
    icon: 'TestTube2',
  },
  {
    id: 'symptom-check',
    category: 'Symptoms',
    prompt: "I've been experiencing unusual symptoms — what should I know?",
    icon: 'Stethoscope',
  },
  {
    id: 'medication-review',
    category: 'Medications',
    prompt: 'Review my current medications for potential interactions',
    icon: 'Pill',
  },
  {
    id: 'wellness-summary',
    category: 'Wellness',
    prompt: 'Give me a comprehensive wellness summary based on my data',
    icon: 'Activity',
  },
  {
    id: 'drug-interaction',
    category: 'Clinical',
    prompt: 'Check for drug interactions between my current medications',
    icon: 'AlertTriangle',
  },
  {
    id: 'differential-dx',
    category: 'Clinical',
    prompt: 'What conditions could explain these symptoms: fatigue, joint pain, and mild fever?',
    icon: 'Brain',
  },
  {
    id: 'twin-simulation',
    category: 'Digital Twin',
    prompt: 'Run a simulation on my digital twin: what if I increase exercise to 45 min/day?',
    icon: 'Fingerprint',
  },
  {
    id: 'genomic-risk',
    category: 'Genomics',
    prompt: 'Explain my pharmacogenomic results for CYP2D6 and what medications to avoid',
    icon: 'Dna',
  },
  {
    id: 'compliance-check',
    category: 'Compliance',
    prompt: 'What is my current HIPAA compliance status and are there any issues?',
    icon: 'ShieldCheck',
  },
  {
    id: 'triage-assess',
    category: 'Emergency',
    prompt: 'I have chest pain and shortness of breath — help me assess the urgency',
    icon: 'Siren',
  },
] as const;

/** Wearable provider metadata */
export const WEARABLE_PROVIDERS = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: 'Apple',
    color: '#000000',
    metrics: ['heart_rate', 'steps', 'sleep_duration', 'spo2', 'temperature'],
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    icon: 'CircleDot',
    color: '#D4AF37',
    metrics: ['heart_rate', 'hrv', 'temperature', 'sleep_score', 'readiness'],
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    icon: 'Zap',
    color: '#00DC5A',
    metrics: ['heart_rate', 'hrv', 'strain', 'recovery', 'respiratory_rate'],
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: 'Watch',
    color: '#00B0B9',
    metrics: ['heart_rate', 'steps', 'sleep_duration', 'spo2', 'calories'],
  },
  {
    id: 'garmin',
    name: 'Garmin',
    icon: 'Compass',
    color: '#007CC3',
    metrics: ['heart_rate', 'steps', 'spo2', 'respiratory_rate', 'calories'],
  },
] as const;

/** FHIR R4 resource types supported */
export const FHIR_RESOURCE_TYPES = [
  { id: 'Patient', label: 'Patient', icon: 'User', shioraMapping: 'notes' },
  { id: 'Observation', label: 'Observation', icon: 'Eye', shioraMapping: 'vitals' },
  {
    id: 'MedicationRequest',
    label: 'Medication Request',
    icon: 'Pill',
    shioraMapping: 'prescription',
  },
  { id: 'Condition', label: 'Condition', icon: 'AlertCircle', shioraMapping: 'notes' },
  {
    id: 'DiagnosticReport',
    label: 'Diagnostic Report',
    icon: 'FileSearch',
    shioraMapping: 'lab_result',
  },
  { id: 'Immunization', label: 'Immunization', icon: 'Syringe', shioraMapping: 'notes' },
  { id: 'Procedure', label: 'Procedure', icon: 'Scissors', shioraMapping: 'notes' },
  {
    id: 'AllergyIntolerance',
    label: 'Allergy / Intolerance',
    icon: 'AlertTriangle',
    shioraMapping: 'notes',
  },
] as const;

/** Alert notification channels */
export const ALERT_CHANNELS = [
  { id: 'in_app', label: 'In-App', icon: 'Bell', description: 'Push notification within Shiora' },
  { id: 'email', label: 'Email', icon: 'Mail', description: 'Email to your registered address' },
  { id: 'push', label: 'Push', icon: 'Smartphone', description: 'Mobile push notification' },
  { id: 'sms', label: 'SMS', icon: 'MessageSquare', description: 'Text message alert' },
] as const;

/** Alert metric definitions */
export const ALERT_METRICS = [
  {
    id: 'temperature',
    label: 'Body Temperature',
    unit: '\u00B0F',
    defaultThreshold: 100.4,
    condition: 'above',
  },
  {
    id: 'cycle_length',
    label: 'Cycle Length',
    unit: 'days',
    defaultThreshold: 35,
    condition: 'above',
  },
  { id: 'heart_rate', label: 'Heart Rate', unit: 'bpm', defaultThreshold: 100, condition: 'above' },
  {
    id: 'hrv',
    label: 'Heart Rate Variability',
    unit: 'ms',
    defaultThreshold: 20,
    condition: 'below',
  },
  { id: 'spo2', label: 'Blood Oxygen', unit: '%', defaultThreshold: 94, condition: 'below' },
  {
    id: 'blood_pressure',
    label: 'Blood Pressure',
    unit: 'mmHg',
    defaultThreshold: 140,
    condition: 'above',
  },
  {
    id: 'glucose',
    label: 'Blood Glucose',
    unit: 'mg/dL',
    defaultThreshold: 180,
    condition: 'above',
  },
  {
    id: 'sleep_score',
    label: 'Sleep Score',
    unit: 'pts',
    defaultThreshold: 50,
    condition: 'below',
  },
] as const;

/** Governance proposal types */
export const GOVERNANCE_PROPOSAL_TYPES = [
  {
    id: 'parameter',
    label: 'Parameter Change',
    icon: 'Settings',
    description: 'Modify protocol parameters',
  },
  {
    id: 'feature',
    label: 'Feature Proposal',
    icon: 'Sparkles',
    description: 'Propose new protocol features',
  },
  {
    id: 'treasury',
    label: 'Treasury Spend',
    icon: 'Wallet',
    description: 'Allocate treasury funds',
  },
  {
    id: 'emergency',
    label: 'Emergency Action',
    icon: 'AlertOctagon',
    description: 'Emergency protocol changes',
  },
] as const;

/** Marketplace data categories */
export const MARKETPLACE_CATEGORIES = [
  { id: 'menstrual_cycles', label: 'Menstrual Cycles', icon: 'Calendar', color: '#f43f5e' },
  { id: 'fertility_data', label: 'Fertility Data', icon: 'Heart', color: '#a78bfa' },
  { id: 'lab_results', label: 'Lab Results', icon: 'TestTube2', color: '#8B1538' },
  { id: 'vitals_timeseries', label: 'Vitals Time Series', icon: 'HeartPulse', color: '#10b981' },
  { id: 'wearable_data', label: 'Wearable Data', icon: 'Watch', color: '#06b6d4' },
  { id: 'imaging_anonymized', label: 'Anonymized Imaging', icon: 'ScanLine', color: '#fb923c' },
  { id: 'clinical_outcomes', label: 'Clinical Outcomes', icon: 'ClipboardCheck', color: '#84cc16' },
  { id: 'medication_responses', label: 'Medication Responses', icon: 'Pill', color: '#eab308' },
] as const;

/** Community circle categories */
export const COMMUNITY_CATEGORIES = [
  {
    id: 'fertility',
    label: 'Fertility',
    icon: 'Heart',
    color: '#a78bfa',
    description: 'Fertility journeys, IVF, conception',
  },
  {
    id: 'pregnancy',
    label: 'Pregnancy',
    icon: 'Baby',
    color: '#f43f5e',
    description: 'Pregnancy support and guidance',
  },
  {
    id: 'menopause',
    label: 'Menopause',
    icon: 'Flame',
    color: '#fb923c',
    description: 'Menopause and perimenopause',
  },
  {
    id: 'endometriosis',
    label: 'Endometriosis',
    icon: 'Ribbon',
    color: '#eab308',
    description: 'Living with endometriosis',
  },
  {
    id: 'pcos',
    label: 'PCOS',
    icon: 'CircleDot',
    color: '#06b6d4',
    description: 'Polycystic ovary syndrome support',
  },
  {
    id: 'general_wellness',
    label: 'Wellness',
    icon: 'Leaf',
    color: '#10b981',
    description: 'General health and wellness',
  },
  {
    id: 'mental_health',
    label: 'Mental Health',
    icon: 'Brain',
    color: '#8B1538',
    description: 'Mental health support',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: 'Apple',
    color: '#84cc16',
    description: 'Nutrition and diet discussion',
  },
] as const;

/** Reward action types and AETHEL amounts */
export const REWARD_ACTIONS = [
  { id: 'data_upload', label: 'Upload Health Record', aethel: 5, icon: 'Upload' },
  { id: 'wearable_sync', label: 'Wearable Data Sync', aethel: 2, icon: 'RefreshCw' },
  { id: 'community_post', label: 'Community Post', aethel: 1, icon: 'MessageCircle' },
  { id: 'health_checkup', label: 'Health Checkup', aethel: 10, icon: 'Stethoscope' },
  { id: 'data_contribution', label: 'Research Contribution', aethel: 25, icon: 'Microscope' },
  { id: 'streak_bonus', label: 'Streak Bonus', aethel: 5, icon: 'Flame' },
  { id: 'milestone', label: 'Milestone Reached', aethel: 50, icon: 'Trophy' },
  { id: 'referral', label: 'Referral', aethel: 20, icon: 'Users' },
] as const;

/** Extended status styles for new features */
export const EXTENDED_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  // Consent statuses
  active: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  expired: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  revoked: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  // Marketplace
  sold: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  withdrawn: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  // Governance
  passed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  defeated: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  queued: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  executed: {
    bg: 'bg-brand-50',
    text: 'text-brand-700',
    border: 'border-brand-200',
    dot: 'bg-brand-500',
  },
  cancelled: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  // Wearable
  connected: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  disconnected: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  syncing: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  // Staking
  staked: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  unstaking: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  // Trust levels
  gold: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  silver: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  bronze: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  // Alert severities
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  info: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  // FHIR
  processing: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  failed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  // Research
  recruiting: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  suspended: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  // Vault
  locked: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  unlocked: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  partial: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  // ZKP
  verified: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  proving: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  unproven: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  // Digital Twin / MPC
  simulating: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  converging: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  enrolled: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  // Emergency / Triage
  triaged: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  escalated: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  // Genomics
  sequenced: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  low_risk: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  high_risk: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  elevated: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  // Compliance
  flagged: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  compliant: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  non_compliant: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  open: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  in_progress: {
    bg: 'bg-accent-50',
    text: 'text-accent-700',
    border: 'border-accent-200',
    dot: 'bg-accent-500',
  },
  resolved: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  accepted_risk: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
} as const;

/** Primary navigation links (always visible in header) */
export const PRIMARY_NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/records', label: 'Records', icon: 'FileHeart' },
  { href: '/chat', label: 'Health\u00A0AI', icon: 'MessageSquare' },
  { href: '/insights', label: 'Insights', icon: 'Brain' },
  { href: '/clinical', label: 'Clinical', icon: 'Stethoscope' },
] as const;

/** Secondary navigation links (Platform dropdown) */
export const SECONDARY_NAV_LINKS = [
  { href: '/vault', label: 'Vault', icon: 'Lock' },
  { href: '/marketplace', label: 'Marketplace', icon: 'Store' },
  { href: '/governance', label: 'Governance', icon: 'Vote' },
  { href: '/compliance', label: 'Compliance', icon: 'ShieldCheck' },
  { href: '/tee-explorer', label: 'TEE\u00A0Explorer', icon: 'Cpu' },
] as const;

/** Tertiary navigation links (More dropdown) */
export const TERTIARY_NAV_LINKS = [
  { href: '/wearables', label: 'Wearables', icon: 'Watch' },
  { href: '/fhir', label: 'FHIR Bridge', icon: 'Link' },
  { href: '/alerts', label: 'Alerts', icon: 'Bell' },
  { href: '/community', label: 'Community', icon: 'Users' },
  { href: '/research', label: 'Research', icon: 'Microscope' },
  { href: '/genomics', label: 'Genomics', icon: 'Dna' },
  { href: '/twin', label: 'Digital\u00A0Twin', icon: 'Fingerprint' },
  { href: '/mpc', label: 'MPC\u00A0Lab', icon: 'Network' },
  { href: '/emergency', label: 'Emergency', icon: 'Siren' },
  { href: '/access', label: 'Access', icon: 'Shield' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
] as const;

/** Vault compartment categories */
export const VAULT_CATEGORIES = [
  { id: 'cycle_tracking', label: 'Cycle Tracking', icon: 'Calendar', color: '#f43f5e' },
  { id: 'fertility_data', label: 'Fertility Data', icon: 'Heart', color: '#a78bfa' },
  { id: 'hormone_levels', label: 'Hormone Levels', icon: 'TrendingUp', color: '#fb923c' },
  { id: 'medications', label: 'Medications', icon: 'Pill', color: '#8B1538' },
  { id: 'lab_results', label: 'Lab Results', icon: 'TestTube2', color: '#10b981' },
  { id: 'imaging', label: 'Imaging', icon: 'ScanLine', color: '#06b6d4' },
  { id: 'symptoms', label: 'Symptoms', icon: 'Thermometer', color: '#eab308' },
  { id: 'pregnancy', label: 'Pregnancy', icon: 'Baby', color: '#ec4899' },
] as const;

/** Symptom categories for the vault */
export const SYMPTOM_CATEGORIES = [
  {
    id: 'pain',
    label: 'Pain',
    icon: 'Frown',
    icons: ['Frown', 'AlertCircle', 'AlertTriangle', 'ThermometerSun', 'AlertCircle'],
  },
  {
    id: 'mood',
    label: 'Mood',
    icon: 'Smile',
    icons: ['Smile', 'Meh', 'Frown', 'Angry', 'CloudRain'],
  },
  {
    id: 'energy',
    label: 'Energy',
    icon: 'Zap',
    icons: ['Zap', 'Battery', 'BatteryLow', 'Dumbbell', 'BatteryWarning'],
  },
  {
    id: 'digestive',
    label: 'Digestive',
    icon: 'Apple',
    icons: ['AlertCircle', 'Apple', 'AlertTriangle', 'Wind', 'UtensilsCrossed'],
  },
  {
    id: 'skin',
    label: 'Skin',
    icon: 'Droplets',
    icons: ['Sparkles', 'Circle', 'Droplets', 'Cross', 'Smile'],
  },
  {
    id: 'sleep',
    label: 'Sleep',
    icon: 'Moon',
    icons: ['Moon', 'Frown', 'CloudMoon', 'MoonStar', 'Star'],
  },
  {
    id: 'discharge',
    label: 'Discharge',
    icon: 'Droplet',
    icons: ['Droplet', 'Droplets', 'Circle', 'CircleDot', 'AlertCircle'],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    icon: 'Thermometer',
    icons: ['Thermometer', 'ThermometerSun', 'Snowflake', 'Smile', 'ThermometerSun'],
  },
] as const;

/** Jurisdictions with reproductive data protections */
export const REPRODUCTIVE_JURISDICTIONS = [
  { id: 'us-ca', label: 'California, US', protectionLevel: 'high' },
  { id: 'us-ny', label: 'New York, US', protectionLevel: 'high' },
  { id: 'us-wa', label: 'Washington, US', protectionLevel: 'high' },
  { id: 'us-il', label: 'Illinois, US', protectionLevel: 'high' },
  { id: 'eu-gdpr', label: 'European Union (GDPR)', protectionLevel: 'high' },
  { id: 'uk', label: 'United Kingdom', protectionLevel: 'high' },
  { id: 'us-tx', label: 'Texas, US', protectionLevel: 'low' },
  { id: 'us-fl', label: 'Florida, US', protectionLevel: 'medium' },
] as const;

// ============================================================
// 10x Upgrade — New Feature Constants
// ============================================================

/** Clinical pathway categories */
export const CLINICAL_PATHWAY_TYPES = [
  { id: 'diabetes_management', label: 'Diabetes Management', icon: 'Droplets', color: '#8B1538' },
  {
    id: 'hypertension_protocol',
    label: 'Hypertension Protocol',
    icon: 'HeartPulse',
    color: '#f43f5e',
  },
  { id: 'prenatal_care', label: 'Prenatal Care', icon: 'Baby', color: '#a78bfa' },
  { id: 'cardiac_screening', label: 'Cardiac Screening', icon: 'Heart', color: '#fb923c' },
  { id: 'mental_health_pathway', label: 'Mental Health', icon: 'Brain', color: '#06b6d4' },
  { id: 'chronic_pain_management', label: 'Chronic Pain', icon: 'Frown', color: '#eab308' },
] as const;

/** Drug interaction severity levels */
export const DRUG_SEVERITY_LEVELS = [
  {
    id: 'major',
    label: 'Major',
    color: '#ef4444',
    description: 'Highly clinically significant — avoid combination',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    color: '#f59e0b',
    description: 'Moderately significant — use with caution',
  },
  {
    id: 'minor',
    label: 'Minor',
    color: '#06b6d4',
    description: 'Minimally significant — monitor closely',
  },
  { id: 'none', label: 'None', color: '#10b981', description: 'No known interaction' },
] as const;

/** Emergency Severity Index (ESI) triage levels */
export const TRIAGE_LEVELS = [
  { level: 1, label: 'Resuscitation', color: '#ef4444', description: 'Immediate life-threatening' },
  {
    level: 2,
    label: 'Emergent',
    color: '#f97316',
    description: 'High risk — confused/lethargic/disoriented',
  },
  { level: 3, label: 'Urgent', color: '#eab308', description: 'Multiple resources needed' },
  { level: 4, label: 'Less Urgent', color: '#06b6d4', description: 'One resource expected' },
  { level: 5, label: 'Non-Urgent', color: '#10b981', description: 'No resources expected' },
] as const;

/** Genomic risk score categories */
export const GENOMIC_RISK_CATEGORIES = [
  { id: 'cardiovascular', label: 'Cardiovascular', icon: 'Heart', color: '#f43f5e' },
  { id: 'type2_diabetes', label: 'Type 2 Diabetes', icon: 'Droplets', color: '#8B1538' },
  { id: 'breast_cancer', label: 'Breast Cancer', icon: 'Ribbon', color: '#a78bfa' },
  { id: 'alzheimers', label: "Alzheimer's Disease", icon: 'Brain', color: '#fb923c' },
  { id: 'colorectal_cancer', label: 'Colorectal Cancer', icon: 'CircleDot', color: '#06b6d4' },
  { id: 'autoimmune', label: 'Autoimmune Disorders', icon: 'Shield', color: '#eab308' },
] as const;

/** Common biomarker types for tracking */
export const BIOMARKER_TYPES = [
  {
    id: 'hba1c',
    name: 'HbA1c',
    category: 'Metabolic',
    unit: '%',
    refRange: { low: 4.0, high: 5.6 },
  },
  {
    id: 'total_cholesterol',
    name: 'Total Cholesterol',
    category: 'Lipid',
    unit: 'mg/dL',
    refRange: { low: 125, high: 200 },
  },
  {
    id: 'ldl',
    name: 'LDL Cholesterol',
    category: 'Lipid',
    unit: 'mg/dL',
    refRange: { low: 0, high: 100 },
  },
  {
    id: 'hdl',
    name: 'HDL Cholesterol',
    category: 'Lipid',
    unit: 'mg/dL',
    refRange: { low: 40, high: 100 },
  },
  {
    id: 'cortisol',
    name: 'Cortisol',
    category: 'Endocrine',
    unit: 'mcg/dL',
    refRange: { low: 6, high: 23 },
  },
  { id: 'tsh', name: 'TSH', category: 'Thyroid', unit: 'mIU/L', refRange: { low: 0.4, high: 4.0 } },
  {
    id: 'vitamin_d',
    name: 'Vitamin D',
    category: 'Nutritional',
    unit: 'ng/mL',
    refRange: { low: 30, high: 100 },
  },
  {
    id: 'crp',
    name: 'C-Reactive Protein',
    category: 'Inflammatory',
    unit: 'mg/L',
    refRange: { low: 0, high: 3.0 },
  },
  {
    id: 'ferritin',
    name: 'Ferritin',
    category: 'Iron',
    unit: 'ng/mL',
    refRange: { low: 12, high: 150 },
  },
  {
    id: 'b12',
    name: 'Vitamin B12',
    category: 'Nutritional',
    unit: 'pg/mL',
    refRange: { low: 200, high: 900 },
  },
] as const;

/** Organ systems for digital twin */
export const ORGAN_SYSTEMS = [
  { id: 'cardiovascular', label: 'Cardiovascular', icon: 'Heart', color: '#f43f5e' },
  { id: 'respiratory', label: 'Respiratory', icon: 'Wind', color: '#06b6d4' },
  { id: 'neurological', label: 'Neurological', icon: 'Brain', color: '#a78bfa' },
  { id: 'endocrine', label: 'Endocrine', icon: 'Zap', color: '#fb923c' },
  { id: 'musculoskeletal', label: 'Musculoskeletal', icon: 'Bone', color: '#84cc16' },
  { id: 'gastrointestinal', label: 'Gastrointestinal', icon: 'Apple', color: '#eab308' },
  { id: 'renal', label: 'Renal', icon: 'Droplets', color: '#8B1538' },
  { id: 'hepatic', label: 'Hepatic', icon: 'CircleDot', color: '#10b981' },
  { id: 'immune', label: 'Immune', icon: 'Shield', color: '#C9A227' },
  { id: 'reproductive', label: 'Reproductive', icon: 'Baby', color: '#ec4899' },
] as const;

/** Compliance frameworks */
export const COMPLIANCE_FRAMEWORKS = [
  {
    id: 'hipaa',
    name: 'HIPAA',
    fullName: 'Health Insurance Portability and Accountability Act',
    icon: 'ShieldCheck',
    color: '#8B1538',
  },
  {
    id: 'gdpr',
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    icon: 'Globe',
    color: '#06b6d4',
  },
  {
    id: 'soc2',
    name: 'SOC 2',
    fullName: 'Service Organization Control 2',
    icon: 'Lock',
    color: '#a78bfa',
  },
  {
    id: 'hitrust',
    name: 'HITRUST',
    fullName: 'Health Information Trust Alliance',
    icon: 'Shield',
    color: '#10b981',
  },
  {
    id: 'fda_21cfr11',
    name: 'FDA 21 CFR 11',
    fullName: 'Electronic Records & Signatures',
    icon: 'FileCheck',
    color: '#fb923c',
  },
] as const;

/** MPC protocol types */
export const MPC_PROTOCOL_TYPES = [
  {
    id: 'secure_sum',
    label: 'Secure Sum',
    icon: 'Calculator',
    description: 'Privately sum data across parties',
  },
  {
    id: 'federated_averaging',
    label: 'Federated Averaging',
    icon: 'GitMerge',
    description: 'Average model weights without sharing data',
  },
  {
    id: 'private_intersection',
    label: 'Private Intersection',
    icon: 'CircleDot',
    description: 'Find common elements without revealing sets',
  },
  {
    id: 'garbled_circuits',
    label: 'Garbled Circuits',
    icon: 'Cpu',
    description: 'General-purpose secure computation',
  },
  {
    id: 'secret_sharing',
    label: 'Secret Sharing',
    icon: 'Share2',
    description: 'Split data into shares across parties',
  },
] as const;

/** Emergency protocol categories */
export const EMERGENCY_PROTOCOL_CATEGORIES = [
  { id: 'anaphylaxis', label: 'Anaphylaxis', icon: 'AlertOctagon', severity: 'critical' },
  { id: 'cardiac_arrest', label: 'Cardiac Arrest', icon: 'Heart', severity: 'critical' },
  { id: 'stroke', label: 'Stroke', icon: 'Brain', severity: 'critical' },
  { id: 'severe_bleeding', label: 'Severe Bleeding', icon: 'Droplets', severity: 'critical' },
  { id: 'seizure', label: 'Seizure', icon: 'Zap', severity: 'warning' },
  { id: 'diabetic_emergency', label: 'Diabetic Emergency', icon: 'Activity', severity: 'warning' },
  {
    id: 'allergic_reaction',
    label: 'Allergic Reaction',
    icon: 'AlertTriangle',
    severity: 'warning',
  },
  { id: 'asthma_attack', label: 'Asthma Attack', icon: 'Wind', severity: 'warning' },
] as const;

/** TEE enclave types */
export const TEE_ENCLAVE_TYPES = [
  { platform: 'Intel SGX', version: 'SGX2', icon: 'Cpu', color: '#0071C5' },
  { platform: 'AWS Nitro', version: 'v3', icon: 'Cloud', color: '#FF9900' },
  { platform: 'AMD SEV', version: 'SEV-SNP', icon: 'Server', color: '#ED1C24' },
] as const;

/** Compute job states */
export const COMPUTE_JOB_STATES = [
  { id: 'queued', label: 'Queued', color: '#94a3b8' },
  { id: 'running', label: 'Running', color: '#06b6d4' },
  { id: 'completed', label: 'Completed', color: '#10b981' },
  { id: 'failed', label: 'Failed', color: '#ef4444' },
  { id: 'cancelled', label: 'Cancelled', color: '#64748b' },
] as const;
