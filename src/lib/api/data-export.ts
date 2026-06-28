// ============================================================
// Shiora on Aethelred — Data-Subject Export Serialization
//
// Renders a GDPR data-subject bundle (see privacy.ts) into the portable format
// the subject requested. The portability endpoint advertised csv/xml but only
// ever returned JSON; this makes those formats real, so an export labelled "csv"
// genuinely contains CSV.
// ============================================================

import type { UserDataBundle } from '@/lib/api/privacy';

export type ExportFormat = 'json' | 'csv' | 'xml';

/** Render any cell value as text: arrays/objects become compact JSON. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

// --- CSV --------------------------------------------------------------------

function csvEscape(text: string): string {
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowsToCsv(rows: readonly object[]): string {
  if (rows.length === 0) {
    return '';
  }
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => csvEscape(cellText((row as Record<string, unknown>)[h]))).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function toCsv(bundle: UserDataBundle): string {
  const sections: [string, readonly object[]][] = [
    ['profile', [bundle.profile]],
    ['records', bundle.records],
    ['consents', bundle.consents],
    ['accessGrants', bundle.accessGrants],
    ['symptoms', bundle.symptoms],
    ['cycleEntries', bundle.cycleEntries],
    ['clinicalNotes', bundle.clinicalNotes],
    ['notifications', bundle.notifications],
    ['sanaConversations', bundle.sanaConversations],
    ['ipfsObjects', bundle.ipfsObjects],
  ];
  return sections.map(([name, rows]) => `# ${name}\n${rowsToCsv(rows)}`).join('\n\n');
}

// --- XML --------------------------------------------------------------------

function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function objectToXml(tag: string, obj: object): string {
  const inner = Object.entries(obj)
    .map(([key, value]) => `<${key}>${xmlEscape(cellText(value))}</${key}>`)
    .join('');
  return `<${tag}>${inner}</${tag}>`;
}

function arrayToXml(wrapper: string, item: string, rows: readonly object[]): string {
  return `<${wrapper}>${rows.map((row) => objectToXml(item, row)).join('')}</${wrapper}>`;
}

function toXml(bundle: UserDataBundle): string {
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<userData>'
    + objectToXml('profile', bundle.profile)
    + arrayToXml('records', 'record', bundle.records)
    + arrayToXml('consents', 'consent', bundle.consents)
    + arrayToXml('accessGrants', 'accessGrant', bundle.accessGrants)
    + arrayToXml('symptoms', 'symptom', bundle.symptoms)
    + arrayToXml('cycleEntries', 'cycleEntry', bundle.cycleEntries)
    + arrayToXml('clinicalNotes', 'clinicalNote', bundle.clinicalNotes)
    + arrayToXml('notifications', 'notification', bundle.notifications)
    + arrayToXml('sanaConversations', 'sanaConversation', bundle.sanaConversations)
    + arrayToXml('ipfsObjects', 'ipfsObject', bundle.ipfsObjects)
    + '</userData>';
}

/** Serialize a data-subject bundle into the requested portable format. */
export function serializeUserData(bundle: UserDataBundle, format: ExportFormat): string {
  if (format === 'csv') {
    return toCsv(bundle);
  }
  if (format === 'xml') {
    return toXml(bundle);
  }
  return JSON.stringify(bundle, null, 2);
}
