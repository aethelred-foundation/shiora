// ============================================================
// Shiora on Aethelred — Translation core (GAP-25)
//
// A tiny message resolver: dot-path key lookup, `{param}` interpolation, and a
// two-level fallback (active locale → default locale → the key itself, so a
// missing string is visible in development rather than blank). Pluralization
// defers to Intl.PluralRules, which is correct for Arabic's six plural
// categories (zero/one/two/few/many/other) — naive `n === 1` logic is not.
// ============================================================

import type { Locale } from './config';

export interface MessageCatalog {
  [key: string]: string | MessageCatalog;
}

export type TranslateParams = Record<string, string | number>;
export type Translator = (key: string, params?: TranslateParams) => string;

/** Resolve a dot-path (`a.b.c`) to a leaf string, or undefined if absent/non-leaf. */
export function resolvePath(catalog: MessageCatalog, key: string): string | undefined {
  let node: string | MessageCatalog = catalog;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || !(part in node)) {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replace `{name}` placeholders with params; unknown placeholders are left intact. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    (name in params ? String(params[name]) : match));
}

/** Build a translator bound to an active catalog with a default-locale fallback. */
export function createTranslator(catalog: MessageCatalog, fallback: MessageCatalog): Translator {
  return (key, params) => {
    const raw = resolvePath(catalog, key) ?? resolvePath(fallback, key) ?? key;
    return interpolate(raw, params);
  };
}

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * Select the plural form appropriate for `count` under `locale`'s rules and
 * interpolate `{count}` into it. Falls back to the `other` form when the
 * selected category is not supplied.
 */
export function pluralize(locale: Locale, count: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(locale).select(count);
  const template = forms[category] ?? forms.other;
  return interpolate(template, { count });
}
