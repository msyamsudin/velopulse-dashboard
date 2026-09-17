import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { PreRideCockpit } from './PreRideCockpit';

const PROFILE = { age: 30, maxHr: 190, ftp: 200, weight: 75, restingHr: 55 };

const DATA = { hr: 0, cadence: 0, power: 0, speed: 0, distance: 0, resistance: 0, calories: 0 };

const renderCockpit = (connected: boolean) => {
  const onStart = vi.fn();

  render(
    <I18nProvider>
      <PreRideCockpit
        currentData={DATA}
        userProfile={PROFILE}
        hrConnected={connected}
        bikeConnected={connected}
        bleError={null}
        connectHeartRate={vi.fn()}
        connectBike={vi.fn()}
        onStart={onStart}
        onDisconnect={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    </I18nProvider>
  );

  return { onStart };
};

describe('PreRideCockpit start gate', () => {
  it('keeps Start locked while the heart-rate strap is offline', () => {
    renderCockpit(false);

    expect(screen.getByRole('button', { name: 'Start workout session' })).toBeDisabled();
  });

  it('starts the session once a heart-rate source is connected', () => {
    const { onStart } = renderCockpit(true);

    const startButton = screen.getByRole('button', { name: 'Start workout session' });
    expect(startButton).toBeEnabled();

    fireEvent.click(startButton);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
