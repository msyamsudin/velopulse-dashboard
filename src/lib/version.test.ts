import { describe, expect, it } from 'vitest';
import {
  formatBuildDate,
  formatBuildId,
  shortSha,
  UNKNOWN,
  versionLabel,
} from './version';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

describe('shortSha', () => {
  it('truncates to seven characters by default', () => {
    expect(shortSha(SHA)).toBe('a1b2c3d');
  });

  it('honours a custom length', () => {
    expect(shortSha(SHA, 10)).toBe('a1b2c3d4e5');
  });

  it('degrades to unknown instead of printing a bogus hash', () => {
    expect(shortSha('')).toBe(UNKNOWN);
    expect(shortSha(UNKNOWN)).toBe(UNKNOWN);
  });
});

describe('formatBuildId', () => {
  it('appends the short SHA as SemVer build metadata', () => {
    expect(formatBuildId('0.1.0', SHA)).toBe('0.1.0+a1b2c3d');
  });

  it('keeps the bare version when the SHA is unavailable', () => {
    expect(formatBuildId('0.1.0', UNKNOWN)).toBe('0.1.0');
  });
});

describe('formatBuildDate', () => {
  it('reduces an ISO instant to a date', () => {
    expect(formatBuildDate('2026-09-11T12:34:56.789Z')).toBe('2026-09-11');
  });

  it('returns an empty string when missing or malformed', () => {
    expect(formatBuildDate('')).toBe('');
    expect(formatBuildDate('not-a-date')).toBe('');
  });
});

describe('versionLabel', () => {
  it('joins version, SHA and date', () => {
    expect(versionLabel('0.1.0', SHA, '2026-09-11T00:00:00.000Z')).toBe(
      'v0.1.0 · a1b2c3d · 2026-09-11'
    );
  });

  it('omits the parts it does not have', () => {
    expect(versionLabel('0.1.0', UNKNOWN, '')).toBe('v0.1.0');
  });
});
