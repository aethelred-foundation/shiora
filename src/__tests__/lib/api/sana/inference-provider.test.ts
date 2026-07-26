/** @jest-environment node */

import {
  InferenceConfigurationError,
  ManagedInferenceProvider,
  getInferenceProvider,
} from '@/lib/api/sana/inference-provider';

function fakeFetch(impl: (url: string, init: RequestInit) => unknown): typeof fetch {
  return ((url: string, init: RequestInit) =>
    Promise.resolve(impl(url, init))) as unknown as typeof fetch;
}

describe('ManagedInferenceProvider', () => {
  it('posts to the configured gateway using the neutral contract', async () => {
    let sentUrl = '';
    let sentInit: RequestInit = {};
    const fetchImpl = fakeFetch((url, init) => {
      sentUrl = url;
      sentInit = init;
      return {
        ok: true,
        json: async () => ({
          output: 'Hello',
        }),
      };
    });

    const result = await new ManagedInferenceProvider(
      'https://inference.internal.example/v1/generate',
      'test-key',
      'health-assistant-production',
      fetchImpl,
    ).generate({ instructions: 'sys', messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toEqual({ text: 'Hello', refused: false, provider: 'managed' });
    expect(sentUrl).toBe('https://inference.internal.example/v1/generate');
    expect((sentInit.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    expect(JSON.parse(sentInit.body as string)).toMatchObject({
      deploymentId: 'health-assistant-production',
      maxOutputTokens: 1024,
      instructions: 'sys',
    });
  });

  it('reports a refusal without inventing output', async () => {
    const fetchImpl = fakeFetch(() => ({ ok: true, json: async () => ({ refused: true }) }));
    const result = await new ManagedInferenceProvider(
      'https://service.example',
      'k',
      'd',
      fetchImpl,
    ).generate({ instructions: 's', messages: [], maxOutputTokens: 256 });
    expect(result).toEqual({ text: '', refused: true, provider: 'managed' });
  });

  it('rejects an empty gateway response', async () => {
    const fetchImpl = fakeFetch(() => ({ ok: true, json: async () => ({}) }));
    await expect(
      new ManagedInferenceProvider('https://service.example', 'k', 'd', fetchImpl).generate({
        instructions: 's',
        messages: [],
      }),
    ).rejects.toThrow(/usable output/);
  });

  it('throws on a non-OK HTTP response', async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 503 }));
    await expect(
      new ManagedInferenceProvider('https://service.example', 'k', 'd', fetchImpl).generate({
        instructions: 's',
        messages: [],
      }),
    ).rejects.toThrow(/503/);
  });
});

describe('getInferenceProvider', () => {
  it('fails closed when configuration is incomplete', () => {
    expect(() => getInferenceProvider({})).toThrow(InferenceConfigurationError);
    expect(() =>
      getInferenceProvider({
        SHIORA_INFERENCE_API_URL: 'https://service.example/v1/generate',
      }),
    ).toThrow(InferenceConfigurationError);
    expect(() =>
      getInferenceProvider({
        SHIORA_INFERENCE_API_URL: 'https://service.example/v1/generate',
        SHIORA_INFERENCE_API_KEY: 'test-key',
      }),
    ).toThrow(InferenceConfigurationError);
  });

  it('returns the managed adapter only when all values are configured', () => {
    expect(
      getInferenceProvider({
        SHIORA_INFERENCE_API_URL: 'https://service.example/v1/generate',
        SHIORA_INFERENCE_API_KEY: 'test-key',
        SHIORA_INFERENCE_DEPLOYMENT_ID: 'health-assistant-production',
      }),
    ).toBeInstanceOf(ManagedInferenceProvider);
  });

  it('reads complete configuration from the process environment by default', () => {
    const previous = {
      url: process.env.SHIORA_INFERENCE_API_URL,
      key: process.env.SHIORA_INFERENCE_API_KEY,
      deployment: process.env.SHIORA_INFERENCE_DEPLOYMENT_ID,
    };
    process.env.SHIORA_INFERENCE_API_URL = 'https://service.example/v1/generate';
    process.env.SHIORA_INFERENCE_API_KEY = 'test-key';
    process.env.SHIORA_INFERENCE_DEPLOYMENT_ID = 'health-assistant-production';

    try {
      expect(getInferenceProvider()).toBeInstanceOf(ManagedInferenceProvider);
    } finally {
      if (previous.url === undefined) delete process.env.SHIORA_INFERENCE_API_URL;
      else process.env.SHIORA_INFERENCE_API_URL = previous.url;
      if (previous.key === undefined) delete process.env.SHIORA_INFERENCE_API_KEY;
      else process.env.SHIORA_INFERENCE_API_KEY = previous.key;
      if (previous.deployment === undefined) delete process.env.SHIORA_INFERENCE_DEPLOYMENT_ID;
      else process.env.SHIORA_INFERENCE_DEPLOYMENT_ID = previous.deployment;
    }
  });
});
