import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nProvider, useTranslation } from '@/contexts/I18nContext';

function clearPersistence(): void {
  window.localStorage.clear();
  // Expire any NEXT_LOCALE cookie left by a prior test.
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
}

/** Swap window.localStorage for a stub for the duration of fn, then restore it. */
function withLocalStorage(stub: Partial<Storage>, fn: () => void): void {
  const real = window.localStorage;
  Object.defineProperty(window, 'localStorage', { configurable: true, value: stub });
  try {
    fn();
  } finally {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
  }
}

function Consumer() {
  const { locale, dir, setLocale, t, plural, formatNumber, formatDate } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="t">{t('common.save')}</span>
      <span data-testid="num">{formatNumber(1234.5)}</span>
      <span data-testid="date-num">{formatDate(0, { timeZone: 'UTC', year: 'numeric' })}</span>
      <span data-testid="date-obj">{formatDate(new Date(0), { timeZone: 'UTC', year: 'numeric' })}</span>
      <span data-testid="plural">{plural(1, { one: '{count} record', other: '{count} records' })}</span>
      <button onClick={() => setLocale('ar')}>to-ar</button>
      <button onClick={() => setLocale('en')}>to-en</button>
    </div>
  );
}

function renderProvider(initialLocale?: 'en' | 'ar') {
  return render(
    <I18nProvider initialLocale={initialLocale}>
      <Consumer />
    </I18nProvider>,
  );
}

beforeEach(clearPersistence);
afterEach(() => {
  jest.restoreAllMocks();
  clearPersistence();
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

describe('I18nProvider', () => {
  it('defaults to English (LTR) and reflects it onto <html>', () => {
    renderProvider();
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
    expect(screen.getByTestId('t')).toHaveTextContent('Save');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('adopts a persisted cookie preference on mount', () => {
    document.cookie = 'NEXT_LOCALE=ar; path=/';
    renderProvider();
    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    expect(screen.getByTestId('t')).toHaveTextContent('حفظ');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('ignores an invalid cookie and falls back to a stored preference', () => {
    document.cookie = 'NEXT_LOCALE=zz; path=/'; // not a supported locale
    window.localStorage.setItem('NEXT_LOCALE', 'ar');
    renderProvider();
    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
  });

  it('ignores an invalid stored value and falls back to the browser language', () => {
    window.localStorage.setItem('NEXT_LOCALE', 'zz');
    renderProvider();
    expect(screen.getByTestId('locale')).toHaveTextContent('en'); // jsdom navigator.language → en-US
  });

  it('survives localStorage reads throwing (private mode)', () => {
    withLocalStorage(
      { getItem: () => { throw new Error('access denied'); }, setItem: () => {}, clear: () => {} },
      () => {
        renderProvider();
        expect(screen.getByTestId('locale')).toHaveTextContent('en');
      },
    );
  });

  it('survives localStorage writes throwing (quota) while still updating the cookie', () => {
    withLocalStorage(
      { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); }, clear: () => {} },
      () => {
        renderProvider();
        // Persist still wrote the cookie despite the storage failure.
        expect(document.cookie).toContain('NEXT_LOCALE=en');
      },
    );
  });

  it('honors an injected initialLocale without consulting persistence', () => {
    document.cookie = 'NEXT_LOCALE=ar; path=/';
    renderProvider('en'); // explicit initial overrides the ar cookie
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });

  it('switches locale on demand, flipping direction and persistence', () => {
    renderProvider();
    act(() => {
      fireEvent.click(screen.getByText('to-ar'));
    });
    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem('NEXT_LOCALE')).toBe('ar');
    expect(document.cookie).toContain('NEXT_LOCALE=ar');

    act(() => {
      fireEvent.click(screen.getByText('to-en'));
    });
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('exposes locale-aware formatters (number, date from ms and from Date, plural)', () => {
    renderProvider();
    expect(screen.getByTestId('num')).toHaveTextContent('1,234.5');
    expect(screen.getByTestId('date-num')).toHaveTextContent('1970');
    expect(screen.getByTestId('date-obj')).toHaveTextContent('1970');
    expect(screen.getByTestId('plural')).toHaveTextContent('1 record');
  });
});

describe('useTranslation', () => {
  it('throws when used outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/must be used within an I18nProvider/);
    spy.mockRestore();
  });
});
