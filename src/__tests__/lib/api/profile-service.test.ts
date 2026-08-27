/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  getProfile,
  updateProfile,
  eraseProfile,
  __resetProfileForTests,
} from '@/lib/api/profile-service';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(600);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetProfileForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetProfileForTests();
  jest.clearAllMocks();
});

describe('profile-service', () => {
  it('returns empty defaults when no profile has been set', async () => {
    expect(await getProfile(USER)).toEqual({
      displayName: '', contactEmail: '', timezone: '', locale: '', updatedAt: null,
    });
  });

  it('persists a profile and reads it back, owner-scoped', async () => {
    const saved = await updateProfile(USER, {
      displayName: 'Ada', contactEmail: 'ada@example.com', timezone: 'UTC', locale: 'en',
    });
    expect(saved.displayName).toBe('Ada');
    expect(saved.updatedAt).not.toBeNull();

    const fetched = await getProfile(USER);
    expect(fetched.displayName).toBe('Ada');
    expect(fetched.contactEmail).toBe('ada@example.com');

    // owner-scoped: a different user has no profile
    expect((await getProfile(seededAddress(601))).displayName).toBe('');
  });

  it('merges partial updates, leaving untouched fields intact', async () => {
    await updateProfile(USER, { displayName: 'Ada', timezone: 'UTC' });
    const merged = await updateProfile(USER, { displayName: 'Ada Lovelace' });

    expect(merged.displayName).toBe('Ada Lovelace'); // changed
    expect(merged.timezone).toBe('UTC'); // preserved
  });

  it('an empty update preserves every existing field', async () => {
    await updateProfile(USER, {
      displayName: 'Ada', contactEmail: 'ada@example.com', timezone: 'UTC', locale: 'en',
    });
    const result = await updateProfile(USER, {});
    expect(result).toMatchObject({
      displayName: 'Ada', contactEmail: 'ada@example.com', timezone: 'UTC', locale: 'en',
    });
  });

  it('erases the profile (returns 1), and is a no-op when absent (returns 0)', async () => {
    await updateProfile(USER, { displayName: 'Ada' });
    expect(await eraseProfile(USER)).toBe(1);
    expect((await getProfile(USER)).displayName).toBe(''); // gone
    expect(await eraseProfile(USER)).toBe(0); // nothing left to erase
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetProfileForTests();

    expect((await getProfile(USER)).displayName).toBe('');
    expect(pgQuery).toHaveBeenCalled();
  });
});
