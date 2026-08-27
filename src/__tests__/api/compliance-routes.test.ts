/** @jest-environment node */

import { NextRequest } from 'next/server';
import { GET as overview } from '@/app/api/compliance/route';
import { GET as checks } from '@/app/api/compliance/checks/route';
import { GET as reports } from '@/app/api/compliance/reports/route';
import { GET as complianceAudit } from '@/app/api/compliance/audit/route';
import { assignRole, __resetRolesForTests } from '@/lib/api/roles-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';
import { createSessionToken } from '@/lib/api/session';
import { seededAddress } from '@/lib/utils';

const GOV = seededAddress(870);
const USER = seededAddress(871);
const govToken = createSessionToken(GOV).token;
const userToken = createSessionToken(USER).token;

function req(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest('http://localhost:3000/api/compliance', { headers });
}

beforeEach(async () => {
  __resetRolesForTests();
  __resetAuditLogForTests();
  await assignRole(GOV, 'government'); // government grants view_compliance
});

const routes = [
  ['overview', overview],
  ['checks', checks],
  ['reports', reports],
  ['audit', complianceAudit],
] as const;

describe.each(routes)('GET /api/compliance/%s', (_name, handler) => {
  it('requires authentication', async () => {
    expect((await handler(req())).status).toBe(401);
  });

  it('forbids a caller without view_compliance', async () => {
    expect((await handler(req(userToken))).status).toBe(403);
  });

  it('returns a live report for an authorized caller', async () => {
    const res = await handler(req(govToken));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe('compliance report content', () => {
  it('overview exposes posture + frameworks; checks lists controls; audit is audit-only', async () => {
    const o = await (await overview(req(govToken))).json();
    expect(o.data.posture.total).toBe(7);
    expect(o.data.frameworks.length).toBeGreaterThanOrEqual(2);

    const c = await (await checks(req(govToken))).json();
    expect(c.data.checks).toHaveLength(7);

    const a = await (await complianceAudit(req(govToken))).json();
    expect(a.data.auditControls.map((x: { id: string }) => x.id).sort()).toEqual(['audit_controls', 'integrity']);
  });
});
