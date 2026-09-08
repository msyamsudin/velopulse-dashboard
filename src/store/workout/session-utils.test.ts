import { describe, expect, it } from 'vitest';
import { sanitizeLegacySessionDuration } from './session-utils';
import type { WorkoutSession } from './types';

const makeHistory = (pointCount: number, finalDistanceMeters: number, maxSpeed: number) => {
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    points.push({
      time: `00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
      ts: i * 1000,
      hr: 110,
      cadence: 70,
      power: 50,
      speed: i === pointCount - 1 ? maxSpeed : 20,
      distance: Math.round((finalDistanceMeters * i) / (pointCount - 1)),
      resistance: 10,
      calories: 10,
    });
  }
  return points;
};

const makeSession = (overrides: Partial<WorkoutSession>): WorkoutSession => ({
  id: 's1',
  sessionStartTime: Date.parse('2026-04-19T07:17:22.350Z'),
  date: '2026-04-19T07:17:22.350Z',
  duration: 60,
  stats: {
    avgHr: 107,
    maxHr: 126,
    avgPower: 41,
    maxPower: 85,
    avgCadence: 68,
    maxCadence: 105,
    maxSpeed: 35,
  },
  history: makeHistory(150, 2000, 35),
  ...overrides,
});

describe('sanitizeLegacySessionDuration', () => {
  it('repairs a legacy session whose stored duration froze far below the ride length', () => {
    // Mirrors the real 2026-04-19 session: ~2 km recorded over 150 points
    // (≈1 point/second ⇒ ~2:30 real) but stored with duration = 60 s, which
    // would imply an impossible 120 km/h average (max recorded speed 35).
    const session = makeSession({});

    const repaired = sanitizeLegacySessionDuration(session);

    expect(repaired.duration).toBe(149); // point-count derived (ts span = 149 s)
    expect(repaired.id).toBe('s1');
    expect(repaired.history).toBe(session.history);
  });

  it('leaves a consistent session untouched (same object)', () => {
    // 600 s stored, 600 points, 4 km ⇒ ~24 km/h average ≤ max 30 km/h.
    const session = makeSession({
      duration: 600,
      history: makeHistory(600, 4000, 30),
    });

    const result = sanitizeLegacySessionDuration(session);

    expect(result).toBe(session);
  });

  it('ignores sessions with no speed reference to compare against', () => {
    const session = makeSession({
      duration: 60,
      history: makeHistory(150, 2000, 0).map(point => ({ ...point, speed: 0 })),
      stats: {
        avgHr: 107,
        maxHr: 126,
        avgPower: 41,
        maxPower: 85,
        avgCadence: 68,
        maxCadence: 105,
      },
    });

    expect(sanitizeLegacySessionDuration(session)).toBe(session);
  });

  it('does not lengthen when the derived time is not clearly larger (below 2×)', () => {
    const session = makeSession({
      duration: 120,
      history: makeHistory(150, 2000, 35), // derived 149 s < 2 × 120 s
    });

    expect(sanitizeLegacySessionDuration(session)).toBe(session);
  });
});
