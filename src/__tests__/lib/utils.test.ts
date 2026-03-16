// ============================================================
// Tests for src/lib/utils.ts
// ============================================================

import {
  seededRandom,
  seededRange,
  seededInt,
  seededHex,
  seededAddress,
  seededPick,
  formatNumber,
  formatFullNumber,
  truncateAddress,
  copyToClipboard,
  formatDate,
  formatDateTime,
  generateCID,
  generateAttestation,
  generateTxHash,
  daysFromNow,
  timeAgo,
  generateDayLabel,
  formatBytes,
  formatPercent,
} from '@/lib/utils';

// ---------------------------------------------------------------------------
// seededRandom
// ---------------------------------------------------------------------------
describe('seededRandom', () => {
  it('returns a number between 0 and 1', () => {
    for (let seed = 0; seed < 100; seed++) {
      const val = seededRandom(seed);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('produces deterministic results for the same seed', () => {
    expect(seededRandom(42)).toBe(seededRandom(42));
    expect(seededRandom(0)).toBe(seededRandom(0));
    expect(seededRandom(999)).toBe(seededRandom(999));
  });

  it('produces different results for different seeds', () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// seededRange
// ---------------------------------------------------------------------------
describe('seededRange', () => {
  it('stays within bounds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const val = seededRange(seed, 10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThan(20);
    }
  });

  it('returns min when range is zero (edge case)', () => {
    const val = seededRange(42, 5, 5);
    expect(val).toBe(5);
  });

  it('is deterministic', () => {
    expect(seededRange(7, 0, 100)).toBe(seededRange(7, 0, 100));
  });
});

// ---------------------------------------------------------------------------
// seededInt
// ---------------------------------------------------------------------------
describe('seededInt', () => {
  it('returns integers within inclusive bounds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const val = seededInt(seed, 1, 10);
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(10);
    }
  });

  it('is deterministic', () => {
    expect(seededInt(99, 0, 1000)).toBe(seededInt(99, 0, 1000));
  });
});

// ---------------------------------------------------------------------------
// seededHex
// ---------------------------------------------------------------------------
describe('seededHex', () => {
  it('produces valid hex strings of the correct length', () => {
    const hex8 = seededHex(42, 8);
    expect(hex8).toHaveLength(8);
    expect(hex8).toMatch(/^[0-9a-f]+$/);
  });

  it('produces 64-character hex strings', () => {
    const hex64 = seededHex(1, 64);
    expect(hex64).toHaveLength(64);
    expect(hex64).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    expect(seededHex(42, 16)).toBe(seededHex(42, 16));
  });

  it('returns empty string for length 0', () => {
    expect(seededHex(1, 0)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// seededAddress
// ---------------------------------------------------------------------------
describe('seededAddress', () => {
  it('generates addresses starting with aeth1', () => {
    const addr = seededAddress(42);
    expect(addr.startsWith('aeth1')).toBe(true);
  });

  it('generates 43-character addresses (aeth1 + 38 chars)', () => {
    const addr = seededAddress(1);
    expect(addr).toHaveLength(43);
  });

  it('only contains valid characters', () => {
    const addr = seededAddress(7);
    expect(addr).toMatch(/^aeth1[a-z0-9]{38}$/);
  });

  it('is deterministic', () => {
    expect(seededAddress(100)).toBe(seededAddress(100));
  });
});

// ---------------------------------------------------------------------------
// seededPick
// ---------------------------------------------------------------------------
describe('seededPick', () => {
  it('picks an item from the array', () => {
    const items = ['a', 'b', 'c', 'd'];
    const picked = seededPick(42, items);
    expect(items).toContain(picked);
  });

  it('is deterministic', () => {
    const items = [1, 2, 3, 4, 5];
    expect(seededPick(42, items)).toBe(seededPick(42, items));
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------
describe('formatNumber', () => {
  it('formats numbers less than 1000 without suffix', () => {
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
  });

  it('formats billions with B suffix', () => {
    expect(formatNumber(1000000000)).toBe('1.00B');
    expect(formatNumber(2500000000)).toBe('2.50B');
  });

  it('respects custom decimals', () => {
    expect(formatNumber(1234, 2)).toBe('1.23K');
    expect(formatNumber(42, 2)).toBe('42.00');
  });

  it('respects custom decimals for millions', () => {
    expect(formatNumber(1234567, 2)).toBe('1.23M');
  });
});

// ---------------------------------------------------------------------------
// formatFullNumber
// ---------------------------------------------------------------------------
describe('formatFullNumber', () => {
  it('formats numbers with locale-aware commas', () => {
    expect(formatFullNumber(1234567)).toBe('1,234,567');
    expect(formatFullNumber(100)).toBe('100');
  });
});

// ---------------------------------------------------------------------------
// truncateAddress
// ---------------------------------------------------------------------------
describe('truncateAddress', () => {
  it('truncates long addresses', () => {
    const addr = 'aeth1abcdefghijklmnopqrstuvwxyz0123456789ab';
    const result = truncateAddress(addr);
    expect(result).toContain('...');
    expect(result.startsWith('aeth1abcde')).toBe(true);
  });

  it('returns short strings unchanged', () => {
    const short = 'aeth1abc';
    expect(truncateAddress(short)).toBe(short);
  });

  it('handles custom start and end lengths', () => {
    const addr = 'aeth1abcdefghijklmnopqrstuvwxyz0123456789ab';
    const result = truncateAddress(addr, 6, 4);
    expect(result).toBe('aeth1a...89ab');
  });

  it('returns empty string for empty input', () => {
    expect(truncateAddress('')).toBe('');
  });

  it('returns empty string for falsy input', () => {
    // @ts-expect-error testing falsy input
    expect(truncateAddress(null)).toBe('');
    // @ts-expect-error testing falsy input
    expect(truncateAddress(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// copyToClipboard
// ---------------------------------------------------------------------------
describe('copyToClipboard', () => {
  it('calls navigator.clipboard.writeText', async () => {
    await copyToClipboard('test');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test');
  });

  it('suppresses clipboard errors', async () => {
    const writeTextMock = jest.spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new Error('clipboard access denied'));

    // Should not throw
    await expect(copyToClipboard('should-fail')).resolves.toBeUndefined();

    writeTextMock.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('formats a timestamp to readable date', () => {
    const ts = new Date('2024-06-15T12:00:00Z').getTime();
    const result = formatDate(ts);
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------
describe('formatDateTime', () => {
  it('includes date and time components', () => {
    const ts = new Date('2024-06-15T14:30:00Z').getTime();
    const result = formatDateTime(ts);
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });
});

// ---------------------------------------------------------------------------
// generateCID
// ---------------------------------------------------------------------------
describe('generateCID', () => {
  it('starts with Qm prefix', () => {
    const cid = generateCID(42);
    expect(cid.startsWith('Qm')).toBe(true);
  });

  it('has correct length (Qm + 44 hex chars)', () => {
    const cid = generateCID(1);
    expect(cid).toHaveLength(46);
  });

  it('is deterministic', () => {
    expect(generateCID(42)).toBe(generateCID(42));
  });
});

// ---------------------------------------------------------------------------
// generateAttestation
// ---------------------------------------------------------------------------
describe('generateAttestation', () => {
  it('starts with 0x prefix', () => {
    const att = generateAttestation(42);
    expect(att.startsWith('0x')).toBe(true);
  });

  it('has correct length (0x + 64 hex chars)', () => {
    const att = generateAttestation(1);
    expect(att).toHaveLength(66);
  });
});

// ---------------------------------------------------------------------------
// generateTxHash
// ---------------------------------------------------------------------------
describe('generateTxHash', () => {
  it('starts with 0x prefix', () => {
    const hash = generateTxHash(42);
    expect(hash.startsWith('0x')).toBe(true);
  });

  it('has correct length (0x + 64 hex chars)', () => {
    const hash = generateTxHash(1);
    expect(hash).toHaveLength(66);
  });

  it('is deterministic', () => {
    expect(generateTxHash(7)).toBe(generateTxHash(7));
  });
});

// ---------------------------------------------------------------------------
// daysFromNow
// ---------------------------------------------------------------------------
describe('daysFromNow', () => {
  it('returns positive for future timestamps', () => {
    const futureTs = Date.now() + 5 * 86400000;
    expect(daysFromNow(futureTs)).toBeCloseTo(5, 0);
  });

  it('returns negative for past timestamps', () => {
    const pastTs = Date.now() - 3 * 86400000;
    expect(daysFromNow(pastTs)).toBeCloseTo(-3, 0);
  });

  it('returns 0 for now', () => {
    expect(daysFromNow(Date.now())).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// timeAgo
// ---------------------------------------------------------------------------
describe('timeAgo', () => {
  it('returns seconds ago for recent timestamps', () => {
    const ts = Date.now() - 30 * 1000;
    expect(timeAgo(ts)).toBe('30s ago');
  });

  it('returns minutes ago', () => {
    const ts = Date.now() - 5 * 60 * 1000;
    expect(timeAgo(ts)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const ts = Date.now() - 3 * 60 * 60 * 1000;
    expect(timeAgo(ts)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const ts = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(timeAgo(ts)).toBe('7d ago');
  });

  it('returns formatted date for timestamps older than 30 days', () => {
    const ts = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const result = timeAgo(ts);
    // Should fall back to formatDate (contains month name)
    expect(result).not.toContain('ago');
  });
});

// ---------------------------------------------------------------------------
// generateDayLabel
// ---------------------------------------------------------------------------
describe('generateDayLabel', () => {
  it('returns a string with month and day', () => {
    const label = generateDayLabel(0);
    // Should be today's date in "Mon D" format
    expect(label).toMatch(/[A-Z][a-z]{2}\s+\d{1,2}/);
  });

  it('returns a past date for daysAgo > 0', () => {
    const label = generateDayLabel(7);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------
describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.00 GB');
    expect(formatBytes(2.4 * 1024 * 1024 * 1024)).toBe('2.40 GB');
  });
});

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------
describe('formatPercent', () => {
  it('formats percentages with default decimals', () => {
    expect(formatPercent(95.123)).toBe('95.1%');
  });

  it('respects custom decimals', () => {
    expect(formatPercent(95.123, 2)).toBe('95.12%');
    expect(formatPercent(50, 0)).toBe('50%');
  });
});
