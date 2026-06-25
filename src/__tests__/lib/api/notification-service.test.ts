/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  notify,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  __resetNotificationsForTests,
} from '@/lib/api/notification-service';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(700);
const OTHER = seededAddress(701);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetNotificationsForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetNotificationsForTests();
  jest.restoreAllMocks();
});

const sample = (title: string) => ({ type: 'system' as const, title, body: `${title} body` });

describe('notification-service', () => {
  it('emits notifications and lists them newest-first, scoped to the owner', async () => {
    let clock = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));

    const first = await notify(USER, sample('First'));
    expect(first.read).toBe(false);
    await notify(USER, sample('Second'));

    const list = await listNotifications(USER);
    expect(list.map((n) => n.title)).toEqual(['Second', 'First']); // newest first
    expect(await listNotifications(OTHER)).toEqual([]); // owner-scoped
  });

  it('filters to unread and counts them', async () => {
    const a = await notify(USER, sample('A'));
    await notify(USER, sample('B'));
    expect(await unreadCount(USER)).toBe(2);

    await markRead(USER, a.id);
    expect(await unreadCount(USER)).toBe(1);
    expect((await listNotifications(USER, { unreadOnly: true })).map((n) => n.title)).toEqual(['B']);
    expect(await listNotifications(USER)).toHaveLength(2); // all, including read
  });

  it('returns undefined when marking an unknown notification', async () => {
    expect(await markRead(USER, 'ntf-nope')).toBeUndefined();
  });

  it('marks all unread read and reports the count', async () => {
    await notify(USER, sample('A'));
    await notify(USER, sample('B'));
    expect(await markAllRead(USER)).toBe(2);
    expect(await unreadCount(USER)).toBe(0);
    expect(await markAllRead(USER)).toBe(0); // nothing left to mark
  });

  it('uses the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetNotificationsForTests();
    expect(await listNotifications(USER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
