import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  calculateMaxHr,
  hasProfileErrors,
  normalizeProfile,
  profileErrorFields,
  validateProfile,
  type UserProfile,
} from './profile';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  ...DEFAULT_PROFILE,
  age: 40,
  maxHr: 178,
  ftp: 220,
  weight: 74,
  restingHr: 52,
  ...overrides,
});

describe('calculateMaxHr', () => {
  it('uses the Robergs and Landwehr formula', () => {
    expect(calculateMaxHr(40)).toBe(178);
    expect(calculateMaxHr(25)).toBe(189);
  });

  it('falls back to the default for an unset age', () => {
    expect(calculateMaxHr(0)).toBe(DEFAULT_PROFILE.maxHr);
    expect(calculateMaxHr(-5)).toBe(DEFAULT_PROFILE.maxHr);
  });
});

describe('normalizeProfile', () => {
  it('accepts the snake_case shape returned by Supabase', () => {
    const normalized = normalizeProfile({
      age: 41,
      max_hr: 177,
      ftp: 240,
      weight: 72.5,
      resting_hr: 48,
    });

    expect(normalized).toEqual({ age: 41, maxHr: 177, ftp: 240, weight: 72.5, restingHr: 48 });
  });

  it('fills absent fields from the fallback instead of leaving undefined', () => {
    expect(normalizeProfile({ age: 30 })).toEqual({ ...DEFAULT_PROFILE, age: 30 });
    expect(normalizeProfile({}, profile())).toEqual(profile());
  });

  it('keeps unreadable values as NaN so validation can reject them', () => {
    const normalized = normalizeProfile({ age: 'forty', weight: true });

    expect(Number.isNaN(normalized.age)).toBe(true);
    expect(Number.isNaN(normalized.weight)).toBe(true);
    expect(normalizeProfile({ age: '39' }).age).toBe(39);
  });
});

describe('validateProfile', () => {
  it('accepts a complete, plausible profile', () => {
    expect(profileErrorFields(validateProfile(profile()))).toEqual([]);
  });

  it('requires an adult age inside the supported range', () => {
    expect(validateProfile(profile({ age: 0 })).age).toBe(true);
    expect(validateProfile(profile({ age: 9 })).age).toBe(true);
    expect(validateProfile(profile({ age: 101 })).age).toBe(true);
    expect(validateProfile(profile({ age: 39.5 })).age).toBe(true);
    expect(validateProfile(profile({ age: Number.NaN })).age).toBe(true);
  });

  it('treats FTP and weight as optional but bounded', () => {
    expect(hasProfileErrors(validateProfile(profile({ ftp: 0, weight: 0 })))).toBe(false);
    expect(validateProfile(profile({ ftp: -1 })).ftp).toBe(true);
    expect(validateProfile(profile({ ftp: 2001 })).ftp).toBe(true);
    expect(validateProfile(profile({ weight: 19 })).weight).toBe(true);
    expect(validateProfile(profile({ weight: 301 })).weight).toBe(true);
    expect(validateProfile(profile({ weight: Number.NaN })).weight).toBe(true);
  });

  it('allows one decimal of weight and rejects more', () => {
    expect(validateProfile(profile({ weight: 72.5 })).weight).toBeUndefined();
    expect(validateProfile(profile({ weight: 72.55 })).weight).toBe(true);
  });

  it('keeps resting HR optional, plausible and below max HR', () => {
    expect(validateProfile(profile({ restingHr: 0 })).restingHr).toBeUndefined();
    expect(validateProfile(profile({ restingHr: 24 })).restingHr).toBe(true);
    expect(validateProfile(profile({ restingHr: 121 })).restingHr).toBe(true);
    expect(validateProfile(profile({ maxHr: 100, restingHr: 120 })).restingHr).toBe(true);
    expect(validateProfile(profile({ restingHr: 52.5 })).restingHr).toBe(true);
  });

  it('reports every invalid field at once', () => {
    const fields = profileErrorFields(validateProfile({
      age: 0,
      maxHr: 0,
      ftp: -2,
      weight: -1,
      restingHr: 200,
    }));

    expect(fields.sort()).toEqual(['age', 'ftp', 'maxHr', 'restingHr', 'weight']);
  });
});
