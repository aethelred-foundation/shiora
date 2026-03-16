// ============================================================
// Shiora on Aethelred — Shared Utilities
// Deterministic mock data generators and formatting helpers
// ============================================================

/**
 * Deterministic pseudo-random number generator using sine function.
 * Used for generating consistent mock data across SSR and client.
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a random float in [min, max) range from a seed.
 */
export function seededRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

/**
 * Generate a random integer in [min, max] range from a seed.
 */
export function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRange(seed, min, max + 1));
}

/**
 * Generate a hexadecimal string of given length from a seed.
 */
export function seededHex(seed: number, length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(seededRandom(seed + i * 7 + 3) * chars.length)];
  }
  return result;
}

/**
 * Generate an Aethelred-style address from a seed.
 */
export function seededAddress(seed: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let addr = 'aeth1';
  for (let i = 0; i < 38; i++) {
    addr += chars[Math.floor(seededRandom(seed + i + 1) * chars.length)];
  }
  return addr;
}

/**
 * Pick a random item from an array using a seed.
 */
export function seededPick<T>(seed: number, items: readonly T[]): T {
  return items[Math.floor(seededRandom(seed) * items.length)];
}

/**
 * Format a number with compact notation (K, M, B suffixes).
 */
export function formatNumber(n: number, decimals = 0): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals > 0 ? decimals : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(decimals > 0 ? decimals : 1)}K`;
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a number using locale-aware full formatting (e.g., 1,234,567).
 */
export function formatFullNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Truncate a long address/hash for display.
 */
export function truncateAddress(addr: string, startLen = 10, endLen = 6): string {
  if (!addr) return '';
  if (addr.length <= startLen + endLen + 3) return addr;
  return `${addr.slice(0, startLen)}...${addr.slice(-endLen)}`;
}

/**
 * Copy text to clipboard with error suppression.
 */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text).catch(() => {});
}

/**
 * Format a timestamp to readable date string.
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a timestamp to readable date + time string.
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Generate a mock IPFS CID from a seed.
 */
export function generateCID(seed: number): string {
  return `Qm${seededHex(seed, 44)}`;
}

/**
 * Generate a mock TEE attestation hash from a seed.
 */
export function generateAttestation(seed: number): string {
  return `0x${seededHex(seed, 64)}`;
}

/**
 * Generate a mock transaction hash from a seed.
 */
export function generateTxHash(seed: number): string {
  return `0x${seededHex(seed * 3 + 7, 64)}`;
}

/**
 * Calculate days between a timestamp and now.
 */
export function daysFromNow(timestamp: number): number {
  const now = Date.now();
  return Math.round((timestamp - now) / (1000 * 60 * 60 * 24));
}

/**
 * Generate a time-ago string from a timestamp.
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(timestamp);
}

/**
 * Generate a day label for a given number of days ago.
 */
export function generateDayLabel(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format a percentage with fixed decimals.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
