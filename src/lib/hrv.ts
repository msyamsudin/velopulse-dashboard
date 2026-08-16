/**
 * HRV (heart-rate variability) helpers.
 *
 * The Bluetooth Heart Rate Measurement characteristic optionally carries
 * RR-intervals (time between successive heart beats, unit 1/1024 s). These are
 * currently the only source of HRV on a standard BLE strap, so we parse them,
 * derive RMSSD (root mean square of successive differences — the standard
 * time-domain HRV metric) and classify a simple daily readiness against a
 * rolling baseline.
 */

/** Parsed content of a Heart Rate Measurement notification. */
export interface HeartRateMeasurement {
  heartRate: number;
  /** RR-intervals in milliseconds (may be empty — many straps omit them). */
  rrIntervalsMs: number[];
}

/**
 * Parse a Heart Rate Measurement characteristic value (Bluetooth SIG spec):
 * - flags (1 byte): bit0 HR format (0 = uint8, 1 = uint16), bit3 Energy
 *   Expended present, bit4 RR-Interval present
 * - HR value (1 or 2 bytes)
 * - Energy Expended (uint16, only if flag bit3)
 * - one or more RR-intervals (uint16 each, unit 1/1024 s)
 */
export const parseHeartRateMeasurement = (value: DataView): HeartRateMeasurement => {
  if (value.byteLength < 2) return { heartRate: 0, rrIntervalsMs: [] };

  const flags = value.getUint8(0);
  const formatUint16 = (flags & 0x01) !== 0;
  const hasEnergyExpended = (flags & 0x08) !== 0;
  const hasRrIntervals = (flags & 0x10) !== 0;

  let offset = 1;
  const heartRate = formatUint16 ? value.getUint16(offset, true) : value.getUint8(offset);
  offset += formatUint16 ? 2 : 1;

  if (hasEnergyExpended) offset += 2;

  const rrIntervalsMs: number[] = [];
  if (hasRrIntervals) {
    while (offset + 2 <= value.byteLength) {
      const rr1024 = value.getUint16(offset, true);
      rrIntervalsMs.push((rr1024 * 1000) / 1024);
      offset += 2;
    }
  }

  return { heartRate, rrIntervalsMs };
};

/**
 * Root Mean Square of Successive Differences (ms) — the primary time-domain
 * HRV metric. Requires at least `minCount` intervals (default 5) to be
 * meaningful; returns null otherwise.
 */
export const computeRmssd = (intervalsMs: number[], minCount = 5): number | null => {
  if (intervalsMs.length < minCount) return null;

  let sumSq = 0;
  let n = 0;
  for (let i = 1; i < intervalsMs.length; i++) {
    const diff = intervalsMs[i] - intervalsMs[i - 1];
    sumSq += diff * diff;
    n++;
  }
  if (n === 0) return null;

  return Math.sqrt(sumSq / n);
};

export type ReadinessLevel = 'strained' | 'balanced' | 'recovered';

/**
 * Classify live RMSSD against a personal baseline. The exact thresholds are
 * arbitrary; the important thing is they are relative to the rider's own
 * baseline, not absolute numbers.
 */
export const classifyReadiness = (rmssd: number, baseline: number): ReadinessLevel => {
  if (baseline <= 0) return 'balanced';
  const ratio = rmssd / baseline;
  if (ratio < 0.85) return 'strained';
  if (ratio > 1.15) return 'recovered';
  return 'balanced';
};

/** Median of a numeric list (null when empty). */
export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/** Daily baseline = median of the day's RMSSD readings (null if too few). */
export const finalizeDailyHrv = (readings: number[], minReadings = 5): number | null =>
  readings.length < minReadings ? null : median(readings);

/** Local date key in the user's timezone, e.g. "2026-08-16". */
export const todayKey = (now = new Date()): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export interface HrvDaily {
  /** Local date key (see todayKey). */
  date: string;
  /** RMSSD readings collected today (throttled). */
  readings: number[];
  /** Timestamp of the last recorded reading (throttle gate). */
  lastTs: number;
}

const BASELINE_KEY = 'velopulse-hrv-baseline';
const DAILY_KEY = 'velopulse-hrv-daily';

/** Minimum gap between RMSSD readings stored for the daily baseline. */
export const HRV_READING_INTERVAL_MS = 60_000;

const readNumber = (key: string): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

export const loadHrvBaseline = (): number | null => readNumber(BASELINE_KEY);

export const saveHrvBaseline = (baseline: number): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BASELINE_KEY, String(baseline));
  } catch {
    // storage unavailable (private mode / quota) — HRV just won't persist
  }
};

export const loadHrvDaily = (): HrvDaily | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HrvDaily>;
    if (!parsed || typeof parsed.date !== 'string' || !Array.isArray(parsed.readings)) {
      return null;
    }
    return {
      date: parsed.date,
      readings: parsed.readings.filter((r) => Number.isFinite(r)),
      lastTs: typeof parsed.lastTs === 'number' ? parsed.lastTs : 0,
    };
  } catch {
    return null;
  }
};

export const saveHrvDaily = (daily: HrvDaily): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  } catch {
    // ignore — persistence is best-effort
  }
};

/**
 * Record one live RMSSD reading for the day (throttled) and return the
 * current readiness classification:
 * - against yesterday's baseline once it exists,
 * - otherwise against today's running median (day-1 provisional).
 *
 * Returns null before enough readings exist. Side effects on localStorage are
 * intentional — this runs from a store action (notification handler), never
 * during render.
 */
export const recordHrvReading = (rmssd: number, now = Date.now()): ReadinessLevel | null => {
  const key = todayKey(new Date(now));
  let daily = loadHrvDaily();

  if (!daily || daily.date !== key) {
    // New day: finalize the previous day into the baseline.
    if (daily && daily.date !== key) {
      const finalized = finalizeDailyHrv(daily.readings);
      if (finalized !== null) saveHrvBaseline(finalized);
    }
    daily = { date: key, readings: [], lastTs: 0 };
    saveHrvDaily(daily);
  }

  if (now - daily.lastTs >= HRV_READING_INTERVAL_MS) {
    daily.readings = [...daily.readings, rmssd].slice(-60);
    daily.lastTs = now;
    saveHrvDaily(daily);
  }

  const baseline = loadHrvBaseline();
  const reference = baseline ?? finalizeDailyHrv(daily.readings);
  return reference !== null ? classifyReadiness(rmssd, reference) : null;
};
