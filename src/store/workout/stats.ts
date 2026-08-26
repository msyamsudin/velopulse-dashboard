import { calcCaloriesFromPower, DELTA_MAX_SECONDS } from '@/lib/physics';
import type { BluetoothData } from '../useBluetoothStore';
import { EMPTY_LIVE_STATS, EMPTY_LIVE_TOTALS } from './constants';
import type { HistoryData, LiveWorkoutStats, LiveWorkoutTotals } from './types';

/**
 * Effective seconds between consecutive history points. The first point
 * represents one second; gaps are clamped to [0, DELTA_MAX_SECONDS] so a long
 * dropout cannot inject a huge single interval into the accumulator.
 */
export const getDeltaSeconds = (history: HistoryData[], index: number) => {
  if (index === 0) return 1;
  const current = history[index]?.ts;
  const previous = history[index - 1]?.ts;
  if (!current || !previous) return 1;
  const deltaSeconds = (current - previous) / 1000;
  return Math.min(Math.max(deltaSeconds, 0), DELTA_MAX_SECONDS);
};

/**
 * Reintegrates calories from a point series. Legacy points carry no ts and may
 * be downsampled for storage, so when no timestamp exists the snapshot
 * duration is distributed evenly across the retained points.
 */
export const computeCalorieAccumulator = (history: HistoryData[], elapsedSeconds = 0) => {
  const hasPowerSource = history.some(point => point.power > 0);
  if (!hasPowerSource) {
    return history[history.length - 1]?.calories || 0;
  }
  if (elapsedSeconds > 0 && !history.some(point => point.ts)) {
    const secondsPerPoint = elapsedSeconds / history.length;
    return history.reduce(
      (total, point) => total + calcCaloriesFromPower(point.power || 0, secondsPerPoint),
      0
    );
  }
  return history.reduce(
    (total, point, index) =>
      total + calcCaloriesFromPower(point.power || 0, getDeltaSeconds(history, index)),
    0
  );
};

/**
 * Single authoritative Δt-weighted, stale-excluded aggregation step shared by
 * the incremental live path and the full recompute path.
 */
export const addPointToTotals = (
  totals: LiveWorkoutTotals,
  point: HistoryData,
  deltaSeconds: number
): LiveWorkoutTotals => {
  // HR is physiologically never 0 while riding; power/cadence/speed zeros
  // only count when they are genuine (not watchdog-zeroed stale samples).
  const validHr = point.hr > 0 && !point.staleHr;
  const validPower = !point.stalePower;
  const validCadence = !point.staleCadence;
  const validSpeed = !point.staleSpeed;

  return {
    hr: totals.hr + (validHr ? point.hr * deltaSeconds : 0),
    hrTime: totals.hrTime + (validHr ? deltaSeconds : 0),
    power: totals.power + (validPower ? point.power * deltaSeconds : 0),
    powerTime: totals.powerTime + (validPower ? deltaSeconds : 0),
    cadence: totals.cadence + (validCadence ? point.cadence * deltaSeconds : 0),
    cadenceTime: totals.cadenceTime + (validCadence ? deltaSeconds : 0),
    speed: totals.speed + (validSpeed ? (point.speed || 0) * deltaSeconds : 0),
    speedTime: totals.speedTime + (validSpeed ? deltaSeconds : 0)
  };
};

export const statsFromTotals = (
  totals: LiveWorkoutTotals,
  maxes: { maxHr: number; maxPower: number; maxCadence: number; maxSpeed: number },
  hrrScore: number | null,
  hrrClassification: string | null
): LiveWorkoutStats => ({
  avgHr: totals.hrTime > 0 ? Math.round(totals.hr / totals.hrTime) : 0,
  maxHr: maxes.maxHr,
  avgPower: totals.powerTime > 0 ? Math.round(totals.power / totals.powerTime) : 0,
  maxPower: maxes.maxPower,
  avgCadence: totals.cadenceTime > 0 ? Math.round(totals.cadence / totals.cadenceTime) : 0,
  maxCadence: maxes.maxCadence,
  avgSpeed: totals.speedTime > 0 ? Number((totals.speed / totals.speedTime).toFixed(1)) : 0,
  maxSpeed: Number(maxes.maxSpeed.toFixed(1)),
  hrrScore,
  hrrClassification
});

export const calculateLiveStats = (
  history: HistoryData[],
  hrrScore: number | null = null,
  hrrClassification: string | null = null
) => {
  if (history.length === 0) {
    return {
      stats: { ...EMPTY_LIVE_STATS, hrrScore, hrrClassification },
      totals: { ...EMPTY_LIVE_TOTALS }
    };
  }

  const aggregate = history.reduce((acc, point, index) => ({
    totals: addPointToTotals(acc.totals, point, getDeltaSeconds(history, index)),
    maxHr: Math.max(acc.maxHr, point.hr),
    maxPower: Math.max(acc.maxPower, point.power),
    maxCadence: Math.max(acc.maxCadence, point.cadence),
    maxSpeed: Math.max(acc.maxSpeed, point.speed || 0)
  }), {
    totals: { ...EMPTY_LIVE_TOTALS },
    maxHr: 0,
    maxPower: 0,
    maxCadence: 0,
    maxSpeed: 0
  });

  const { totals } = aggregate;

  return {
    stats: statsFromTotals(totals, aggregate, hrrScore, hrrClassification),
    totals
  };
};

/** Session-relative sensor calories (cumulative sensor value minus the session start offset). */
export const sensorCaloriesDelta = (sensorCalories: number | undefined, startCalories: number) =>
  Math.max(0, (sensorCalories || 0) - startCalories);

export const calculateSessionCalories = (
  data: BluetoothData,
  startCalories: number,
  accumulator: number,
  hasPowerSource: boolean,
  deltaSeconds: number
) => {
  if (hasPowerSource) {
    return accumulator + calcCaloriesFromPower(data.power || 0, deltaSeconds);
  }

  return Math.max(accumulator, sensorCaloriesDelta(data.calories, startCalories));
};
