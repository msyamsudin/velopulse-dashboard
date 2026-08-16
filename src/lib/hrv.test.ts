import { describe, expect, it } from 'vitest';
import {
  classifyReadiness,
  computeRmssd,
  finalizeDailyHrv,
  median,
  parseHeartRateMeasurement,
  todayKey,
} from './hrv';

const toDataView = (bytes: number[]): DataView =>
  new DataView(Uint8Array.from(bytes).buffer);

describe('parseHeartRateMeasurement', () => {
  it('parses a minimal uint8 heart rate packet', () => {
    const { heartRate, rrIntervalsMs } = parseHeartRateMeasurement(toDataView([0x00, 0x5a]));
    expect(heartRate).toBe(90);
    expect(rrIntervalsMs).toEqual([]);
  });

  it('parses uint16 heart rate format (flag bit0)', () => {
    const { heartRate } = parseHeartRateMeasurement(toDataView([0x01, 0x2c, 0x01]));
    expect(heartRate).toBe(300);
  });

  it('skips Energy Expended when flag bit3 is set', () => {
    // flags 0x08 (EE present), HR 90, EE = 0x0064 (100 kcal) — must not leak into RR
    const { heartRate, rrIntervalsMs } = parseHeartRateMeasurement(
      toDataView([0x08, 0x5a, 0x64, 0x00])
    );
    expect(heartRate).toBe(90);
    expect(rrIntervalsMs).toEqual([]);
  });

  it('parses RR-intervals in 1/1024 s units when flag bit4 is set', () => {
    // flags 0x10 (RR present), HR 90, RR = 512 -> 500 ms, RR = 1024 -> 1000 ms
    const { heartRate, rrIntervalsMs } = parseHeartRateMeasurement(
      toDataView([0x10, 0x5a, 0x00, 0x02, 0x00, 0x04])
    );
    expect(heartRate).toBe(90);
    expect(rrIntervalsMs).toEqual([500, 1000]);
  });

  it('combines uint16 HR with RR-intervals', () => {
    const { heartRate, rrIntervalsMs } = parseHeartRateMeasurement(
      toDataView([0x11, 0x2c, 0x01, 0x00, 0x02, 0x00, 0x04])
    );
    expect(heartRate).toBe(300);
    expect(rrIntervalsMs).toEqual([500, 1000]);
  });

  it('tolerates truncated buffers', () => {
    expect(parseHeartRateMeasurement(toDataView([0x10, 0x5a]))).toEqual({
      heartRate: 90,
      rrIntervalsMs: [],
    });
    expect(parseHeartRateMeasurement(toDataView([0x00]))).toEqual({
      heartRate: 0,
      rrIntervalsMs: [],
    });
  });
});

describe('computeRmssd', () => {
  it('returns 0 for perfectly regular intervals', () => {
    expect(computeRmssd([1000, 1000, 1000, 1000, 1000, 1000])).toBe(0);
  });

  it('computes the root mean square of successive differences', () => {
    // diffs: 200, -200, 200, -200, 200 -> sqrt(200^2) = 200
    expect(computeRmssd([1000, 1200, 1000, 1200, 1000, 1200])).toBe(200);
  });

  it('returns null below the minimum interval count', () => {
    expect(computeRmssd([1000, 1100])).toBeNull();
    expect(computeRmssd([1000, 1100], 2)).toBe(100);
  });
});

describe('classifyReadiness', () => {
  it('flags below 85% of baseline as strained', () => {
    expect(classifyReadiness(40, 50)).toBe('strained');
  });

  it('keeps values within ±15% of baseline as balanced', () => {
    expect(classifyReadiness(42.5, 50)).toBe('balanced');
    expect(classifyReadiness(50, 50)).toBe('balanced');
    expect(classifyReadiness(57.4, 50)).toBe('balanced');
  });

  it('flags above 115% of baseline as recovered', () => {
    expect(classifyReadiness(60, 50)).toBe('recovered');
  });

  it('falls back to balanced for a missing baseline', () => {
    expect(classifyReadiness(40, 0)).toBe('balanced');
  });
});

describe('median', () => {
  it('returns the middle value for odd-length lists', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even-length lists', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('returns null for an empty list', () => {
    expect(median([])).toBeNull();
  });
});

describe('finalizeDailyHrv', () => {
  it('returns the median when enough readings exist', () => {
    expect(finalizeDailyHrv([40, 50, 60, 55, 45])).toBe(50);
  });

  it('returns null with too few readings', () => {
    expect(finalizeDailyHrv([40, 50])).toBeNull();
  });
});

describe('todayKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 7, 16))).toBe('2026-08-16');
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
