/** @jest-environment node */

// The chat surface is now backed by the real SANA engine (owner-scoped,
// guardrails + a controlled inference fixture in tests). These tests assert the real adapter
// behaviour: auth-gated, empty-start, non-attested replies.

const mockInferenceGenerate = jest.fn(async () => ({
  text: 'General health information from the managed test gateway.',
  refused: false,
  provider: 'managed' as const,
}));

jest.mock('@/lib/api/sana/inference-provider', () => {
  const actual = jest.requireActual('@/lib/api/sana/inference-provider');
  return {
    ...actual,
    getInferenceProvider: () => ({
      generate: mockInferenceGenerate,
    }),
  };
});

import { NextRequest } from 'next/server';
import { GET as listChat, POST as sendChat } from '@/app/api/chat/route';
import { GET as listConvs, POST as createConv } from '@/app/api/chat/conversations/route';
import {
  GET as getMsgs,
  POST as sendToConv,
  DELETE as deleteConvo,
} from '@/app/api/chat/[id]/route';
import { __resetSanaForTests } from '@/lib/api/sana/sana-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { InferenceConfigurationError } from '@/lib/api/sana/inference-provider';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(800);
const token = createSessionToken(USER).token;
const URL = 'http://localhost:3000/api/chat';

function req(method: string, body?: unknown, withToken = false): NextRequest {
  const headers: Record<string, string> = {};
  if (withToken) headers.authorization = `Bearer ${token}`;
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new NextRequest(URL, init);
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function newConversationId(): Promise<string> {
  const res = await createConv(req('POST', undefined, true));
  return (await res.json()).data.id as string;
}

beforeEach(() => {
  mockInferenceGenerate.mockReset();
  mockInferenceGenerate.mockResolvedValue({
    text: 'General health information from the managed test gateway.',
    refused: false,
    provider: 'managed',
  });
  __resetSanaForTests();
  __resetAuditLogForTests();
});

describe('GET /api/chat', () => {
  it('requires authentication', async () => {
    expect((await listChat(req('GET'))).status).toBe(401);
  });

  it('lists the caller conversations (empty, then populated by a real turn)', async () => {
    let res = await listChat(req('GET', undefined, true));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);

    await sendChat(req('POST', { content: 'Tell me about cycle tracking.' }, true));
    await sendChat(req('POST', { content: 'And about sleep hygiene.' }, true));

    res = await listChat(req('GET', undefined, true));
    const body = await res.json();
    expect(body.data).toHaveLength(2); // two distinct conversations, sorted
    expect(body.data[0].model).toBe('SANA');
    expect(body.data[0].attestationCount).toBe(0);
    expect(typeof body.data[0].lastMessage).toBe('string');
  });
});

describe('POST /api/chat', () => {
  it('requires authentication', async () => {
    expect((await sendChat(req('POST', { content: 'hi' }))).status).toBe(401);
  });

  it('returns a non-attested assistant reply from the real engine', async () => {
    const res = await sendChat(req('POST', { content: 'What is a healthy sleep routine?' }, true));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.role).toBe('assistant');
    expect(typeof body.data.content).toBe('string');
    expect(body.data.attestation).toBeUndefined();
    expect(body.data.teePlatform).toBeUndefined();
  });

  it('rejects an invalid body (422)', async () => {
    expect((await sendChat(req('POST', {}, true))).status).toBe(422);
  });

  it('returns 503 when managed inference is not configured', async () => {
    mockInferenceGenerate.mockRejectedValueOnce(new InferenceConfigurationError());
    const response = await sendChat(req('POST', { content: 'hello' }, true));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('INFERENCE_SERVICE_NOT_CONFIGURED');
  });

  it('rethrows on a non-JSON body', async () => {
    await expect(sendChat(req('POST', 'not-json', true))).rejects.toThrow();
  });
});

describe('/api/chat/conversations', () => {
  it('GET requires authentication', async () => {
    expect((await listConvs(req('GET'))).status).toBe(401);
  });

  it('POST requires authentication', async () => {
    expect((await createConv(req('POST'))).status).toBe(401);
  });

  it('GET lists conversations', async () => {
    const res = await listConvs(req('GET', undefined, true));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it('GET lists multiple conversations (sorted, empty-message safe)', async () => {
    await createConv(req('POST', undefined, true));
    await createConv(req('POST', undefined, true));
    const res = await listConvs(req('GET', undefined, true));
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].lastMessage).toBe('');
  });

  it('POST starts a new empty conversation', async () => {
    const res = await createConv(req('POST', undefined, true));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.messageCount).toBe(0);
    expect(body.data.title).toBe('New conversation');
  });
});

describe('/api/chat/[id]', () => {
  it('GET requires authentication', async () => {
    expect((await getMsgs(req('GET'), ctx('x'))).status).toBe(401);
  });

  it('GET returns 404 for an unknown conversation', async () => {
    expect((await getMsgs(req('GET', undefined, true), ctx('missing'))).status).toBe(404);
  });

  it('GET returns the conversation transcript', async () => {
    const id = await newConversationId();
    await sendToConv(req('POST', { content: 'Hello SANA' }, true), ctx(id));
    const res = await getMsgs(req('GET', undefined, true), ctx(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2); // user + assistant
    expect(body.data[0].conversationId).toBe(id);
  });

  it('POST requires authentication', async () => {
    expect((await sendToConv(req('POST', { content: 'hi' }), ctx('x'))).status).toBe(401);
  });

  it('POST returns 404 for an unknown conversation', async () => {
    expect((await sendToConv(req('POST', { content: 'hi' }, true), ctx('missing'))).status).toBe(
      404,
    );
  });

  it('POST sends to an existing conversation', async () => {
    const id = await newConversationId();
    const res = await sendToConv(
      req('POST', { content: 'How do I prepare for my appointment?' }, true),
      ctx(id),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).data.role).toBe('assistant');
  });

  it('POST rejects an invalid body (422)', async () => {
    const id = await newConversationId();
    expect((await sendToConv(req('POST', {}, true), ctx(id))).status).toBe(422);
  });

  it('POST returns 503 when managed inference is not configured', async () => {
    const id = await newConversationId();
    mockInferenceGenerate.mockRejectedValueOnce(new InferenceConfigurationError());
    const response = await sendToConv(req('POST', { content: 'hello' }, true), ctx(id));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('INFERENCE_SERVICE_NOT_CONFIGURED');
  });

  it('POST rethrows on a non-JSON body', async () => {
    const id = await newConversationId();
    await expect(sendToConv(req('POST', 'not-json', true), ctx(id))).rejects.toThrow();
  });

  it('DELETE requires authentication', async () => {
    expect((await deleteConvo(req('DELETE'), ctx('x'))).status).toBe(401);
  });

  it('DELETE returns 404 for an unknown conversation', async () => {
    expect((await deleteConvo(req('DELETE', undefined, true), ctx('missing'))).status).toBe(404);
  });

  it('DELETE removes an owned conversation', async () => {
    const id = await newConversationId();
    const res = await deleteConvo(req('DELETE', undefined, true), ctx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ id, deleted: true });
    expect((await getMsgs(req('GET', undefined, true), ctx(id))).status).toBe(404);
  });
});
