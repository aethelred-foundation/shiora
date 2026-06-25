/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

import {
  createDataRequest,
  listRequestsByRequester,
  listAllDataRequests,
  decideDataRequest,
  revokeDataRequest,
  listActiveGrants,
  dataRequestStats,
  __resetDataRequestsForTests,
} from '@/lib/api/data-access-service';
import { listNotifications, __resetNotificationsForTests } from '@/lib/api/notification-service';
import { seededAddress } from '@/lib/utils';

const DAY = 86_400_000;

const RESEARCHER = seededAddress(900);
const RESEARCHER_B = seededAddress(901);
const STEWARD = seededAddress(902);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetDataRequestsForTests();
  __resetNotificationsForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetDataRequestsForTests();
  __resetNotificationsForTests();
  jest.restoreAllMocks();
});

describe('data-access-service', () => {
  it('creates a pending request and lists it for the requester, newest first', async () => {
    let clock = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));

    await createDataRequest(RESEARCHER, 'listing-1', 'cohort study');
    await createDataRequest(RESEARCHER, 'listing-2', 'second study');

    const list = await listRequestsByRequester(RESEARCHER);
    expect(list).toHaveLength(2);
    expect(list[0].listingId).toBe('listing-2'); // newest first
    expect(list[0].status).toBe('pending');
    expect(list[0].decidedBy).toBeNull();
    expect(list[0].decidedAt).toBeNull();
  });

  it('scopes a requester listing and aggregates all for review', async () => {
    await createDataRequest(RESEARCHER, 'l1', 'a');
    await createDataRequest(RESEARCHER_B, 'l2', 'b');
    expect(await listRequestsByRequester(RESEARCHER)).toHaveLength(1);
    expect(await listAllDataRequests()).toHaveLength(2);
  });

  it('records an approval decision and grants time-bound access', async () => {
    const created = await createDataRequest(RESEARCHER, 'l1', 'a');
    expect(created.expiresAt).toBe(0); // no grant while pending
    const decided = await decideDataRequest(created.id, STEWARD, 'approved');
    expect(decided?.status).toBe('approved');
    expect(decided?.decidedBy).toBe(STEWARD);
    expect(decided?.expiresAt).toBeGreaterThan(Date.now()); // grant has a future expiry
  });

  it('records a denial without granting access', async () => {
    const created = await createDataRequest(RESEARCHER, 'l1', 'a');
    const decided = await decideDataRequest(created.id, STEWARD, 'denied');
    expect(decided?.status).toBe('denied');
    expect(decided?.expiresAt).toBe(0);
  });

  it('notifies the requester when a decision is made', async () => {
    const created = await createDataRequest(RESEARCHER, 'cohort-7', 'study');
    await decideDataRequest(created.id, STEWARD, 'approved');

    const inbox = await listNotifications(RESEARCHER);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].type).toBe('data_request_decision');
    expect(inbox[0].title).toBe('Data access approved');
  });

  it('returns undefined when deciding an unknown request', async () => {
    expect(await decideDataRequest('dar-nope', STEWARD, 'denied')).toBeUndefined();
  });

  it('returns undefined when the request is no longer pending', async () => {
    const created = await createDataRequest(RESEARCHER, 'l1', 'a');
    await decideDataRequest(created.id, STEWARD, 'approved');
    expect(await decideDataRequest(created.id, STEWARD, 'denied')).toBeUndefined();
  });

  it('revokes an approved request and rejects revoking a non-approved one', async () => {
    const created = await createDataRequest(RESEARCHER, 'l1', 'a');
    expect(await revokeDataRequest(created.id, STEWARD)).toBeUndefined(); // still pending
    expect(await revokeDataRequest('dar-nope', STEWARD)).toBeUndefined(); // unknown

    await decideDataRequest(created.id, STEWARD, 'approved');
    const revoked = await revokeDataRequest(created.id, STEWARD);
    expect(revoked?.status).toBe('revoked');
    expect(revoked?.expiresAt).toBe(0);
  });

  it('lists only active (approved, unexpired) grants for a requester', async () => {
    const approved = await createDataRequest(RESEARCHER, 'l1', 'a');
    const pending = await createDataRequest(RESEARCHER, 'l2', 'b');
    await decideDataRequest(approved.id, STEWARD, 'approved');

    const now = Date.now();
    expect(await listActiveGrants(RESEARCHER, now)).toHaveLength(1); // approved + unexpired
    expect(await listActiveGrants(RESEARCHER, now + 365 * DAY)).toHaveLength(0); // grant lapsed
    expect(pending.status).toBe('pending'); // pending never counts as a grant
  });

  it('summarises request counts including expired grants', async () => {
    const approved = await createDataRequest(RESEARCHER, 'l1', 'a');
    const denied = await createDataRequest(RESEARCHER, 'l2', 'b');
    const revoked = await createDataRequest(RESEARCHER, 'l3', 'c');
    await createDataRequest(RESEARCHER, 'l4', 'd'); // stays pending
    await decideDataRequest(approved.id, STEWARD, 'approved');
    await decideDataRequest(denied.id, STEWARD, 'denied');
    await decideDataRequest(revoked.id, STEWARD, 'approved');
    await revokeDataRequest(revoked.id, STEWARD);

    const now = Date.now();
    expect(await dataRequestStats(now)).toEqual({ pending: 1, approved: 1, denied: 1, revoked: 1, expired: 0 });
    // far in the future, the live grant reads as expired
    const future = await dataRequestStats(now + 365 * DAY);
    expect(future.expired).toBe(1);
    expect(future.approved).toBe(0);
  });

  it('uses the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetDataRequestsForTests();
    expect(await listAllDataRequests()).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
