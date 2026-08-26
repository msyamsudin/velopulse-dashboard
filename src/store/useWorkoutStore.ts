import { create } from 'zustand';
import { createWorkoutActions } from './workout/actions';
import { EMPTY_LIVE_STATS, EMPTY_LIVE_TOTALS } from './workout/constants';
import type { WorkoutState } from './workout/types';

export * from './workout/types';
export * from './workout/stats';

export const useWorkoutStore = create<WorkoutState>((set, get, api) => ({
  isRecording: false,
  elapsed: 0,
  sessionStartTime: null,
  startDistance: 0,
  startCalories: 0,
  calorieAccumulator: 0,
  hasPowerSource: false,
  lastHistoryPointTs: null,
  history: [],
  sessionHistory: [],
  hrrScore: null,
  hrrClassification: null,
  liveStats: EMPTY_LIVE_STATS,
  liveStatsTotals: EMPTY_LIVE_TOTALS,
  supabaseHistoryLoadedCount: 0,
  hasMoreSupabaseHistory: false,
  supabaseSyncError: null,
  ...createWorkoutActions(api),
}));
