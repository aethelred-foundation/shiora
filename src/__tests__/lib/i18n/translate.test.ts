/** @jest-environment node */

import {
  resolvePath,
  interpolate,
  createTranslator,
  pluralize,
  type MessageCatalog,
} from '@/lib/i18n/translate';
import { en } from '@/lib/i18n/messages/en';
import { ar } from '@/lib/i18n/messages/ar';

const catalog: MessageCatalog = {
  a: { b: { c: 'deep' } },
  greeting: 'Hello {name}',
  branch: { leaf: 'x' },
};

describe('resolvePath', () => {
  it('resolves a nested dot-path to its leaf string', () => {
    expect(resolvePath(catalog, 'a.b.c')).toBe('deep');
    expect(resolvePath(catalog, 'greeting')).toBe('Hello {name}');
  });

  it('returns undefined for a missing key or a non-leaf node', () => {
    expect(resolvePath(catalog, 'a.b.missing')).toBeUndefined(); // key absent
    expect(resolvePath(catalog, 'a.b')).toBeUndefined(); // resolves to an object, not a string
    expect(resolvePath(catalog, 'greeting.deeper')).toBeUndefined(); // descend into a string
  });
});

describe('interpolate', () => {
  it('returns the template unchanged when no params are given', () => {
    expect(interpolate('static text')).toBe('static text');
  });

  it('substitutes known placeholders and leaves unknown ones intact', () => {
    expect(interpolate('Hi {name}, you have {n}', { name: 'Sam', n: 3 })).toBe('Hi Sam, you have 3');
    expect(interpolate('Hi {name}', { other: 'x' })).toBe('Hi {name}'); // unknown placeholder untouched
  });
});

describe('createTranslator', () => {
  const t = createTranslator(catalog, { greeting: 'FALLBACK', only: { inFallback: 'yes' } });

  it('prefers the active catalog', () => {
    expect(t('greeting', { name: 'Ada' })).toBe('Hello Ada');
  });

  it('falls back to the default catalog when a key is missing', () => {
    expect(t('only.inFallback')).toBe('yes');
  });

  it('returns the key itself when it is missing everywhere (fail-visible)', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('pluralize', () => {
  it('selects the English one/other forms', () => {
    const forms = { one: '{count} record', other: '{count} records' };
    expect(pluralize('en', 1, forms)).toBe('1 record');
    expect(pluralize('en', 5, forms)).toBe('5 records');
  });

  it('uses Arabic plural categories, falling back to `other` when a form is absent', () => {
    // Arabic distinguishes zero/one/two/few/many/other; 2 selects `two`.
    expect(pluralize('ar', 2, { two: 'اثنان', other: '{count}' })).toBe('اثنان');
    // `few` (e.g. 3) is not supplied here, so it falls back to `other`.
    expect(pluralize('ar', 3, { other: '{count} سجلات' })).toBe('3 سجلات');
  });
});

describe('bundled catalogs', () => {
  it('ship matching keys in English and Arabic', () => {
    expect(en.nav.dashboard).toBe('Dashboard');
    expect(ar.nav.dashboard).toBe('لوحة التحكم');
    expect(Object.keys(en.common)).toEqual(Object.keys(ar.common));
  });
});
