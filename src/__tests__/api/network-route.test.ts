/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return {
    ...actual,
    runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)),
  };
});

jest.mock('@/lib/api/network-status', () => {
  class NetworkRpcError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NetworkRpcError';
    }
  }
  return {
    NetworkRpcError,
    getLiveNetworkStatus: jest.fn(),
  };
});

import { NextRequest, NextResponse } from 'next/server';

import { GET } from '@/app/api/network/status/route';
import { runMiddleware } from '@/lib/api/middleware';
import { getLiveNetworkStatus, NetworkRpcError } from '@/lib/api/network-status';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;
const mockedGetLiveNetworkStatus = getLiveNetworkStatus as jest.MockedFunction<
  typeof getLiveNetworkStatus
>;
const originalRpcUrl = process.env.SHIORA_L1_RPC_URL;

describe('/api/network/status', () => {
  beforeEach(() => {
    process.env.SHIORA_L1_RPC_URL = 'https://rpc.testnet.example';
    mockedGetLiveNetworkStatus.mockResolvedValue({
      blockHeight: 100,
      tps: 4,
      epoch: null,
      networkLoad: 25,
      aethelPrice: null,
      lastBlockTime: 1_700_000_000_000,
      recentBlocks: [],
      chainId: '7332',
      source: 'evm-json-rpc',
    });
  });

  afterEach(() => {
    mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
      const actual = jest.requireActual('@/lib/api/middleware');
      return actual.runMiddleware(...args);
    });
    jest.clearAllMocks();
    if (originalRpcUrl === undefined) {
      delete process.env.SHIORA_L1_RPC_URL;
    } else {
      process.env.SHIORA_L1_RPC_URL = originalRpcUrl;
    }
  });

  it('returns live network telemetry from the configured RPC', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/network/status'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      blockHeight: 100,
      chainId: '7332',
      source: 'evm-json-rpc',
      aethelPrice: null,
    });
    expect(mockedGetLiveNetworkStatus).toHaveBeenCalledWith(
      'https://rpc.testnet.example',
      undefined,
    );
  });

  it('passes a requested block height to the RPC service', async () => {
    mockedGetLiveNetworkStatus.mockResolvedValue({
      height: 99,
      hash: `0x${'a'.repeat(64)}`,
      txCount: 1,
      proposer: '0x0000000000000000000000000000000000000001',
      timestamp: 1_700_000_000_000,
      gasUsed: 21_000,
    });
    await GET(new NextRequest('http://localhost:3000/api/network/status?block=99'));
    expect(mockedGetLiveNetworkStatus).toHaveBeenCalledWith('https://rpc.testnet.example', 99);
  });

  it('fails closed when no live RPC is configured', async () => {
    delete process.env.SHIORA_L1_RPC_URL;
    const response = await GET(new NextRequest('http://localhost:3000/api/network/status'));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('NETWORK_RPC_NOT_CONFIGURED');
  });

  it('maps an unavailable upstream RPC to 502', async () => {
    mockedGetLiveNetworkStatus.mockRejectedValue(
      new NetworkRpcError('The chain endpoint is unavailable.'),
    );
    const response = await GET(new NextRequest('http://localhost:3000/api/network/status'));
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('NETWORK_RPC_UNAVAILABLE');
  });

  it('does not misclassify unexpected programming errors as an unavailable RPC', async () => {
    mockedGetLiveNetworkStatus.mockRejectedValue(new TypeError('unexpected response shape'));
    await expect(GET(new NextRequest('http://localhost:3000/api/network/status'))).rejects.toThrow(
      'unexpected response shape',
    );
  });

  it('returns middleware errors before contacting the chain', async () => {
    mockedRunMiddleware.mockResolvedValueOnce(
      NextResponse.json({ error: 'blocked' }, { status: 403 }),
    );
    const response = await GET(new NextRequest('http://localhost:3000/api/network/status'));
    expect(response.status).toBe(403);
    expect(mockedGetLiveNetworkStatus).not.toHaveBeenCalled();
  });
});
