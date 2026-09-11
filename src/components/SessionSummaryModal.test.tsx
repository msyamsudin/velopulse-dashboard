import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { SessionSummaryModal } from './SessionSummaryModal';

beforeEach(() => {
  try {
    window.localStorage.setItem('velopulse-locale', 'en');
  } catch {
    // storage unavailable — the provider falls back to the browser language
  }
});

const stats = {
  avgHr: 130,
  maxHr: 160,
  avgPower: 180,
  maxPower: 320,
  avgCadence: 82,
  maxCadence: 95,
  avgSpeed: 28.4,
  maxSpeed: 42.1,
  hrrScore: null,
  hrrClassification: null,
};

const renderModal = (onSave = vi.fn()) => {
  render(
    <I18nProvider>
      <SessionSummaryModal
        stats={stats}
        duration="30:00"
        calories={320}
        distance={14200}
        maxHr={190}
        onSave={onSave}
        onDiscard={() => {}}
      />
    </I18nProvider>
  );
  return onSave;
};

describe('SessionSummaryModal subjective effort', () => {
  it('reports the chosen RPE together with its session load', () => {
    const onSave = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'RPE 7' }));
    expect(screen.getByRole('button', { name: 'RPE 7' })).toHaveAttribute('aria-pressed', 'true');
    // 7 × 30 min = 210 AU, shown live so the number is not a black box.
    expect(screen.getByText('210')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save workout session' }));
    expect(onSave).toHaveBeenCalledWith(7);
  });

  it('lets the rider clear the rating again', () => {
    const onSave = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'RPE 4' }));
    fireEvent.click(screen.getByRole('button', { name: 'RPE 4' }));
    expect(screen.getByRole('button', { name: 'RPE 4' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Save workout session' }));
    expect(onSave).toHaveBeenCalledWith(undefined);
  });

  it('saves an unrated ride without an RPE', () => {
    const onSave = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Save workout session' }));
    expect(onSave).toHaveBeenCalledWith(undefined);
  });
});
