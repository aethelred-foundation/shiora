// ============================================================
// Shiora — persisted API domain records
//
// These types describe data that is actually stored by Shiora. They live
// outside mock-data.ts so production services never depend on demo fixtures.
// ============================================================

export interface StoredHealthRecord {
  id: string;
  type: string;
  label: string;
  description: string;
  date: number;
  uploadDate: number;
  encrypted: boolean;
  encryption: string;
  cid: string;
  txHash: string;
  attestation: string;
  size: number;
  provider: string;
  status: 'Verified' | 'Pinning' | 'Pinned' | 'Processing';
  ipfsNodes: number;
  tags: string[];
  deleted: boolean;
  ownerAddress: string;
  blockHeight: number;
}

export interface StoredAccessGrant {
  id: string;
  provider: string;
  specialty: string;
  address: string;
  status: 'Active' | 'Expired' | 'Revoked' | 'Pending';
  scope: string;
  grantedAt: number;
  expiresAt: number;
  lastAccess: number | null;
  accessCount: number;
  txHash: string;
  attestation: string;
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
  ownerAddress: string;
}
