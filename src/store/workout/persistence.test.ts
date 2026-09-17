import { describe, expect, it } from 'vitest';
import { buildActiveSessionStorageSnapshot } from './persistence';
import type { ActiveSessionSnapshot } from './types';

const POINT = {
  time: '21:30:43',
  ts: 1_789_655_443_815,
  hr: 99,
  cadence: 84,
  power: 40,
  speed: 18.5,
  distance: 0,
  resistance: 6,
  calories: 0.04,
};

const baseSnapshot: ActiveSessionSnapshot = {
  isRecording: true,
  elapsed: 30,
  sessionStartTime: 1_789_655_443_802,
  startDistance: 0,
  startCalories: 0,
  calorieAccumulator: 1.33,
  hasPowerSource: true,
  lastHistoryPointTs: 1_789_655_475_723,
  history: [POINT],
};

describe('buildActiveSessionStorageSnapshot', () => {
  it('persists the demo origin so a restored session is not treated as a real one', () => {
    const snapshot = buildActiveSessionStorageSnapshot({ ...baseSnapshot, simulated: true });

    expect(snapshot.simulated).toBe(true);
    // JSON round-trip: the flag must survive what is actually written.
    expect(JSON.parse(JSON.stringify(snapshot)).simulated).toBe(true);
  });

  it('reads the flag from full store state, which names it isSimulatedSession', () => {
    const snapshot = buildActiveSessionStorageSnapshot({
      ...baseSnapshot,
      isSimulatedSession: true,
    });

    expect(snapshot.simulated).toBe(true);
  });

  it('leaves a real session without the key instead of storing false', () => {
    const snapshot = buildActiveSessionStorageSnapshot(baseSnapshot);

    expect(snapshot.simulated).toBeUndefined();
    expect('simulated' in JSON.parse(JSON.stringify(snapshot))).toBe(false);
  });

  it('keeps sampling the history points like before', () => {
    const history = Array.from({ length: 10 }, (_, index) => ({ ...POINT, ts: index * 1000 }));
    const snapshot = buildActiveSessionStorageSnapshot({ ...baseSnapshot, history }, 4);

    expect(snapshot.history).toHaveLength(4);
    expect(snapshot.history[snapshot.history.length - 1].ts).toBe(9000);
  });
});
