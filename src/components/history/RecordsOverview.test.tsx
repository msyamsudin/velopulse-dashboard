import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  // Pin the locale so the date labels in the best-efforts rows are stable.
  beforeEach(() => {
    try {
      window.localStorage.setItem('velopulse-locale', 'en');
    } catch {
      // storage unavailable — the provider falls back to the browser language
    }
  });

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

  it('shows the sustained windows and fastest splits, and opens the session behind a row', () => {
    const onSelectSession = vi.fn();
    render(
      <I18nProvider>
        <RecordsOverview sessions={sessions} onSelectSession={onSelectSession} />
      </I18nProvider>
    );

    expect(screen.getByText('Best efforts')).toBeInTheDocument();
    expect(screen.getByText('Sustained power')).toBeInTheDocument();
    expect(screen.getByText('Fastest splits')).toBeInTheDocument();

    // Windows the fixture can hold: 5/10/20 min. Nothing lasts an hour, so the
    // 60-minute row must not be invented.
    expect(screen.getByText('5 min')).toBeInTheDocument();
    expect(screen.getByText('20 min')).toBeInTheDocument();
    expect(screen.queryByText('60 min')).not.toBeInTheDocument();

    // Splits: 1/5 km from session a in 10:00, 10 km from session b in 20:00.
    expect(screen.getAllByText('10:00').length).toBeGreaterThan(0);
    expect(screen.getByText('10 km')).toBeInTheDocument();

    // The 5 km record belongs to session a (10:00 against b's 20:00), so a
    // lower-is-better split must resolve to it and open that session.
    fireEvent.click(screen.getByText('5 km'));
    expect(onSelectSession).toHaveBeenCalledWith('a');
  });

  it('reports a missing stream per column instead of hiding the whole block', () => {
    const noPower: WorkoutSession = {
      id: 'c',
      sessionStartTime: Date.parse('2026-05-03T08:00:00.000Z'),
      date: '2026-05-03T08:00:00.000Z',
      duration: 1200,
      stats: { avgHr: 120, maxHr: 160, avgPower: 0, maxPower: 0, avgCadence: 70, maxCadence: 110, maxSpeed: 45 },
      history: [
        { time: '00:00:00', hr: 100, cadence: 60, power: 0, speed: 0, distance: 0, resistance: 0, calories: 0 },
        { time: 'end', hr: 120, cadence: 70, power: 0, speed: 45, distance: 9000, resistance: 10, calories: 50 },
      ],
    };

    render(
      <I18nProvider>
        <RecordsOverview sessions={[noPower]} />
      </I18nProvider>
    );

    expect(screen.getByText('Best efforts')).toBeInTheDocument();
    expect(screen.getByText('No power data in this scope')).toBeInTheDocument();
    // The distance stream is intact, so its rows still render.
    expect(screen.getByText('1 km')).toBeInTheDocument();
    expect(screen.queryByText('No distance data in this scope')).not.toBeInTheDocument();
  });

  it('hides the best-efforts block when the scope has no sessions', () => {
    render(
      <I18nProvider>
        <RecordsOverview sessions={[]} />
      </I18nProvider>
    );

    expect(screen.queryByText('Best efforts')).not.toBeInTheDocument();
    expect(screen.getByText('No records in this period')).toBeInTheDocument();
  });
});
