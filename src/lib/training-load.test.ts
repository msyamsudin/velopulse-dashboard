import { describe, expect, it } from 'vitest';
import { calculateEdwardsTrimp, calculateLoadTrend, calculateTrainingLoadMetrics, getTrainingLoadLabel, MIN_TREND_TRAINING_DAYS } from './training-load';

describe('calculateEdwardsTrimp', () => {
  it('weights time in each heart-rate zone', () => {
    const history = [
      ...Array.from({ length: 30 }, () => ({ hr: 140 })), // 70% of 200: Z3
      ...Array.from({ length: 30 }, () => ({ hr: 180 })), // 90% of 200: Z5
    ];

    const result = calculateEdwardsTrimp(history, 60 * 60, 200);

    expect(result.score).toBe(240);
    expect(result.activeMinutes).toBe(60);
    expect(result.label).toBe('Very High');
  });

  it('ignores missing values and heart rate below 50% of max', () => {
    const result = calculateEdwardsTrimp([{ hr: 0 }, { hr: 90 }, {}], 180, 200);

    expect(result).toEqual({ score: 0, label: 'Recovery', activeMinutes: 0 });
  });

  it('returns zero when session data is unavailable', () => {
    expect(calculateEdwardsTrimp([], 3600, 190).score).toBe(0);
    expect(calculateEdwardsTrimp([{ hr: 150 }], 0, 190).score).toBe(0);
  });
});

describe('getTrainingLoadLabel', () => {
  it('classifies session load consistently', () => {
    expect(getTrainingLoadLabel(49.9)).toBe('Recovery');
    expect(getTrainingLoadLabel(50)).toBe('Moderate');
    expect(getTrainingLoadLabel(100)).toBe('High');
    expect(getTrainingLoadLabel(150)).toBe('Very High');
  });
});

describe('calculateTrainingLoadMetrics', () => {
  it('normalizes chronic load to the 3-week baseline before the acute week', () => {
    const result = calculateTrainingLoadMetrics(Array.from({ length: 28 }, (_, index) => index % 2 === 0 ? 10 : 0));

    expect(result.acuteLoad).toBe(30);
    expect(result.chronicLoad).toBe(36.7);
    expect(result.acuteChronicRatio).toBe(0.82);
    expect(result.monotony).toBeGreaterThan(0);
    expect(result.strain).toBeGreaterThan(0);
    expect(result.recommendation).toBe('Maintain');
  });

  it('keeps the acute week out of the chronic baseline', () => {
    const result = calculateTrainingLoadMetrics([
      ...Array(21).fill(10),
      ...Array(7).fill(30),
    ]);

    expect(result.acuteLoad).toBe(210);
    expect(result.chronicLoad).toBe(70); // 21 days × 10 / 3 weeks, no double-counting
    expect(result.acuteChronicRatio).toBe(3);
  });

  it('recommends recovery after a sharp load increase', () => {
    const result = calculateTrainingLoadMetrics([
      ...Array(21).fill(5),
      ...Array(7).fill(30),
    ]);

    expect(result.acuteChronicRatio).toBeGreaterThan(1.5);
    expect(result.recommendation).toBe('Recovery');
  });

  it('uses conservative build guidance with insufficient history', () => {
    const result = calculateTrainingLoadMetrics([0, 0, 20]);

    expect(result.trainingDays).toBe(1);
    expect(result.recommendation).toBe('Build');
  });
});

describe('calculateLoadTrend', () => {
  it('stays level for a perfectly steady load instead of drifting to fatigued', () => {
    const trend = calculateLoadTrend(Array(90).fill(100));

    expect(trend.ctl).toBe(100);
    expect(trend.atl).toBe(100);
    expect(trend.tsb).toBe(0);
    expect(trend.days).toBe(90);
    expect(trend.established).toBe(true);
  });

  it('pushes fatigue above fitness after a load spike', () => {
    const trend = calculateLoadTrend([...Array(60).fill(50), ...Array(7).fill(300)]);

    expect(trend.atl).toBeGreaterThan(trend.ctl);
    expect(trend.tsb).toBeLessThan(0);
  });

  it('marks the model unestablished until enough training days exist', () => {
    const trend = calculateLoadTrend([100, 100, 0, 0, 0, 0, 0]);

    expect(trend.trainingDays).toBe(2);
    expect(trend.established).toBe(false);
    expect(trend.trainingDays).toBeLessThan(MIN_TREND_TRAINING_DAYS);
  });

  it('returns an empty series for no history', () => {
    const trend = calculateLoadTrend([]);

    expect(trend).toMatchObject({ ctl: 0, atl: 0, tsb: 0, days: 0, established: false });
    expect(trend.ctlSeries).toEqual([]);
    expect(trend.atlSeries).toEqual([]);
  });
});
