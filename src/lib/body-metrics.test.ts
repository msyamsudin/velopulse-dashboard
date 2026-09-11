import { describe, expect, it } from 'vitest';
import { computeBodyMetrics } from './body-metrics';

describe('computeBodyMetrics', () => {
  it('returns null without a usable body weight', () => {
    expect(computeBodyMetrics({ sessions: [], totalSeconds: 3600, totalCalories: 500, weightKg: 0 })).toBeNull();
    expect(computeBodyMetrics({ sessions: [], totalSeconds: 3600, totalCalories: 500, weightKg: -70 })).toBeNull();
    expect(computeBodyMetrics({ sessions: [], totalSeconds: 3600, totalCalories: 500, weightKg: Number.NaN })).toBeNull();
  });

  it('weights average power by session duration and divides by weight', () => {
    const metrics = computeBodyMetrics({
      sessions: [
        { avgPower: 100, maxPower: 300, duration: 3600 },
        { avgPower: 200, maxPower: 400, duration: 3600 },
      ],
      totalSeconds: 7200,
      totalCalories: 800,
      weightKg: 80,
    });

    expect(metrics).not.toBeNull();
    // (100 + 200) / 2 → 150 W → 150 / 80
    expect(metrics?.avgPower).toBe(150);
    expect(metrics?.avgWkg).toBe(1.88);
    expect(metrics?.peakPower).toBe(400);
    expect(metrics?.peakWkg).toBe(5);
    // 800 kcal over 2 h for an 80 kg rider
    expect(metrics?.kcalPerKgHour).toBe(5);
  });

  it('excludes pedal-less sessions from the power denominator', () => {
    const metrics = computeBodyMetrics({
      sessions: [
        { avgPower: 0, maxPower: 0, duration: 3600 },
        { avgPower: 100, maxPower: 250, duration: 600 },
      ],
      totalSeconds: 4200,
      totalCalories: 0,
      weightKg: 50,
    });

    // Averaging over 4200 s would have produced 14 W (0.29 W/kg) instead.
    expect(metrics?.avgPower).toBe(100);
    expect(metrics?.avgWkg).toBe(2);
    expect(metrics?.peakWkg).toBe(5);
    expect(metrics?.kcalPerKgHour).toBeNull();
  });

  it('keeps kcal/kg/h usable when the range has no power at all', () => {
    const metrics = computeBodyMetrics({
      sessions: [{ avgPower: 0, maxPower: 0, duration: 1800 }],
      totalSeconds: 1800,
      totalCalories: 300,
      weightKg: 75,
    });

    expect(metrics?.avgWkg).toBeNull();
    expect(metrics?.peakWkg).toBeNull();
    // 300 kcal in 0.5 h at 75 kg
    expect(metrics?.kcalPerKgHour).toBe(8);
  });

  it('returns null per metric when its own input is missing', () => {
    const noTime = computeBodyMetrics({
      sessions: [{ avgPower: 150, maxPower: 200, duration: 0 }],
      totalSeconds: 0,
      totalCalories: 400,
      weightKg: 70,
    });
    expect(noTime?.kcalPerKgHour).toBeNull();
    expect(noTime?.avgWkg).toBeNull();
    expect(noTime?.peakWkg).toBe(2.86);

    const noEnergy = computeBodyMetrics({ sessions: [], totalSeconds: 3600, totalCalories: 0, weightKg: 70 });
    expect(noEnergy?.kcalPerKgHour).toBeNull();
  });

  it('rounds W/kg to two decimals', () => {
    const metrics = computeBodyMetrics({
      sessions: [{ avgPower: 137, maxPower: 137, duration: 600 }],
      totalSeconds: 600,
      totalCalories: 100,
      weightKg: 70,
    });

    expect(metrics?.avgWkg).toBe(1.96);
  });
});
