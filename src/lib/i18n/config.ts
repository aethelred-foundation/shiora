// ============================================================
// Shiora on Aethelred — Internationalization config (GAP-25)
//
// The supported locales, their writing direction, and the persistence key.
// `Locale` is derived from the LOCALES tuple so that adding a language is a
// single edit and every `Record<Locale, …>` becomes an exhaustiveness check.
// Direction is derived from a set (not hardcoded per component) so that one
// `dir` attribute on <html> mirrors the entire UI for right-to-left scripts.
// ============================================================

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Locales written right-to-left. */
const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['ar']);

export type Direction = 'ltr' | 'rtl';

/** Native-name label for each locale (shown in the switcher). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

/** Cookie the locale is persisted under (the de-facto `NEXT_LOCALE` name). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Narrow an arbitrary value to a supported Locale. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Writing direction for a locale. */
export function directionOf(locale: Locale): Direction {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

/**
 * Resolve a free-form language preference (a cookie value, `navigator.language`,
 * or an `Accept-Language` primary tag) to a supported locale, matching on the
 * primary subtag (`ar-EG` → `ar`). Falls back to the default when unmatched.
 */
export function resolveLocale(preference: string | null | undefined): Locale {
  if (!preference) {
    return DEFAULT_LOCALE;
  }
  const primary = preference.toLowerCase().split('-')[0];
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}
