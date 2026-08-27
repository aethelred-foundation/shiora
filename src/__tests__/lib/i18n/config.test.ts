/** @jest-environment node */

import {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_COOKIE,
  isLocale,
  directionOf,
  resolveLocale,
} from '@/lib/i18n/config';

describe('i18n config', () => {
  it('declares the supported locales and their metadata', () => {
    expect(LOCALES).toEqual(['en', 'ar']);
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALE_LABELS.en).toBe('English');
    expect(LOCALE_LABELS.ar).toBe('العربية');
    expect(LOCALE_COOKIE).toBe('NEXT_LOCALE');
  });

  it('narrows arbitrary values to a supported locale', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(42)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('derives writing direction from the locale', () => {
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('ar')).toBe('rtl');
  });

  it('resolves a free-form preference to a supported locale by primary subtag', () => {
    expect(resolveLocale('ar-EG')).toBe('ar');
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('AR')).toBe('ar'); // case-insensitive
    expect(resolveLocale('fr')).toBe('en'); // unmatched → default
    expect(resolveLocale('')).toBe('en'); // empty → default
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});
