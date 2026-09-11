import type { TrainingLoadMetrics, TrainingLoadResult } from '@/lib/training-load';
import type { WorkoutSession } from '@/store/useWorkoutStore';

export type { WorkoutSession };

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
  /** Sessions bucketed by their quality label. */
  sessionTypes: { easy: number; moderate: number; hard: number };
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
  normalizedChartData: HistoryChartPoint[];
  summaryInsights: SummaryInsights | null;
  comparisonSummary: ComparisonSummary | null;
  trainingLoadMetrics: TrainingLoadMetrics;
  weeklyDailyData: DailySummaryDay[];
  /** Four rolling 7-day TRIMP windows backing the Load Ratio chart. */
  loadRatioWeeklyData: WeeklyLoadPoint[];
}
