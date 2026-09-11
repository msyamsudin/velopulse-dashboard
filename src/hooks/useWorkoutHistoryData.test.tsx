import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { useWorkoutHistoryData } from './useWorkoutHistoryData';
import type { WorkoutSession } from '@/store/useWorkoutStore';

const makeSession = (id: string, dateISO: string): WorkoutSession => ({
  id,
  sessionStartTime: new Date(dateISO).getTime(),
  date: dateISO,
  duration: 1800,
  stats: { avgHr: 130, maxHr: 150, avgPower: 150, maxPower: 250, avgCadence: 80, maxCadence: 90 },
  history: [],
});

const daysAgo = (days: number, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const renderStreakHook = (sessions: WorkoutSession[]) =>
  renderHook(() => useWorkoutHistoryData({
    sessions,
    maxHr: 200,
    summaryPeriod: 'daily',
    summaryRange: '7d',
    weeklyMetric: 'distance',
  }), { wrapper: I18nProvider });

describe('current streak grace', () => {
  it('counts the streak from yesterday while today is still in progress', () => {
    const sessions = [1, 2, 3].map(day => makeSession(`s${day}`, daysAgo(day)));
    const { result } = renderStreakHook(sessions);

    expect(result.current.summaryInsights?.currentStreakLabel).toBe('3 days');
  });

  it('breaks the streak when a full day without data is in the way', () => {
    const sessions = [2, 3].map(day => makeSession(`s${day}`, daysAgo(day)));
    const { result } = renderStreakHook(sessions);

    expect(result.current.summaryInsights?.currentStreakLabel).toBe('0 days');
  });

  it('counts today when it already has data', () => {
    const sessions = [makeSession('today', daysAgo(0, 8)), ...([1, 2].map(day => makeSession(`s${day}`, daysAgo(day))))];
    const { result } = renderStreakHook(sessions);

    expect(result.current.summaryInsights?.currentStreakLabel).toBe('3 days');
  });
});

describe('zone time aggregation', () => {
  const point = (index: number, hr: number) => ({
    time: `${index}`,
    ts: Date.parse(daysAgo(1)) + index * 1000,
    hr,
    cadence: 80,
    power: 150,
    speed: 20,
    distance: 0,
    resistance: 0,
    calories: 0,
  });

  // maxHr 200 → Z1 starts at 100 bpm. Half the samples sit below that
  // threshold (warm-up / dropout), half are in Z2 (0.65 × maxHr).
  const session: WorkoutSession = {
    id: 'zones',
    sessionStartTime: Date.parse(daysAgo(1)),
    date: daysAgo(1),
    duration: 100,
    stats: { avgHr: 105, maxHr: 130, avgPower: 150, maxPower: 250, avgCadence: 80, maxCadence: 90 },
    history: [
      ...Array.from({ length: 5 }, (_, index) => point(index, 80)),
      ...Array.from({ length: 5 }, (_, index) => point(index + 5, 130)),
    ],
  };

  it('leaves below-Z1 time out of the zones instead of dumping it into Z5', () => {
    const { result } = renderStreakHook([session]);
    const { intensity } = result.current;

    // 5 of 10 samples in Z2 → half of the 100 s duration.
    expect(intensity.zones[1].seconds).toBe(50);
    // Percent is the share of *counted* zone time, so all of it is Z2 here.
    expect(intensity.zones[1].percent).toBe(100);
    // Regression: Z5 used to absorb every below-Z1 second (it was 50 here).
    expect(intensity.zones[4].seconds).toBe(0);
    expect(intensity.countedSeconds).toBe(50);
    expect(intensity.belowZoneSeconds).toBe(50);
    expect(intensity.easyShare).toBe(1);
    expect(intensity.hardShare).toBe(0);
    expect(intensity.sessionTypes).toEqual({ easy: 1, moderate: 0, hard: 0 });
  });
});
