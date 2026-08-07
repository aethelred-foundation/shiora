/** @jest-environment node */

import { getLiveNetworkStatus, NetworkRpcError } from '@/lib/api/network-status';

function rpcResponse(result: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: '2.0',
      id: 1,
      result,
    }),
  } as Response;
}

function evmBlock(height: number) {
  return {
    number: `0x${height.toString(16)}`,
    hash: `0x${height.toString(16).padStart(64, '0')}`,
    transactions: Array.from({ length: height % 5 }, (_, index) => `0x${index}`),
    miner: '0x0000000000000000000000000000000000000001',
    timestamp: `0x${(1_700_000_000 + height * 3).toString(16)}`,
    gasUsed: '0x4c4b40',
    gasLimit: '0x989680',
  };
}

describe('getLiveNetworkStatus', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string;
        params: unknown[];
      };
      if (body.method === 'eth_chainId') {
        return rpcResponse('0x1ca4');
      }
      if (body.method === 'eth_getBlockByNumber') {
        const tag = String(body.params[0]);
        const height = tag === 'latest' ? 100 : Number.parseInt(tag.slice(2), 16);
        return rpcResponse(evmBlock(height));
      }
      throw new Error(`Unexpected method ${body.method}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('derives bounded live metrics from recent EVM blocks', async () => {
    const result = await getLiveNetworkStatus('https://rpc.testnet.example');
    expect('recentBlocks' in result).toBe(true);
    if (!('recentBlocks' in result)) return;

    expect(result).toMatchObject({
      blockHeight: 100,
      chainId: '7332',
      epoch: null,
      aethelPrice: null,
      networkLoad: 50,
      source: 'evm-json-rpc',
    });
    expect(result.recentBlocks).toHaveLength(5);
    expect(result.lastBlockTime).toBe((1_700_000_000 + 100 * 3) * 1000);
    expect(result.tps).toBeGreaterThanOrEqual(0);
  });

  it('returns a requested block without inventing missing fields', async () => {
    const result = await getLiveNetworkStatus('https://rpc.testnet.example', 42);
    expect(result).toMatchObject({
      height: 42,
      proposer: '0x0000000000000000000000000000000000000001',
      gasUsed: 5_000_000,
    });
  });

  it('rejects unsafe requested block heights', async () => {
    await expect(
      getLiveNetworkStatus('https://rpc.testnet.example', Number.NaN),
    ).rejects.toBeInstanceOf(NetworkRpcError);
    await expect(getLiveNetworkStatus('https://rpc.testnet.example', -1)).rejects.toBeInstanceOf(
      NetworkRpcError,
    );
  });

  it('rejects invalid and unsupported hexadecimal chain values', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse('not-hex'));
    await expect(getLiveNetworkStatus('https://rpc.testnet.example')).rejects.toThrow(
      'invalid chain ID',
    );

    (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse('0x20000000000000'));
    await expect(getLiveNetworkStatus('https://rpc.testnet.example')).rejects.toThrow(
      'unsupported chain ID',
    );
  });

  it('rejects non-successful and incomplete JSON-RPC responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
    } as Response);
    await expect(getLiveNetworkStatus('https://rpc.testnet.example')).rejects.toThrow('HTTP 502');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1 }),
    } as Response);
    await expect(getLiveNetworkStatus('https://rpc.testnet.example')).rejects.toThrow(
      'incomplete JSON-RPC response',
    );
  });

  it('rejects JSON-RPC errors without exposing a false success', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'upstream unavailable' },
      }),
    } as Response);

    await expect(getLiveNetworkStatus('https://rpc.testnet.example')).rejects.toThrow(
      'The chain rejected the request',
    );
  });

  it('reports requested and latest blocks that are absent upstream', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(rpcResponse('0x1ca4'))
      .mockResolvedValueOnce(rpcResponse(null));
    await expect(getLiveNetworkStatus('https://rpc.testnet.example', 42)).rejects.toThrow(
      'requested block was not found',
    );

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(rpcResponse('0x1ca4'))
      .mockResolvedValueOnce(rpcResponse(null));
    await expect(getLiveNetworkStatus('https://rpc.testnet.example')).rejects.toThrow(
      'did not return a latest block',
    );
  });

  it('maps optional block fields without inventing a proposer or transaction count', async () => {
    const block = {
      ...evmBlock(42),
      transactions: 'not-an-array',
      miner: undefined,
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(rpcResponse('0x1ca4'))
      .mockResolvedValueOnce(rpcResponse(block));

    await expect(getLiveNetworkStatus('https://rpc.testnet.example', 42)).resolves.toMatchObject({
      height: 42,
      txCount: 0,
      proposer: '',
    });
  });

  it('handles a genesis-only chain with a zero gas limit', async () => {
    const block = {
      ...evmBlock(0),
      gasUsed: '0x0',
      gasLimit: '0x0',
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(rpcResponse('0x1ca4'))
      .mockResolvedValueOnce(rpcResponse(block));

    await expect(getLiveNetworkStatus('https://rpc.testnet.example')).resolves.toMatchObject({
      blockHeight: 0,
      tps: 0,
      networkLoad: 0,
    });
  });

  it('filters absent historical blocks and avoids throughput over zero elapsed time', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string;
        params: unknown[];
      };
      if (body.method === 'eth_chainId') {
        return rpcResponse('0x1ca4');
      }

      const tag = String(body.params[0]);
      const height = tag === 'latest' ? 4 : Number.parseInt(tag.slice(2), 16);
      if (height === 2) {
        return rpcResponse(null);
      }
      return rpcResponse({
        ...evmBlock(height),
        timestamp: '0x6553f100',
      });
    });

    const result = await getLiveNetworkStatus('https://rpc.testnet.example');
    expect('recentBlocks' in result).toBe(true);
    if (!('recentBlocks' in result)) return;
    expect(result.recentBlocks).toHaveLength(4);
    expect(result.tps).toBe(0);
  });
});
