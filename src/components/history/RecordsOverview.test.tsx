import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { RecordsOverview } from './RecordsOverview';
import type { WorkoutSession } from '@/store/useWorkoutStore';

const makeSession = (
  id: string,
  iso: string,
  duration: number,
  finalDistanceMeters: number,
  maxSpeed: number,
  maxPower = 220,
  calories = 50
): WorkoutSession => ({
  id,
  sessionStartTime: Date.parse(iso),
  date: iso,
  duration,
  stats: {
    avgHr: 120,
    maxHr: 160,
    avgPower: 60,
    maxPower,
    avgCadence: 70,
    maxCadence: 110,
    maxSpeed,
  },
  history: [
    {
      time: '00:00:00',
      hr: 100,
      cadence: 60,
      power: 40,
      speed: 0,
      distance: 0,
      resistance: 0,
      calories: 0,
    },
    {
      time: 'end',
      hr: 120,
      cadence: 70,
      power: 60,
      speed: maxSpeed,
      distance: finalDistanceMeters,
      resistance: 10,
      calories,
    },
  ],
});

// Every metric has a single clear best in session b (longest, farthest,
// highest calories, highest peak power, fastest average).
const sessions: WorkoutSession[] = [
  makeSession('a', '2026-05-01T08:00:00.000Z', 1200, 9000, 45),
  makeSession('b', '2026-05-02T08:00:00.000Z', 2400, 30000, 55, 300, 200),
];

describe('RecordsOverview', () => {
  it('shows the current all-time personal records by default', () => {
    render(
      <I18nProvider>
        <RecordsOverview sessions={sessions} />
      </I18nProvider>
    );

    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.getByText('Longest Ride')).toBeInTheDocument();
    expect(screen.getByText('Best Distance')).toBeInTheDocument();
    expect(screen.getByText('Fastest Avg Speed')).toBeInTheDocument();

    // Longest Ride: 2400 s shown with second precision → 40:00.
    expect(screen.getByText('40:00')).toBeInTheDocument();
    // Best Distance: 30.00 km.
    expect(screen.getByText('30.00')).toBeInTheDocument();
    // Fastest Avg Speed: 30 km ÷ 40 min → 45.0 km/h.
    expect(screen.getByText('45.0')).toBeInTheDocument();
    // Peak Power from session b.
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('opens the session behind a record card', () => {
    const onSelectSession = vi.fn();
    render(
      <I18nProvider>
        <RecordsOverview sessions={sessions} onSelectSession={onSelectSession} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByText('30.00')); // Best Distance card
    expect(onSelectSession).toHaveBeenCalledWith('b');
  });
});
