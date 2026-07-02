// ============================================================
// Shiora on Aethelred — Internationalization context (GAP-25)
//
// Holds the active locale, exposes a translator plus locale-aware formatters,
// and — critically — reflects the locale onto <html lang/dir> so that choosing
// Arabic mirrors the ENTIRE interface right-to-left, not one component at a
// time. The preference is persisted to both a cookie (so the server could read
// it) and localStorage, and re-adopted on load.
// ============================================================

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  directionOf,
  isLocale,
  resolveLocale,
  type Direction,
  type Locale,
} from '@/lib/i18n/config';
import { CATALOGS } from '@/lib/i18n/messages';
import {
  createTranslator,
  pluralize,
  type MessageCatalog,
  type PluralForms,
  type TranslateParams,
} from '@/lib/i18n/translate';

export interface I18nValue {
  locale: Locale;
  dir: Direction;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
  plural: (count: number, forms: PluralForms) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: number | Date, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readLocaleCookie(): Locale | null {
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  if (!match) {
    return null;
  }
  const value = decodeURIComponent(match[1]);
  return isLocale(value) ? value : null;
}

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_COOKIE);
    return stored && isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Cookie → localStorage → browser language → default. */
function detectLocale(): Locale {
  return readLocaleCookie() ?? readStoredLocale() ?? resolveLocale(navigator.language);
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    // Private-mode/quota failures must not break locale switching.
  }
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  // Adopt the persisted/browser preference on mount unless one was injected.
  useEffect(() => {
    if (initialLocale === undefined) {
      setLocaleState(detectLocale());
    }
  }, [initialLocale]);

  // Mirror the locale onto <html> and persist it whenever it changes.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = directionOf(locale);
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

  const value = useMemo<I18nValue>(() => {
    const t = createTranslator(
      CATALOGS[locale] as MessageCatalog,
      CATALOGS[DEFAULT_LOCALE] as MessageCatalog,
    );
    return {
      locale,
      dir: directionOf(locale),
      setLocale,
      t,
      plural: (count, forms) => pluralize(locale, count, forms),
      formatNumber: (num, options) => new Intl.NumberFormat(locale, options).format(num),
      formatDate: (val, options) =>
        new Intl.DateTimeFormat(locale, options).format(typeof val === 'number' ? new Date(val) : val),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the active locale, translator, and formatters. Throws outside a provider. */
export function useTranslation(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return ctx;
}
