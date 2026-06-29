/** @jest-environment node */

import {
  LocalAnchorClient,
  JsonRpcAnchorClient,
  getAnchorClient,
  isOnChainAnchoringConfigured,
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
  L1_ENVS.forEach((k) => delete process.env[k]);
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

describe('LocalAnchorClient', () => {
  it('records locally without broadcasting', async () => {
    const receipt = await new LocalAnchorClient().submit('abc123');
    expect(receipt.status).toBe('local');
    expect(receipt.ref).toBe('local:abc123');
    expect(receipt.target).toBe('local');
    expect(typeof receipt.submittedAt).toBe('number');
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
});

describe('getAnchorClient selection', () => {
  it('returns a JsonRpcAnchorClient when L1 is configured', () => {
    configureL1();
    expect(getAnchorClient()).toBeInstanceOf(JsonRpcAnchorClient);
  });

  it('returns a LocalAnchorClient otherwise', () => {
    expect(getAnchorClient()).toBeInstanceOf(LocalAnchorClient);
  });
});
