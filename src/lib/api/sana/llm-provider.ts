// ============================================================
// Shiora on Aethelred — SANA LLM Provider (port + adapters)
//
// A ports-and-adapters seam over the language model, mirroring the datastore
// driver selection used elsewhere (shouldUsePostgres). When ANTHROPIC_API_KEY
// is configured, SANA talks to the real Claude Messages API; otherwise it falls
// back to a deterministic stub so the platform runs end-to-end with no key and
// no network — honestly labelled as offline guidance mode in the registry.
//
// The real adapter uses a thin fetch call rather than pulling the Anthropic SDK
// into the production bundle of a compliance-sensitive health platform. Swapping
// in @anthropic-ai/sdk (retries, streaming, typed errors) is the production
// hardening path for this seam, exactly like the KMS KeyProvider swap-in.
// ============================================================

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
}

export interface LLMResult {
  text: string;
  refused: boolean;
  provider: 'anthropic' | 'stub';
}

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResult>;
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-opus-4-8';

/**
 * Deterministic offline provider. Returns a safe, in-scope response so the
 * platform is fully functional without an API key — and so tests never make a
 * network call. It deliberately stays within SANA's non-diagnostic boundary.
 */
export class StubLLMProvider implements LLMProvider {
  async generate(): Promise<LLMResult> {
    return {
      text: 'I can help you understand general health information, make sense of your own records, '
        + 'and prepare questions for your clinician. For anything specific to your health, please '
        + 'consult a licensed healthcare professional. (SANA is running in offline guidance mode — '
        + 'no AI model is configured.)',
      refused: false,
      provider: 'stub',
    };
  }
}

/** Real adapter over the Claude Messages API. */
export class AnthropicLLMProvider implements LLMProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(request: LLMRequest): Promise<LLMResult> {
    const response = await this.fetchImpl(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1024,
        system: request.system,
        messages: request.messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`SANA LLM request failed with status ${response.status}`);
    }

    const data = await response.json() as {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    };

    // Claude returns HTTP 200 with stop_reason "refusal" when it declines.
    if (data.stop_reason === 'refusal') {
      return { text: '', refused: true, provider: 'anthropic' };
    }

    const text = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    return { text, refused: false, provider: 'anthropic' };
  }
}

/** Select the real Claude adapter when a key is configured, else the stub. */
export function getLLMProvider(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return new AnthropicLLMProvider(apiKey, process.env.SANA_MODEL ?? DEFAULT_MODEL);
  }
  return new StubLLMProvider();
}
