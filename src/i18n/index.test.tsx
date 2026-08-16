import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, useI18n } from './index';

function Consumer() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <span>{locale}</span>
      <span>{t('Settings')}</span>
      <span>{t('Load Guidance')}</span>
      <span>{t('Not enough history for a stable baseline. Add easy sessions gradually.')}</span>
      <span>{t('Automatic Insights')}</span>
      <span>{t('Personal Records')}</span>
      <span>{t('{count} active periods in {range}', { count: 4, range: t('30 days') })}</span>
      <button onClick={() => setLocale('en')}>English</button>
    </div>
  );
}

describe('I18nProvider', () => {
  beforeAll(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });

  beforeEach(() => window.localStorage.clear());

  it('loads and applies a persisted Indonesian locale', async () => {
    window.localStorage.setItem('velopulse-locale', 'id');
    render(<I18nProvider><Consumer /></I18nProvider>);

    expect(await screen.findByText('Pengaturan')).toBeInTheDocument();
    expect(screen.getByText('Panduan Beban')).toBeInTheDocument();
    expect(screen.getByText('Riwayat belum cukup untuk baseline yang stabil. Tambahkan sesi ringan secara bertahap.')).toBeInTheDocument();
    expect(screen.getByText('Insight Otomatis')).toBeInTheDocument();
    expect(screen.getByText('Rekor Pribadi')).toBeInTheDocument();
    expect(screen.getByText('4 periode aktif dalam 30 hari')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('id');
  });

  it('updates and persists the selected locale', async () => {
    window.localStorage.setItem('velopulse-locale', 'id');
    render(<I18nProvider><Consumer /></I18nProvider>);
    await screen.findByText('Pengaturan');

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    expect(window.localStorage.getItem('velopulse-locale')).toBe('en');
  });
});
