/** @jest-environment node */

import {
  LocalAnchorClient,
  JsonRpcAnchorClient,
  getAnchorClient,
  isOnChainAnchoringConfigured,
  finalityConfirmations,
  __resetAnchorClientForTests,
} from '@/lib/api/anchoring/anchor-client';

const L1_ENVS = ['SHIORA_L1_RPC_URL', 'SHIORA_L1_ANCHOR_FROM', 'SHIORA_L1_ANCHOR_TO'];
const realFetch = global.fetch;

function configureL1(): void {
  process.env.SHIORA_L1_RPC_URL = 'https://l1.example/rpc';
  process.env.SHIORA_L1_ANCHOR_FROM = '0xfrom';
  process.env.SHIORA_L1_ANCHOR_TO = '0xto';
}

afterEach(() => {
  [...L1_ENVS, 'SHIORA_L1_FINALITY_CONFIRMATIONS'].forEach((k) => delete process.env[k]);
  global.fetch = realFetch;
  __resetAnchorClientForTests();
  jest.clearAllMocks();
});

describe('isOnChainAnchoringConfigured', () => {
  it('is true when all L1 settings are present', () => {
    configureL1();
    expect(isOnChainAnchoringConfigured()).toBe(true);
  });

  it.each(L1_ENVS)('is false when %s is missing', (missing) => {
    configureL1();
    delete process.env[missing];
    expect(isOnChainAnchoringConfigured()).toBe(false);
  });
});

describe('finalityConfirmations', () => {
  it('defaults to 12 and rejects non-positive / non-integer overrides', () => {
    expect(finalityConfirmations()).toBe(12);
    process.env.SHIORA_L1_FINALITY_CONFIRMATIONS = '0';
    expect(finalityConfirmations()).toBe(12);
    process.env.SHIORA_L1_FINALITY_CONFIRMATIONS = 'abc';
    expect(finalityConfirmations()).toBe(12);
    process.env.SHIORA_L1_FINALITY_CONFIRMATIONS = '30';
    expect(finalityConfirmations()).toBe(30);
  });
});

describe('LocalAnchorClient', () => {
  it('records locally without broadcasting', async () => {
    const receipt = await new LocalAnchorClient().submit('abc123');
    expect(receipt.status).toBe('local');
    expect(receipt.ref).toBe('local:abc123');
    expect(receipt.target).toBe('local');
    expect(typeof receipt.submittedAt).toBe('number');
  });

  it('confirms immediately — a local record is final as soon as it is written', async () => {
    expect(await new LocalAnchorClient().confirm('local:abc123')).toBe('confirmed');
  });
});

describe('JsonRpcAnchorClient', () => {
  const client = () => new JsonRpcAnchorClient('https://l1.example/rpc', '0xfrom', '0xto');

  it('submits via eth_sendTransaction and returns the tx hash', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: '0xtxhash' }),
    });

    const receipt = await client().submit('deadbeef');
    expect(receipt).toMatchObject({ ref: '0xtxhash', status: 'on-chain', target: 'https://l1.example/rpc' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://l1.example/rpc');
    const sent = JSON.parse((init as { body: string }).body);
    expect(sent.method).toBe('eth_sendTransaction');
    expect(sent.params[0]).toEqual({ from: '0xfrom', to: '0xto', data: '0xdeadbeef' });
  });

  it('throws when the RPC is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client().submit('x')).rejects.toThrow(/unreachable/);
  });

  it('throws on a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });
    await expect(client().submit('x')).rejects.toThrow(/HTTP 500/);
  });

  it('throws on a JSON-RPC error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ error: { code: -32000, message: 'bad' } }),
    });
    await expect(client().submit('x')).rejects.toThrow(/-32000: bad/);
  });

  it('throws when no transaction hash is returned', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    await expect(client().submit('x')).rejects.toThrow(/no transaction hash/);
  });

  describe('confirm', () => {
    it('asks the node for the transaction receipt', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: { status: '0x1' } }),
      });
      await client().confirm('0xtxhash');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const sent = JSON.parse((init as { body: string }).body);
      expect(sent.method).toBe('eth_getTransactionReceipt');
      expect(sent.params).toEqual(['0xtxhash']);
    });

    it('reports confirmed only once the success receipt is buried under the finality depth', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ result: { status: '0x1', blockNumber: '0x64' } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ result: '0x71' }) }); // head 113 → 14 confirmations ≥ 12
      expect(await client().confirm('0xtxhash')).toBe('confirmed');
      // Two calls: the receipt lookup, then the chain head for the depth check.
      expect((global.fetch as jest.Mock).mock.calls[1][1].body).toContain('eth_blockNumber');
    });

    it('reports pending while a success receipt is not yet deep enough (reorg-safe)', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ result: { status: '0x1', blockNumber: '0x64' } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ result: '0x66' }) }); // head 102 → 3 confirmations < 12
      expect(await client().confirm('0xtxhash')).toBe('pending');
    });

    it('reports pending when the success receipt carries no block number yet', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true, status: 200, json: () => Promise.resolve({ result: { status: '0x1' } }),
      });
      expect(await client().confirm('0xtxhash')).toBe('pending');
    });

    it('reports pending when the chain head is unavailable', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ result: { status: '0x1', blockNumber: '0x64' } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) }); // no head result
      expect(await client().confirm('0xtxhash')).toBe('pending');
    });

    it('honors a configured finality depth', async () => {
      process.env.SHIORA_L1_FINALITY_CONFIRMATIONS = '2';
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ result: { status: '0x1', blockNumber: '0x64' } }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ result: '0x65' }) }); // head 101 → 2 confirmations ≥ 2
      expect(await client().confirm('0xtxhash')).toBe('confirmed');
      delete process.env.SHIORA_L1_FINALITY_CONFIRMATIONS;
    });

    it('reports pending while the transaction has no receipt yet', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: null }),
      });
      expect(await client().confirm('0xtxhash')).toBe('pending');
    });

    it('reports failed when the transaction reverted', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: { status: '0x0' } }),
      });
      expect(await client().confirm('0xtxhash')).toBe('failed');
    });

    it('throws when the RPC is unreachable — the caller decides how to retry', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(client().confirm('0xtxhash')).rejects.toThrow(/unreachable/);
    });

    it('throws on a non-2xx response', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({}) });
      await expect(client().confirm('0xtxhash')).rejects.toThrow(/HTTP 502/);
    });

    it('throws on a JSON-RPC error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: { code: -32001, message: 'nope' } }),
      });
      await expect(client().confirm('0xtxhash')).rejects.toThrow(/-32001: nope/);
    });
  });
});

describe('getAnchorClient selection', () => {
  it('returns a JsonRpcAnchorClient when L1 is configured', () => {
    configureL1();
    expect(getAnchorClient()).toBeInstanceOf(JsonRpcAnchorClient);
  });

  it('returns a LocalAnchorClient otherwise', () => {
    expect(getAnchorClient()).toBeInstanceOf(LocalAnchorClient);
  });

  it('caches the selected client for the process', () => {
    expect(getAnchorClient()).toBe(getAnchorClient());
  });
});
