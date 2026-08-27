import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nProvider } from '@/contexts/I18nContext';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

function setup(className?: string) {
  return render(
    <I18nProvider>
      <LocaleSwitcher className={className} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
});
afterEach(() => {
  document.documentElement.removeAttribute('dir');
});

describe('LocaleSwitcher', () => {
  it('lists every language in its own script and shows the LTR note by default', () => {
    setup();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'العربية' })).toBeInTheDocument();
    expect(screen.getByText(/left-to-right/)).toBeInTheDocument();
  });

  it('switches the locale to Arabic and swaps to the RTL note', () => {
    setup();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    act(() => {
      fireEvent.change(select, { target: { value: 'ar' } });
    });
    expect(select.value).toBe('ar');
    expect(screen.getByText('تُعرض هذه اللغة من اليمين إلى اليسار.')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('applies a caller-supplied className', () => {
    const { container } = setup('custom-class');
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
