// ============================================================
// Shiora on Aethelred — Anchor submission client (L1 seam)
//
// Closes audit Finding F5 (operator could rewrite history wholesale before an
// external anchor). The anchor service hash-chains and WORM-persists the audit
// head; this seam is the final hop that broadcasts that anchor to an external
// record. Like the KeyProvider / IPFS / LLM seams, the concrete client is config-
// selected so the platform stays honest about what is really on-chain:
//
//   - no L1 configured  -> LocalAnchorClient (recorded locally, NOT broadcast)
//   - SHIORA_L1_RPC_URL  -> JsonRpcAnchorClient (real eth_sendTransaction)
//
// The JSON-RPC adapter targets an EVM-compatible L1; for a non-EVM Aethelred RPC
// only this adapter's method/encoding changes — the seam and pipeline do not.
// ============================================================

export interface AnchorReceipt {
  /** On-chain transaction hash, or a local reference when not broadcast. */
  ref: string;
  /** 'on-chain' once broadcast to L1; 'local' when only recorded locally. */
  status: 'on-chain' | 'local';
  /** Submission target (the RPC URL, or 'local'). */
  target: string;
  submittedAt: number;
}

/**
 * The observed finality of a submitted anchor. 'pending' means the network has
 * not yet included the transaction — an anchor must never be reported as
 * anchored while pending.
 */
export type AnchorConfirmation = 'confirmed' | 'pending' | 'failed';

export interface AnchorClient {
  /** Broadcast (or locally record) an anchor for the given payload hash. */
  submit(payloadHash: string): Promise<AnchorReceipt>;
  /** Check whether a previously submitted anchor is final on the target. */
  confirm(ref: string): Promise<AnchorConfirmation>;
}

/** True when an L1 JSON-RPC endpoint is configured for real on-chain anchoring. */
export function isOnChainAnchoringConfigured(): boolean {
  return Boolean(
    process.env.SHIORA_L1_RPC_URL
    && process.env.SHIORA_L1_ANCHOR_FROM
    && process.env.SHIORA_L1_ANCHOR_TO,
  );
}

/**
 * Records anchors locally only — the honest default when no L1 endpoint is set.
 * The audit head is still hash-chained and WORM-persisted by the anchor service;
 * this client simply does not broadcast it, and says so via status: 'local'.
 */
export class LocalAnchorClient implements AnchorClient {
  async submit(payloadHash: string): Promise<AnchorReceipt> {
    return {
      ref: `local:${payloadHash}`,
      status: 'local',
      target: 'local',
      submittedAt: Date.now(),
    };
  }

  /** A local record is durable the moment it is written — nothing to await. */
  async confirm(): Promise<AnchorConfirmation> {
    return 'confirmed';
  }
}

interface JsonRpcError {
  code: number;
  message: string;
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: JsonRpcError;
}

/** The subset of an EVM transaction receipt the anchor pipeline reads. */
interface TransactionReceipt {
  status?: string;
}

/**
 * Broadcasts the anchor hash to an EVM-compatible L1 via JSON-RPC
 * `eth_sendTransaction`. The hash travels as transaction calldata; the node
 * holds the anchoring account (no client-side signing), the standard pattern for
 * a trusted anchoring service.
 */
export class JsonRpcAnchorClient implements AnchorClient {
  constructor(
    private readonly rpcUrl: string,
    private readonly from: string,
    private readonly to: string,
  ) {}

  async submit(payloadHash: string): Promise<AnchorReceipt> {
    const txHash = await this.rpc<string>('eth_sendTransaction', [
      { from: this.from, to: this.to, data: `0x${payloadHash}` },
    ]);
    if (!txHash) {
      throw new Error('L1 RPC returned no transaction hash.');
    }
    return {
      ref: txHash,
      status: 'on-chain',
      target: this.rpcUrl,
      submittedAt: Date.now(),
    };
  }

  /**
   * Look up the transaction receipt. No receipt yet means the transaction is
   * still pending; a receipt with a non-success status means it reverted.
   * Transport failures throw so the caller can distinguish "the network says
   * pending" from "we could not ask the network".
   */
  async confirm(ref: string): Promise<AnchorConfirmation> {
    const receipt = await this.rpc<TransactionReceipt | null>('eth_getTransactionReceipt', [ref]);
    if (!receipt) {
      return 'pending';
    }
    return receipt.status === '0x1' ? 'confirmed' : 'failed';
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T | undefined> {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
    } catch {
      throw new Error(`L1 RPC at ${this.rpcUrl} is unreachable.`);
    }
    if (!res.ok) {
      throw new Error(`L1 RPC returned HTTP ${res.status}.`);
    }
    const body = (await res.json()) as JsonRpcResponse<T>;
    if (body.error) {
      throw new Error(`L1 RPC error ${body.error.code}: ${body.error.message}`);
    }
    return body.result;
  }
}

let client: AnchorClient | null = null;

/** The process-wide anchor client, selected by configuration. */
export function getAnchorClient(): AnchorClient {
  if (!client) {
    client = isOnChainAnchoringConfigured()
      ? new JsonRpcAnchorClient(
        process.env.SHIORA_L1_RPC_URL as string,
        process.env.SHIORA_L1_ANCHOR_FROM as string,
        process.env.SHIORA_L1_ANCHOR_TO as string,
      )
      : new LocalAnchorClient();
  }
  return client;
}

/** Test-only: drop the cached client so config changes take effect. */
export function __resetAnchorClientForTests(): void {
  client = null;
}
