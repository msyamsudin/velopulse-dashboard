import { describe, expect, it } from 'vitest';
import { getPersonalRecords } from './workout-analysis';
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

  it('omits the average-speed record when every session is implausible or too short', () => {
    const shortBlip = makeSession('blip', '2026-05-01T08:00:00.000Z', 120, 3000, 90, 92);

    const records = getPersonalRecords([shortBlip], 'en-US');
    const fastest = records.find(record => record.title === 'Fastest Avg Speed');

    expect(fastest).toBeUndefined();
    // Other record cards are unaffected.
    expect(records.some(record => record.title === 'Best Distance')).toBe(true);
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
