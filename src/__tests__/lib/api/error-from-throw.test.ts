/** @jest-environment node */

import { z } from 'zod';
import { errorFromThrow } from '@/lib/api/responses';
import { DatastoreUnavailableError } from '@/lib/persistence/datastore-errors';

describe('errorFromThrow (graceful degradation, GAP-05)', () => {
  it('maps a ZodError to 422 VALIDATION_ERROR', async () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: 'x' });
    const res = errorFromThrow((parsed as { error: unknown }).error);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(422);
    expect((await res!.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('maps a DatastoreUnavailableError to 503 with Retry-After', async () => {
    const res = errorFromThrow(new DatastoreUnavailableError());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    expect(res!.headers.get('Retry-After')).toBe('5');
    expect((await res!.json()).error.code).toBe('DATASTORE_UNAVAILABLE');
  });

  it('returns null for an unrecognized error so the caller rethrows (genuine 500)', () => {
    expect(errorFromThrow(new Error('unexpected bug'))).toBeNull();
    expect(errorFromThrow('not even an error')).toBeNull();
  });
});
