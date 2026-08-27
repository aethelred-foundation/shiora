// ============================================================
// Shiora on Aethelred — FHIR R4 ingest / export service
//
// Real HL7 FHIR R4 interoperability: parses and validates a FHIR Bundle (the
// shape Epic/Cerner export), maps each supported clinical resource into the
// encrypted health-record store (records-service → EncryptedRecordRepository, so
// the mapped PHI is sealed at rest and audited), and emits a patient's records
// back as a FHIR Bundle. No mock data — the mapping is structural and the
// validation rejects malformed resources with explicit reasons.
//
// SCOPE: structural R4 validation + mapping. Conformance against a specific
// production EHR sandbox (Epic/Cerner) is the remaining integration step.
// ============================================================

import { randomUUID } from 'node:crypto';

import { createRecord, listRecords } from '@/lib/api/records-service';
import type { StoredHealthRecord } from '@/lib/api/domain-types';
import type {
  FhirBundle,
  FhirCodeableConcept,
  FhirObservation,
  FhirCondition,
  FhirMedicationStatement,
  FhirAllergyIntolerance,
  FhirDiagnosticReport,
  SupportedResourceType,
} from './fhir-types';

/** Thrown when the payload is not a usable FHIR Bundle. */
export class FhirParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FhirParseError';
  }
}

interface MappedFields {
  type: string;
  label: string;
  description: string;
  date: number;
  tags: string[];
  provider: string;
}

type MapResult = { ok: true; fields: MappedFields } | { ok: false; reason: string };

export interface ImportSummary {
  bundleType: string | null;
  totalResources: number;
  imported: number;
  recordIds: string[];
  skipped: Array<{ resourceType: string; reason: string }>;
}

/** The structural mapping Shiora applies, surfaced at GET /api/fhir/mapping. */
export const RESOURCE_MAPPING: ReadonlyArray<{
  resourceType: SupportedResourceType;
  recordType: string;
  description: string;
}> = [
  {
    resourceType: 'Observation',
    recordType: 'lab_result | vitals',
    description: 'Lab results and vital signs (by category)',
  },
  {
    resourceType: 'Condition',
    recordType: 'notes',
    description: 'Problem-list conditions / diagnoses',
  },
  {
    resourceType: 'MedicationStatement',
    recordType: 'prescription',
    description: 'Medication statements',
  },
  {
    resourceType: 'AllergyIntolerance',
    recordType: 'notes',
    description: 'Allergies and intolerances',
  },
  { resourceType: 'DiagnosticReport', recordType: 'lab_result', description: 'Diagnostic reports' },
];

// ── helpers ──────────────────────────────────────────────────────────────────

interface ResolvedCode {
  label: string;
  system: string | undefined;
}

/**
 * Resolve a CodeableConcept to a human label + primary coding system. Returns
 * undefined when there is no usable code — a clinical resource without one is
 * not importable. The explicit `if (!concept)` narrows the type so there is no
 * unreachable optional-chain branch downstream.
 */
function resolveCode(concept: FhirCodeableConcept | undefined): ResolvedCode | undefined {
  if (!concept) {
    return undefined;
  }
  const label = concept.text ?? concept.coding?.[0]?.display ?? concept.coding?.[0]?.code;
  if (!label) {
    return undefined;
  }
  return { label, system: concept.coding?.[0]?.system };
}

/** A label-only resolution (e.g. clinical/verification status). */
function statusLabel(concept: FhirCodeableConcept | undefined): string {
  return resolveCode(concept)?.label ?? 'unknown';
}

function tags(resourceType: string, system: string | undefined): string[] {
  return system ? [resourceType, system] : [resourceType];
}

function parseDate(value: string | undefined, now: number): number {
  if (!value) {
    return now;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? now : parsed;
}

function isVitalSigns(observation: FhirObservation): boolean {
  return (observation.category ?? []).some(
    (concept) =>
      (concept.coding ?? []).some((c) => c.code === 'vital-signs') ||
      (concept.text?.toLowerCase().includes('vital') ?? false),
  );
}

function observationValue(observation: FhirObservation): string {
  const quantity = observation.valueQuantity;
  if (quantity && quantity.value !== undefined) {
    const unit = quantity.unit ?? quantity.code ?? '';
    return unit ? `${quantity.value} ${unit}` : `${quantity.value}`;
  }
  if (observation.valueString) {
    return observation.valueString;
  }
  return 'No recorded value';
}

// ── per-resource mapping ─────────────────────────────────────────────────────

function mapObservation(resource: FhirObservation, now: number): MapResult {
  const code = resolveCode(resource.code);
  if (!code) {
    return { ok: false, reason: 'missing-code' };
  }
  return {
    ok: true,
    fields: {
      type: isVitalSigns(resource) ? 'vitals' : 'lab_result',
      label: code.label,
      description: observationValue(resource),
      date: parseDate(resource.effectiveDateTime ?? resource.issued, now),
      tags: tags('Observation', code.system),
      provider: resource.performer?.[0]?.display ?? 'FHIR import',
    },
  };
}

function mapCondition(resource: FhirCondition, now: number): MapResult {
  const code = resolveCode(resource.code);
  if (!code) {
    return { ok: false, reason: 'missing-code' };
  }
  return {
    ok: true,
    fields: {
      type: 'notes',
      label: code.label,
      description: `Condition (clinical status: ${statusLabel(resource.clinicalStatus)})`,
      date: parseDate(resource.recordedDate, now),
      tags: tags('Condition', code.system),
      provider: 'FHIR import',
    },
  };
}

function mapMedicationStatement(resource: FhirMedicationStatement, now: number): MapResult {
  const code = resolveCode(resource.medicationCodeableConcept);
  if (!code) {
    return { ok: false, reason: 'missing-code' };
  }
  return {
    ok: true,
    fields: {
      type: 'prescription',
      label: code.label,
      description: `Medication status: ${resource.status ?? 'unknown'}`,
      date: parseDate(resource.effectiveDateTime ?? resource.dateAsserted, now),
      tags: tags('MedicationStatement', code.system),
      provider: 'FHIR import',
    },
  };
}

function mapAllergy(resource: FhirAllergyIntolerance, now: number): MapResult {
  const code = resolveCode(resource.code);
  if (!code) {
    return { ok: false, reason: 'missing-code' };
  }
  return {
    ok: true,
    fields: {
      type: 'notes',
      label: `Allergy: ${code.label}`,
      description: `Criticality: ${resource.criticality ?? 'unknown'}`,
      date: parseDate(resource.recordedDate, now),
      tags: tags('AllergyIntolerance', code.system),
      provider: 'FHIR import',
    },
  };
}

function mapDiagnosticReport(resource: FhirDiagnosticReport, now: number): MapResult {
  const code = resolveCode(resource.code);
  if (!code) {
    return { ok: false, reason: 'missing-code' };
  }
  return {
    ok: true,
    fields: {
      type: 'lab_result',
      label: code.label,
      description: resource.conclusion ?? `Report status: ${resource.status ?? 'unknown'}`,
      date: parseDate(resource.effectiveDateTime ?? resource.issued, now),
      tags: tags('DiagnosticReport', code.system),
      provider: 'FHIR import',
    },
  };
}

/** Map any single resource. Returns ok:false (with a reason) for skip cases. */
export function mapResource(
  resource: { resourceType?: string } & Record<string, unknown>,
  now: number,
): MapResult {
  switch (resource.resourceType) {
    case 'Observation':
      return mapObservation(resource as unknown as FhirObservation, now);
    case 'Condition':
      return mapCondition(resource as unknown as FhirCondition, now);
    case 'MedicationStatement':
      return mapMedicationStatement(resource as unknown as FhirMedicationStatement, now);
    case 'AllergyIntolerance':
      return mapAllergy(resource as unknown as FhirAllergyIntolerance, now);
    case 'DiagnosticReport':
      return mapDiagnosticReport(resource as unknown as FhirDiagnosticReport, now);
    default:
      return { ok: false, reason: 'unsupported-resource-type' };
  }
}

// ── bundle parsing / import / export ─────────────────────────────────────────

/** Validate and narrow an unknown payload to a FHIR Bundle. */
export function parseBundle(input: unknown): FhirBundle {
  if (!input || typeof input !== 'object') {
    throw new FhirParseError('Payload is not a FHIR resource object.');
  }
  const candidate = input as { resourceType?: unknown; entry?: unknown };
  if (candidate.resourceType !== 'Bundle') {
    throw new FhirParseError('Payload resourceType must be "Bundle".');
  }
  if (candidate.entry !== undefined && !Array.isArray(candidate.entry)) {
    throw new FhirParseError('Bundle.entry must be an array.');
  }
  return input as FhirBundle;
}

function buildRecord(ownerAddress: string, fields: MappedFields, now: number): StoredHealthRecord {
  return {
    id: `fhir-${randomUUID().replace(/-/g, '')}`,
    type: fields.type,
    label: fields.label,
    description: fields.description,
    date: fields.date,
    uploadDate: now,
    encrypted: true,
    encryption: 'AES-256-GCM',
    cid: '', // mapped record is sealed at rest; not yet content-addressed/anchored
    txHash: '',
    attestation: '',
    size: Buffer.byteLength(fields.description, 'utf8'),
    provider: fields.provider,
    status: 'Processing',
    ipfsNodes: 0,
    tags: fields.tags,
    deleted: false,
    ownerAddress,
    blockHeight: 0,
  };
}

/** Parse a Bundle and import each supported resource as an encrypted record. */
export async function importBundle(ownerAddress: string, input: unknown): Promise<ImportSummary> {
  const bundle = parseBundle(input);
  const entries = bundle.entry ?? [];
  const now = Date.now();

  const summary: ImportSummary = {
    bundleType: bundle.type ?? null,
    totalResources: entries.length,
    imported: 0,
    recordIds: [],
    skipped: [],
  };

  for (const entry of entries) {
    const resource = entry.resource;
    if (!resource || typeof resource.resourceType !== 'string') {
      summary.skipped.push({ resourceType: 'unknown', reason: 'missing-resource' });
      continue;
    }
    const mapped = mapResource(resource, now);
    if (!mapped.ok) {
      summary.skipped.push({ resourceType: resource.resourceType, reason: mapped.reason });
      continue;
    }
    const record = buildRecord(ownerAddress, mapped.fields, now);
    await createRecord(ownerAddress, record);
    summary.imported += 1;
    summary.recordIds.push(record.id);
  }

  return summary;
}

/** Emit a patient's records as a FHIR R4 Bundle of Observations. */
export async function exportRecordsAsBundle(ownerAddress: string): Promise<FhirBundle> {
  const records = await listRecords(ownerAddress);
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: records.map((record) => ({
      resource: {
        resourceType: 'Observation',
        id: record.id,
        status: 'final',
        category: [{ text: record.type }],
        code: { text: record.label },
        effectiveDateTime: new Date(record.date).toISOString(),
        valueString: record.description,
      },
    })),
  };
}
