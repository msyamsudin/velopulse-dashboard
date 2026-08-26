import type { LiveWorkoutStats, LiveWorkoutTotals } from './types';

export const SUPABASE_HISTORY_PAGE_SIZE = 50;
export const ACTIVE_SESSION_PERSIST_INTERVAL_MS = 5000;
export const ACTIVE_SESSION_STORAGE_KEY = 'velopulse_active_session';
export const SESSION_HISTORY_STORAGE_KEY = 'velopulse_sessions';
export const WORKOUT_INDEXED_DB_NAME = 'velopulse_workouts';
export const WORKOUT_INDEXED_DB_VERSION = 1;
export const WORKOUT_INDEXED_DB_STORE = 'workout_state';
export const BLE_STALE_TIMEOUT_MS = 3000;
export const RECOVERY_GRACE_SECONDS = 30;

export const ACTIVE_SESSION_HISTORY_POINT_LIMITS = [1800, 900, 300, 60];
export const SESSION_HISTORY_STORAGE_ATTEMPTS = [
  { maxSessions: 75, maxHistoryPoints: 600 },
  { maxSessions: 75, maxHistoryPoints: 300 },
  { maxSessions: 50, maxHistoryPoints: 300 },
  { maxSessions: 50, maxHistoryPoints: 150 },
  { maxSessions: 25, maxHistoryPoints: 150 },
  { maxSessions: 25, maxHistoryPoints: 60 },
  { maxSessions: 10, maxHistoryPoints: 60 },
  { maxSessions: 10, maxHistoryPoints: 20 },
  { maxSessions: 5, maxHistoryPoints: 20 }
];

export const EMPTY_LIVE_STATS: LiveWorkoutStats = {
  avgHr: 0,
  maxHr: 0,
  avgPower: 0,
  maxPower: 0,
  avgCadence: 0,
  maxCadence: 0,
  avgSpeed: 0,
  maxSpeed: 0,
  hrrScore: null,
  hrrClassification: null
};

export const EMPTY_LIVE_TOTALS: LiveWorkoutTotals = {
  hr: 0,
  hrTime: 0,
  power: 0,
  powerTime: 0,
  cadence: 0,
  cadenceTime: 0,
  speed: 0,
  speedTime: 0
};
