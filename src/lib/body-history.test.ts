import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendBodyEntry,
  BODY_HISTORY_MAX_ENTRIES,
  BODY_HISTORY_STORAGE_KEY,
  readBodyHistory,
  recordBodyEntry,
  resolveBodyMetric,
  summarizeBodyTrend,
  type BodyHistoryEntry,
} from './body-history';

describe('appendBodyEntry', () => {
  it('keeps the list sorted oldest-first', () => {
    const entries = appendBodyEntry(
      appendBodyEntry([], { date: '2026-05-02', weight: 74 }),
      { date: '2026-04-30', weight: 75 }
    );

    expect(entries.map(entry => entry.date)).toEqual(['2026-04-30', '2026-05-02']);
  });

  it('merges same-day saves instead of stacking points', () => {
    const entries = appendBodyEntry([{ date: '2026-05-02', weight: 74 }], { date: '2026-05-02', weight: 73.4 });

    expect(entries).toHaveLength(1);
    expect(entries[0].weight).toBe(73.4);
  });

  it('keeps a metric recorded earlier the same day when only the other is saved', () => {
    const entries = appendBodyEntry(
      [{ date: '2026-05-02', weight: 74, restingHr: 52 }],
      { date: '2026-05-02', weight: 73.8 }
    );

    expect(entries[0]).toEqual({ date: '2026-05-02', weight: 73.8, restingHr: 52 });
  });

  it('ignores entries with no usable value or an invalid date', () => {
    const base: BodyHistoryEntry[] = [{ date: '2026-05-02', weight: 74 }];

    expect(appendBodyEntry(base, { date: '2026-05-03', weight: 0 })).toEqual(base);
    expect(appendBodyEntry(base, { date: '2026-05-03', restingHr: -4 })).toEqual(base);
    expect(appendBodyEntry(base, { date: 'yesterday', weight: 73 })).toEqual(base);
    expect(appendBodyEntry(base, { date: '2026-05-03', weight: Number.NaN })).toEqual(base);
  });

  it('caps the history, dropping the oldest entries', () => {
    const dayKey = (offset: number) => new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
    const total = BODY_HISTORY_MAX_ENTRIES + 5;

    let entries: BodyHistoryEntry[] = [];
    for (let day = 0; day < total; day++) {
      entries = appendBodyEntry(entries, { date: dayKey(day), weight: 70 });
    }

    expect(entries).toHaveLength(BODY_HISTORY_MAX_ENTRIES);
    // The five oldest days were dropped; the newest survive.
    expect(entries[0].date).toBe(dayKey(5));
    expect(entries[entries.length - 1].date).toBe(dayKey(total - 1));
  });
});

describe('resolveBodyMetric', () => {
  const entries: BodyHistoryEntry[] = [
    { date: '2026-05-01', weight: 80, restingHr: 55 },
    { date: '2026-07-01', weight: 77, restingHr: 52 },
    { date: '2026-09-01', weight: 74 },
  ];

  it('uses the latest entry at or before the date', () => {
    expect(resolveBodyMetric(entries, '2026-06-15T08:00:00.000Z', 'weight')).toBe(80);
    expect(resolveBodyMetric(entries, '2026-07-01T08:00:00.000Z', 'weight')).toBe(77);
    expect(resolveBodyMetric(entries, '2026-10-01T08:00:00.000Z', 'weight')).toBe(74);
  });

  it('carries the last known value forward when a later entry omits the metric', () => {
    expect(resolveBodyMetric(entries, '2026-09-15T08:00:00.000Z', 'restingHr')).toBe(52);
  });

  it('falls back to the earliest entry for a date before the history', () => {
    expect(resolveBodyMetric(entries, '2026-01-01T08:00:00.000Z', 'weight')).toBe(80);
  });

  it('returns null when the metric was never recorded', () => {
    expect(resolveBodyMetric(entries, '2026-09-15T08:00:00.000Z', 'restingHr')).toBe(52);
    expect(resolveBodyMetric([{ date: '2026-09-01', weight: 74 }], '2026-09-15T08:00:00.000Z', 'restingHr')).toBeNull();
    expect(resolveBodyMetric([], '2026-09-15T08:00:00.000Z', 'weight')).toBeNull();
  });
});

describe('summarizeBodyTrend', () => {
  it('reports first, last and delta per metric', () => {
    const trend = summarizeBodyTrend([
      { date: '2026-05-01', weight: 80, restingHr: 55 },
      { date: '2026-07-01', weight: 77, restingHr: 52 },
      { date: '2026-09-01', weight: 74, restingHr: 49 },
    ]);

    expect(trend.weight).toEqual({
      first: { date: '2026-05-01', value: 80 },
      last: { date: '2026-09-01', value: 74 },
      delta: -6,
      count: 3,
    });
    expect(trend.restingHr?.delta).toBe(-6);
  });

  it('describes a single entry as a flat trend and missing metrics as null', () => {
    const trend = summarizeBodyTrend([{ date: '2026-05-01', weight: 80 }]);

    expect(trend.weight?.delta).toBe(0);
    expect(trend.weight?.count).toBe(1);
    expect(trend.restingHr).toBeNull();
    expect(summarizeBodyTrend([])).toEqual({ weight: null, restingHr: null });
  });
});

describe('local storage round trip', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and reads back entries, appending to what is stored', () => {
    recordBodyEntry({ date: '2026-05-01', weight: 80, restingHr: 55 });
    const afterSecondSave = recordBodyEntry({ date: '2026-06-01', weight: 78 });

    expect(afterSecondSave).toHaveLength(2);
    expect(readBodyHistory()).toHaveLength(2);
    // The second save only carried a weight: the resting HR entry is intact.
    expect(readBodyHistory()[0]).toEqual({ date: '2026-05-01', weight: 80, restingHr: 55 });
  });

  it('ignores a corrupt stored payload instead of throwing', () => {
    window.localStorage.setItem(BODY_HISTORY_STORAGE_KEY, '{not json');
    expect(readBodyHistory()).toEqual([]);

    window.localStorage.setItem(BODY_HISTORY_STORAGE_KEY, JSON.stringify([{ date: 'nope' }, { date: '2026-05-01', weight: 80 }]));
    expect(readBodyHistory()).toEqual([{ date: '2026-05-01', weight: 80 }]);
  });
});
