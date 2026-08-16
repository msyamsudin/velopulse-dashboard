import { describe, expect, it } from 'vitest';
import { calculateSessionCalories } from './useWorkoutStore';

describe('Workout Store calorie calculation', () => {
  it('adds power-based calories when power is available', () => {
    const result = calculateSessionCalories(
      { power: 200, calories: 1 },
      0,
      10,
      1
    );

    expect(result).toBe(10);
  });

  it('falls back to sensor session calories when power is unavailable', () => {
    const result = calculateSessionCalories(
      { power: 0, calories: 25 },
      10,
      12,
      1
    );

    expect(result).toBe(15);
  });

  it('keeps calories monotonic when sensor fallback is lower than previous calories', () => {
    const result = calculateSessionCalories(
      { power: 0, calories: 12 },
      10,
      15,
      1
    );

    expect(result).toBe(15);
  });
});
