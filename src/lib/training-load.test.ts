import { describe, expect, it } from 'vitest';
import { calculateEdwardsTrimp, calculateTrainingLoadMetrics, getTrainingLoadLabel } from './training-load';

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
  it('normalizes chronic load to a weekly 28-day baseline', () => {
    const result = calculateTrainingLoadMetrics(Array.from({ length: 28 }, (_, index) => index % 2 === 0 ? 10 : 0));

    expect(result.acuteLoad).toBe(30);
    expect(result.chronicLoad).toBe(35);
    expect(result.acuteChronicRatio).toBe(0.86);
    expect(result.monotony).toBeGreaterThan(0);
    expect(result.strain).toBeGreaterThan(0);
    expect(result.recommendation).toBe('Maintain');
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
