import { describe, expect, it } from 'vitest';
import { getPersonalRecords, getSessionTypeBucket, SESSION_TYPE_BUCKETS, SESSION_TYPE_LABELS } from './workout-analysis';
import type { WorkoutSession } from '@/store/useWorkoutStore';

const makeSession = (
  id: string,
  startIso: string,
  durationSeconds: number,
  finalDistanceMeters: number,
  maxPointSpeed: number,
  maxSpeedStat: number
): WorkoutSession => ({
  id,
  sessionStartTime: Date.parse(startIso),
  date: startIso,
  duration: durationSeconds,
  stats: {
    avgHr: 120,
    maxHr: 160,
    avgPower: 60,
    maxPower: 200,
    avgCadence: 70,
    maxCadence: 120,
    maxSpeed: maxSpeedStat,
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
      speed: maxPointSpeed,
      distance: finalDistanceMeters,
      resistance: 10,
      calories: 50,
    },
  ],
});

describe('getPersonalRecords — Fastest Avg Speed', () => {
  it('ignores a broken short session whose counter injected an impossible distance', () => {
    // Mirrors the real 2026-04-19 session from the user's export:
    // 10.04 km recorded over only 262 s → 138 km/h while the trainer never
    // exceeded ~32 km/h. Such a session must not set the average-speed record.
    const corrupt = makeSession(
      'corrupt_138',
      '2026-04-19T07:17:22.350Z',
      262,
      10040,
      30,
      32
    );
    // A normal, slower session must win instead.
    const normal = makeSession(
      'normal_29_5',
      '2026-04-16T07:15:26.972Z',
      680,
      5570,
      35,
      40
    );

    const records = getPersonalRecords([corrupt, normal], 'en-US');
    const fastest = records.find(record => record.title === 'Fastest Avg Speed');

    expect(fastest).toBeDefined();
    expect(fastest?.value).toBe('29.5');
    expect(fastest?.sessionId).toBe('normal_29_5');
  });

  it('omits distance-derived records when every session is implausible or too short', () => {
    const shortBlip = makeSession('blip', '2026-05-01T08:00:00.000Z', 120, 3000, 90, 92);

    const records = getPersonalRecords([shortBlip], 'en-US');

    // A 2-minute blip cannot set any distance-derived record: no Fastest Avg
    // Speed, and no Best Distance either.
    expect(records.find(record => record.title === 'Fastest Avg Speed')).toBeUndefined();
    expect(records.find(record => record.title === 'Best Distance')).toBeUndefined();
    // Power metrics are not distance-dependent, so they still surface.
    expect(records.find(record => record.title === 'Peak Power')).toBeDefined();
    expect(records.find(record => record.title === 'Best Avg Power')).toBeDefined();
  });

  it('keeps distance-derived records honest when a session carries an inflated distance', () => {
    // Distance-counter offset: a real ~6 km in 15 minutes was recorded as
    // 18 km (average would be an impossible 72 km/h vs a 42 km/h max).
    const inflated = makeSession('inflated', '2026-05-03T08:00:00.000Z', 900, 18000, 40, 42);
    const normalBest = makeSession('normal', '2026-05-04T08:00:00.000Z', 3600, 25000, 45, 50);

    const records = getPersonalRecords([inflated, normalBest], 'en-US');

    for (const title of ['Longest Ride', 'Best Distance', 'Top Calories', 'Fastest Avg Speed']) {
      expect(records.find(record => record.title === title)?.sessionId).not.toBe('inflated');
    }
    const best = records.find(record => record.title === 'Best Distance');
    expect(best?.sessionId).toBe('normal');
  });

  it('carries the exact duration seconds on the Longest Ride record', () => {
    const session = makeSession('long', '2026-05-05T08:00:00.000Z', 3725, 26000, 45, 50);

    const records = getPersonalRecords([session], 'en-US');
    const longest = records.find(record => record.title === 'Longest Ride');

    // Display value stays in rounded minutes; the exact seconds ride along.
    expect(longest?.value).toBe('62');
    expect(longest?.seconds).toBe(3725);
  });

  it('keeps the true best average from plausible sessions', () => {
    const a = makeSession('a', '2026-06-01T08:00:00.000Z', 2000, 15000, 40, 42);
    const b = makeSession('b', '2026-06-02T08:00:00.000Z', 900, 9000, 50, 52);

    const records = getPersonalRecords([a, b], 'en-US');
    const fastest = records.find(record => record.title === 'Fastest Avg Speed');

    // a = 27.0 km/h, b = 36.0 km/h → b is the legitimate record.
    expect(fastest?.value).toBe('36.0');
    expect(fastest?.sessionId).toBe('b');
  });
});

describe('getSessionTypeBucket', () => {
  it('folds the five quality labels into three buckets', () => {
    expect(getSessionTypeBucket('Easy')).toBe('easy');
    expect(getSessionTypeBucket('Endurance')).toBe('easy');
    expect(getSessionTypeBucket('Tempo')).toBe('moderate');
    expect(getSessionTypeBucket('Hard')).toBe('hard');
    expect(getSessionTypeBucket('Peak')).toBe('hard');
  });

  it('treats an unknown label as hard rather than dropping the session', () => {
    expect(getSessionTypeBucket('')).toBe('hard');
    expect(getSessionTypeBucket('something-new')).toBe('hard');
  });

  it('keeps the display order and labels in step with the bucket list', () => {
    expect(SESSION_TYPE_BUCKETS).toEqual(['easy', 'moderate', 'hard']);
    expect(SESSION_TYPE_BUCKETS.map(bucket => SESSION_TYPE_LABELS[bucket])).toEqual(['Easy', 'Tempo', 'Hard']);
  });
});
