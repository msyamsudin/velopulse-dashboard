import { describe, it, expect } from 'vitest';
import { calcCaloriesFromPower } from './physics';

describe('Physics Utils', () => {
  it('calculates calories from power correctly (200W for 1 hour)', () => {
    // Expected: (200 * 3600) / (4184 * 0.24) ≈ 717.02
    const result = calcCaloriesFromPower(200, 3600);
    expect(Math.round(result)).toBe(717);
  });

  it('returns 0 for zero power', () => {
    expect(calcCaloriesFromPower(0, 3600)).toBe(0);
  });

  it('returns 0 for zero duration', () => {
    expect(calcCaloriesFromPower(200, 0)).toBe(0);
  });

  it('handles small power values', () => {
    // (50 * 60) / (4184 * 0.24) ≈ 2.98
    const result = calcCaloriesFromPower(50, 60);
    expect(result).toBeGreaterThan(2.9);
    expect(result).toBeLessThan(3.1);
  });
});
