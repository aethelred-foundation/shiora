/**
 * Shiora on Aethelred — Comprehensive Type Definitions
 *
 * Centralized types for the entire application covering health records,
 * access control, AI/TEE operations, wallet/network state, IPFS storage,
 * notifications, user profiles, API responses, and form schemas.
 */

// ============================================================
// Health Records
// ============================================================

/** Supported health record categories. */
export type RecordType =
  | 'lab_result'
  | 'imaging'
  | 'prescription'
  | 'vitals'
  | 'notes';

/** Lifecycle status of a health record on IPFS/blockchain. */
export type RecordStatus = 'Verified' | 'Pinning' | 'Pinned' | 'Processing';

/** Encryption algorithms used for record protection. */
export type EncryptionType = 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305';

/**
 * A single encrypted health record stored on IPFS
 * with blockchain-anchored integrity proofs.
 */
export interface HealthRecord {
  /** Unique record identifier (e.g. `rec-a1b2c3d4e5f6`). */
  id: string;
  /** Category of the health record. */
  type: RecordType;
  /** Human-readable title (e.g. "Complete Blood Count"). */
  label: string;
  /** Extended description or summary of the record. */
  description: string;
  /** Date the medical event occurred (epoch ms). */
  date: number;
  /** Date the record was uploaded to IPFS (epoch ms). */
  uploadDate: number;
  /** Whether the record payload is encrypted. */
  encrypted: boolean;
  /** Encryption algorithm used. */
  encryption: EncryptionType;
  /** IPFS content identifier (CID). */
  cid: string;
  /** Aethelred blockchain transaction hash anchoring this record. */
  txHash: string;
  /** TEE attestation hash proving enclave processing. */
  attestation: string;
  /** File size in bytes. */
  size: number;
  /** Healthcare provider or facility name. */
  provider: string;
  /** Current record lifecycle status. */
  status: RecordStatus;
  /** Number of IPFS nodes pinning this record. */
  ipfsNodes: number;
  /** Freeform tags for search and categorisation. */
  tags: string[];
}

/** Sort fields available for health record listings. */
export type RecordSortField = 'date' | 'label' | 'size' | 'uploadDate';

/** Sort direction. */
export type SortDirection = 'asc' | 'desc';

/** Filter/sort parameters for health record queries. */
export interface RecordFilters {
  /** Filter by record type; `undefined` means all types. */
  type?: RecordType;
  /** Free-text search across label, provider, and tags. */
  search?: string;
  /** Filter by record status. */
  status?: RecordStatus;
  /** Sort field. */
  sortField: RecordSortField;
  /** Sort direction. */
  sortDirection: SortDirection;
  /** Current page (1-indexed). */
  page: number;
  /** Records per page. */
  pageSize: number;
}

// ============================================================
// Access Control
// ============================================================

/** Status of a provider access grant. */
export type AccessGrantStatus = 'Active' | 'Expired' | 'Revoked' | 'Pending';

/** Individual permission flags within a grant. */
export interface AccessPermission {
  /** Can the provider view records. */
  canView: boolean;
  /** Can the provider download records. */
  canDownload: boolean;
  /** Can the provider share/forward records. */
  canShare: boolean;
}

/** Scope of data a provider may access. */
export type DataScope =
  | 'Full Records'
  | 'Lab Results Only'
  | 'Imaging Only'
  | 'Vitals Only'
  | 'Prescriptions Only'
  | 'Clinical Notes Only';

/**
 * A blockchain-verified access grant giving a healthcare
 * provider time-limited access to patient health data.
 */
export interface AccessGrant extends AccessPermission {
  /** Unique grant identifier. */
  id: string;
  /** Provider or facility name. */
  provider: string;
  /** Provider medical specialty. */
  specialty: string;
  /** Provider Aethelred wallet address. */
  address: string;
  /** Current grant status. */
  status: AccessGrantStatus;
  /** Data scope this grant covers. */
  scope: DataScope;
  /** When the grant was created (epoch ms). */
  grantedAt: number;
  /** When the grant expires (epoch ms). */
  expiresAt: number;
  /** Last time the provider accessed data (epoch ms), or `null`. */
  lastAccess: number | null;
  /** Total number of times the provider has accessed data. */
  accessCount: number;
  /** Blockchain transaction hash for the grant. */
  txHash: string;
  /** TEE attestation hash for the grant. */
  attestation: string;
}

/** Categories of audit log actions. */
export type AuditActionType = 'access' | 'grant' | 'revoke' | 'modify' | 'download';

/**
 * A single entry in the immutable on-chain audit trail
 * recording every data access event.
 */
export interface AuditEntry {
  /** Unique audit entry identifier. */
  id: string;
  /** Provider that performed the action. */
  provider: string;
  /** Human-readable action summary. */
  action: string;
  /** When the action occurred (epoch ms). */
  timestamp: number;
  /** Extended details about the action. */
  details: string;
  /** Blockchain transaction hash recording this event. */
  txHash: string;
  /** Category of the audit action. */
  type: AuditActionType;
}

// ============================================================
// AI / TEE
// ============================================================

/** Architecture type of an AI model. */
export type ModelArchitecture = 'LSTM' | 'Isolation Forest' | 'XGBoost' | 'Transformer';

/**
 * An AI model registered in the Shiora model registry,
 * executed inside a TEE enclave.
 */
export interface AIModel {
  /** Unique model identifier (e.g. `lstm`, `anomaly`). */
  id: string;
  /** Display name of the model. */
  name: string;
  /** Semantic version string (e.g. `v2.1`). */
  version: string;
  /** Neural network / ML architecture. */
  type: ModelArchitecture;
  /** Validation accuracy percentage (0-100). */
  accuracy: number;
  /** Human-readable description of the model's purpose. */
  description: string;
}

/** TEE platform vendors. */
export type TEEPlatform = 'Intel SGX' | 'AWS Nitro' | 'AMD SEV';

/** Operational status of a TEE enclave. */
export type TEEStatus = 'operational' | 'degraded' | 'offline';

/**
 * A cryptographic TEE attestation proving that a computation
 * was performed inside an unmodified enclave.
 */
export interface TEEAttestation {
  /** Attestation hash. */
  hash: string;
  /** TEE platform that produced the attestation. */
  platform: TEEPlatform;
  /** Whether the attestation has been verified on-chain. */
  verified: boolean;
  /** When the attestation was produced (epoch ms). */
  timestamp: number;
  /** Block height at which the attestation was anchored. */
  blockHeight: number;
}

/** Result classification from an AI inference. */
export type InferenceResult = 'Normal' | 'Anomaly Detected';

/**
 * A single TEE-verified AI inference run.
 */
export interface Inference {
  /** Unique inference identifier. */
  id: string;
  /** The AI model that produced this inference. */
  model: AIModel;
  /** Classification result. */
  result: InferenceResult;
  /** Model confidence in the result (0-100). */
  confidence: number;
  /** When the inference completed (epoch ms). */
  timestamp: number;
  /** TEE attestation hash for this inference. */
  attestation: string;
  /** Block height at which the inference was recorded. */
  blockHeight: number;
}

/** Severity level for detected anomalies. */
export type AnomalySeverity = 'High' | 'Medium' | 'Low';

/**
 * An anomaly detected by the AI anomaly detection model.
 */
export interface AnomalyDetection {
  /** Unique anomaly identifier. */
  id: string;
  /** Anomaly type/category. */
  type: string;
  /** Detailed description of the anomaly. */
  description: string;
  /** Severity classification. */
  severity: AnomalySeverity;
  /** When the anomaly was detected (epoch ms). */
  detectedAt: number;
  /** Model confidence in the anomaly detection (0-100). */
  confidence: number;
  /** Name of the model that detected the anomaly. */
  model: string;
  /** TEE attestation hash for the detection. */
  attestation: string;
  /** Whether the anomaly has been resolved/reviewed. */
  resolved: boolean;
}

/** A phase in the menstrual cycle. */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/**
 * A single data point in a cycle prediction time series.
 */
export interface CyclePrediction {
  /** Day number within the cycle (1-indexed). */
  day: number;
  /** Display label (e.g. "Day 14"). */
  label: string;
  /** Actual basal body temperature in Fahrenheit. */
  temperature: number;
  /** Model-predicted temperature in Fahrenheit. */
  predicted: number;
  /** Fertility probability percentage (0-100). */
  fertility: number;
  /** Current cycle phase. */
  phase: CyclePhase;
  /** Display color for the phase. */
  phaseColor: string;
}

// ============================================================
// Wallet
// ============================================================

/** Supported wallet providers. */
export type WalletProvider = 'keplr' | 'metamask' | 'walletconnect' | 'leap';

/**
 * Current state of the connected blockchain wallet.
 */
export interface WalletState {
  /** Whether a wallet is currently connected. */
  connected: boolean;
  /** Aethelred wallet address (e.g. `aeth1...`). */
  address: string;
  /** AETHEL token balance. */
  aethelBalance: number;
  /** Which wallet extension was used to connect (persisted for re-enable on reload). */
  provider?: 'keplr' | 'leap' | null;
  /** Chain ID used during authentication (persisted for signing after reload). */
  chainId?: string | null;
}

/**
 * A blockchain transaction on the Aethelred network.
 */
export interface Transaction {
  /** Transaction hash. */
  hash: string;
  /** Sender address. */
  from: string;
  /** Receiver address. */
  to: string;
  /** Transaction amount in AETHEL. */
  amount: number;
  /** Gas fee paid in AETHEL. */
  fee: number;
  /** Block height at which the transaction was included. */
  blockHeight: number;
  /** Transaction timestamp (epoch ms). */
  timestamp: number;
  /** Transaction status. */
  status: 'pending' | 'confirmed' | 'failed';
  /** Optional memo/note. */
  memo?: string;
}

/** Parameters for signing a message with the connected wallet. */
export interface SignMessageParams {
  /** The message string to sign. */
  message: string;
  /** Signer address (defaults to connected wallet). */
  signer?: string;
}

/** Result of a message signing operation. */
export interface SignMessageResult {
  /** The original message. */
  message: string;
  /** The cryptographic signature. */
  signature: string;
  /** The public key used for signing. */
  publicKey: string;
}

// ============================================================
// Network
// ============================================================

/**
 * Real-time blockchain network state, updated via
 * WebSocket or polling simulation.
 */
export interface NetworkState {
  /** Current block height. */
  blockHeight: number;
  /** Current transactions per second. */
  tps: number;
  /** Current network epoch. */
  epoch: number;
  /** Network load percentage (0-100). */
  networkLoad: number;
  /** Current AETHEL token price in USD. */
  aethelPrice: number;
  /** Timestamp of the last block (epoch ms). */
  lastBlockTime: number;
}

/**
 * Summary information about a single block.
 */
export interface Block {
  /** Block height (sequential number). */
  height: number;
  /** Block hash. */
  hash: string;
  /** Number of transactions in the block. */
  txCount: number;
  /** Block producer/validator address. */
  proposer: string;
  /** Block timestamp (epoch ms). */
  timestamp: number;
  /** Gas used as a fraction of gas limit. */
  gasUsed: number;
}

/**
 * Static configuration for the Aethelred blockchain.
 */
export interface BlockchainConfig {
  /** Human-readable chain name. */
  chainName: string;
  /** Chain identifier string. */
  chainId: string;
  /** RPC endpoint URL. */
  rpcUrl: string;
  /** REST API endpoint URL. */
  restUrl: string;
  /** WebSocket endpoint URL. */
  wsUrl: string;
  /** Native token denomination. */
  denom: string;
  /** Bech32 address prefix. */
  bech32Prefix: string;
  /** Average block time in seconds. */
  blockTime: number;
}

// ============================================================
// API Responses
// ============================================================

/**
 * Generic wrapper for API responses with typed data payload.
 */
export interface ApiResponse<T> {
  /** Whether the request succeeded. */
  success: boolean;
  /** Response payload (present when `success` is true). */
  data?: T;
  /** Error information (present when `success` is false). */
  error?: ErrorResponse;
  /** ISO 8601 timestamp of the response. */
  timestamp: string;
}

/**
 * Paginated API response with cursor metadata.
 */
export interface PaginatedResponse<T> {
  /** Array of items in the current page. */
  items: T[];
  /** Total number of items across all pages. */
  total: number;
  /** Current page number (1-indexed). */
  page: number;
  /** Items per page. */
  pageSize: number;
  /** Total number of pages. */
  totalPages: number;
  /** Whether more pages exist after this one. */
  hasMore: boolean;
}

/**
 * Structured error payload returned by the API.
 */
export interface ErrorResponse {
  /** Machine-readable error code (e.g. `UNAUTHORIZED`). */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** Optional field-level validation errors. */
  details?: Record<string, string>;
}

// ============================================================
// IPFS
// ============================================================

/** Status of an IPFS pin operation. */
export type PinStatus = 'pinned' | 'pinning' | 'unpinned' | 'failed';

/**
 * A file stored on IPFS through the Shiora pinning service.
 */
export interface IPFSFile {
  /** IPFS content identifier (CID). */
  cid: string;
  /** Original file name. */
  name: string;
  /** File size in bytes. */
  size: number;
  /** MIME type of the file. */
  mimeType: string;
  /** Current pin status. */
  pinStatus: PinStatus;
  /** Number of IPFS nodes pinning this file. */
  pinCount: number;
  /** When the file was uploaded (epoch ms). */
  createdAt: number;
  /** Encryption algorithm used (if encrypted). */
  encryption?: EncryptionType;
}

/**
 * Aggregated storage usage metrics for the current user.
 */
export interface StorageMetrics {
  /** Total storage used in bytes. */
  totalUsed: number;
  /** Storage quota in bytes. */
  totalQuota: number;
  /** Number of files stored. */
  fileCount: number;
  /** Number of files currently pinned. */
  pinnedCount: number;
  /** Number of connected IPFS nodes. */
  nodeCount: number;
  /** Breakdown of storage by record type. */
  byType: Record<RecordType, number>;
}

// ============================================================
// Notifications
// ============================================================

/** Visual category for notifications. */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * An in-app notification displayed in the toast queue.
 */
export interface Notification {
  /** Unique notification identifier. */
  id: string;
  /** Visual type / severity. */
  type: NotificationType;
  /** Short notification title. */
  title: string;
  /** Notification body message. */
  message: string;
  /** When the notification was created (epoch ms). */
  timestamp: number;
  /** Whether the notification has been read/dismissed. */
  read?: boolean;
  /** Auto-dismiss duration in milliseconds (0 = persistent). */
  duration?: number;
  /** Optional callback when the notification is clicked. */
  onClick?: () => void;
}

/**
 * User preferences for notification delivery.
 */
export interface NotificationPreferences {
  /** Enable browser desktop notifications. */
  desktop: boolean;
  /** Enable notification sounds. */
  sound: boolean;
  /** Auto-dismiss delay in milliseconds. */
  autoDismissMs: number;
  /** Maximum number of toasts visible at once. */
  maxVisible: number;
}

// ============================================================
// User
// ============================================================

/**
 * The authenticated user's profile.
 */
export interface UserProfile {
  /** User's Aethelred wallet address (serves as unique ID). */
  address: string;
  /** Optional display name. */
  displayName?: string;
  /** Optional avatar URL. */
  avatar?: string;
  /** When the profile was created (epoch ms). */
  createdAt: number;
  /** When the profile was last updated (epoch ms). */
  updatedAt: number;
}

/**
 * User application preferences persisted to localStorage.
 */
export interface UserPreferences {
  /** UI theme. */
  theme: 'light' | 'dark' | 'system';
  /** Preferred currency for token display. */
  currency: 'USD' | 'EUR' | 'GBP';
  /** Notification delivery preferences. */
  notifications: NotificationPreferences;
  /** Preferred wallet provider for auto-connect. */
  walletProvider?: WalletProvider;
  /** Default data scope for new access grants. */
  defaultDataScope: DataScope;
  /** Records per page in list views. */
  pageSize: number;
}

// ============================================================
// Forms
// ============================================================

/**
 * Form data for uploading a new health record.
 */
export interface UploadRecordForm {
  /** Record type/category. */
  type: RecordType;
  /** Human-readable label. */
  label: string;
  /** Extended description. */
  description: string;
  /** Healthcare provider name. */
  provider: string;
  /** Date of the medical event (ISO 8601 string). */
  date: string;
  /** The file to upload. */
  file: File | null;
  /** Tags to attach to the record. */
  tags: string[];
  /** Encryption algorithm to use. */
  encryption: EncryptionType;
}

/**
 * Form data for granting a provider access to health data.
 */
export interface GrantAccessForm {
  /** Provider Aethelred wallet address. */
  providerAddress: string;
  /** Provider display name. */
  providerName: string;
  /** Provider medical specialty. */
  specialty: string;
  /** Data scope to grant. */
  scope: DataScope;
  /** Grant duration in days. */
  durationDays: number;
  /** Permission flags. */
  permissions: AccessPermission;
}

/**
 * Form data for revoking an existing access grant.
 */
export interface RevokeAccessForm {
  /** The grant ID to revoke. */
  grantId: string;
  /** Reason for revocation (optional). */
  reason?: string;
}

/**
 * Form data for modifying the scope of an existing grant.
 */
export interface ModifyGrantForm {
  /** The grant ID to modify. */
  grantId: string;
  /** New data scope. */
  scope: DataScope;
  /** Updated permission flags. */
  permissions: AccessPermission;
  /** New expiration date (ISO 8601 string), or `undefined` to keep current. */
  expiresAt?: string;
}

// ============================================================
// TEE State (mirrors AppContext for standalone hook usage)
// ============================================================

/**
 * Aggregate TEE enclave status, used by both AppContext
 * and the standalone `useTEE` hook.
 */
export interface TEEState {
  /** Current enclave operational status. */
  status: TEEStatus;
  /** TEE hardware platform. */
  platform: string;
  /** Number of attestations produced today. */
  attestationsToday: number;
  /** Timestamp of the most recent attestation (epoch ms). */
  lastAttestation: number;
  /** Enclave uptime percentage (0-100). */
  enclaveUptime: number;
  /** Total inferences completed by the enclave. */
  inferencesCompleted: number;
}

// ============================================================
// Health Data State (mirrors AppContext)
// ============================================================

/**
 * Summary health data statistics displayed on the dashboard.
 */
export interface HealthDataState {
  /** Total number of health records. */
  totalRecords: number;
  /** Number of encrypted records. */
  encryptedRecords: number;
  /** Timestamp of the last upload (epoch ms). */
  lastUpload: number;
  /** Total storage used in bytes. */
  storageUsed: number;
  /** Number of IPFS nodes in the storage cluster. */
  ipfsNodes: number;
}

// ============================================================
// Consent Management
// ============================================================

export type ConsentScope =
  | 'cycle_data' | 'fertility_markers' | 'lab_results' | 'imaging'
  | 'prescriptions' | 'vitals' | 'clinical_notes' | 'wearable_data'
  | 'ai_inferences' | 'full_access';

export type ConsentStatus = 'active' | 'expired' | 'revoked' | 'pending';

export interface ConsentGrant {
  id: string;
  patientAddress: string;
  providerAddress: string;
  providerName: string;
  scopes: ConsentScope[];
  status: ConsentStatus;
  grantedAt: number;
  expiresAt: number;
  revokedAt?: number;
  txHash: string;
  attestation: string;
  policyId: string;
  autoRenew: boolean;
}

export interface ConsentPolicy {
  id: string;
  name: string;
  description: string;
  scopes: ConsentScope[];
  maxDurationDays: number;
  requiresAttestation: boolean;
  jurisdictions: string[];
  createdAt: number;
}

export interface ConsentAuditEntry {
  id: string;
  consentId: string;
  action: 'granted' | 'revoked' | 'modified' | 'expired' | 'accessed';
  actor: string;
  timestamp: number;
  details: string;
  txHash: string;
}

// ============================================================
// Health Chat AI
// ============================================================

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  attestation?: string;
  model?: string;
  confidence?: number;
  teePlatform?: TEEPlatform;
  tokens?: number;
  attachedRecordIds?: string[];
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage: string;
  model: string;
  totalTokens: number;
  attestationCount: number;
}

export interface ChatSuggestedPrompt {
  id: string;
  category: string;
  prompt: string;
  icon: string;
}

export interface ChatModelConfig {
  id: string;
  name: string;
  version: string;
  maxTokens: number;
  teePlatform: TEEPlatform;
  capabilities: string[];
}

// ============================================================
// Reproductive Data Vault
// ============================================================

export type VaultCompartmentCategory =
  | 'cycle_tracking' | 'fertility_data' | 'hormone_levels'
  | 'medications' | 'lab_results' | 'imaging' | 'symptoms' | 'pregnancy';

export type VaultLockStatus = 'locked' | 'unlocked' | 'partial';

export interface VaultCompartment {
  id: string;
  category: VaultCompartmentCategory;
  label: string;
  description: string;
  lockStatus: VaultLockStatus;
  recordCount: number;
  storageUsed: number;
  lastAccessed: number;
  encryptionKey: string;
  accessList: string[];
  jurisdictionFlags: string[];
  createdAt: number;
}

export type SymptomSeverity = 1 | 2 | 3 | 4 | 5;

export type SymptomCategory =
  | 'pain' | 'mood' | 'energy' | 'digestive' | 'skin'
  | 'sleep' | 'discharge' | 'temperature' | 'other';

export interface SymptomLog {
  id: string;
  date: number;
  category: SymptomCategory;
  symptom: string;
  severity: SymptomSeverity;
  notes: string;
  tags: string[];
}

export interface CycleEntry {
  id: string;
  date: number;
  day: number;
  phase: CyclePhase;
  temperature: number;
  flow: 'none' | 'light' | 'medium' | 'heavy';
  symptoms: SymptomLog[];
  fertilityScore: number;
  notes: string;
}

export interface FertilityMarker {
  id: string;
  date: number;
  type: 'lh_surge' | 'bbt_shift' | 'cervical_mucus' | 'ovulation_confirmed';
  value: number;
  confidence: number;
  source: 'manual' | 'ai_predicted' | 'wearable';
  attestation?: string;
}

export interface VaultPrivacyScore {
  overall: number;
  encryptionScore: number;
  accessControlScore: number;
  jurisdictionScore: number;
  dataMinimizationScore: number;
}

// ============================================================
// Health Data Marketplace
// ============================================================

export type ListingStatus = 'active' | 'sold' | 'expired' | 'withdrawn';

export type MarketplaceCategory =
  | 'menstrual_cycles' | 'fertility_data' | 'lab_results'
  | 'vitals_timeseries' | 'wearable_data' | 'imaging_anonymized'
  | 'clinical_outcomes' | 'medication_responses';

export interface DataListing {
  id: string;
  seller: string;
  sellerReputation: number;
  category: MarketplaceCategory;
  title: string;
  description: string;
  dataPoints: number;
  dateRange: { start: number; end: number };
  qualityScore: number;
  anonymizationLevel: 'k-anonymity' | 'l-diversity' | 'differential-privacy';
  price: number;
  currency: 'AETHEL';
  status: ListingStatus;
  teeVerified: boolean;
  attestation: string;
  purchaseCount: number;
  createdAt: number;
  expiresAt: number;
}

export interface DataPurchase {
  id: string;
  listingId: string;
  buyer: string;
  seller: string;
  price: number;
  purchasedAt: number;
  txHash: string;
  downloadCount: number;
  category: MarketplaceCategory;
  title: string;
}

export interface MarketplaceStats {
  totalListings: number;
  activeListings: number;
  totalVolume: number;
  totalSellers: number;
  totalBuyers: number;
  averagePrice: number;
  topCategories: { category: MarketplaceCategory; count: number; volume: number }[];
}

export interface QualityScore {
  overall: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  accuracy: number;
  teeVerification: boolean;
}

// ============================================================
// Wearable Integration
// ============================================================

export type WearableProvider = 'apple_health' | 'oura' | 'whoop' | 'fitbit' | 'garmin';

export type WearableConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

export interface WearableDevice {
  id: string;
  provider: WearableProvider;
  deviceName: string;
  status: WearableConnectionStatus;
  lastSync: number;
  dataPointsSynced: number;
  batteryLevel?: number;
  firmwareVersion?: string;
  connectedAt: number;
}

export type WearableMetricType =
  | 'heart_rate' | 'hrv' | 'spo2' | 'temperature' | 'steps'
  | 'calories' | 'sleep_duration' | 'sleep_score' | 'readiness'
  | 'strain' | 'recovery' | 'respiratory_rate';

export interface WearableDataPoint {
  id: string;
  deviceId: string;
  metric: WearableMetricType;
  value: number;
  unit: string;
  timestamp: number;
  source: WearableProvider;
}

export interface WearableSyncBatch {
  id: string;
  deviceId: string;
  syncedAt: number;
  dataPointCount: number;
  attestation: string;
  status: 'completed' | 'partial' | 'failed';
}

// ============================================================
// FHIR Bridge
// ============================================================

export type FHIRResourceType =
  | 'Patient' | 'Observation' | 'MedicationRequest' | 'Condition'
  | 'DiagnosticReport' | 'Immunization' | 'Procedure' | 'AllergyIntolerance';

export interface FHIRResource {
  id: string;
  resourceType: FHIRResourceType;
  status: string;
  lastUpdated: number;
  rawJson: string;
  mappedRecordId?: string;
}

export interface FHIRMapping {
  id: string;
  fhirResourceType: FHIRResourceType;
  shioraRecordType: RecordType;
  fieldMappings: { fhirPath: string; shioraField: string; transform?: string }[];
  isDefault: boolean;
}

export type FHIRImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface FHIRImportJob {
  id: string;
  source: string;
  resourceCount: number;
  processedCount: number;
  failedCount: number;
  status: FHIRImportStatus;
  startedAt: number;
  completedAt?: number;
  errors: string[];
}

export interface FHIRExportConfig {
  id: string;
  format: 'json' | 'xml';
  resourceTypes: FHIRResourceType[];
  dateRange?: { start: number; end: number };
  destination: string;
  lastExportAt?: number;
}

// ============================================================
// Predictive Health Alerts
// ============================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertChannel = 'in_app' | 'email' | 'push' | 'sms';

export type AlertMetric =
  | 'temperature' | 'cycle_length' | 'heart_rate' | 'hrv'
  | 'spo2' | 'blood_pressure' | 'glucose' | 'weight'
  | 'sleep_score' | 'recovery_score';

export interface AlertRule {
  id: string;
  metric: AlertMetric;
  condition: 'above' | 'below' | 'deviation';
  threshold: number;
  unit: string;
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled: boolean;
  cooldownMinutes: number;
  createdAt: number;
}

export interface PredictiveAlert {
  id: string;
  ruleId: string;
  metric: AlertMetric;
  severity: AlertSeverity;
  title: string;
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  modelId: string;
  confidence: number;
  attestation: string;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  action: 'triggered' | 'acknowledged' | 'resolved' | 'escalated';
  timestamp: number;
  actor?: string;
  notes?: string;
}

// ============================================================
// ZKP (Zero-Knowledge Proofs)
// ============================================================

export type ZKClaimType =
  | 'age_range' | 'condition_present' | 'medication_active'
  | 'data_quality' | 'provider_verified' | 'fertility_window';

export interface ZKProof {
  id: string;
  claimType: ZKClaimType;
  proofHash: string;
  publicInputs: string;
  verified: boolean;
  verifiedAt?: number;
  createdAt: number;
  expiresAt: number;
  txHash?: string;
}

export interface ZKClaim {
  id: string;
  claimType: ZKClaimType;
  description: string;
  proof?: ZKProof;
  status: 'unproven' | 'proving' | 'verified' | 'expired' | 'failed';
  createdAt: number;
}

export interface ZKVerificationResult {
  valid: boolean;
  claimType: ZKClaimType;
  verifiedAt: number;
  blockHeight: number;
  gasUsed: number;
}

// ============================================================
// Governance
// ============================================================

export type ProposalType = 'parameter' | 'feature' | 'treasury' | 'emergency';

export type ProposalStatus = 'active' | 'passed' | 'defeated' | 'queued' | 'executed' | 'cancelled';

export interface Proposal {
  id: string;
  proposer: string;
  type: ProposalType;
  title: string;
  description: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  startBlock: number;
  endBlock: number;
  status: ProposalStatus;
  createdAt: number;
  executedAt?: number;
  txHash: string;
}

export interface Vote {
  id: string;
  proposalId: string;
  voter: string;
  support: 'for' | 'against' | 'abstain';
  weight: number;
  timestamp: number;
  txHash: string;
  reason?: string;
}

export interface Delegation {
  id: string;
  delegator: string;
  delegatee: string;
  votingPower: number;
  delegatedAt: number;
  txHash: string;
}

export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  totalVoters: number;
  totalVotingPower: number;
  quorumThreshold: number;
  treasuryBalance: number;
}

// ============================================================
// Staking
// ============================================================

export type StakingStatus = 'staked' | 'unstaking' | 'withdrawn';

export interface StakingPosition {
  id: string;
  staker: string;
  amount: number;
  stakedAt: number;
  unlockAt?: number;
  status: StakingStatus;
  rewardsEarned: number;
  rewardsClaimed: number;
  votingPower: number;
  txHash: string;
}

export interface StakingReward {
  id: string;
  positionId: string;
  amount: number;
  source: 'staking_apy' | 'marketplace_fees' | 'governance_bonus';
  earnedAt: number;
  claimedAt?: number;
  txHash?: string;
}

export interface StakingStats {
  totalStaked: number;
  totalStakers: number;
  currentAPY: number;
  rewardsDistributed: number;
  nextRewardEpoch: number;
  minStakeAmount: number;
  unstakeCooldownDays: number;
}

// ============================================================
// Community Circles
// ============================================================

export type CircleCategory =
  | 'fertility' | 'pregnancy' | 'menopause' | 'endometriosis'
  | 'pcos' | 'general_wellness' | 'mental_health' | 'nutrition';

export interface CommunityCircle {
  id: string;
  name: string;
  category: CircleCategory;
  description: string;
  memberCount: number;
  postCount: number;
  createdAt: number;
  isJoined: boolean;
  requiresZKP: boolean;
  zkpClaimType?: ZKClaimType;
  icon: string;
  color: string;
}

export interface AnonymousPost {
  id: string;
  circleId: string;
  anonymousId: string;
  content: string;
  timestamp: number;
  reactions: { emoji: string; count: number }[];
  replyCount: number;
  zkpVerified: boolean;
  tags: string[];
}

export interface CircleMembership {
  circleId: string;
  joinedAt: number;
  anonymousId: string;
  zkpProofId?: string;
  postCount: number;
  reactionCount: number;
}

// ============================================================
// Health-to-Earn Rewards
// ============================================================

export type RewardAction =
  | 'data_upload' | 'wearable_sync' | 'community_post' | 'health_checkup'
  | 'data_contribution' | 'streak_bonus' | 'milestone' | 'referral';

export interface RewardEntry {
  id: string;
  action: RewardAction;
  description: string;
  amount: number;
  currency: 'AETHEL';
  earnedAt: number;
  claimedAt?: number;
  txHash?: string;
}

export interface RewardStreak {
  action: RewardAction;
  currentStreak: number;
  longestStreak: number;
  lastActionAt: number;
  nextMilestone: number;
  multiplier: number;
}

export interface RewardStats {
  totalEarned: number;
  totalClaimed: number;
  pendingRewards: number;
  activeStreaks: number;
  rank: number;
  level: number;
  nextLevelThreshold: number;
}

// ============================================================
// Provider Reputation
// ============================================================

export type TrustLevel = 'gold' | 'silver' | 'bronze' | 'unrated';

export interface ProviderReputation {
  address: string;
  name: string;
  specialty: string;
  trustLevel: TrustLevel;
  overallScore: number;
  reviewCount: number;
  totalAccesses: number;
  onTimeRevocations: number;
  dataBreaches: number;
  averageAccessDuration: number;
  registeredAt: number;
  lastActivityAt: number;
}

export interface ProviderReview {
  id: string;
  providerAddress: string;
  reviewerAnonymousId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  categories: {
    communication: number;
    dataHandling: number;
    timeliness: number;
    professionalism: number;
  };
  comment: string;
  timestamp: number;
  verified: boolean;
}

// ============================================================
// Explainable AI
// ============================================================

export interface SHAPValue {
  feature: string;
  value: number;
  baseValue: number;
  contribution: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface ModelCard {
  modelId: string;
  name: string;
  version: string;
  description: string;
  architecture: ModelArchitecture;
  trainingDataSize: number;
  validationAccuracy: number;
  fairnessMetrics: {
    demographicParity: number;
    equalizedOdds: number;
    calibration: number;
  };
  limitations: string[];
  intendedUse: string;
  lastUpdated: number;
}

export interface BiasReport {
  modelId: string;
  reportDate: number;
  overallBiasScore: number;
  categories: {
    category: string;
    biasScore: number;
    sampleSize: number;
    recommendation: string;
  }[];
}

export interface ExplainabilityResult {
  inferenceId: string;
  modelId: string;
  shapValues: SHAPValue[];
  featureImportances: FeatureImportance[];
  decisionPath: string[];
  confidence: number;
  explanation: string;
}

// ============================================================
// Research Portal
// ============================================================

export type StudyStatus = 'recruiting' | 'active' | 'completed' | 'suspended';

export interface ResearchStudy {
  id: string;
  title: string;
  description: string;
  institution: string;
  principalInvestigator: string;
  status: StudyStatus;
  participantCount: number;
  targetParticipants: number;
  dataTypesRequired: RecordType[];
  compensationShio: number;
  irbApprovalId: string;
  startDate: number;
  endDate: number;
  zkpRequired: boolean;
}

export interface DataContribution {
  id: string;
  studyId: string;
  contributorAnonymousId: string;
  dataTypes: RecordType[];
  contributedAt: number;
  compensation: number;
  consentId: string;
  status: 'pending' | 'accepted' | 'rejected';
}

// ============================================================
// GDPR / Privacy Rights
// ============================================================

export type PrivacyRequestType = 'access' | 'portability' | 'erasure' | 'rectification';

export type PrivacyRequestStatus = 'pending' | 'processing' | 'completed' | 'denied';

export interface PrivacyRequest {
  id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requestedAt: number;
  completedAt?: number;
  details: string;
  dataCategories: string[];
}

// ============================================================
// Form Types (New Features)
// ============================================================

export interface CreateConsentForm {
  providerAddress: string;
  providerName: string;
  scopes: ConsentScope[];
  durationDays: number;
  autoRenew: boolean;
  policyId?: string;
}

export interface CreateListingForm {
  category: MarketplaceCategory;
  title: string;
  description: string;
  price: number;
  expirationDays: number;
  anonymizationLevel: DataListing['anonymizationLevel'];
}

export interface CreateProposalForm {
  type: ProposalType;
  title: string;
  description: string;
  votingPeriodDays: number;
}

export interface StakeForm {
  amount: number;
  lockPeriodDays: number;
}

// ============================================================
// TEE Computation Explorer
// ============================================================

/** Status of a TEE compute job. */
export type ComputeJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Detailed TEE enclave information. */
export interface TEEEnclaveInfo {
  id: string;
  platform: TEEPlatform;
  firmwareVersion: string;
  measurementHash: string;
  status: TEEStatus;
  uptime: number;
  jobsProcessed: number;
  trustScore: number;
  lastAttestationAt: number;
  cpuCores: number;
  memoryMB: number;
  region: string;
}

/** A full attestation verification chain entry. */
export interface TEEVerificationChain {
  id: string;
  attestationHash: string;
  enclaveId: string;
  platform: TEEPlatform;
  measurementHash: string;
  pcrValues: string[];
  nonce: string;
  signature: string;
  verifiedOnChain: boolean;
  blockHeight: number;
  txHash: string;
  timestamp: number;
  inputHash: string;
  outputHash: string;
  modelId: string;
}

/** A compute job executed inside a TEE enclave. */
export interface TEEComputeJob {
  id: string;
  enclaveId: string;
  modelId: string;
  modelName: string;
  status: ComputeJobStatus;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  executionTimeMs: number;
  inputHash: string;
  outputHash: string;
  attestationHash: string;
  gasCost: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

/** Aggregated TEE platform statistics. */
export interface TEEPlatformStats {
  totalEnclaves: number;
  activeEnclaves: number;
  attestationSuccessRate: number;
  totalAttestations: number;
  attestationsToday: number;
  computeTPS: number;
  averageExecutionMs: number;
  platformDistribution: { platform: TEEPlatform; count: number; percentage: number }[];
  dailyAttestationVolume: { day: string; count: number }[];
}

// ============================================================
// Clinical Decision Support
// ============================================================

/** Clinical pathway step status. */
export type PathwayStepStatus = 'completed' | 'active' | 'pending' | 'skipped';

/** Severity of a drug interaction. */
export type InteractionSeverity = 'major' | 'moderate' | 'minor' | 'none';

/** A clinical care pathway with step-by-step protocol. */
export interface ClinicalPathway {
  id: string;
  name: string;
  category: string;
  description: string;
  steps: ClinicalPathwayStep[];
  applicableConditions: string[];
  guidelineSource: string;
  version: string;
  lastUpdated: number;
  teeVerified: boolean;
  attestation: string;
}

/** An individual step within a clinical pathway. */
export interface ClinicalPathwayStep {
  id: string;
  order: number;
  title: string;
  description: string;
  actionRequired: string;
  status: PathwayStepStatus;
  completedAt?: number;
  attestation?: string;
  criteria: string[];
}

/** A drug-drug interaction check result. */
export interface DrugInteraction {
  id: string;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
  evidenceLevel: 'established' | 'probable' | 'suspected' | 'theoretical';
  teeVerified: boolean;
  attestation: string;
}

/** A differential diagnosis entry with probability. */
export interface DifferentialDiagnosis {
  id: string;
  condition: string;
  icdCode: string;
  probability: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  recommendedTests: string[];
  urgency: 'emergent' | 'urgent' | 'routine' | 'elective';
  teeVerified: boolean;
  attestation: string;
}

/** A clinical guideline reference. */
export interface ClinicalGuideline {
  id: string;
  title: string;
  source: string;
  version: string;
  publicationDate: number;
  applicableConditions: string[];
  recommendations: string[];
  evidenceGrade: 'A' | 'B' | 'C' | 'D';
}

/** A clinical alert for the patient. */
export interface ClinicalAlert {
  id: string;
  type: 'drug_interaction' | 'overdue_screening' | 'lab_abnormal' | 'guideline_deviation' | 'contraindication';
  severity: AlertSeverity;
  title: string;
  message: string;
  relatedDrugs?: string[];
  relatedConditions?: string[];
  recommendation: string;
  triggeredAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  attestation: string;
}

/** A symptom assessment input for differential diagnosis. */
export interface SymptomAssessment {
  symptoms: string[];
  duration: string;
  severity: 'mild' | 'moderate' | 'severe';
  onsetType: 'sudden' | 'gradual';
  associatedFactors: string[];
  medications: string[];
  medicalHistory: string[];
}

/** An immutable clinical decision audit entry. */
export interface ClinicalDecisionAuditEntry {
  id: string;
  decisionType: 'pathway_step' | 'drug_check' | 'differential' | 'guideline_applied' | 'alert_generated';
  inputs: string;
  output: string;
  modelId: string;
  confidence: number;
  attestation: string;
  timestamp: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

/** Aggregated clinical decision support stats. */
export interface ClinicalStats {
  totalDecisions: number;
  activePathways: number;
  activeClinicalAlerts: number;
  drugChecksToday: number;
  guidelineComplianceScore: number;
  teeVerifiedDecisions: number;
}

// ============================================================
// Digital Health Twin
// ============================================================

/** Organ system identifiers. */
export type OrganSystem =
  | 'cardiovascular' | 'respiratory' | 'neurological' | 'endocrine'
  | 'musculoskeletal' | 'gastrointestinal' | 'renal' | 'hepatic'
  | 'immune' | 'reproductive';

/** A digital twin model representing a virtual patient. */
export interface DigitalTwin {
  id: string;
  ownerAddress: string;
  createdAt: number;
  lastUpdated: number;
  modelVersion: string;
  organScores: { system: OrganSystem; score: number; trend: 'improving' | 'stable' | 'declining'; lastUpdated: number }[];
  overallHealthScore: number;
  dataSourceCount: number;
  simulationCount: number;
  attestation: string;
  txHash: string;
}

/** A what-if simulation run on the digital twin. */
export interface TwinSimulation {
  id: string;
  twinId: string;
  scenario: string;
  description: string;
  parameters: TwinParameter[];
  status: 'pending' | 'simulating' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  beforeMetrics: { metric: string; value: number; unit: string }[];
  afterMetrics: { metric: string; value: number; unit: string }[];
  confidenceInterval: number;
  trajectoryData: { day: number; before: number; after: number; metric: string }[];
  attestation: string;
  txHash: string;
}

/** An adjustable twin parameter. */
export interface TwinParameter {
  id: string;
  name: string;
  category: string;
  currentValue: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  simulatedValue?: number;
}

/** A health prediction generated by the digital twin. */
export interface TwinPrediction {
  id: string;
  twinId: string;
  metric: string;
  currentValue: number;
  predicted30d: number;
  predicted60d: number;
  predicted90d: number;
  unit: string;
  confidenceBand: number;
  riskLevel: 'low' | 'moderate' | 'high';
  recommendations: string[];
  attestation: string;
  generatedAt: number;
}

/** A timeline event for the digital twin. */
export interface TwinTimelineEvent {
  id: string;
  twinId: string;
  type: 'creation' | 'simulation' | 'parameter_update' | 'prediction' | 'data_sync';
  title: string;
  description: string;
  timestamp: number;
  relatedId?: string;
  attestation?: string;
}

// ============================================================
// Multi-Party Computation
// ============================================================

/** MPC protocol types. */
export type MPCProtocolType = 'secure_sum' | 'federated_averaging' | 'private_intersection' | 'garbled_circuits' | 'secret_sharing';

/** Status of an MPC session. */
export type MPCSessionStatus = 'setup' | 'enrolling' | 'computing' | 'converging' | 'completed' | 'failed' | 'cancelled';

/** An MPC computation session. */
export interface MPCSession {
  id: string;
  name: string;
  description: string;
  protocol: MPCProtocolType;
  status: MPCSessionStatus;
  creatorAddress: string;
  participants: MPCParticipant[];
  minParticipants: number;
  maxParticipants: number;
  currentRound: number;
  totalRounds: number;
  privacyBudgetTotal: number;
  privacyBudgetRemaining: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  attestation: string;
  txHash: string;
}

/** A participant in an MPC session. */
export interface MPCParticipant {
  id: string;
  anonymousId: string;
  joinedAt: number;
  dataPointsContributed: number;
  roundsCompleted: number;
  status: 'enrolled' | 'active' | 'completed' | 'dropped';
}

/** Result from a completed MPC session. */
export interface MPCResult {
  id: string;
  sessionId: string;
  query: string;
  aggregatedResult: Record<string, number>;
  participantCount: number;
  roundsCompleted: number;
  privacyBudgetUsed: number;
  confidenceInterval: number;
  noiseAdded: number;
  attestation: string;
  commitmentHash: string;
  txHash: string;
  completedAt: number;
}

/** An available dataset for MPC computation. */
export interface MPCDataset {
  id: string;
  name: string;
  description: string;
  ownerAnonymousId: string;
  recordCount: number;
  dataTypes: RecordType[];
  qualityScore: number;
  privacyLevel: 'standard' | 'enhanced' | 'maximum';
  contributionReward: number;
  participations: number;
  createdAt: number;
}

/** Convergence data point for MPC visualization. */
export interface MPCConvergencePoint {
  round: number;
  loss: number;
  accuracy: number;
  participantsActive: number;
}

// ============================================================
// Compliance & Audit
// ============================================================

/** Supported compliance frameworks. */
export type ComplianceFrameworkId = 'hipaa' | 'gdpr' | 'soc2' | 'hitrust' | 'fda_21cfr11';

/** Status of a compliance control check. */
export type ComplianceCheckStatus = 'pass' | 'fail' | 'na' | 'partial' | 'not_assessed';

/** A regulatory compliance framework. */
export interface ComplianceFramework {
  id: ComplianceFrameworkId;
  name: string;
  description: string;
  version: string;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  notAssessedControls: number;
  overallScore: number;
  lastAssessedAt: number;
  nextAssessmentDue: number;
}

/** An individual compliance control check. */
export interface ComplianceCheck {
  id: string;
  frameworkId: ComplianceFrameworkId;
  controlId: string;
  controlName: string;
  description: string;
  category: string;
  status: ComplianceCheckStatus;
  evidence: string[];
  remediation?: string;
  lastCheckedAt: number;
  teeVerified: boolean;
  attestation?: string;
}

/** A compliance audit log entry. */
export interface ComplianceAuditEntry {
  id: string;
  action: string;
  actor: string;
  resource: string;
  resourceType: string;
  details: string;
  ipAddress: string;
  timestamp: number;
  frameworkRelevance: ComplianceFrameworkId[];
  teeAttestation: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/** A generated compliance report. */
export interface ComplianceReport {
  id: string;
  frameworkId: ComplianceFrameworkId;
  title: string;
  generatedAt: number;
  period: { start: number; end: number };
  overallScore: number;
  findings: number;
  criticalGaps: number;
  status: 'draft' | 'final' | 'archived';
}

/** A compliance policy violation. */
export interface PolicyViolation {
  id: string;
  frameworkId: ComplianceFrameworkId;
  controlId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  detectedAt: number;
  resolvedAt?: number;
  assignedTo?: string;
  remediationPlan: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
}

/** Aggregated compliance overview stats. */
export interface ComplianceOverview {
  frameworks: ComplianceFramework[];
  overallComplianceScore: number;
  activeViolations: number;
  daysSinceLastAudit: number;
  upcomingAssessments: { frameworkId: ComplianceFrameworkId; dueDate: number }[];
  complianceTrend: { month: string; score: number }[];
}

// ============================================================
// Emergency & Care Coordination
// ============================================================

/** Triage severity level (ESI 1-5). */
export type TriageLevel = 1 | 2 | 3 | 4 | 5;

/** Disposition recommendation from triage. */
export type TriageDisposition = 'emergency_room' | 'urgent_care' | 'primary_care' | 'self_care' | 'call_911';

/** An emergency information card. */
export interface EmergencyCard {
  id: string;
  ownerAddress: string;
  bloodType: string;
  allergies: string[];
  currentMedications: { name: string; dosage: string; frequency: string }[];
  conditions: string[];
  emergencyContacts: EmergencyContact[];
  advanceDirectives: string;
  organDonor: boolean;
  insuranceInfo: string;
  primaryPhysician: string;
  lastVerified: number;
  teeAttestation: string;
}

/** An emergency contact entry. */
export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  notifyOnEmergency: boolean;
}

/** A care team member. */
export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  institution: string;
  specialty: string;
  phone: string;
  email: string;
  accessLevel: 'full' | 'partial' | 'emergency_only';
  lastInteraction: number;
  isActive: boolean;
}

/** An emergency protocol. */
export interface EmergencyProtocol {
  id: string;
  name: string;
  category: string;
  severity: AlertSeverity;
  steps: { order: number; instruction: string; medication?: string; dosage?: string; timeLimit?: string }[];
  autoNotifyTeam: boolean;
  teeVerifiedDoses: boolean;
  attestation: string;
  lastReviewed: number;
}

/** A triage assessment result. */
export interface TriageAssessment {
  id: string;
  symptoms: string[];
  vitalSigns: Record<string, number>;
  esiLevel: TriageLevel;
  disposition: TriageDisposition;
  reasoning: string;
  confidence: number;
  attestation: string;
  assessedAt: number;
  modelId: string;
}

/** A care handoff record. */
export interface CareHandoff {
  id: string;
  fromProvider: string;
  toProvider: string;
  patientSummary: string;
  outstandingIssues: string[];
  medications: string[];
  qualityScore: number;
  completenessScore: number;
  handoffAt: number;
  acknowledgedAt?: number;
  teeAttestation: string;
  txHash: string;
}

/** A care coordination event. */
export interface CareEvent {
  id: string;
  type: 'triage' | 'handoff' | 'protocol_activated' | 'team_notified' | 'status_update';
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: number;
  actorName: string;
  relatedId?: string;
}

// ============================================================
// Genomics & Biomarkers
// ============================================================

/** Genomic sequencing status. */
export type SequencingStatus = 'not_started' | 'in_progress' | 'completed' | 'failed';

/** Drug metabolism rate classification. */
export type MetabolismRate = 'poor' | 'intermediate' | 'normal' | 'rapid' | 'ultra_rapid';

/** A genomic profile for a patient. */
export interface GenomicProfile {
  id: string;
  ownerAddress: string;
  sequencingStatus: SequencingStatus;
  sequencingDate?: number;
  totalVariants: number;
  clinicallySignificant: number;
  pharmacogenomicFlags: number;
  riskScoresGenerated: number;
  dataEncrypted: boolean;
  teeProcessed: boolean;
  attestation: string;
  lastUpdated: number;
}

/** A pharmacogenomic drug-gene result. */
export interface PharmacogenomicResult {
  id: string;
  gene: string;
  variant: string;
  rsId: string;
  drugName: string;
  drugCategory: string;
  metabolismRate: MetabolismRate;
  clinicalRecommendation: string;
  evidenceLevel: 'Level 1A' | 'Level 1B' | 'Level 2A' | 'Level 2B' | 'Level 3';
  guidelineSource: string;
  teeVerified: boolean;
  attestation: string;
}

/** A biomarker tracking entry. */
export interface Biomarker {
  id: string;
  name: string;
  category: string;
  currentValue: number;
  unit: string;
  referenceRange: { low: number; high: number };
  status: 'normal' | 'borderline' | 'abnormal';
  trend: 'improving' | 'stable' | 'worsening';
  lastMeasured: number;
  history: { date: number; value: number }[];
}

/** A polygenic risk score. */
export interface PolygenicRiskScore {
  id: string;
  category: string;
  condition: string;
  score: number;
  percentile: number;
  riskLevel: 'low' | 'average' | 'elevated' | 'high';
  variantsAnalyzed: number;
  modifiableFactors: string[];
  nonModifiableFactors: string[];
  recommendedInterventions: string[];
  attestation: string;
  calculatedAt: number;
}

/** A gene variant of interest. */
export interface GeneVariant {
  id: string;
  gene: string;
  variant: string;
  rsId: string;
  chromosome: string;
  position: number;
  clinicalSignificance: 'pathogenic' | 'likely_pathogenic' | 'uncertain' | 'likely_benign' | 'benign';
  associatedConditions: string[];
  frequency: number;
}

/** A generated genomic report. */
export interface GenomicReport {
  id: string;
  title: string;
  category: string;
  generatedAt: number;
  summary: string;
  findings: number;
  actionableItems: number;
  teeVerified: boolean;
  attestation: string;
  status: 'generating' | 'ready' | 'reviewed' | 'shared';
}

/** Aggregated genomics overview stats. */
export interface GenomicsOverview {
  profile: GenomicProfile;
  pharmacogenomicCount: number;
  biomarkerCount: number;
  riskScoreCount: number;
  reportCount: number;
  highRiskConditions: string[];
  actionableFindings: number;
}

// ============================================================
// Form Types (New Features — 10x Upgrade)
// ============================================================

export interface CreateMPCSessionForm {
  name: string;
  description: string;
  protocol: MPCProtocolType;
  minParticipants: number;
  maxParticipants: number;
  privacyBudget: number;
}

export interface RunSimulationForm {
  scenario: string;
  description: string;
  parameters: { id: string; value: number }[];
}

export interface TriageAssessmentForm {
  symptoms: string[];
  vitalSigns: Record<string, number>;
  duration: string;
  severity: 'mild' | 'moderate' | 'severe';
  onsetType: 'sudden' | 'gradual';
}

export interface DrugInteractionCheckForm {
  drugA: string;
  drugB: string;
}

export interface GenerateReportForm {
  frameworkId?: ComplianceFrameworkId;
  category?: string;
  period?: { start: number; end: number };
}
