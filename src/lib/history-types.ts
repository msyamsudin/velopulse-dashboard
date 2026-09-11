import type { LoadTrend, TrainingLoadMetrics, TrainingLoadResult } from '@/lib/training-load';
import type { BodyMetrics } from '@/lib/body-metrics';
import type { PowerZoneShare } from '@/lib/power-zones';
import type { SessionTypeBucket } from '@/lib/workout-analysis';
import type { WorkoutSession } from '@/store/useWorkoutStore';

export type { WorkoutSession };
// Re-exported so view components import every Summary payload type from one
// place, the same way WorkoutSession is exposed here.
export type { BodyMetrics } from '@/lib/body-metrics';
export type { PowerZoneShare, PowerZoneSummary } from '@/lib/power-zones';

export type MetricKey = 'distance' | 'calories' | 'duration' | 'cadence' | 'trimp';

export interface WorkoutZoneStat {
  label: string;
  min: number;
  max: number;
  seconds: number;
  color: string;
  range: string;
  percent: number;
  time: string;
}

/** Result of `calculateFullStats` for a single workout session. */
export interface FullWorkoutStats {
  avgHr: number;
  maxHr: number;
  avgPower: number;
  maxPower: number;
  avgCadence: number;
  maxCadence: number;
  hrrScore?: number | null;
  hrrClassification?: string | null;
  avgSpeed: string;
  maxSpeed: string;
  totalDistance: string;
  totalCalories: number;
  /** Raw (unrounded) distance in km for lossless aggregation. */
  totalDistanceKm: number;
  avgResistance: number;
  maxResistance: number;
  moveMinutes: number;
  trainingLoad: TrainingLoadResult;
  zones: WorkoutZoneStat[];
}

export interface DailySummaryDay {
  date: string;
  label: string;
  shortDate: string;
  distance: number;
  calories: number;
  durationSeconds: number;
  trimp: number;
  sessions: number;
  cadence: number;
  isToday: boolean;
  hasData: boolean;
}

/** One 7-day window of the Load Ratio chart: total TRIMP per rolling week. */
export interface WeeklyLoadPoint {
  /** Axis label, e.g. "3/4–10" (start month/day – end day). */
  label: string;
  /** Total Edwards TRIMP across all sessions in this window. */
  trimp: number;
  /** True for the most recent window (the acute week). */
  isCurrent: boolean;
}

export interface PeriodSummaryEntry {
  key?: string;
  label: string;
  sortKey?: number;
  totalDistance: number;
  totalCalories: number;
  totalDuration: number;
  totalTrainingLoad: number;
  sessionCount: number;
  avgHr?: number;
  avgPower?: number;
  avgCadence?: number;
}

export interface HistoryChartPoint {
  date?: string;
  displayLabel: string;
  subLabel: string;
  distance: number;
  calories: number;
  duration: number;
  cadence: number;
  trimp: number;
  sessions: number;
  hasData: boolean;
  isHighlight: boolean;
  isToday?: boolean;
}

/** One HR zone's share of the recorded range. */
export interface ZoneShare {
  /** Zone label, e.g. "Z3". */
  label: string;
  /** Absolute bpm range for the rider, e.g. "<95" or "114-133". */
  range: string;
  seconds: number;
  /** Share of the counted zone time (Z1–Z5), rounded. */
  percent: number;
  /** Zone seconds formatted as mm:ss / h:mm:ss. */
  time: string;
}

/**
 * Zone composition of one session-type bucket. The count and the zones are
 * tracked apart on purpose: a bucket can hold sessions that recorded no heart
 * rate at all, and dropping those rows would hide the very monotony the block
 * is there to expose.
 */
export interface SessionTypeZones {
  type: SessionTypeBucket;
  /** Sessions in this bucket, with or without heart-rate data. */
  sessions: number;
  zones: ZoneShare[];
  /** Zone seconds inside this bucket (Z1–Z5); 0 when none of them carried HR. */
  countedSeconds: number;
}

/** Intensity composition of the selected range (block 4 of the Summary). */
export interface IntensitySummary {
  zones: ZoneShare[];
  /** Seconds inside Z1–Z5; excludes time below Z1 (warm-up, HR dropouts). */
  countedSeconds: number;
  /** Recorded session seconds that never reached Z1. */
  belowZoneSeconds: number;
  /** (Z1+Z2) / countedSeconds, 0..1. */
  easyShare: number;
  /** (Z4+Z5) / countedSeconds, 0..1. */
  hardShare: number;
  /**
   * Zone mix split by session type (easy/moderate/hard), in display order and
   * limited to the buckets the range actually contains. This is also where the
   * per-type session counts live — the same number is not repeated elsewhere.
   */
  zoneByType: SessionTypeZones[];
  /**
   * Power-zone distribution (Z1–Z7 from POWER_ZONES). Empty while the rider has
   * no FTP: with `ftp <= 0` all samples would fall into Z1, so no distribution
   * is reported at all (see `hasFtp`).
   */
  powerZones: PowerZoneShare[];
  /** Seconds attributed to a power zone (samples with power > 0 only). */
  powerCountedSeconds: number;
  /** Recorded seconds with no usable power sample (coasting or no power source). */
  powerBelowZoneSeconds: number;
  /** False when the FTP gate is closed; the UI shows a prompt instead of zones. */
  hasFtp: boolean;
}

/** How many sessions in the range actually carry each data source. */
export interface CoverageSummary {
  sessions: number;
  withHeartRate: number;
  withPower: number;
  withHrr: number;
}

/** L2 "advanced analysis" payload: data trust plus the fitness/fatigue model. */
export interface AdvancedSummary {
  coverage: CoverageSummary;
  loadTrend: LoadTrend;
  /**
   * W/kg and kcal/kg/h for the range. Null while the rider has no body weight:
   * a per-kilogram figure divided by zero carries no information.
   */
  bodyMetrics: BodyMetrics | null;
  /** False when the weight gate is closed; the L2 panel shows a prompt instead. */
  hasWeight: boolean;
}

export interface GlobalSummary {
  totalDistance: string;
  totalCalories: number;
  totalDuration: string;
  totalSessions: number;
  totalTrainingLoad: number;
  averageTrainingLoad: number;
  sevenDayTrainingLoad: number;
  hrrSessions: number;
  avgHrr: number | null;
  bestHrr: number | null;
  /** HRR scores of the range in chronological order, for the trend sparkline. */
  hrrSeries: number[];
}

export interface SummaryInsights {
  avgDistancePerSession: string;
  avgDurationPerSession: string;
  bestPeriodLabel: string;
  bestPeriodDistance: string;
  lastWorkoutLabel: string;
  activeDaysLabel: string;
  currentStreakLabel: string;
  longestStreakLabel: string;
  activeSpanLabel: string;
}

export interface MetricDelta {
  value: number | null;
  direction: 'up' | 'down' | 'flat';
  hasBaseline: boolean;
}

export interface ComparisonMetrics {
  distance: number;
  calories: number;
  duration: number;
  sessions: number;
  trimp: number;
}

export interface ComparisonSummary {
  label: string;
  headline: string;
  metrics: ComparisonMetrics;
  deltas: Record<'distance' | 'calories' | 'duration' | 'sessions' | 'trimp', MetricDelta>;
}

export interface WorkoutHistoryData {
  calculateFullStats: (session: WorkoutSession) => FullWorkoutStats;
  globalSummary: GlobalSummary | null;
  intensity: IntensitySummary;
  advanced: AdvancedSummary;
  normalizedChartData: HistoryChartPoint[];
  summaryInsights: SummaryInsights | null;
  comparisonSummary: ComparisonSummary | null;
  trainingLoadMetrics: TrainingLoadMetrics;
  weeklyDailyData: DailySummaryDay[];
  /** Four rolling 7-day TRIMP windows backing the Load Ratio chart. */
  loadRatioWeeklyData: WeeklyLoadPoint[];
}
