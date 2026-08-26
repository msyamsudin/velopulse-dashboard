import { describe, expect, it } from 'vitest';
import { groupSessionsByDay, resolveSessionMetric, type SessionChartPoint } from './SessionCharts';

const makePoint = (overrides: Partial<SessionChartPoint> & { ts: number }): SessionChartPoint => ({
  id: 's1',
  fullLabel: 'Feb 14, 10:30 AM',
  timeLabel: '10:30 AM',
  distanceKm: 12.34,
  calories: 560,
  duration: 2700,
  trimp: 45.5,
  avgHr: 142,
  avgPower: 176,
  quality: 'Tempo',
  fill: '#fde047',
  ...overrides,
});

describe('resolveSessionMetric', () => {
  it('maps every metric key to the correct session value', () => {
    const point = makePoint({ ts: 1_700_000_000_000 });
    expect(resolveSessionMetric(point, 'distance')).toBe(12.34);
    expect(resolveSessionMetric(point, 'calories')).toBe(560);
    expect(resolveSessionMetric(point, 'duration')).toBe(2700);
    expect(resolveSessionMetric(point, 'trimp')).toBe(45.5);
    expect(resolveSessionMetric(point, 'avgHr')).toBe(142);
    expect(resolveSessionMetric(point, 'avgPower')).toBe(176);
  });

  it('returns the value of each session, not a shared total', () => {
    const first = makePoint({ id: 'a', ts: 1_700_000_000_000, distanceKm: 5 });
    const second = makePoint({ id: 'b', ts: 1_700_000_000_000, distanceKm: 15 });
    expect(resolveSessionMetric(first, 'distance')).toBe(5);
    expect(resolveSessionMetric(second, 'distance')).toBe(15);
  });
});

describe('groupSessionsByDay', () => {
  const morning = makePoint({ id: 'm', ts: new Date(2025, 1, 14, 7, 30).getTime() });
  const evening = makePoint({ id: 'e', ts: new Date(2025, 1, 14, 18, 0).getTime() });
  const nextDay = makePoint({ id: 'n', ts: new Date(2025, 1, 15, 9, 0).getTime() });

  it('groups multiple sessions of the same local day into one day', () => {
    const days = groupSessionsByDay([evening, morning], false);
    expect(days).toHaveLength(1);
    expect(days[0].sessions.map(s => s.id).sort()).toEqual(['e', 'm']);
  });

  it('keeps sessions sorted by time of day within a day', () => {
    const days = groupSessionsByDay([evening, morning], false);
    expect(days[0].sessions.map(s => s.id)).toEqual(['m', 'e']);
  });

  it('separates distinct days and orders them chronologically', () => {
    const days = groupSessionsByDay([nextDay, morning], false);
    expect(days.map(d => d.key)).toEqual(['2025-02-14', '2025-02-15']);
    expect(days[0].sessions.map(s => s.id)).toEqual(['m']);
    expect(days[1].sessions.map(s => s.id)).toEqual(['n']);
  });

  it('anchors the day bar at local midnight', () => {
    const days = groupSessionsByDay([morning], false);
    expect(days[0].ts).toBe(new Date(2025, 1, 14).getTime());
  });
});
