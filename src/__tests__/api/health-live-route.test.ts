/** @jest-environment node */

import { GET } from '@/app/api/health/live/route';

describe('/api/health/live', () => {
  it('returns 200 with an alive status and timestamp', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('alive');
    expect(typeof body.data.timestamp).toBe('string');
  });
});
