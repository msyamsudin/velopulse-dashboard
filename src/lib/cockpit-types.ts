import type { HistoryData, LiveWorkoutStats, WorkoutSession } from '@/store/useWorkoutStore';
import type { UserProfile } from './profile';

/** Nama lama untuk profil pesepeda; definisinya ada di lib/profile.ts. */
export type RiderProfile = UserProfile;

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
