// Locale switcher (GAP-25). A labelled <select> of the supported languages,
// each shown in its own script (English / العربية). Changing it flips the
// active locale — and, for Arabic, the whole interface to right-to-left.

'use client';

import { LOCALES, LOCALE_LABELS, directionOf, type Locale } from '@/lib/i18n/config';
import { useTranslation } from '@/contexts/I18nContext';

export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, dir, t } = useTranslation();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor="locale-select" className="text-sm font-medium text-slate-700">
        {t('language.label')}
      </label>
      <select
        id="locale-select"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">
        {dir === 'rtl' ? t('language.rtlNote') : t('language.ltrNote')}
      </p>
    </div>
  );
}
