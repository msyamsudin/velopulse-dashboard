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
