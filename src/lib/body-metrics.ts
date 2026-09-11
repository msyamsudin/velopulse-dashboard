/**
 * Body-mass normalised metrics: W/kg and kcal/kg/h.
 *
 * Both are only meaningful with a real body weight, so `computeBodyMetrics`
 * returns `null` when no weight is set (the caller renders a prompt instead of
 * a zero or a division artefact). Inside the result, a single value can still
 * be `null` when its own input is missing: a range without power has no W/kg,
 * but kcal/kg/h is unaffected because it only needs energy and time.
 */

export interface BodyMetricSession {
  /** Session average power in watts (0 when the session recorded no power). */
  avgPower: number;
  /** Session peak power in watts (0 when the session recorded no power). */
  maxPower: number;
  /** Session duration in seconds. */
  duration: number;
}

export interface BodyMetricsInput {
  sessions: BodyMetricSession[];
  /** Total recorded seconds across the range (all sessions, with or without power). */
  totalSeconds: number;
  /** Total calories across the range. */
  totalCalories: number;
  weightKg: number;
}

export interface BodyMetrics {
  /** Duration-weighted average power of the sessions that did record power. */
  avgPower: number;
  /** Highest session peak power in the range. */
  peakPower: number;
  /** Average power per kilogram, 2 decimals; null without usable power. */
  avgWkg: number | null;
  /** Peak power per kilogram, 2 decimals; null without usable power. */
  peakWkg: number | null;
  /** Energy cost per kilogram per hour, 1 decimal; null without energy or time. */
  kcalPerKgHour: number | null;
}

const round = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const computeBodyMetrics = ({
  sessions = [],
  totalSeconds = 0,
  totalCalories = 0,
  weightKg = 0,
}: BodyMetricsInput): BodyMetrics | null => {
  if (!(weightKg > 0) || !Number.isFinite(weightKg)) return null;

  // Duration-weighted over the sessions that actually recorded power: folding a
  // pedal-less session's duration into the denominator would understate W/kg.
  const powerSessions = sessions.filter(session => Number(session.avgPower) > 0);
  const powerSeconds = powerSessions.reduce((total, session) => total + Math.max(0, session.duration || 0), 0);
  const weightedPower = powerSessions.reduce(
    (total, session) => total + Number(session.avgPower) * Math.max(0, session.duration || 0),
    0
  );
  const avgPower = powerSeconds > 0 ? weightedPower / powerSeconds : 0;
  const peakPower = sessions.reduce((max, session) => Math.max(max, Number(session.maxPower) || 0), 0);

  const hours = totalSeconds > 0 ? totalSeconds / 3600 : 0;

  return {
    avgPower: Math.round(avgPower),
    peakPower: Math.round(peakPower),
    avgWkg: avgPower > 0 ? round(avgPower / weightKg, 2) : null,
    peakWkg: peakPower > 0 ? round(peakPower / weightKg, 2) : null,
    kcalPerKgHour: hours > 0 && totalCalories > 0 ? round(totalCalories / weightKg / hours, 1) : null,
  };
};
