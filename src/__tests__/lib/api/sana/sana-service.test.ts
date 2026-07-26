/** @jest-environment node */

const pgQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('@/lib/persistence/sql-client', () => ({
  getPgClient: jest.fn(() => ({ query: pgQuery })),
}));

const mockGenerate = jest.fn();
jest.mock('@/lib/api/sana/inference-provider', () => ({
  getInferenceProvider: () => ({ generate: mockGenerate }),
}));

import {
  sendMessage,
  listConversations,
  getConversation,
  eraseSanaConversations,
  __resetSanaForTests,
} from '@/lib/api/sana/sana-service';
import { getAuditLog, __resetAuditLogForTests } from '@/lib/api/audit-log';
import { seededAddress } from '@/lib/utils';

const USER = seededAddress(500);
const original = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
  __resetSanaForTests();
  __resetAuditLogForTests();
  mockGenerate.mockReset();
  mockGenerate.mockResolvedValue({
    text: 'An A1C reflects average blood sugar.',
    refused: false,
    provider: 'managed',
  });
});

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
  __resetSanaForTests();
  jest.clearAllMocks();
});

describe('sana-service', () => {
  it('creates a conversation, returns a disclaimed reply, and audits the turn', async () => {
    const { conversation, reply } = await sendMessage(USER, null, 'what is an A1C?');

    expect(conversation.id.startsWith('sana-')).toBe(true);
    expect(conversation.messages).toHaveLength(2); // user + assistant
    expect(reply.role).toBe('assistant');
    expect(reply.content).toMatch(/not a substitute for professional/); // disclaimer appended
    expect(reply.flags).toEqual([]);

    const audits = await getAuditLog().list({ action: 'SANA_MESSAGE', actor: USER });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('continues an existing conversation by id', async () => {
    const first = await sendMessage(USER, null, 'hello');
    const second = await sendMessage(USER, first.conversation.id, 'tell me more');

    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.messages).toHaveLength(4); // two turns
  });

  it('intercepts a crisis without ever calling the model', async () => {
    const { reply } = await sendMessage(USER, null, 'I want to hurt myself');
    expect(reply.intervention).toBe('crisis');
    expect(reply.content).toMatch(/988/);
    expect(mockGenerate).not.toHaveBeenCalled(); // remote inference is bypassed
  });

  it('returns a safe reply when the model refuses', async () => {
    mockGenerate.mockResolvedValueOnce({ text: '', refused: true, provider: 'managed' });
    const { reply } = await sendMessage(USER, null, 'do something disallowed');
    expect(reply.content).toMatch(/not able to help/);
  });

  it('flags a reply that drifts into diagnosis', async () => {
    mockGenerate.mockResolvedValueOnce({
      text: 'It sounds like you have a cold.',
      refused: false,
      provider: 'managed',
    });
    const { reply } = await sendMessage(USER, null, 'I am sneezing');
    expect(reply.flags).toContain('diagnosis');
  });

  it('lists and fetches conversations, scoped to the owner', async () => {
    const { conversation } = await sendMessage(USER, null, 'hi');
    expect(await listConversations(USER)).toHaveLength(1);
    expect((await getConversation(USER, conversation.id))?.id).toBe(conversation.id);
    expect(await listConversations(seededAddress(501))).toEqual([]);
  });

  it("erases all of an owner's conversations", async () => {
    await sendMessage(USER, null, 'one');
    await sendMessage(USER, null, 'two');
    expect(await eraseSanaConversations(USER)).toBe(2);
    expect(await listConversations(USER)).toEqual([]);
  });

  it('selects the Postgres store when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/shiora';
    __resetSanaForTests();
    expect(await listConversations(USER)).toEqual([]);
    expect(pgQuery).toHaveBeenCalled();
  });
});
