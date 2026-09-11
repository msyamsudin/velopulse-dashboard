import { describe, expect, it } from 'vitest';
import {
  compareSessionEffort,
  getSessionRpeLoad,
  RPE_MIN_RATED_SESSIONS,
  type RatedEffortSession,
} from './rpe';

const MAX_HR = 200;

/** Constant-HR ride: Edwards weight is decided by hr / maxHr. */
const ride = (
  id: string,
  rpe: number | undefined,
  hr: number,
  durationSeconds = 3600
): RatedEffortSession => ({
  id,
  duration: durationSeconds,
  history: Array.from({ length: durationSeconds }, () => ({ hr })),
  stats: { rpe },
});

describe('getSessionRpeLoad', () => {
  it('multiplies RPE by the duration in minutes', () => {
    expect(getSessionRpeLoad(7, 1800)).toBe(210);
    expect(getSessionRpeLoad(5, 90)).toBe(8);
    expect(getSessionRpeLoad(10, 3600)).toBe(600);
  });

  it('returns null for an unrated or timeless session', () => {
    expect(getSessionRpeLoad(undefined, 1800)).toBeNull();
    expect(getSessionRpeLoad(null, 1800)).toBeNull();
    expect(getSessionRpeLoad(0, 1800)).toBeNull();
    expect(getSessionRpeLoad(-3, 1800)).toBeNull();
    expect(getSessionRpeLoad(Number.NaN, 1800)).toBeNull();
    expect(getSessionRpeLoad(7, 0)).toBeNull();
  });
});

describe('compareSessionEffort', () => {
  // Other rated rides, ascending in both perception and heart-rate load.
  const others = [
    ride('o1', 3, 130), // 180 AU / 120 TRIMP
    ride('o2', 5, 150), // 300 AU / 180 TRIMP
    ride('o3', 7, 170), // 420 AU / 240 TRIMP
  ];

  it('calls a ride aligned when its ranks match', () => {
    // 4 RPE → 240 AU (between o1 and o2) and 140 bpm → 180 TRIMP (ties o2).
    const comparison = compareSessionEffort(ride('target', 4, 140), others, MAX_HR);

    expect(comparison).not.toBeNull();
    expect(comparison?.rpePercentile).toBeCloseTo(1 / 3);
    expect(comparison?.trimpPercentile).toBeCloseTo(1 / 3);
    expect(comparison?.gap).toBe(0);
    expect(comparison?.agreement).toBe('aligned');
  });

  it('flags a ride that felt harder than the heart-rate load', () => {
    // Maximum perceived effort at the lowest recorded intensity.
    const comparison = compareSessionEffort(ride('target', 10, 110), others, MAX_HR);

    expect(comparison?.gap).toBe(100);
    expect(comparison?.agreement).toBe('perceived-harder');
  });

  it('flags a ride that felt easier than the heart-rate load', () => {
    const comparison = compareSessionEffort(ride('target', 1, 180), others, MAX_HR);

    expect(comparison?.gap).toBe(-100);
    expect(comparison?.agreement).toBe('perceived-easier');
  });

  it('needs a rated session with a heart-rate load to compare', () => {
    expect(compareSessionEffort(ride('target', undefined, 150), others, MAX_HR)).toBeNull();
    // No HR anywhere: nothing to compare the perception against.
    expect(compareSessionEffort(ride('target', 5, 0), others, MAX_HR)).toBeNull();
  });

  it('waits for enough other rated rides before ranking', () => {
    const target = ride('target', 5, 150);
    const short = others.slice(0, RPE_MIN_RATED_SESSIONS - 1);

    expect(compareSessionEffort(target, short, MAX_HR)).toBeNull();
    expect(compareSessionEffort(target, others, MAX_HR)).not.toBeNull();
  });

  it('excludes the session itself and unrated rides from the ranking pool', () => {
    const target = ride('target', 5, 150);
    // Its own values must not be counted twice, and unrated rides neither help
    // nor block the comparison.
    const pool = [...others, target, ride('unrated', undefined, 160)];

    const withSelf = compareSessionEffort(target, pool, MAX_HR);
    const withoutSelf = compareSessionEffort(target, others, MAX_HR);

    expect(withSelf).toEqual(withoutSelf);
  });
});
