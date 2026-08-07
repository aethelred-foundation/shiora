// ============================================================
// Shiora — managed inference provider
//
// The application talks only to an operator-controlled inference gateway.
// Product code contains no vendor SDK, vendor endpoint, branded deployment
// name, or offline response substitute. An unconfigured integration fails
// closed instead of fabricating assistant output.
// ============================================================

export interface InferenceMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InferenceRequest {
  instructions: string;
  messages: InferenceMessage[];
  maxOutputTokens?: number;
}

export interface InferenceResult {
  text: string;
  refused: boolean;
  provider: 'managed';
}

export interface InferenceProvider {
  generate(request: InferenceRequest): Promise<InferenceResult>;
}

export class InferenceConfigurationError extends Error {
  constructor(message = 'The managed inference service is not configured.') {
    super(message);
    this.name = 'InferenceConfigurationError';
  }
}

/**
 * Provider-neutral adapter for the organization's managed inference gateway.
 * The gateway contract is deliberately small and stable:
 *
 * request:  { deploymentId, instructions, messages, maxOutputTokens }
 * response: { output, refused }
 */
export class ManagedInferenceProvider implements InferenceProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly deploymentId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(request: InferenceRequest): Promise<InferenceResult> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        deploymentId: this.deploymentId,
        maxOutputTokens: request.maxOutputTokens ?? 1024,
        instructions: request.instructions,
        messages: request.messages,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Managed inference request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      output?: unknown;
      refused?: unknown;
    };

    if (data.refused === true) {
      return { text: '', refused: true, provider: 'managed' };
    }

    if (typeof data.output !== 'string' || !data.output.trim()) {
      throw new Error('Managed inference response did not contain usable output.');
    }

    return { text: data.output.trim(), refused: false, provider: 'managed' };
  }
}

/** Resolve the configured production integration. Missing values fail closed. */
export function getInferenceProvider(
  env: Record<string, string | undefined> = process.env,
): InferenceProvider {
  const endpoint = env.SHIORA_INFERENCE_API_URL;
  const apiKey = env.SHIORA_INFERENCE_API_KEY;
  const deploymentId = env.SHIORA_INFERENCE_DEPLOYMENT_ID;

  if (!endpoint || !apiKey || !deploymentId) {
    throw new InferenceConfigurationError();
  }

  return new ManagedInferenceProvider(endpoint, apiKey, deploymentId);
}
