import { beforeEach, describe, expect, it } from 'vitest';
import { useBluetoothStore } from './useBluetoothStore';
import { calculateSessionCalories, useWorkoutStore } from './useWorkoutStore';

describe('Workout Store calorie calculation', () => {
  it('accumulates fractional power calories without per-second rounding', () => {
    const oneSecond = calculateSessionCalories({ power: 200, calories: 1 }, 0, 0, true, 1);
    expect(oneSecond).toBeCloseTo(0.1992, 3);

    const afterMinute = calculateSessionCalories({ power: 200, calories: 1 }, 0, 0, true, 60);
    expect(afterMinute).toBeCloseTo(11.9503, 3);
  });

  it('integrates with the real delta seconds so gaps are not undercounted', () => {
    const gapIntegration = calculateSessionCalories({ power: 200, calories: 1 }, 0, 0, true, 3);
    const singleSecond = calculateSessionCalories({ power: 200, calories: 1 }, 0, 0, true, 1);
    expect(gapIntegration).toBeCloseTo(singleSecond * 3, 3);
  });

  it('falls back to sensor session calories only when the session has no power source', () => {
    const result = calculateSessionCalories({ power: 0, calories: 25 }, 10, 0, false, 1);
    expect(result).toBe(15);
  });

  it('keeps calories monotonic when the sensor fallback is lower than the accumulator', () => {
    const result = calculateSessionCalories({ power: 0, calories: 12 }, 10, 15, false, 1);
    expect(result).toBe(15);
  });

  it('ignores the sensor while the session is power-based even when power drops to 0', () => {
    const result = calculateSessionCalories({ power: 0, calories: 500 }, 10, 4, true, 1);
    expect(result).toBe(4);
  });
});

describe('saveSession with empty history', () => {
  beforeEach(() => {
    useWorkoutStore.setState({
      sessionStartTime: 123456,
      elapsed: 5,
      history: [],
      isRecording: false,
    });
  });

  it('discards the session instead of persisting NaN/-Infinity stats', async () => {
    await useWorkoutStore.getState().saveSession();

    const state = useWorkoutStore.getState();
    expect(state.sessionStartTime).toBeNull();
    expect(state.sessionHistory.length).toBe(0);
  });
});

describe('live stats staleness handling', () => {
  it('excludes watchdog-stale zeros from weighted averages', async () => {
    useWorkoutStore.setState({ isRecording: false });
    useWorkoutStore.getState().toggleRecording();

    // HR zeroed by the watchdog (no update for 5 s); power still fresh.
    useBluetoothStore.setState({
      lastUpdate: { heartRate: Date.now() - 5000, power: Date.now() },
      data: { heartRate: 0, power: 200 },
    });
    useWorkoutStore.getState().addHistoryPoint({ heartRate: 0, power: 200 });

    await new Promise(resolve => setTimeout(resolve, 1100));

    // Strap back online with a fresh sample.
    useBluetoothStore.setState({
      lastUpdate: { heartRate: Date.now(), power: Date.now() },
      data: { heartRate: 120, power: 200 },
    });
    useWorkoutStore.getState().addHistoryPoint({ heartRate: 120, power: 200 });

    const state = useWorkoutStore.getState();
    expect(state.liveStats.avgHr).toBe(120); // stale 0 did not dilute the average
    expect(state.liveStats.avgPower).toBe(200);
    expect(state.liveStatsTotals.hrTime).toBeGreaterThan(1); // only the valid HR second counted
    expect(state.liveStatsTotals.hrTime).toBeLessThan(2);

    useWorkoutStore.getState().discardSession();
  });

  it('hands calories back to the sensor when the power source goes stale mid-session', async () => {
    useWorkoutStore.setState({ isRecording: false });
    useWorkoutStore.getState().toggleRecording();

    // Power meter alive.
    useBluetoothStore.setState({
      lastUpdate: { heartRate: Date.now(), power: Date.now() },
      data: { heartRate: 120, power: 200 },
    });
    useWorkoutStore.getState().addHistoryPoint({ heartRate: 120, power: 200 });
    expect(useWorkoutStore.getState().hasPowerSource).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 1100));

    // Power meter dies: watchdog zeroes power, sensor calories keep rising.
    useBluetoothStore.setState({
      lastUpdate: { heartRate: Date.now(), power: Date.now() - 5000 },
      data: { heartRate: 125, power: 0, calories: 50 },
    });
    useWorkoutStore.getState().addHistoryPoint({ heartRate: 125, power: 0, calories: 50 });

    const state = useWorkoutStore.getState();
    expect(state.hasPowerSource).toBe(false);
    expect(state.calorieAccumulator).toBe(50); // sensor delta, not the frozen power value

    useWorkoutStore.getState().discardSession();
  });

  it('keeps a genuine coasting zero on the power source', async () => {
    useWorkoutStore.setState({ isRecording: false });
    useWorkoutStore.getState().toggleRecording();

    useBluetoothStore.setState({
      lastUpdate: { heartRate: Date.now(), power: Date.now() },
      data: { heartRate: 120, power: 200 },
    });
    useWorkoutStore.getState().addHistoryPoint({ heartRate: 120, power: 200 });
    expect(useWorkoutStore.getState().hasPowerSource).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 1100));

    // Coasting: sensor alive and reporting 0 W (fresh timestamp).
    useBluetoothStore.setState({
      lastUpdate: { heartRate: Date.now(), power: Date.now() },
      data: { heartRate: 120, power: 0 },
    });
    useWorkoutStore.getState().addHistoryPoint({ heartRate: 120, power: 0 });

    expect(useWorkoutStore.getState().hasPowerSource).toBe(true);

    useWorkoutStore.getState().discardSession();
  });
});

describe('incrementElapsed wall clock', () => {
  it('derives elapsed from sessionStartTime instead of drifting increments', () => {
    useWorkoutStore.setState({
      isRecording: true,
      sessionStartTime: Date.now() - 15000,
      elapsed: 0,
    });

    useWorkoutStore.getState().incrementElapsed();

    const elapsed = useWorkoutStore.getState().elapsed;
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThanOrEqual(16);

    useWorkoutStore.getState().discardSession();
  });

  it('never returns a negative elapsed after a backward clock correction', () => {
    useWorkoutStore.setState({
      isRecording: true,
      sessionStartTime: Date.now() + 5000,
      elapsed: 0,
    });

    useWorkoutStore.getState().incrementElapsed();

    expect(useWorkoutStore.getState().elapsed).toBe(0);

    useWorkoutStore.getState().discardSession();
  });
});

describe('active session recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('corrects the timer base and reintegrates calories for a stale legacy snapshot', () => {
    localStorage.setItem('velopulse_active_session', JSON.stringify({
      isRecording: true,
      elapsed: 3600,
      sessionStartTime: Date.now() - 10 * 3600 * 1000,
      startDistance: 0,
      startCalories: 0,
      history: [
        { time: '00:00:01', hr: 140, cadence: 80, power: 200, speed: 25, distance: 100, resistance: 0, calories: 0 },
        { time: '00:30:00', hr: 140, cadence: 80, power: 200, speed: 25, distance: 18000, resistance: 0, calories: 0 },
        { time: '01:00:00', hr: 140, cadence: 80, power: 200, speed: 25, distance: 36000, resistance: 0, calories: 0 },
      ],
    }));

    useWorkoutStore.getState().loadHistory();

    const state = useWorkoutStore.getState();
    // Timer base shifted forward: duration stays near the snapshot value,
    // not the 10 hours of dead time.
    const baseAgeSeconds = (Date.now() - state.sessionStartTime) / 1000;
    expect(baseAgeSeconds).toBeGreaterThan(3600);
    expect(baseAgeSeconds).toBeLessThan(3700);
    // Legacy points without ts: snapshot duration distributed across the
    // retained (downsampled) points → 3600 s × 200 W ≈ 717 kcal.
    expect(state.calorieAccumulator).toBeGreaterThan(600);
    expect(state.calorieAccumulator).toBeLessThan(800);

    useWorkoutStore.getState().discardSession();
  });
});
