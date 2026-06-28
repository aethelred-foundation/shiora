/** @jest-environment node */

import {
  StubLLMProvider,
  AnthropicLLMProvider,
  getLLMProvider,
} from '@/lib/api/sana/llm-provider';

const originalKey = process.env.ANTHROPIC_API_KEY;
const originalModel = process.env.SANA_MODEL;

afterEach(() => {
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.SANA_MODEL;
  else process.env.SANA_MODEL = originalModel;
});

function fakeFetch(impl: (url: string, init: RequestInit) => unknown): typeof fetch {
  return ((url: string, init: RequestInit) => Promise.resolve(impl(url, init))) as unknown as typeof fetch;
}

describe('StubLLMProvider', () => {
  it('returns a safe in-scope offline response', async () => {
    const result = await new StubLLMProvider().generate();
    expect(result.provider).toBe('stub');
    expect(result.refused).toBe(false);
    expect(result.text).toMatch(/offline guidance mode/);
  });
});

describe('AnthropicLLMProvider', () => {
  it('posts to the Messages API and joins the text blocks', async () => {
    let sentUrl = '';
    let sentInit: RequestInit = {};
    const fetchImpl = fakeFetch((url, init) => {
      sentUrl = url;
      sentInit = init;
      return {
        ok: true,
        json: async () => ({
          content: [
            { type: 'thinking' }, // excluded by the filter
            { type: 'text', text: 'Hello' },
            { type: 'text' }, // missing text → coalesces to ''
          ],
        }),
      };
    });

    const result = await new AnthropicLLMProvider('sk-test', 'claude-opus-4-8', fetchImpl)
      .generate({ system: 'sys', messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toEqual({ text: 'Hello', refused: false, provider: 'anthropic' });
    expect(sentUrl).toBe('https://api.anthropic.com/v1/messages');
    expect((sentInit.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(sentInit.body as string).max_tokens).toBe(1024); // default
  });

  it('reports a refusal when Claude declines', async () => {
    const fetchImpl = fakeFetch(() => ({ ok: true, json: async () => ({ stop_reason: 'refusal' }) }));
    const result = await new AnthropicLLMProvider('k', 'm', fetchImpl)
      .generate({ system: 's', messages: [], maxTokens: 256 });
    expect(result).toEqual({ text: '', refused: true, provider: 'anthropic' });
  });

  it('handles a missing content array and honors an explicit maxTokens', async () => {
    let body = '';
    const fetchImpl = fakeFetch((_url, init) => {
      body = init.body as string;
      return { ok: true, json: async () => ({}) }; // no content
    });
    const result = await new AnthropicLLMProvider('k', 'm', fetchImpl)
      .generate({ system: 's', messages: [], maxTokens: 256 });
    expect(result.text).toBe('');
    expect(JSON.parse(body).max_tokens).toBe(256);
  });

  it('throws on a non-OK HTTP response', async () => {
    const fetchImpl = fakeFetch(() => ({ ok: false, status: 503 }));
    await expect(
      new AnthropicLLMProvider('k', 'm', fetchImpl).generate({ system: 's', messages: [] }),
    ).rejects.toThrow(/503/);
  });
});

describe('getLLMProvider', () => {
  it('returns the stub when no API key is configured', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(getLLMProvider()).toBeInstanceOf(StubLLMProvider);
  });

  it('returns the Claude adapter when a key is configured (default model)', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    delete process.env.SANA_MODEL;
    expect(getLLMProvider()).toBeInstanceOf(AnthropicLLMProvider);
  });

  it('honors an explicit SANA_MODEL override', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.SANA_MODEL = 'claude-sonnet-4-6';
    expect(getLLMProvider()).toBeInstanceOf(AnthropicLLMProvider);
  });
});
