import type { HistoryData, LiveWorkoutStats, WorkoutSession } from '@/store/useWorkoutStore';

/** Rider calibration profile (age / maxHr / ftp / weight). */
export interface RiderProfile {
  age: number;
  maxHr: number;
  ftp: number;
  weight: number;
}

/** Latest live telemetry snapshot shown by the cockpits. */
export interface TelemetrySnapshot {
  hr: number;
  cadence: number;
  power: number;
  speed: number;
  distance: number;
  resistance: number;
  calories: number;
}

/** Active workout view handed to the cockpits (history, elapsed, formatter). */
export interface WorkoutView {
  history: HistoryData[];
  elapsed: number;
  formatTime: (seconds: number) => string;
}

export type { HistoryData, LiveWorkoutStats, WorkoutSession };
