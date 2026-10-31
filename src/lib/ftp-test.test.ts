import { describe, expect, it } from 'vitest';
import {
  computeFtpResult,
  FTP_MIN_COVERAGE_SECONDS,
  FTP_RESULT_FACTOR,
  getFtpCoveragePercent,
  type FtpSample,
} from './ftp-test';

const WINDOW = { effortStart: 0, effortEnd: 20 * 60 * 1000 };

/** Satu sampel per detik, mulai dari `startMs`. */
const samplesPerSecond = (
  power: number,
  seconds: number,
  startMs = 0,
  overrides: (index: number) => Partial<FtpSample> = () => ({})
): FtpSample[] =>
  Array.from({ length: seconds }, (_, index) => ({
    ts: startMs + index * 1000,
    power,
    ...overrides(index),
  }));

const effort = (samples: FtpSample[]) => computeFtpResult(samples, WINDOW);

describe('computeFtpResult', () => {
  it('returns 95% of a steady 20-minute average', () => {
    const result = effort(samplesPerSecond(200, 1200));

    expect(result.valid).toBe(true);
    expect(result.avgPower).toBe(200);
    expect(result.ftp).toBe(Math.round(200 * FTP_RESULT_FACTOR));
    expect(result.coverageSeconds).toBe(1199);
    expect(result.gapCount).toBe(0);
  });

  it('weights the average by time instead of by sample count', () => {
    const samples = [
      ...samplesPerSecond(100, 600, 0),
      ...samplesPerSecond(300, 600, 600 * 1000),
    ];

    const result = effort(samples);

    expect(result.avgPower).toBe(200);
    expect(result.ftp).toBe(190);
  });

  it('drops stale power samples from the calculation', () => {
    const samples = samplesPerSecond(200, 1200, 0, index =>
      index === 600 ? { power: 0, stalePower: true } : {}
    );

    const result = effort(samples);

    expect(result.valid).toBe(true);
    expect(result.avgPower).toBe(200);
    expect(result.gapCount).toBe(0);
  });

  it('treats a long dropout as a gap instead of averaging through it', () => {
    // Detik 600-799 hilang: rata-rata tidak boleh mengisi lubang itu.
    const samples = samplesPerSecond(200, 1200).filter(sample => {
      const second = sample.ts / 1000;
      return second < 600 || second >= 800;
    });

    const result = effort(samples);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('short-coverage');
    expect(result.gapCount).toBe(1);
    expect(result.coverageSeconds).toBeLessThan(FTP_MIN_COVERAGE_SECONDS);
  });

  it('still accepts a short dropout while keeping the covered seconds honest', () => {
    // Empat detik hilang menghasilkan satu interval 5 detik: lubang data,
    // tetapi cakupan total masih di atas ambang.
    const samples = samplesPerSecond(200, 1200).filter(sample => {
      const second = sample.ts / 1000;
      return second < 699 || second > 702;
    });

    const result = effort(samples);

    expect(result.valid).toBe(true);
    expect(result.gapCount).toBe(1);
    expect(result.coverageSeconds).toBe(1194);
  });

  it('rejects efforts shorter than 18 minutes of clean data', () => {
    const result = effort(samplesPerSecond(200, 17 * 60));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('short-coverage');
    expect(result.ftp).toBeNull();
  });

  it('accepts 18 minutes of clean data', () => {
    // 1081 sampel per detik menutup 1080 interval detik.
    const result = effort(samplesPerSecond(200, 18 * 60 + 1));

    expect(result.valid).toBe(true);
    expect(result.coverageSeconds).toBe(1080);
  });

  it('ignores samples outside the effort window', () => {
    const samples = [
      ...samplesPerSecond(500, 300, -5 * 60 * 1000),
      ...samplesPerSecond(200, 1200),
      ...samplesPerSecond(500, 300, 20 * 60 * 1000),
    ];

    const result = effort(samples);

    expect(result.avgPower).toBe(200);
  });

  it('reports no samples when nothing lands inside the window', () => {
    const result = effort(samplesPerSecond(200, 1200, 30 * 60 * 1000));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('no-samples');
    expect(result.coverageSeconds).toBe(0);
  });

  it('reports no power when every covered sample is zero', () => {
    const result = effort(samplesPerSecond(0, 1200));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('no-power');
    expect(result.avgPower).toBe(0);
  });

  it('treats negative power as zero rather than as a boost', () => {
    const samples = samplesPerSecond(200, 1200, 0, index =>
      index % 2 === 0 ? { power: -200 } : {}
    );

    const result = effort(samples);

    expect(result.avgPower).toBe(100);
  });

  it('needs at least two samples to measure an interval', () => {
    const result = effort([{ ts: 0, power: 200 }]);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('short-coverage');
    expect(result.coverageSeconds).toBe(0);
  });

  it('does not count duplicate timestamps as a gap', () => {
    const samples = [...samplesPerSecond(200, 1200), { ts: 500, power: 200 }];

    const result = effort(samples);

    expect(result.gapCount).toBe(0);
    expect(result.valid).toBe(true);
  });
});

describe('getFtpCoveragePercent', () => {
  it('reports coverage against the 20-minute effort', () => {
    expect(getFtpCoveragePercent(0)).toBe(0);
    expect(getFtpCoveragePercent(600)).toBe(50);
    expect(getFtpCoveragePercent(1200)).toBe(100);
    expect(getFtpCoveragePercent(2000)).toBe(100);
    expect(getFtpCoveragePercent(Number.NaN)).toBe(0);
  });
});
