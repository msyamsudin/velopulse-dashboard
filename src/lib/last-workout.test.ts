import { describe, expect, it } from 'vitest';
import { daysSinceLastWorkout } from './last-workout';

const session = (date: Date) => ({ date: date.toISOString() });

describe('daysSinceLastWorkout', () => {
  it('returns null while no session has a valid date', () => {
    expect(daysSinceLastWorkout([], new Date(2026, 10, 5, 12))).toBeNull();
    expect(daysSinceLastWorkout([{ date: 'not-a-date' }], new Date(2026, 10, 5, 12))).toBeNull();
  });

  it('counts zero for a session recorded on the same local day', () => {
    const now = new Date(2026, 10, 5, 18, 0);
    const last = new Date(2026, 10, 5, 6, 30);

    expect(daysSinceLastWorkout([session(last)], now)).toBe(0);
  });

  it('counts calendar days instead of full 24-hour periods', () => {
    const now = new Date(2026, 10, 5, 0, 5);
    const last = new Date(2026, 10, 4, 23, 55);

    expect(daysSinceLastWorkout([session(last)], now)).toBe(1);
  });

  it('uses the newest session regardless of the array order', () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const sessions = [
      session(new Date(2026, 9, 20, 9, 0)),
      session(new Date(2026, 10, 2, 7, 0)),
      session(new Date(2026, 10, 4, 19, 0)),
    ];

    expect(daysSinceLastWorkout(sessions, now)).toBe(1);
  });

  it('counts older sessions when the newest entry is malformed', () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const sessions = [
      { date: '' },
      session(new Date(2026, 10, 2, 7, 0)),
    ];

    expect(daysSinceLastWorkout(sessions, now)).toBe(3);
  });

  it('clamps a future-dated session to zero', () => {
    const now = new Date(2026, 10, 5, 12, 0);
    const last = new Date(2026, 10, 6, 7, 0);

    expect(daysSinceLastWorkout([session(last)], now)).toBe(0);
  });
});
