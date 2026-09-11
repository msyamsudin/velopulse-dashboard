import { getSafeMaxHr } from './constants';

interface HeartRatePoint {
  hr?: number;
}

export interface TrainingLoadResult {
  score: number;
  label: 'Recovery' | 'Moderate' | 'High' | 'Very High';
  activeMinutes: number;
}

export interface TrainingLoadMetrics {
  acuteLoad: number;
  chronicLoad: number;
  acuteChronicRatio: number | null;
  monotony: number;
  strain: number;
  trainingDays: number;
  recommendation: 'Recovery' | 'Maintain' | 'Build';
  recommendationDetail: string;
}

const getEdwardsZoneWeight = (heartRate: number, maxHr: number) => {
  if (!Number.isFinite(heartRate) || heartRate <= 0) return 0;

  const ratio = heartRate / getSafeMaxHr(maxHr);
  if (ratio < 0.5) return 0;
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.7) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
};

export const getTrainingLoadLabel = (score: number): TrainingLoadResult['label'] => {
  if (score >= 150) return 'Very High';
  if (score >= 100) return 'High';
  if (score >= 50) return 'Moderate';
  return 'Recovery';
};

/**
 * Edwards TRIMP: minutes in each HR zone multiplied by zone weights 1-5.
 * Session duration is distributed across samples so imported or downsampled
 * workouts produce the same load as one-second recordings.
 */
export const calculateEdwardsTrimp = (
  history: HeartRatePoint[] = [],
  durationSeconds: number,
  maxHr: number
): TrainingLoadResult => {
  if (history.length === 0 || durationSeconds <= 0) {
    return { score: 0, label: 'Recovery', activeMinutes: 0 };
  }

  const secondsPerSample = durationSeconds / history.length;
  let weightedSeconds = 0;
  let activeSeconds = 0;

  history.forEach(point => {
    const weight = getEdwardsZoneWeight(Number(point.hr || 0), maxHr);
    if (weight === 0) return;

    activeSeconds += secondsPerSample;
    weightedSeconds += secondsPerSample * weight;
  });

  const score = Math.round((weightedSeconds / 60) * 10) / 10;
  return {
    score,
    label: getTrainingLoadLabel(score),
    activeMinutes: Math.round((activeSeconds / 60) * 10) / 10,
  };
};

const roundOne = (value: number) => Math.round(value * 10) / 10;

/** Window length for the fitness/fatigue model: 90 days of daily TRIMP. */
export const LOAD_TREND_DAYS = 90;

/** Training days needed before the fitness/fatigue model is worth trusting. */
export const MIN_TREND_TRAINING_DAYS = 12;

export interface LoadTrend {
  /** Fitness: 42-day exponentially weighted average of daily load. */
  ctl: number;
  /** Fatigue: 7-day exponentially weighted average of daily load. */
  atl: number;
  /** Form: fitness minus fatigue. */
  tsb: number;
  ctlSeries: number[];
  atlSeries: number[];
  /** Days covered by the series (including rest days). */
  days: number;
  /** Days with load > 0. */
  trainingDays: number;
  /** False while the history is too short for the model to mean anything. */
  established: boolean;
}

/**
 * Impulse-response model over chronological daily TRIMP totals.
 *
 * CTL (fitness) and ATL (fatigue) are exponentially weighted averages with
 * 42-day and 7-day time constants; TSB (form) is their difference. Both averages
 * are seeded with the mean of the first week instead of zero: seeding at zero
 * makes a rider with a perfectly steady load look 10% less fit than they are and
 * permanently "fatigued" for the first month.
 */
export const calculateLoadTrend = (
  dailyLoads: number[] = [],
  ctlDays = 42,
  atlDays = 7
): LoadTrend => {
  const loads = dailyLoads.map(load => (Number.isFinite(load) && load > 0 ? load : 0));
  const seedWindow = Math.min(atlDays, loads.length);
  const seed = seedWindow > 0
    ? loads.slice(0, seedWindow).reduce((total, load) => total + load, 0) / seedWindow
    : 0;

  const ctlSeries: number[] = [];
  const atlSeries: number[] = [];
  let ctl = seed;
  let atl = seed;

  for (const load of loads) {
    ctl += (load - ctl) / ctlDays;
    atl += (load - atl) / atlDays;
    ctlSeries.push(roundOne(ctl));
    atlSeries.push(roundOne(atl));
  }

  const trainingDays = loads.filter(load => load > 0).length;
  const lastCtl = ctlSeries[ctlSeries.length - 1] ?? 0;
  const lastAtl = atlSeries[atlSeries.length - 1] ?? 0;

  return {
    ctl: lastCtl,
    atl: lastAtl,
    tsb: roundOne(lastCtl - lastAtl),
    ctlSeries,
    atlSeries,
    days: loads.length,
    trainingDays,
    established: trainingDays >= MIN_TREND_TRAINING_DAYS,
  };
};

/**
 * Calculates workload guidance from up to 28 chronological daily TRIMP totals.
 * Chronic load is the average weekly load of the 3 weeks BEFORE the current
 * (acute) week — the acute week is not counted twice in the ratio.
 */
export const calculateTrainingLoadMetrics = (dailyLoads: number[] = []): TrainingLoadMetrics => {
  const normalized = dailyLoads
    .slice(-28)
    .map(load => Number.isFinite(load) && load > 0 ? load : 0);
  const padded = [...Array(Math.max(0, 28 - normalized.length)).fill(0), ...normalized];
  const acuteDays = padded.slice(-7);
  const acuteLoad = acuteDays.reduce((total, load) => total + load, 0);
  // Uncoupled baseline: only the 21 days before the acute week.
  const baselineDays = padded.slice(0, 21);
  const chronicLoad = baselineDays.reduce((total, load) => total + load, 0) / 3;
  const acuteChronicRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : null;
  const dailyMean = acuteLoad / 7;
  const variance = acuteDays.reduce((total, load) => total + ((load - dailyMean) ** 2), 0) / 7;
  const standardDeviation = Math.sqrt(variance);
  const monotony = dailyMean <= 0 ? 0 : standardDeviation > 0 ? dailyMean / standardDeviation : 10;
  const strain = acuteLoad * monotony;
  const trainingDays = padded.filter(load => load > 0).length;

  let recommendation: TrainingLoadMetrics['recommendation'] = 'Maintain';
  let recommendationDetail = 'Recent load is close to your 3-week baseline. Keep the next session controlled.';

  if (trainingDays < 4) {
    recommendation = 'Build';
    recommendationDetail = 'Not enough history for a stable baseline. Add easy sessions gradually.';
  } else if (acuteLoad === 0) {
    recommendation = 'Build';
    recommendationDetail = 'No load was recorded in the last 7 days. Resume with an easy session.';
  } else if ((acuteChronicRatio ?? 0) > 1.5 || (monotony > 2 && (acuteChronicRatio ?? 0) >= 1)) {
    recommendation = 'Recovery';
    recommendationDetail = 'Load is high or repetitive versus your baseline. Prefer rest or an easy session.';
  } else if ((acuteChronicRatio ?? 1) < 0.8) {
    recommendation = 'Build';
    recommendationDetail = 'Recent load is below your baseline. Increase gradually only if you feel recovered.';
  } else if ((acuteChronicRatio ?? 0) > 1.3) {
    recommendationDetail = 'Load is rising above baseline. Maintain volume and avoid another sharp increase.';
  }

  return {
    acuteLoad: roundOne(acuteLoad),
    chronicLoad: roundOne(chronicLoad),
    acuteChronicRatio: acuteChronicRatio === null ? null : Math.round(acuteChronicRatio * 100) / 100,
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(strain),
    trainingDays,
    recommendation,
    recommendationDetail,
  };
};
