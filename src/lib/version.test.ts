import { describe, expect, it, vi } from 'vitest';
import {
  buildLogTag,
  buildProvenance,
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

describe('buildProvenance', () => {
  it('names the app, the build and the date', () => {
    expect(buildProvenance('0.1.0', SHA, '2026-09-11T00:00:00.000Z')).toBe(
      'VeloPulse 0.1.0+a1b2c3d (2026-09-11)'
    );
  });

  it('drops the date when the build had none', () => {
    expect(buildProvenance('0.1.0', SHA, '')).toBe('VeloPulse 0.1.0+a1b2c3d');
  });

  it('still identifies the version when git metadata was unavailable', () => {
    expect(buildProvenance('0.1.0', UNKNOWN, '')).toBe('VeloPulse 0.1.0');
  });
});

describe('buildLogTag', () => {
  it('wraps the build id for a log line', () => {
    expect(buildLogTag('0.1.0', SHA)).toBe('[build 0.1.0+a1b2c3d]');
  });

  it('falls back to the bare version without a SHA', () => {
    expect(buildLogTag('0.1.0', UNKNOWN)).toBe('[build 0.1.0]');
  });
});

describe('build identity wiring', () => {
  // Closes the loop on next.config.mjs: if the injected variable names ever
  // drift from the ones read here, every export and log line would silently
  // fall back to "0.0.0-dev", which is exactly the kind of failure that looks
  // like nothing is wrong.
  it('picks up the values the build injects', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '0.1.0');
    vi.stubEnv('NEXT_PUBLIC_COMMIT_SHA', SHA);
    vi.stubEnv('NEXT_PUBLIC_BUILD_DATE', '2026-09-11T14:18:00.000Z');
    vi.resetModules();

    try {
      const fresh = await import('./version');

      expect(fresh.APP_VERSION).toBe('0.1.0');
      expect(fresh.formatBuildId()).toBe('0.1.0+a1b2c3d');
      expect(fresh.buildProvenance()).toBe('VeloPulse 0.1.0+a1b2c3d (2026-09-11)');
      expect(fresh.buildLogTag()).toBe('[build 0.1.0+a1b2c3d]');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
