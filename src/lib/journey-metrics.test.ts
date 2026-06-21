import { describe, expect, it } from 'vitest';
import { getJourneyVisualState } from './journey-metrics';

describe('getJourneyVisualState', () => {
  it('uses a stable fallback pace when the bike is disconnected', () => {
    const state = getJourneyVisualState(
      { heartRate: 0, cadence: 100, power: 400, speed: 40, resistance: 0 },
      190,
      false
    );

    expect(state.velocity).toBe(2.4);
    expect(state.hasBikeSignal).toBe(false);
  });

  it('maps live effort, heart rate, and resistance into bounded visual values', () => {
    const state = getJourneyVisualState(
      { heartRate: 171, cadence: 90, power: 250, speed: 30, resistance: 140 },
      190,
      true
    );

    expect(state.velocity).toBeGreaterThan(3);
    expect(state.velocity).toBeLessThanOrEqual(22);
    expect(state.hrZone).toBe(4);
    expect(state.grade).toBe(1);
    expect(state.hasBikeSignal).toBe(true);
  });
});
