/** @jest-environment node */

import {
  buildComplianceReport,
  generateComplianceReport,
  type ComplianceInputs,
} from '@/lib/api/compliance-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';

const MATURITY = { production: 26, pilot: 8, simulated: 8 };

function inputs(over: Partial<ComplianceInputs>): ComplianceInputs {
  return {
    environment: 'production',
    isProduction: true,
    hasDataKey: true,
    hasDurableStore: true,
    hasSessionSecret: true,
    hstsEnabled: true,
    insecureWalletHeader: false,
    auditValid: true,
    auditLength: 12,
    maturity: MATURITY,
    ...over,
  };
}

beforeEach(() => {
  __resetAuditLogForTests();
});

describe('buildComplianceReport', () => {
  it('passes every control when fully configured', () => {
    const report = buildComplianceReport(inputs({}), 1000);
    expect(report.posture).toEqual({ total: 7, passing: 7, failing: 0, advisory: 0, score: 100 });
    expect(report.checks.every((c) => c.status === 'pass')).toBe(true);
    expect(report.frameworks).toEqual([
      { framework: 'HIPAA', total: 5, passing: 5 },
      { framework: 'SOC2', total: 2, passing: 2 },
    ]);
    expect(report.maturity).toEqual(MATURITY);
    expect(report.generatedAt).toBe(1000);
  });

  it('fails controls in production when misconfigured', () => {
    const report = buildComplianceReport(
      inputs({
        hasDataKey: false,
        hasDurableStore: false,
        hasSessionSecret: false,
        hstsEnabled: false,
        insecureWalletHeader: true,
        auditValid: false,
      }),
      1000,
    );
    expect(report.posture).toEqual({ total: 7, passing: 0, failing: 7, advisory: 0, score: 0 });
    expect(report.checks.every((c) => c.status === 'fail')).toBe(true);
    expect(report.checks.find((c) => c.id === 'audit_controls')?.detail).toContain('FAILED');
  });

  it('marks the same gaps advisory outside production', () => {
    const report = buildComplianceReport(
      inputs({
        environment: 'development',
        isProduction: false,
        hasDataKey: false,
        hasDurableStore: false,
        hasSessionSecret: false,
        hstsEnabled: false,
        insecureWalletHeader: true,
        auditValid: false,
      }),
      1000,
    );
    expect(report.posture.advisory).toBe(7);
    expect(report.posture.failing).toBe(0);
    expect(report.checks.every((c) => c.status === 'advisory')).toBe(true);
  });
});

describe('generateComplianceReport (live state)', () => {
  it('builds a report from the running system', async () => {
    const report = await generateComplianceReport();
    expect(report.environment).toBe('test');
    expect(report.posture.total).toBe(7);
    expect(report.checks.map((c) => c.id)).toContain('audit_controls');
    // In-memory audit chain starts valid (empty), so audit controls pass.
    expect(report.checks.find((c) => c.id === 'integrity')?.status).toBe('pass');
  });
});
