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
  normalizedChartData: HistoryChartPoint[];
  summaryInsights: SummaryInsights | null;
  comparisonSummary: ComparisonSummary | null;
  trainingLoadMetrics: TrainingLoadMetrics;
  weeklyDailyData: DailySummaryDay[];
}
