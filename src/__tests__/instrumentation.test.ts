/** @jest-environment node */

jest.mock('@/lib/crypto/key-provider', () => ({ preloadKeyProvider: jest.fn() }));
jest.mock('@/lib/api/preflight', () => ({ assertProductionReadiness: jest.fn() }));

import { register } from '@/instrumentation';
import { preloadKeyProvider } from '@/lib/crypto/key-provider';
import { assertProductionReadiness } from '@/lib/api/preflight';

const mockPreload = preloadKeyProvider as jest.Mock;
const mockAssert = assertProductionReadiness as jest.Mock;
const originalRuntime = process.env.NEXT_RUNTIME;

afterEach(() => {
  if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = originalRuntime;
  jest.clearAllMocks();
});

describe('register (startup instrumentation)', () => {
  it('is a no-op outside the nodejs runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    await register();
    expect(mockPreload).not.toHaveBeenCalled();
    expect(mockAssert).not.toHaveBeenCalled();
  });

  it('warms key custody and asserts production readiness on the nodejs runtime', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    await register();
    expect(mockPreload).toHaveBeenCalledTimes(1);
    expect(mockAssert).toHaveBeenCalledTimes(1);
  });
});
