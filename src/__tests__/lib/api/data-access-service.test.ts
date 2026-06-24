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
  __resetDataRequestsForTests,
} from '@/lib/api/data-access-service';
import { seededAddress } from '@/lib/utils';

const RESEARCHER = seededAddress(900);
const RESEARCHER_B = seededAddress(901);
const STEWARD = seededAddress(902);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetDataRequestsForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetDataRequestsForTests();
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

  it('records an approval decision', async () => {
    const created = await createDataRequest(RESEARCHER, 'l1', 'a');
    const decided = await decideDataRequest(created.id, STEWARD, 'approved');
    expect(decided?.status).toBe('approved');
    expect(decided?.decidedBy).toBe(STEWARD);
    expect(decided?.decidedAt).not.toBeNull();
  });

  it('returns undefined when deciding an unknown request', async () => {
    expect(await decideDataRequest('dar-nope', STEWARD, 'denied')).toBeUndefined();
  });

  it('returns undefined when the request is no longer pending', async () => {
    const created = await createDataRequest(RESEARCHER, 'l1', 'a');
    await decideDataRequest(created.id, STEWARD, 'approved');
    expect(await decideDataRequest(created.id, STEWARD, 'denied')).toBeUndefined();
  });

  it('uses the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetDataRequestsForTests();
    expect(await listAllDataRequests()).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
