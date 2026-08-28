import type { SupabaseErrorInfo } from '@/lib/supabase-errors';
import type { BluetoothData } from '../useBluetoothStore';

export interface HistoryData {
  time: string;
  /** Wall-clock timestamp (ms) of the sample; used for real Δt integration. */
  ts?: number;
  hr: number;
  cadence: number;
  power: number;
  speed: number;
  distance: number;
  resistance: number;
  calories: number;
  /** True when the value was zeroed by the stale-data watchdog (3 s without updates). */
  staleHr?: boolean;
  stalePower?: boolean;
  staleCadence?: boolean;
  staleSpeed?: boolean;
}

export interface WorkoutSession {
  id: string;
  sessionStartTime: number;
  date: string;
  duration: number;
  stats: {
    avgHr: number;
    maxHr: number;
    avgPower: number;
    maxPower: number;
    avgCadence: number;
    maxCadence: number;
    avgSpeed?: number;
    maxSpeed?: number;
    hrrScore?: number;
    hrrClassification?: string;
  };
  history: HistoryData[];
  synced_to_google?: boolean;
  synced_to_supabase?: boolean;
  supabase_id?: string;
  supabase_synced_at?: string;
  supabase_sync_error?: string;
  supabase_sync_error_code?: string;
}

export interface LiveWorkoutStats {
  avgHr: number;
  maxHr: number;
  avgPower: number;
  maxPower: number;
  avgCadence: number;
  maxCadence: number;
  avgSpeed: number;
  maxSpeed: number;
  hrrScore: number | null;
  hrrClassification: string | null;
}

export interface LiveWorkoutTotals {
  hr: number;
  hrTime: number;
  power: number;
  powerTime: number;
  cadence: number;
  cadenceTime: number;
  speed: number;
  speedTime: number;
}

export type SaveSessionPhase =
  | 'idle'
  | 'preparing'
  | 'local'
  | 'sync'
  | 'finalizing'
  | 'done';

export interface ImportTcxResult {
  imported: number;
  skipped: number;
  synced: number;
  pending: number;
  messages: string[];
}

export interface DeleteSessionResult {
  success: boolean;
  message?: string;
}

export interface ActiveSessionSnapshot {
  isRecording: boolean;
  elapsed: number;
  sessionStartTime: number | null;
  startDistance: number;
  startCalories: number;
  calorieAccumulator: number;
  hasPowerSource: boolean;
  lastHistoryPointTs: number | null;
  history: HistoryData[];
}

export interface WorkoutStateFields {
  isRecording: boolean;
  elapsed: number;
  sessionStartTime: number | null;
  startDistance: number;
  startCalories: number;
  /** Fractional calorie accumulator shared by the live card and history points. */
  calorieAccumulator: number;
  /** Sticky per-session flag: true once a power sample arrives. */
  hasPowerSource: boolean;
  /** Wall-clock ts (ms) of the last history point, for real Δt integration. */
  lastHistoryPointTs: number | null;
  history: HistoryData[];
  sessionHistory: WorkoutSession[];
  hrrScore: number | null;
  hrrClassification: string | null;
  liveStats: LiveWorkoutStats;
  liveStatsTotals: LiveWorkoutTotals;
  supabaseHistoryLoadedCount: number;
  hasMoreSupabaseHistory: boolean;
  supabaseSyncError: SupabaseErrorInfo | null;
  /** True while saveSession() is running; drives the summary-modal progress bar. */
  isSavingSession: boolean;
  /** 0–100 save progress, reported by saveSession() as it advances. */
  saveSessionProgress: number;
  /** Current save stage, used to pick a localized progress label. */
  saveSessionPhase: SaveSessionPhase;
}

export interface WorkoutActions {
  toggleRecording: () => void;
  incrementElapsed: () => void;
  addHistoryPoint: (data: BluetoothData) => void;
  setHrrResult: (score: number, classification: string) => void;
  saveSession: () => Promise<void>;
  syncPendingSupabaseSessions: () => Promise<void>;
  importTCX: (tcxContent: string, filename?: string) => Promise<ImportTcxResult>;
  deleteSession: (sessionId: string) => Promise<DeleteSessionResult>;
  discardSession: () => void;
  loadHistory: () => void;
  loadHistoryFromSupabase: () => Promise<void>;
  loadMoreHistoryFromSupabase: () => Promise<void>;
  formatTime: (seconds: number) => string;
  clearSupabaseSyncError: () => void;
}

export type WorkoutState = WorkoutStateFields & WorkoutActions;
