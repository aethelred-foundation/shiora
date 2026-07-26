import type { Block } from '@/types';

const RPC_TIMEOUT_MS = 10_000;
const RECENT_BLOCK_LIMIT = 5;

interface JsonRpcEnvelope<T> {
  jsonrpc?: string;
  id?: number;
  result?: T;
  error?: {
    code?: number;
    message?: string;
  };
}

interface EvmBlock {
  number: string;
  hash: string;
  transactions: unknown[];
  miner?: string;
  timestamp: string;
  gasUsed: string;
  gasLimit: string;
}

export interface LiveNetworkStatus {
  blockHeight: number;
  tps: number;
  /** Epoch is null because the EVM JSON-RPC interface does not expose it. */
  epoch: null;
  networkLoad: number;
  /** Token pricing requires a separately configured, auditable market source. */
  aethelPrice: null;
  lastBlockTime: number;
  recentBlocks: Block[];
  chainId: string;
  source: 'evm-json-rpc';
}

export class NetworkRpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkRpcError';
  }
}

function parseHexNumber(value: string, field: string): number {
  if (!/^0x[0-9a-f]+$/i.test(value)) {
    throw new NetworkRpcError(`The chain returned an invalid ${field}.`);
  }
  const parsed = Number(BigInt(value));
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new NetworkRpcError(`The chain returned an unsupported ${field}.`);
  }
  return parsed;
}

async function rpc<T>(endpoint: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new NetworkRpcError(`The chain endpoint returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as JsonRpcEnvelope<T>;
  if (payload.error || payload.result === undefined) {
    throw new NetworkRpcError(
      payload.error?.message
        ? `The chain rejected the request: ${payload.error.message}`
        : 'The chain returned an incomplete JSON-RPC response.',
    );
  }
  return payload.result;
}

function toBlock(block: EvmBlock): Block {
  return {
    height: parseHexNumber(block.number, 'block number'),
    hash: block.hash,
    txCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
    proposer: block.miner ?? '',
    timestamp: parseHexNumber(block.timestamp, 'block timestamp') * 1000,
    gasUsed: parseHexNumber(block.gasUsed, 'gas-used value'),
  };
}

function calculateTps(blocks: Block[]): number {
  if (blocks.length < 2) return 0;
  const newest = blocks[0];
  const oldest = blocks[blocks.length - 1];
  const elapsedSeconds = (newest.timestamp - oldest.timestamp) / 1000;
  if (elapsedSeconds <= 0) return 0;
  const transactions = blocks.slice(0, -1).reduce((total, block) => total + block.txCount, 0);
  return Number((transactions / elapsedSeconds).toFixed(2));
}

export async function getLiveNetworkStatus(
  endpoint: string,
  requestedBlock?: number,
): Promise<LiveNetworkStatus | Block> {
  const chainIdHex = await rpc<string>(endpoint, 'eth_chainId', []);
  const chainId = String(parseHexNumber(chainIdHex, 'chain ID'));

  if (requestedBlock !== undefined) {
    if (!Number.isSafeInteger(requestedBlock) || requestedBlock < 0) {
      throw new NetworkRpcError('The requested block height is invalid.');
    }
    const result = await rpc<EvmBlock | null>(endpoint, 'eth_getBlockByNumber', [
      `0x${requestedBlock.toString(16)}`,
      false,
    ]);
    if (!result) {
      throw new NetworkRpcError('The requested block was not found.');
    }
    return toBlock(result);
  }

  const latest = await rpc<EvmBlock | null>(endpoint, 'eth_getBlockByNumber', ['latest', false]);
  if (!latest) {
    throw new NetworkRpcError('The chain did not return a latest block.');
  }

  const latestHeight = parseHexNumber(latest.number, 'block number');
  const heights = Array.from(
    { length: Math.min(RECENT_BLOCK_LIMIT, latestHeight + 1) },
    (_, index) => latestHeight - index,
  );
  const rawBlocks = await Promise.all(
    heights.map((height) =>
      height === latestHeight
        ? Promise.resolve(latest)
        : rpc<EvmBlock | null>(endpoint, 'eth_getBlockByNumber', [
            `0x${height.toString(16)}`,
            false,
          ]),
    ),
  );
  const blocks = rawBlocks.filter((block): block is EvmBlock => block !== null).map(toBlock);

  const gasUsed = parseHexNumber(latest.gasUsed, 'gas-used value');
  const gasLimit = parseHexNumber(latest.gasLimit, 'gas-limit value');

  return {
    blockHeight: latestHeight,
    tps: calculateTps(blocks),
    epoch: null,
    networkLoad: gasLimit === 0 ? 0 : Number(((gasUsed / gasLimit) * 100).toFixed(2)),
    aethelPrice: null,
    lastBlockTime: parseHexNumber(latest.timestamp, 'block timestamp') * 1000,
    recentBlocks: blocks,
    chainId,
    source: 'evm-json-rpc',
  };
}
