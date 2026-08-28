import type { StoreApi } from 'zustand';
import { DELTA_MAX_SECONDS } from '@/lib/physics';
import { getSupabaseClient } from '@/lib/supabase';
import { parseTCXWorkoutSessions } from '@/lib/tcx-import-service';
import { classifySupabaseError } from '@/lib/supabase-errors';
import type { BluetoothData } from '../useBluetoothStore';
import { useBluetoothStore } from '../useBluetoothStore';
import {
  ACTIVE_SESSION_STORAGE_KEY,
  BLE_STALE_TIMEOUT_MS,
  EMPTY_LIVE_STATS,
  EMPTY_LIVE_TOTALS,
  RECOVERY_GRACE_SECONDS,
  SESSION_HISTORY_STORAGE_KEY,
  SUPABASE_HISTORY_PAGE_SIZE,
} from './constants';
import {
  getWorkoutStorageValue,
  persistActiveSession,
  persistActiveSessionToIndexedDb,
  persistSessionHistory,
  persistSessionHistoryToIndexedDb,
} from './persistence';
import {
  findSupabaseDuplicate,
  mapSupabaseWorkout,
  syncSessionToSupabase,
} from './supabase';
import {
  getSessionKey,
  getWorkoutDateISOString,
  isPotentialDuplicateSession,
  mergeSessionHistories,
} from './session-utils';
import {
  addPointToTotals,
  calculateLiveStats,
  calculateSessionCalories,
  computeCalorieAccumulator,
  statsFromTotals,
} from './stats';
import type {
  ActiveSessionSnapshot,
  HistoryData,
  ImportTcxResult,
  SaveSessionPhase,
  WorkoutActions,
  WorkoutSession,
  WorkoutState,
} from './types';

export const createWorkoutActions = (api: StoreApi<WorkoutState>): WorkoutActions => {
  const set = api.setState;
  const get = api.getState;

  return {
    toggleRecording: () => {
      const { isRecording } = get();
      if (!isRecording) {
        const startTime = Date.now();
        const sDist = useBluetoothStore.getState().data.distance || 0;
        const sCal = useBluetoothStore.getState().data.calories || 0;
        set({
          history: [],
          elapsed: 0,
          sessionStartTime: startTime,
          startDistance: sDist,
          startCalories: sCal,
          calorieAccumulator: 0,
          hasPowerSource: false,
          lastHistoryPointTs: null,
          liveStats: EMPTY_LIVE_STATS,
          liveStatsTotals: EMPTY_LIVE_TOTALS,
          hrrScore: null,
          hrrClassification: null,
          isRecording: true,
        });
        persistActiveSession({
          isRecording: true,
          elapsed: 0,
          sessionStartTime: startTime,
          startDistance: sDist,
          startCalories: sCal,
          calorieAccumulator: 0,
          hasPowerSource: false,
          lastHistoryPointTs: null,
          history: []
        }, { immediate: true });
      } else {
        set({ isRecording: false });
        persistActiveSession({
          ...get(),
          isRecording: false
        }, { immediate: true });
      }
    },

    incrementElapsed: () => {
      set((state) => {
        const nextElapsed = state.sessionStartTime
          ? Math.max(0, Math.floor((Date.now() - state.sessionStartTime) / 1000))
          : state.elapsed + 1;
        const nextState = { ...state, elapsed: nextElapsed };
        persistActiveSession(nextState);
        return { elapsed: nextElapsed };
      });
    },

    addHistoryPoint: (data) => {
      if (!get().isRecording) return;
      const { startDistance, startCalories } = get();
      const nowMs = Date.now();
      const now = new Date(nowMs);
      const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

      // To prevent timeline stretching, don't add multiple points for the same second
      const lastPoint = get().history[get().history.length - 1];
      if (lastPoint && lastPoint.time === timeStr) return;

      const bleLastUpdate = useBluetoothStore.getState().lastUpdate;
      const isStaleValue = (key: keyof BluetoothData) =>
        bleLastUpdate[key] === undefined || nowMs - bleLastUpdate[key] > BLE_STALE_TIMEOUT_MS;

      const staleHr = (data.heartRate || 0) === 0 && isStaleValue('heartRate');
      const stalePower = (data.power || 0) === 0 && isStaleValue('power');
      const staleCadence = (data.cadence || 0) === 0 && isStaleValue('cadence');
      const staleSpeed = (data.speed || 0) === 0 && isStaleValue('speed');

      set((state) => {
        const deltaSeconds = state.lastHistoryPointTs !== null
          ? Math.min(Math.max((nowMs - state.lastHistoryPointTs) / 1000, 0), DELTA_MAX_SECONDS)
          : 1;
        // Sticky power source, but a power meter that goes stale (watchdog
        // zeroed, no packets for 3+ s) hands control back to the sensor so a
        // dead battery mid-ride does not freeze the calorie count.
        const hasPowerSource = (state.hasPowerSource || (data.power || 0) > 0) && !stalePower;
        const nextAccumulator = calculateSessionCalories(
          data,
          startCalories,
          state.calorieAccumulator,
          hasPowerSource,
          deltaSeconds
        );
        const point: HistoryData = {
          time: timeStr,
          ts: nowMs,
          hr: data.heartRate || 0,
          cadence: data.cadence || 0,
          power: data.power || 0,
          speed: data.speed || 0,
          distance: Math.max(0, (data.distance || 0) - startDistance),
          resistance: data.resistance || 0,
          calories: nextAccumulator,
          staleHr,
          stalePower,
          staleCadence,
          staleSpeed
        };
        const newHistory = [...state.history, point];

        const nextTotals = addPointToTotals(state.liveStatsTotals, point, deltaSeconds);
        const nextLiveStats = statsFromTotals(
          nextTotals,
          {
            maxHr: Math.max(state.liveStats.maxHr, point.hr),
            maxPower: Math.max(state.liveStats.maxPower, point.power),
            maxCadence: Math.max(state.liveStats.maxCadence, point.cadence),
            maxSpeed: Math.max(state.liveStats.maxSpeed, point.speed || 0)
          },
          state.hrrScore,
          state.hrrClassification
        );
        const nextState = {
          ...state,
          history: newHistory,
          calorieAccumulator: nextAccumulator,
          hasPowerSource,
          lastHistoryPointTs: nowMs
        };
        persistActiveSession(nextState);
        return {
          history: newHistory,
          liveStats: nextLiveStats,
          liveStatsTotals: nextTotals,
          calorieAccumulator: nextAccumulator,
          hasPowerSource,
          lastHistoryPointTs: nowMs
        };
      });
    },

    setHrrResult: (score, classification) => {
      set((state) => ({
        hrrScore: score,
        hrrClassification: classification,
        liveStats: {
          ...state.liveStats,
          hrrScore: score,
          hrrClassification: classification
        }
      }));
    },

    saveSession: async () => {
      // Re-entrancy guard: a fast double-click could fire a second call
      // before the Save button re-renders disabled.
      if (get().isSavingSession) return;

      const { history, elapsed, sessionHistory, sessionStartTime } = get();
      if (!sessionStartTime) return;

      // A session without any history point carries no metrics worth saving;
      // computing stats from an empty array would yield NaN/-Infinity.
      if (history.length === 0) {
        get().discardSession();
        return;
      }

      // Pushes the save progress bar forward. The modal keeps rendering while
      // the store is saving, so every update here is visible immediately.
      const reportProgress = (saveSessionProgress: number, saveSessionPhase: SaveSessionPhase) => {
        set({ isSavingSession: true, saveSessionProgress, saveSessionPhase });
      };

      try {
        // Let the browser paint the "Saving…" state before heavy work starts,
        // so the click never looks like a freeze.
        reportProgress(5, 'preparing');
        await new Promise(resolve => setTimeout(resolve, 0));

        const computed = calculateLiveStats(history, get().hrrScore, get().hrrClassification);
        const stats = {
          avgHr: computed.stats.avgHr,
          maxHr: computed.stats.maxHr,
          avgPower: computed.stats.avgPower,
          maxPower: computed.stats.maxPower,
          avgCadence: computed.stats.avgCadence,
          maxCadence: computed.stats.maxCadence,
          avgSpeed: computed.stats.avgSpeed,
          maxSpeed: computed.stats.maxSpeed,
          hrrScore: get().hrrScore !== null ? get().hrrScore! : undefined,
          hrrClassification: get().hrrClassification !== null ? get().hrrClassification! : undefined,
        };

        const newSession: WorkoutSession = {
          id: `session_${Date.now()}`,
          sessionStartTime,
          date: new Date(sessionStartTime).toISOString(),
          duration: elapsed,
          stats,
          history,
          synced_to_google: false,
          synced_to_supabase: false
        };

        // Persist full local data through IndexedDB; localStorage keeps only a compact fallback.
        reportProgress(20, 'local');
        const updatedHistory = [newSession, ...sessionHistory];
        set({ sessionHistory: updatedHistory });
        await persistSessionHistory(updatedHistory);

        // Save to Supabase (Background). This is the slowest step (config
        // fetch + row lookup + insert of the full history payload), so the
        // bar holds at 40% with an animated shimmer until it settles.
        reportProgress(40, 'sync');
        const syncedSession = await syncSessionToSupabase(newSession);
        if (!syncedSession.synced_to_supabase && syncedSession.supabase_sync_error) {
          console.warn('[Supabase] Workout sync pending:', syncedSession.supabase_sync_error);
        }

        reportProgress(80, 'finalizing');
        set((state) => {
          const nextHistory = state.sessionHistory.map(session =>
            session.id === syncedSession.id ? syncedSession : session
          );
          persistSessionHistory(nextHistory);
          return { sessionHistory: nextHistory };
        });

        // Clear current workout after saving
        reportProgress(95, 'finalizing');
        get().discardSession();

        // Hold the completed state briefly so the modal shows "Saved ✓"
        // before the caller closes it.
        reportProgress(100, 'done');
        await new Promise(resolve => setTimeout(resolve, 350));
      } catch (error) {
        console.error('Failed to save workout session:', error);
        set({ isSavingSession: false, saveSessionPhase: 'idle' });
        throw error;
      } finally {
        set({ isSavingSession: false, saveSessionPhase: 'idle' });
      }
    },

    syncPendingSupabaseSessions: async () => {
      const pendingSessions = get().sessionHistory.filter(session => !session.synced_to_supabase);
      if (pendingSessions.length === 0) return;

      let nextHistory = get().sessionHistory;

      for (const pendingSession of pendingSessions) {
        const syncedSession = await syncSessionToSupabase(pendingSession);
        nextHistory = nextHistory.map(session =>
          getSessionKey(session) === getSessionKey(syncedSession) ? syncedSession : session
        );

        set({ sessionHistory: nextHistory });
        persistSessionHistory(nextHistory);

        if (!syncedSession.synced_to_supabase && syncedSession.supabase_sync_error) {
          console.warn('[Supabase] Pending workout sync failed:', syncedSession.supabase_sync_error);
        }
      }

      const firstFailure = nextHistory.find(session =>
        !session.synced_to_supabase && session.supabase_sync_error_code
      );
      if (firstFailure?.supabase_sync_error_code) {
        const info = classifySupabaseError({
          message: firstFailure.supabase_sync_error,
          code: firstFailure.supabase_sync_error_code,
        });
        set({ supabaseSyncError: info });
      } else {
        set({ supabaseSyncError: null });
      }
    },

    importTCX: async (tcxContent, filename = 'TCX file') => {
      const importedSessions = parseTCXWorkoutSessions(tcxContent);
      const result: ImportTcxResult = {
        imported: 0,
        skipped: 0,
        synced: 0,
        pending: 0,
        messages: []
      };

      let nextHistory = get().sessionHistory;

      for (const importedSession of importedSessions) {
        const localDuplicate = nextHistory.find(session =>
          session.sessionStartTime === importedSession.sessionStartTime ||
          isPotentialDuplicateSession(session, importedSession)
        );

        if (localDuplicate) {
          result.skipped += 1;
          result.messages.push(`${new Date(importedSession.sessionStartTime).toLocaleString()} already exists locally.`);
          continue;
        }

        let remoteDuplicate: WorkoutSession | null = null;
        try {
          remoteDuplicate = await findSupabaseDuplicate(importedSession);
        } catch (err) {
          result.messages.push(`Could not check Supabase duplicate for ${filename}: ${err instanceof Error ? err.message : String(err)}`);
        }

        if (remoteDuplicate) {
          result.skipped += 1;
          nextHistory = mergeSessionHistories(nextHistory, [remoteDuplicate]);
          set({ sessionHistory: nextHistory });
          persistSessionHistory(nextHistory);
          result.messages.push(`${new Date(importedSession.sessionStartTime).toLocaleString()} already exists in Supabase.`);
          continue;
        }

        nextHistory = mergeSessionHistories(nextHistory, [importedSession]);
        set({ sessionHistory: nextHistory });
        persistSessionHistory(nextHistory);
        result.imported += 1;

        const syncedSession = await syncSessionToSupabase(importedSession);
        nextHistory = nextHistory.map(session =>
          getSessionKey(session) === getSessionKey(syncedSession) ? syncedSession : session
        );
        set({ sessionHistory: nextHistory });
        persistSessionHistory(nextHistory);

        if (syncedSession.synced_to_supabase) {
          result.synced += 1;
        } else {
          result.pending += 1;
          result.messages.push(`${new Date(importedSession.sessionStartTime).toLocaleString()} imported locally, Supabase sync pending.`);
        }
      }

      if (result.imported === 0 && result.skipped === 0) {
        result.messages.push(`No importable sessions found in ${filename}.`);
      }

      return result;
    },

    deleteSession: async (sessionId) => {
      const { sessionHistory } = get();
      const target = sessionHistory.find(session => session.id === sessionId);
      if (!target) {
        return { success: false, message: 'Workout session not found.' };
      }

      // Delete the cloud copy first (when synced) so the session does not
      // reappear after the next remote history load.
      if (target.supabase_id) {
        const client = await getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('workouts')
            .delete()
            .eq('id', target.supabase_id);

          if (error) {
            const info = classifySupabaseError(error);
            return { success: false, message: info.userMessage };
          }

          // supabase-js returns the deleted rows. An empty result without an
          // error means no row matched — typically an RLS DELETE policy that
          // blocks the anon role (the row still exists in the cloud and would
          // reappear on the next load). Verify the row is actually gone before
          // deleting locally.
          const deletedRows = data as Array<Record<string, unknown>> | null;
          const deletedCount = deletedRows ? deletedRows.length : 0;
          if (deletedCount === 0) {
            const { data: stillThere, error: checkError } = await client
              .from('workouts')
              .select('id')
              .eq('id', target.supabase_id)
              .maybeSingle();

            if (!checkError && stillThere) {
              return {
                success: false,
                message: 'The cloud copy could not be deleted. Add a DELETE policy for the anon role on the workouts table (see README), then try again.'
              };
            }
          }
        } else {
          console.warn(
            '[Supabase] Client unavailable; deleting workout locally only. It may reappear after the next cloud sync.'
          );
        }
      }

      const nextHistory = sessionHistory.filter(session => session.id !== sessionId);
      set({ sessionHistory: nextHistory });
      persistSessionHistory(nextHistory);
      return { success: true };
    },

    discardSession: () => {
      set({
        history: [],
        elapsed: 0,
        sessionStartTime: null,
        calorieAccumulator: 0,
        hasPowerSource: false,
        lastHistoryPointTs: null,
        isRecording: false,
        hrrScore: null,
        hrrClassification: null,
        liveStats: EMPTY_LIVE_STATS,
        liveStatsTotals: EMPTY_LIVE_TOTALS
      });
      persistActiveSession({
        isRecording: false,
        elapsed: 0,
        sessionStartTime: null,
        startDistance: 0,
        startCalories: 0,
        calorieAccumulator: 0,
        hasPowerSource: false,
        lastHistoryPointTs: null,
        history: []
      }, { immediate: true });
    },

    loadHistory: () => {
      const applySessions = (sessions: WorkoutSession[]) => {
        const normalizedSessions = sessions.map((session: WorkoutSession) => ({
          ...session,
          date: getWorkoutDateISOString(session),
          synced_to_supabase: Boolean(session.synced_to_supabase || session.supabase_id)
        }));

        set({ sessionHistory: normalizedSessions });
        return normalizedSessions;
      };

      const applyActiveSession = (activeSession: ActiveSessionSnapshot) => {
        if (!activeSession.sessionStartTime) return;

        console.log('[Recovery] Restoring active session from local storage:', activeSession);
        const restoredHistory = activeSession.history || [];
        const restoredLiveStats = calculateLiveStats(restoredHistory);
        const lastPoint = restoredHistory[restoredHistory.length - 1];
        const lastPointTs = typeof activeSession.lastHistoryPointTs === 'number'
          ? activeSession.lastHistoryPointTs
          : lastPoint?.ts;
        const nowMs = Date.now();
        const lastHistoryPointTs = lastPointTs ?? nowMs;
        // A long gap since the last recorded point means the app was closed in
        // the middle of the session. Shift the wall-clock base forward so dead
        // time (hours/days) is not counted into the saved duration. Legacy
        // snapshots carry no timestamps: fall back to wall age minus elapsed.
        const gapSeconds = lastPointTs !== undefined
          ? (nowMs - lastPointTs) / 1000
          : (nowMs - activeSession.sessionStartTime) / 1000 - (activeSession.elapsed || 0);
        const sessionStartTime = gapSeconds > RECOVERY_GRACE_SECONDS
          ? nowMs - ((activeSession.elapsed || 0) + RECOVERY_GRACE_SECONDS) * 1000
          : activeSession.sessionStartTime;
        set({
          isRecording: activeSession.isRecording || false,
          elapsed: activeSession.elapsed || 0,
          sessionStartTime,
          startDistance: activeSession.startDistance || 0,
          startCalories: activeSession.startCalories || 0,
          calorieAccumulator: typeof activeSession.calorieAccumulator === 'number'
            ? activeSession.calorieAccumulator
            : computeCalorieAccumulator(restoredHistory, activeSession.elapsed || 0),
          hasPowerSource: typeof activeSession.hasPowerSource === 'boolean'
            ? activeSession.hasPowerSource
            : restoredHistory.some(point => point.power > 0),
          lastHistoryPointTs,
          history: restoredHistory,
          liveStats: restoredLiveStats.stats,
          liveStatsTotals: restoredLiveStats.totals
        });
      };

      let localSessions: WorkoutSession[] = [];
      let localActiveSession: ActiveSessionSnapshot | null = null;

      // 1. Load compact localStorage fallback immediately for first paint and legacy data.
      try {
        const saved = localStorage.getItem(SESSION_HISTORY_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          localSessions = Array.isArray(parsed) ? applySessions(parsed) : [];
        }
      } catch (e) {
        console.warn('Failed to load session history from localStorage:', e);
      }

      try {
        const activeSession = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        if (activeSession) {
          const parsed = JSON.parse(activeSession);
          if (parsed && parsed.sessionStartTime) {
            localActiveSession = parsed;
            applyActiveSession(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to recover active session from localStorage:', e);
      }

      // 2. Replace the compact fallback with full IndexedDB data when available.
      if (typeof window !== 'undefined') {
        getWorkoutStorageValue<WorkoutSession[]>(SESSION_HISTORY_STORAGE_KEY)
          .then(indexedDbSessions => {
            if (Array.isArray(indexedDbSessions)) {
              applySessions(indexedDbSessions);
              return;
            }

            if (localSessions.length > 0) {
              persistSessionHistoryToIndexedDb(localSessions);
            }
          })
          .catch(error => {
            console.warn('Failed to load session history from IndexedDB:', error);
          });

        getWorkoutStorageValue<ActiveSessionSnapshot>(ACTIVE_SESSION_STORAGE_KEY)
          .then(indexedDbActiveSession => {
            if (indexedDbActiveSession?.sessionStartTime) {
              applyActiveSession(indexedDbActiveSession);
              return;
            }

            if (localActiveSession?.sessionStartTime) {
              persistActiveSessionToIndexedDb(localActiveSession);
            }
          })
          .catch(error => {
            console.warn('Failed to recover active session from IndexedDB:', error);
          });
      }
    },

    loadHistoryFromSupabase: async () => {
      try {
        const client = await getSupabaseClient();
        if (!client) {
          console.warn('[Supabase] Client not available. Skipping load (config not set).');
          return;
        }

        const { data, error } = await client
          .from('workouts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(0, SUPABASE_HISTORY_PAGE_SIZE - 1);

        if (error) throw error;

        if (data) {
          const mappedSessions: WorkoutSession[] = data.map(mapSupabaseWorkout);
          const mergedSessions = mergeSessionHistories(get().sessionHistory, mappedSessions);
          set({
            sessionHistory: mergedSessions,
            supabaseHistoryLoadedCount: data.length,
            hasMoreSupabaseHistory: data.length === SUPABASE_HISTORY_PAGE_SIZE,
            supabaseSyncError: null
          });
          persistSessionHistory(mergedSessions);
        }
      } catch (err) {
        const info = classifySupabaseError(err);
        console.error('Failed to fetch from Supabase:', err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err) ?? String(err));
        set({ supabaseSyncError: info });
      }
    },

    loadMoreHistoryFromSupabase: async () => {
      try {
        const client = await getSupabaseClient();
        if (!client) {
          console.warn('[Supabase] Client not available. Skipping older history load (config not set).');
          return;
        }

        const from = get().supabaseHistoryLoadedCount;
        const to = from + SUPABASE_HISTORY_PAGE_SIZE - 1;
        const { data, error } = await client
          .from('workouts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const remoteSessions = (data || []).map(mapSupabaseWorkout);
        const mergedSessions = mergeSessionHistories(get().sessionHistory, remoteSessions);
        set({
          sessionHistory: mergedSessions,
          supabaseHistoryLoadedCount: from + (data?.length || 0),
          hasMoreSupabaseHistory: (data?.length || 0) === SUPABASE_HISTORY_PAGE_SIZE,
          supabaseSyncError: null
        });
        persistSessionHistory(mergedSessions);
      } catch (err) {
        const info = classifySupabaseError(err);
        console.error('Failed to fetch older sessions from Supabase:', err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err) ?? String(err));
        set({ supabaseSyncError: info });
      }
    },

    clearSupabaseSyncError: () => {
      set({ supabaseSyncError: null });
    },

    formatTime: (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  };
};
