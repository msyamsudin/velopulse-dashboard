import { describe, expect, it } from 'vitest';
import { generateTCX } from './export-service';
import { parseTCXWorkoutSessions } from './tcx-import-service';

describe('parseTCXWorkoutSessions', () => {
  it('imports a VeloPulse TCX export as a workout session', () => {
    const sessionStartTime = Date.parse('2026-01-02T03:04:05.000Z');
    const tcx = generateTCX({
      id: 'session_test',
      sessionStartTime,
      date: new Date(sessionStartTime).toISOString(),
      duration: 3,
      stats: {
        avgHr: 121,
        maxHr: 125,
        avgPower: 151,
        maxPower: 180,
        avgCadence: 81,
        maxCadence: 90,
      },
      synced_to_google: false,
      history: [
        { time: '10:00:00', hr: 120, cadence: 80, power: 150, speed: 21.6, distance: 0, resistance: 0, calories: 1 },
        { time: '10:00:01', hr: 122, cadence: 82, power: 160, speed: 25.2, distance: 7, resistance: 0, calories: 2 },
        { time: '10:00:02', hr: 125, cadence: 90, power: 180, speed: 28.8, distance: 15, resistance: 0, calories: 3 },
      ],
    });

    const sessions = parseTCXWorkoutSessions(tcx);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionStartTime).toBe(sessionStartTime);
    expect(sessions[0].duration).toBe(3);
    expect(sessions[0].history).toHaveLength(3);
    expect(sessions[0].history[1]).toMatchObject({
      hr: 122,
      cadence: 82,
      power: 160,
      speed: 25.2,
      distance: 7,
    });
    expect(sessions[0].stats).toMatchObject({
      avgHr: 122,
      maxHr: 125,
      avgPower: 163,
      maxPower: 180,
      avgCadence: 84,
      maxCadence: 90,
    });
  });
});
