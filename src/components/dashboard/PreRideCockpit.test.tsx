import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import type { WorkoutSession } from '@/store/useWorkoutStore';
import { PreRideCockpit } from './PreRideCockpit';

const PROFILE = { age: 30, maxHr: 190, maxHrSource: 'auto' as const, ftp: 200, weight: 75, restingHr: 55 };

const DATA = { hr: 0, cadence: 0, power: 0, speed: 0, distance: 0, resistance: 0, calories: 0 };

const sessionOn = (date: Date): WorkoutSession => ({
  id: date.toISOString(),
  sessionStartTime: date.getTime(),
  date: date.toISOString(),
  duration: 1800,
  stats: { avgHr: 120, maxHr: 150, avgPower: 100, maxPower: 200, avgCadence: 80, maxCadence: 90 },
  history: [],
});

const renderCockpit = (
  connected: boolean,
  profile: typeof PROFILE = PROFILE,
  sessions: WorkoutSession[] = []
) => {
  const onStart = vi.fn();
  const onStartFtpTest = vi.fn();

  render(
    <I18nProvider>
      <PreRideCockpit
        currentData={DATA}
        userProfile={profile}
        sessions={sessions}
        hrConnected={connected}
        bikeConnected={connected}
        bleError={null}
        connectHeartRate={vi.fn()}
        connectBike={vi.fn()}
        onStart={onStart}
        onDisconnect={vi.fn()}
        onOpenSettings={vi.fn()}
        onStartFtpTest={onStartFtpTest}
      />
    </I18nProvider>
  );

  return { onStart, onStartFtpTest };
};

afterEach(() => {
  vi.useRealTimers();
});

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

describe('PreRideCockpit FTP invitation', () => {
  it('invites a rider without an FTP to measure it', () => {
    const { onStartFtpTest } = renderCockpit(true, { ...PROFILE, ftp: 0 });

    expect(screen.getByText('No FTP yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Measure FTP' }));

    expect(onStartFtpTest).toHaveBeenCalledTimes(1);
  });

  it('keeps the measurement available once an FTP is already set', () => {
    const { onStartFtpTest } = renderCockpit(true);

    expect(screen.getByText('FTP measurement')).toBeInTheDocument();
    expect(screen.getByText(/Your profile FTP is 200 W/)).toBeInTheDocument();
    expect(screen.queryByText('No FTP yet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Measure again' }));
    expect(onStartFtpTest).toHaveBeenCalledTimes(1);
  });

  it('locks the test button until the bike streams power', () => {
    renderCockpit(false, { ...PROFILE, ftp: 0 });

    expect(screen.getByRole('button', { name: 'Measure FTP' })).toBeDisabled();
    expect(screen.getByText('Connect the bike to start the test.')).toBeInTheDocument();
  });
});

describe('PreRideCockpit last workout recency', () => {
  it('reports how many days have passed since the last workout', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 12, 0));

    renderCockpit(true, PROFILE, [sessionOn(new Date(2026, 10, 2, 18, 0))]);

    expect(screen.getByText('3 days ago')).toBeInTheDocument();
  });

  it('reports today when the last workout happened today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 12, 0));

    renderCockpit(true, PROFILE, [sessionOn(new Date(2026, 10, 5, 6, 30))]);

    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('reports never when no workout is stored yet', () => {
    renderCockpit(true);

    expect(screen.getByText('Never')).toBeInTheDocument();
  });
});
