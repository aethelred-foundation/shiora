/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';

const mockRunMiddleware = jest.fn<NextResponse | null, [NextRequest, ...unknown[]]>(() => null);

jest.mock('@/lib/api/middleware', () => ({
  ...jest.requireActual('@/lib/api/middleware'),
  runMiddleware: (...args: unknown[]) => mockRunMiddleware(args[0] as NextRequest, ...args.slice(1)),
}));

// Mock utils so we can force errors inside try blocks for catch coverage
const actualUtils = jest.requireActual('@/lib/utils');
let mockGenerateAttestation: ((...args: unknown[]) => unknown) | null = null;
let mockSeededHex: ((...args: unknown[]) => unknown) | null = null;

jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  generateAttestation: (...args: unknown[]) => {
    if (mockGenerateAttestation) return mockGenerateAttestation(...args);
    return actualUtils.generateAttestation(...args);
  },
  seededHex: (...args: unknown[]) => {
    if (mockSeededHex) return mockSeededHex(...args);
    return actualUtils.seededHex(...args);
  },
}));

import { GET as getEmergency } from '@/app/api/emergency/route';
import { GET as getTriage, POST as postTriage } from '@/app/api/emergency/triage/route';
import { GET as getProtocols } from '@/app/api/emergency/protocols/route';
import { GET as getCareTeam, POST as postCareTeam } from '@/app/api/emergency/care-team/route';
import { GET as getHandoffs, POST as postHandoff } from '@/app/api/emergency/handoffs/route';

beforeEach(() => {
  mockRunMiddleware.mockReset();
  mockRunMiddleware.mockReturnValue(null);
  mockGenerateAttestation = null;
  mockSeededHex = null;
});

describe('/api/emergency', () => {
  it('GET returns emergency dashboard', async () => {
    const res = await getEmergency(new NextRequest('http://localhost:3000/api/emergency'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getEmergency(new NextRequest('http://localhost:3000/api/emergency'));
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when internal error occurs', async () => {
    mockGenerateAttestation = () => { throw new Error('boom'); };
    const res = await getEmergency(new NextRequest('http://localhost:3000/api/emergency'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    mockGenerateAttestation = null;
  });
});

describe('/api/emergency/triage', () => {
  it('GET returns triage history', async () => {
    const res = await getTriage(new NextRequest('http://localhost:3000/api/emergency/triage'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].esiLevel).toBeDefined();
    expect(body.data[0].disposition).toBeDefined();
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getTriage(new NextRequest('http://localhost:3000/api/emergency/triage'));
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when internal error occurs', async () => {
    mockGenerateAttestation = () => { throw new Error('boom'); };
    const res = await getTriage(new NextRequest('http://localhost:3000/api/emergency/triage'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    mockGenerateAttestation = null;
  });

  it('POST runs a triage assessment', async () => {
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: ['chest pain', 'shortness of breath'],
          vitalSigns: {
            heartRate: 110,
            bloodPressure: 150,
            temperature: 98.6,
            respiratoryRate: 22,
            oxygenSaturation: 94,
          },
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.esiLevel).toBe(2);
    expect(body.data.disposition).toBe('emergency_room');
    expect(body.data.attestation).toBeDefined();
  });

  it('POST returns 422 for missing symptoms', async () => {
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns 422 for empty symptoms array', async () => {
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: [] }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST triages urgent symptoms to urgent care', async () => {
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: ['dizziness', 'confusion'],
          vitalSigns: {
            heartRate: 92,
            bloodPressure: 160,
            temperature: 99.2,
            respiratoryRate: 20,
            oxygenSaturation: 96,
          },
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.esiLevel).toBe(3);
    expect(body.data.disposition).toBe('urgent_care');
  });

  it('POST triages without vital signs (uses generated)', async () => {
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: ['mild cough'],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.vitalSigns).toBeDefined();
    expect(body.data.vitalSigns.heartRate).toBeDefined();
  });

  it('POST returns error for invalid JSON body', async () => {
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST triages non-critical symptoms to primary care', async () => {
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: ['mild headache', 'fatigue'],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.esiLevel).toBe(4);
    expect(body.data.disposition).toBe('primary_care');
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await postTriage(
      new NextRequest('http://localhost:3000/api/emergency/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: ['headache'] }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/emergency/protocols', () => {
  it('GET returns protocols', async () => {
    const res = await getProtocols(new NextRequest('http://localhost:3000/api/emergency/protocols'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getProtocols(new NextRequest('http://localhost:3000/api/emergency/protocols'));
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when internal error occurs', async () => {
    mockGenerateAttestation = () => { throw new Error('boom'); };
    const res = await getProtocols(new NextRequest('http://localhost:3000/api/emergency/protocols'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    mockGenerateAttestation = null;
  });
});

describe('/api/emergency/care-team', () => {
  it('GET returns care team data', async () => {
    const res = await getCareTeam(new NextRequest('http://localhost:3000/api/emergency/care-team'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getCareTeam(new NextRequest('http://localhost:3000/api/emergency/care-team'));
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when internal error occurs', async () => {
    mockSeededHex = () => { throw new Error('boom'); };
    const res = await getCareTeam(new NextRequest('http://localhost:3000/api/emergency/care-team'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    mockSeededHex = null;
  });

  it('POST creates a new care team member', async () => {
    const res = await postCareTeam(
      new NextRequest('http://localhost:3000/api/emergency/care-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Dr. Test Member',
          role: 'Specialist',
          institution: 'Test Hospital',
          specialty: 'Neurology',
          phone: '+1 (555) 999-0000',
          email: 'test@hospital.com',
          accessLevel: 'full',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Dr. Test Member');
  });

  it('POST creates member with default optional fields', async () => {
    const res = await postCareTeam(
      new NextRequest('http://localhost:3000/api/emergency/care-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nurse Test', role: 'Nurse' }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.institution).toBe('');
    expect(body.data.accessLevel).toBe('partial');
  });

  it('POST returns 422 for missing required fields', async () => {
    const res = await postCareTeam(
      new NextRequest('http://localhost:3000/api/emergency/care-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Only Name' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns error for invalid JSON', async () => {
    const res = await postCareTeam(
      new NextRequest('http://localhost:3000/api/emergency/care-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await postCareTeam(
      new NextRequest('http://localhost:3000/api/emergency/care-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', role: 'Nurse' }),
      }),
    );
    expect(res.status).toBe(429);
  });
});

describe('/api/emergency/handoffs', () => {
  it('GET returns handoff data', async () => {
    const res = await getHandoffs(new NextRequest('http://localhost:3000/api/emergency/handoffs'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('GET returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await getHandoffs(new NextRequest('http://localhost:3000/api/emergency/handoffs'));
    expect(res.status).toBe(429);
  });

  it('GET returns 500 when internal error occurs', async () => {
    mockSeededHex = () => { throw new Error('boom'); };
    const res = await getHandoffs(new NextRequest('http://localhost:3000/api/emergency/handoffs'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    mockSeededHex = null;
  });

  it('POST creates a new handoff', async () => {
    const res = await postHandoff(
      new NextRequest('http://localhost:3000/api/emergency/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromProvider: 'Dr. A',
          toProvider: 'Dr. B',
          patientSummary: 'Patient with acute symptoms requiring specialist evaluation',
          outstandingIssues: ['Follow up labs'],
          medications: ['Ibuprofen 400mg PRN'],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.fromProvider).toBe('Dr. A');
  });

  it('POST creates handoff with defaults for optional fields', async () => {
    const res = await postHandoff(
      new NextRequest('http://localhost:3000/api/emergency/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromProvider: 'Dr. X',
          toProvider: 'Dr. Y',
          patientSummary: 'Basic summary',
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.outstandingIssues).toEqual([]);
    expect(body.data.medications).toEqual([]);
  });

  it('POST returns 422 for missing required fields', async () => {
    const res = await postHandoff(
      new NextRequest('http://localhost:3000/api/emergency/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromProvider: 'Dr. A' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('POST returns error for invalid JSON', async () => {
    const res = await postHandoff(
      new NextRequest('http://localhost:3000/api/emergency/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST returns blocked response when middleware blocks', async () => {
    mockRunMiddleware.mockReturnValueOnce(
      new NextResponse(JSON.stringify({ error: 'blocked' }), { status: 429 }),
    );
    const res = await postHandoff(
      new NextRequest('http://localhost:3000/api/emergency/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromProvider: 'A', toProvider: 'B', patientSummary: 'X' }),
      }),
    );
    expect(res.status).toBe(429);
  });
});
