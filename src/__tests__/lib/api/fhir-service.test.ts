/** @jest-environment node */

import {
  parseBundle,
  mapResource,
  importBundle,
  exportRecordsAsBundle,
  RESOURCE_MAPPING,
  FhirParseError,
} from '@/lib/api/fhir/fhir-service';
import { listRecords, __resetRecordsForTests } from '@/lib/api/records-service';
import { __resetAuditLogForTests } from '@/lib/api/audit-log';

const OWNER = 'aeth1owner';
const NOW = 1_700_000_000_000;

beforeEach(() => {
  __resetRecordsForTests();
  __resetAuditLogForTests();
});

describe('parseBundle', () => {
  it('accepts a Bundle with and without entries', () => {
    expect(parseBundle({ resourceType: 'Bundle' }).resourceType).toBe('Bundle');
    expect(parseBundle({ resourceType: 'Bundle', entry: [] }).entry).toEqual([]);
  });

  it.each([
    [null, /not a FHIR resource/],
    ['a string', /not a FHIR resource/],
    [{ resourceType: 'Patient' }, /must be "Bundle"/],
    [{ resourceType: 'Bundle', entry: {} }, /entry must be an array/],
  ])('rejects %p', (input, message) => {
    expect(() => parseBundle(input)).toThrow(FhirParseError);
    expect(() => parseBundle(input)).toThrow(message);
  });
});

describe('mapResource', () => {
  it('maps an Observation lab result (value + unit)', () => {
    const res = mapResource(
      {
        resourceType: 'Observation',
        code: { text: 'Hemoglobin A1c' },
        effectiveDateTime: '2026-01-02T00:00:00Z',
        valueQuantity: { value: 5.4, unit: '%' },
        performer: [{ display: 'Dr. Lin' }],
      },
      NOW,
    );
    expect(res.ok && res.fields).toMatchObject({
      type: 'lab_result',
      label: 'Hemoglobin A1c',
      description: '5.4 %',
      provider: 'Dr. Lin',
    });
    expect(res.ok && res.fields.date).toBe(Date.parse('2026-01-02T00:00:00Z'));
  });

  it('maps a vital-signs Observation (by category) and uses code system in tags', () => {
    const res = mapResource(
      {
        resourceType: 'Observation',
        category: [{ coding: [{ code: 'vital-signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] },
        valueQuantity: { value: 72, code: '/min' },
      },
      NOW,
    );
    expect(res.ok && res.fields.type).toBe('vitals');
    expect(res.ok && res.fields.label).toBe('Heart rate');
    expect(res.ok && res.fields.description).toBe('72 /min');
    expect(res.ok && res.fields.tags).toEqual(['Observation', 'http://loinc.org']);
  });

  it('detects vital signs by category text', () => {
    const res = mapResource(
      { resourceType: 'Observation', category: [{ text: 'Vital Signs' }], code: { text: 'BP' }, valueString: '120/80' },
      NOW,
    );
    expect(res.ok && res.fields.type).toBe('vitals');
    expect(res.ok && res.fields.description).toBe('120/80');
  });

  it('falls back to "No recorded value" when an Observation has no value', () => {
    const res = mapResource({ resourceType: 'Observation', code: { coding: [{ code: 'X' }] } }, NOW);
    expect(res.ok && res.fields.description).toBe('No recorded value');
    expect(res.ok && res.fields.label).toBe('X'); // coding.code fallback
    expect(res.ok && res.fields.tags).toEqual(['Observation']); // no system
    expect(res.ok && res.fields.date).toBe(NOW); // no date
  });

  it('ignores a valueQuantity with no numeric value', () => {
    const res = mapResource(
      { resourceType: 'Observation', code: { text: 'X' }, valueQuantity: { unit: 'mg' }, valueString: 'fallback' },
      NOW,
    );
    expect(res.ok && res.fields.description).toBe('fallback');
  });

  it('handles a non-vital category and a unitless quantity', () => {
    const res = mapResource(
      {
        resourceType: 'Observation',
        category: [{ coding: [{ code: 'laboratory' }] }], // present but not vital-signs, no text
        code: { text: 'X' },
        valueQuantity: { value: 5 }, // no unit, no code
      },
      NOW,
    );
    expect(res.ok && res.fields.type).toBe('lab_result');
    expect(res.ok && res.fields.description).toBe('5');
  });

  it('maps a Condition', () => {
    const res = mapResource(
      {
        resourceType: 'Condition',
        code: { coding: [{ display: 'Type 2 diabetes' }] },
        clinicalStatus: { text: 'active' },
        recordedDate: '2025-12-01',
      },
      NOW,
    );
    expect(res.ok && res.fields).toMatchObject({ type: 'notes', label: 'Type 2 diabetes' });
    expect(res.ok && res.fields.description).toContain('active');
  });

  it('maps a MedicationStatement', () => {
    const res = mapResource(
      { resourceType: 'MedicationStatement', medicationCodeableConcept: { text: 'Metformin' }, status: 'active' },
      NOW,
    );
    expect(res.ok && res.fields).toMatchObject({ type: 'prescription', label: 'Metformin' });
    expect(res.ok && res.fields.description).toContain('active');
  });

  it('maps an AllergyIntolerance', () => {
    const res = mapResource(
      { resourceType: 'AllergyIntolerance', code: { text: 'Penicillin' }, criticality: 'high' },
      NOW,
    );
    expect(res.ok && res.fields.label).toBe('Allergy: Penicillin');
    expect(res.ok && res.fields.description).toContain('high');
  });

  it('maps a DiagnosticReport with conclusion', () => {
    const res = mapResource(
      { resourceType: 'DiagnosticReport', code: { text: 'CBC' }, conclusion: 'Within normal limits', issued: 'bad-date' },
      NOW,
    );
    expect(res.ok && res.fields).toMatchObject({ type: 'lab_result', label: 'CBC', description: 'Within normal limits' });
    expect(res.ok && res.fields.date).toBe(NOW); // invalid date -> now
  });

  it('maps a DiagnosticReport without conclusion (status fallback)', () => {
    const res = mapResource({ resourceType: 'DiagnosticReport', code: { text: 'CBC' }, status: 'final' }, NOW);
    expect(res.ok && res.fields.description).toBe('Report status: final');
  });

  it('falls back to "unknown" when optional status fields are absent', () => {
    const cond = mapResource({ resourceType: 'Condition', code: { text: 'X' } }, NOW);
    expect(cond.ok && cond.fields.description).toContain('unknown');

    const med = mapResource({ resourceType: 'MedicationStatement', medicationCodeableConcept: { text: 'X' } }, NOW);
    expect(med.ok && med.fields.description).toBe('Medication status: unknown');

    const allergy = mapResource({ resourceType: 'AllergyIntolerance', code: { text: 'X' } }, NOW);
    expect(allergy.ok && allergy.fields.description).toBe('Criticality: unknown');

    const report = mapResource({ resourceType: 'DiagnosticReport', code: { text: 'X' } }, NOW);
    expect(report.ok && report.fields.description).toBe('Report status: unknown');
  });

  it.each([
    { resourceType: 'Observation' }, // no code
    { resourceType: 'Condition', code: {} }, // empty concept
    { resourceType: 'MedicationStatement' },
    { resourceType: 'AllergyIntolerance' },
    { resourceType: 'DiagnosticReport' },
  ])('skips a resource missing its clinical code (%p)', (resource) => {
    const res = mapResource(resource, NOW);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe('missing-code');
  });

  it('skips an unsupported resource type', () => {
    const res = mapResource({ resourceType: 'Patient' }, NOW);
    expect(!res.ok && res.reason).toBe('unsupported-resource-type');
  });
});

describe('importBundle', () => {
  it('imports supported resources as encrypted records and reports skips', async () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: [
        { resource: { resourceType: 'Observation', code: { text: 'Glucose' }, valueQuantity: { value: 90, unit: 'mg/dL' } } },
        { resource: { resourceType: 'Condition', code: { text: 'Hypertension' }, clinicalStatus: { text: 'active' } } },
        { resource: { resourceType: 'Patient', id: 'p1' } }, // unsupported
        { resource: { resourceType: 'Observation' } }, // missing code
        { fullUrl: 'x' }, // no resource
      ],
    };

    const summary = await importBundle(OWNER, bundle);
    expect(summary.bundleType).toBe('transaction');
    expect(summary.totalResources).toBe(5);
    expect(summary.imported).toBe(2);
    expect(summary.recordIds).toHaveLength(2);
    expect(summary.skipped).toEqual([
      { resourceType: 'Patient', reason: 'unsupported-resource-type' },
      { resourceType: 'Observation', reason: 'missing-code' },
      { resourceType: 'unknown', reason: 'missing-resource' },
    ]);

    const records = await listRecords(OWNER);
    expect(records).toHaveLength(2);
    expect(records.every((r) => r.encrypted && r.encryption === 'AES-256-GCM')).toBe(true);
    expect(records.map((r) => r.label).sort()).toEqual(['Glucose', 'Hypertension']);
  });

  it('handles an empty bundle', async () => {
    const summary = await importBundle(OWNER, { resourceType: 'Bundle' });
    expect(summary.totalResources).toBe(0);
    expect(summary.imported).toBe(0);
  });

  it('rejects a non-Bundle payload', async () => {
    await expect(importBundle(OWNER, { resourceType: 'Patient' })).rejects.toThrow(FhirParseError);
  });
});

describe('exportRecordsAsBundle', () => {
  it('emits an empty collection Bundle for an owner with no records', async () => {
    const bundle = await exportRecordsAsBundle(OWNER);
    expect(bundle).toMatchObject({ resourceType: 'Bundle', type: 'collection', entry: [] });
  });

  it('round-trips imported records back into a FHIR Bundle', async () => {
    await importBundle(OWNER, {
      resourceType: 'Bundle',
      entry: [{ resource: { resourceType: 'Observation', code: { text: 'Glucose' }, valueString: '90' } }],
    });
    const bundle = await exportRecordsAsBundle(OWNER);
    expect(bundle.entry).toHaveLength(1);
    const resource = bundle.entry![0].resource!;
    expect(resource.resourceType).toBe('Observation');
    expect((resource as { code: { text: string } }).code.text).toBe('Glucose');
  });
});

describe('RESOURCE_MAPPING', () => {
  it('documents every supported resource type', () => {
    expect(RESOURCE_MAPPING.map((m) => m.resourceType)).toEqual([
      'Observation', 'Condition', 'MedicationStatement', 'AllergyIntolerance', 'DiagnosticReport',
    ]);
  });
});
