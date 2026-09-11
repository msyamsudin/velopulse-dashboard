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

const renderHistoryHook = (
  sessions: WorkoutSession[],
  profile: { ftp?: number; weight?: number } = {}
) =>
  renderHook(() => useWorkoutHistoryData({
    sessions,
    maxHr: 200,
    ...profile,
    summaryPeriod: 'daily',
    summaryRange: '7d',
    weeklyMetric: 'distance',
  }), { wrapper: I18nProvider });

const renderStreakHook = (sessions: WorkoutSession[]) => renderHistoryHook(sessions);

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

describe('profile metric gates', () => {
  const powerPoint = (index: number, power: number) => ({
    time: `${index}`,
    ts: Date.parse(daysAgo(1)) + index * 1000,
    hr: 130,
    cadence: 80,
    power,
    speed: 20,
    distance: 0,
    resistance: 0,
    calories: 0,
  });

  // 100 W and 250 W against a 200 W FTP: every second of the ride lands in a
  // zone on purpose, so a missing distribution cannot hide behind "no data".
  const powerSession: WorkoutSession = {
    id: 'power-zones',
    sessionStartTime: Date.parse(daysAgo(1)),
    date: daysAgo(1),
    duration: 100,
    stats: { avgHr: 130, maxHr: 150, avgPower: 160, maxPower: 400, avgCadence: 80, maxCadence: 90 },
    history: [
      ...Array.from({ length: 5 }, (_, index) => powerPoint(index, 100)),
      ...Array.from({ length: 5 }, (_, index) => powerPoint(index + 5, 250)),
    ],
  };

  it('keeps the power zones empty while the FTP gate is closed', () => {
    const { result } = renderHistoryHook([powerSession]);

    expect(result.current.intensity.hasFtp).toBe(false);
    expect(result.current.intensity.powerZones).toEqual([]);
    expect(result.current.intensity.powerCountedSeconds).toBe(0);
  });

  it('builds the power-zone distribution from the rider FTP', () => {
    const { result } = renderHistoryHook([powerSession], { ftp: 200 });
    const { intensity } = result.current;

    expect(intensity.hasFtp).toBe(true);
    expect(intensity.powerZones).toHaveLength(7);
    // 100 W → Z1, 250 W → Z6, half of the 100 s duration each.
    expect(intensity.powerZones[0].seconds).toBe(50);
    expect(intensity.powerZones[5].seconds).toBe(50);
    expect(intensity.powerZones[5].range).toBe('240-300');
    expect(intensity.powerCountedSeconds).toBe(100);
    expect(intensity.powerBelowZoneSeconds).toBe(0);
  });

  it('reports no body metrics without a weight and full ones with it', () => {
    const withoutWeight = renderHistoryHook([powerSession]);
    expect(withoutWeight.result.current.advanced.hasWeight).toBe(false);
    expect(withoutWeight.result.current.advanced.bodyMetrics).toBeNull();

    const session: WorkoutSession = {
      ...powerSession,
      id: 'body-metrics',
      duration: 3600,
      history: [{ ...powerPoint(0, 160), calories: 720 }],
    };
    const { result } = renderHistoryHook([session], { weight: 80 });
    const { bodyMetrics, hasWeight } = result.current.advanced;

    expect(hasWeight).toBe(true);
    // 160 W / 80 kg, 400 W / 80 kg, 720 kcal in 1 h at 80 kg.
    expect(bodyMetrics?.avgWkg).toBe(2);
    expect(bodyMetrics?.peakWkg).toBe(5);
    expect(bodyMetrics?.kcalPerKgHour).toBe(9);
  });
});
