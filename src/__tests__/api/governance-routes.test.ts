/** @jest-environment node */

jest.mock('@/lib/api/middleware', () => {
  const actual = jest.requireActual('@/lib/api/middleware');
  return { ...actual, runMiddleware: jest.fn((...args: unknown[]) => actual.runMiddleware(...args)) };
});

import { NextRequest, NextResponse } from 'next/server';
import { runMiddleware } from '@/lib/api/middleware';
import { GET as getProposals, POST as createProposal } from '@/app/api/governance/proposals/route';
import { GET as getProposal, POST as voteOnProposal } from '@/app/api/governance/proposals/[id]/route';
import { GET as getVotes, POST as castVote } from '@/app/api/governance/vote/route';

const mockedRunMiddleware = runMiddleware as jest.MockedFunction<typeof runMiddleware>;

afterEach(() => {
  mockedRunMiddleware.mockImplementation((...args: unknown[]) => {
    const actual = jest.requireActual('@/lib/api/middleware');
    return actual.runMiddleware(...args);
  });
});

describe('/api/governance/proposals', () => {
  it('GET returns proposals list', async () => {
    const res = await getProposals(new NextRequest('http://localhost:3000/api/governance/proposals'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toMatch(/^prop-/);
  });

  it('GET returns stats view', async () => {
    const res = await getProposals(
      new NextRequest('http://localhost:3000/api/governance/proposals?view=stats'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalProposals).toBeDefined();
    expect(body.data.activeProposals).toBeDefined();
  });

  it('GET returns delegations view', async () => {
    const res = await getProposals(
      new NextRequest('http://localhost:3000/api/governance/proposals?view=delegations'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET filters by status', async () => {
    const res = await getProposals(
      new NextRequest('http://localhost:3000/api/governance/proposals?status=active'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    body.data.forEach((p: { status: string }) => {
      expect(p.status).toBe('active');
    });
  });

  it('POST creates a proposal', async () => {
    const res = await createProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature',
          title: 'Test Proposal',
          description: 'A test governance proposal.',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Test Proposal');
    expect(body.data.status).toBe('active');
  });

  it('POST returns 422 for missing fields', async () => {
    const res = await createProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'feature' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await createProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getProposals(new NextRequest('http://localhost:3000/api/governance/proposals'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await createProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'feature', title: 'Test', description: 'Test' }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/governance/proposals/[id]', () => {
  it('GET returns a specific proposal', async () => {
    const res = await getProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals/prop-test'),
      { params: Promise.resolve({ id: 'prop-test' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('prop-test');
  });

  it('POST votes on a proposal with valid support', async () => {
    const res = await voteOnProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals/prop-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ support: 'for', reason: 'I agree' }),
      }),
      { params: Promise.resolve({ id: 'prop-test' }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.proposalId).toBe('prop-test');
    expect(body.data.support).toBe('for');
  });

  it('POST votes on a proposal without reason', async () => {
    const res = await voteOnProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals/prop-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ support: 'against' }),
      }),
      { params: Promise.resolve({ id: 'prop-test' }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.reason).toBeUndefined();
  });

  it('POST returns 422 for invalid support value', async () => {
    const res = await voteOnProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals/prop-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ support: 'maybe' }),
      }),
      { params: Promise.resolve({ id: 'prop-test' }) },
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await voteOnProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals/prop-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
      { params: Promise.resolve({ id: 'prop-test' }) },
    );
    expect(res.status).toBe(400);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals/prop-test'),
      { params: Promise.resolve({ id: 'prop-test' }) },
    );
    expect(res.status).toBe(403);
  });

  it('POST vote returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await voteOnProposal(
      new NextRequest('http://localhost:3000/api/governance/proposals/prop-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ support: 'for' }),
      }),
      { params: Promise.resolve({ id: 'prop-test' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('/api/governance/vote', () => {
  it('GET returns votes list', async () => {
    const res = await getVotes(new NextRequest('http://localhost:3000/api/governance/vote'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST casts a vote', async () => {
    const res = await castVote(
      new NextRequest('http://localhost:3000/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: 'prop-1', support: 'for' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.proposalId).toBe('prop-1');
    expect(body.data.support).toBe('for');
  });

  it('POST returns 422 for invalid support', async () => {
    const res = await castVote(
      new NextRequest('http://localhost:3000/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: 'prop-1', support: 'yes' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const res = await castVote(
      new NextRequest('http://localhost:3000/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('GET returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await getVotes(new NextRequest('http://localhost:3000/api/governance/vote'));
    expect(res.status).toBe(403);
  });

  it('POST returns middleware error when blocked', async () => {
    mockedRunMiddleware.mockReturnValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));
    const res = await castVote(
      new NextRequest('http://localhost:3000/api/governance/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: 'prop-1', support: 'for' }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
