/** @jest-environment node */

import { serializeUserData } from '@/lib/api/data-export';
import type { UserDataBundle } from '@/lib/api/privacy';

// A representative bundle that exercises every value kind and escaping path:
// null (profile.updatedAt), string, number (size), boolean (encrypted), array
// (tags), a CSV-hostile string (comma + quote), an XML-hostile string (< > &),
// non-empty sections (profile, records, consents) and empty ones (the rest).
const bundle = {
  profile: { displayName: 'Ada', contactEmail: 'ada@x.co', timezone: '', locale: '', updatedAt: null },
  records: [{ id: 'r1', label: 'Hello, "world"', encrypted: true, size: 10, tags: ['genomics', 'lab'] }],
  consents: [{ id: 'c1', providerName: 'Dr <A> & <B>', status: 'active' }],
  accessGrants: [],
  symptoms: [],
  cycleEntries: [],
  clinicalNotes: [],
  notifications: [],
} as unknown as UserDataBundle;

describe('serializeUserData', () => {
  it('renders JSON by default', () => {
    const out = serializeUserData(bundle, 'json');
    expect(out).toContain('"records"');
    expect(JSON.parse(out).profile.displayName).toBe('Ada');
  });

  it('renders sectioned CSV with proper escaping and array cells', () => {
    const out = serializeUserData(bundle, 'csv');
    expect(out).toContain('# profile');
    expect(out).toContain('# records');
    expect(out).toContain('# notifications'); // empty section still labelled
    expect(out).toContain('"Hello, ""world"""'); // comma + quote escaped
    expect(out).toContain('genomics'); // array cell serialized to JSON
  });

  it('renders XML with escaped entities', () => {
    const out = serializeUserData(bundle, 'xml');
    expect(out).toContain('<userData>');
    expect(out).toContain('<record>');
    expect(out).toContain('Dr &lt;A&gt; &amp; &lt;B&gt;'); // < > & escaped
  });
});
