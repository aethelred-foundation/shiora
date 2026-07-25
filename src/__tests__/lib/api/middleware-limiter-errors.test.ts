/** @jest-environment node */

const mockConsume = jest.fn();

jest.mock('@/lib/api/rate-limiter', () => ({
  getRateLimiter: () => ({ consume: mockConsume }),
}));

import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/api/middleware';

describe('checkRateLimit unexpected limiter failures', () => {
  it('rethrows an unknown failure instead of misclassifying it', async () => {
    const unexpected = new Error('limiter programming error');
    mockConsume.mockRejectedValueOnce(unexpected);

    await expect(
      checkRateLimit(
        new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-forwarded-for': 'coverage-limiter-error' },
        }),
        10,
      ),
    ).rejects.toBe(unexpected);
  });
});
