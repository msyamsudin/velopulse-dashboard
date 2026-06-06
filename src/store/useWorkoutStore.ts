import { create } from 'zustand';
import { BluetoothData, useBluetoothStore } from './useBluetoothStore';
import { getSupabaseClient } from '@/lib/supabase';
import { parseTCXWorkoutSessions } from '@/lib/tcx-import-service';

export interface HistoryData {
  time: string;
  hr: number;
  cadence: number;
  power: number;
  speed: number;
  distance: number;
  resistance: number;
  calories: number;
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
    hrrScore?: number;
    hrrClassification?: string;
  };
  history: HistoryData[];
  synced_to_google?: boolean;
  synced_to_supabase?: boolean;
  supabase_id?: string;
  supabase_synced_at?: string;
  supabase_sync_error?: string;
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

interface LiveWorkoutTotals {
  count: number;
  hr: number;
  power: number;
  cadence: number;
  speed: number;
}

export interface ImportTcxResult {
  imported: number;
  skipped: number;
  synced: number;
  pending: number;
  messages: string[];
}

interface WorkoutState {
  isRecording: boolean;
  elapsed: number;
  sessionStartTime: number | null;
  startDistance: number;
  startCalories: number;
  history: HistoryData[];
  sessionHistory: WorkoutSession[];
  hrrScore: number | null;
  hrrClassification: string | null;
  liveStats: LiveWorkoutStats;
  liveStatsTotals: LiveWorkoutTotals;
  supabaseHistoryLoadedCount: number;
  hasMoreSupabaseHistory: boolean;
  
  // Actions
  toggleRecording: () => void;
  incrementElapsed: () => void;
  addHistoryPoint: (data: BluetoothData) => void;
  setHrrResult: (score: number, classification: string) => void;
  saveSession: () => Promise<void>;
  syncPendingSupabaseSessions: () => Promise<void>;
  importTCX: (tcxContent: string, filename?: string) => Promise<ImportTcxResult>;
  discardSession: () => void;
  loadHistory: () => void;
  loadHistoryFromSupabase: () => Promise<void>;
  loadMoreHistoryFromSupabase: () => Promise<void>;
  markAsSynced: (startTime: number) => Promise<void>;
  formatTime: (seconds: number) => string;
}

const SUPABASE_HISTORY_PAGE_SIZE = 50;
const ACTIVE_SESSION_PERSIST_INTERVAL_MS = 5000;

const EMPTY_LIVE_STATS: LiveWorkoutStats = {
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

const EMPTY_LIVE_TOTALS: LiveWorkoutTotals = {
  count: 0,
  hr: 0,
  power: 0,
  cadence: 0,
  speed: 0
};

const calculateLiveStats = (
  history: HistoryData[],
  hrrScore: number | null = null,
  hrrClassification: string | null = null
) => {
  if (history.length === 0) {
    return {
      stats: { ...EMPTY_LIVE_STATS, hrrScore, hrrClassification },
      totals: { ...EMPTY_LIVE_TOTALS }
    };
  }

  const aggregate = history.reduce((acc, point) => ({
    totals: {
      count: acc.totals.count + 1,
      hr: acc.totals.hr + point.hr,
      power: acc.totals.power + point.power,
      cadence: acc.totals.cadence + point.cadence,
      speed: acc.totals.speed + (point.speed || 0)
    },
    maxHr: Math.max(acc.maxHr, point.hr),
    maxPower: Math.max(acc.maxPower, point.power),
    maxCadence: Math.max(acc.maxCadence, point.cadence),
    maxSpeed: Math.max(acc.maxSpeed, point.speed || 0)
  }), {
    totals: { ...EMPTY_LIVE_TOTALS },
    maxHr: 0,
    maxPower: 0,
    maxCadence: 0,
    maxSpeed: 0
  });

  const { totals } = aggregate;

  return {
    stats: {
      avgHr: Math.round(totals.hr / totals.count),
      maxHr: aggregate.maxHr,
      avgPower: Math.round(totals.power / totals.count),
      maxPower: aggregate.maxPower,
      avgCadence: Math.round(totals.cadence / totals.count),
      maxCadence: aggregate.maxCadence,
      avgSpeed: Number((totals.speed / totals.count).toFixed(1)),
      maxSpeed: Number(aggregate.maxSpeed.toFixed(1)),
      hrrScore,
      hrrClassification
    },
    totals
  };
};

type ActiveSessionSnapshot = {
  isRecording: boolean;
  elapsed: number;
  sessionStartTime: number | null;
  startDistance: number;
  startCalories: number;
  history: HistoryData[];
};

let pendingActiveSessionSnapshot: ActiveSessionSnapshot | null = null;
let activeSessionPersistTimer: ReturnType<typeof setTimeout> | null = null;
let lastActiveSessionPersistAt = 0;
let hasActiveSessionFlushListener = false;

const writeActiveSession = (state: ActiveSessionSnapshot) => {
  if (typeof window === 'undefined') return;
  try {
    if (state.sessionStartTime === null) {
      localStorage.removeItem('velopulse_active_session');
    } else {
      localStorage.setItem('velopulse_active_session', JSON.stringify({
        isRecording: state.isRecording,
        elapsed: state.elapsed,
        sessionStartTime: state.sessionStartTime,
        startDistance: state.startDistance,
        startCalories: state.startCalories,
        history: state.history
      }));
    }
  } catch (e) {
    console.error('Failed to persist active session to localStorage:', e);
  }
};

const persistActiveSession = (
  state: ActiveSessionSnapshot,
  options: { immediate?: boolean } = {}
) => {
  if (typeof window === 'undefined') return;

  if (!hasActiveSessionFlushListener) {
    const flushPendingSnapshot = () => {
      if (pendingActiveSessionSnapshot) {
        writeActiveSession(pendingActiveSessionSnapshot);
        pendingActiveSessionSnapshot = null;
        lastActiveSessionPersistAt = Date.now();
      }
    };
    window.addEventListener('pagehide', flushPendingSnapshot);
    window.addEventListener('beforeunload', flushPendingSnapshot);
    hasActiveSessionFlushListener = true;
  }

  if (options.immediate) {
    if (activeSessionPersistTimer) {
      clearTimeout(activeSessionPersistTimer);
      activeSessionPersistTimer = null;
    }
    pendingActiveSessionSnapshot = null;
    writeActiveSession(state);
    lastActiveSessionPersistAt = Date.now();
    return;
  }

  pendingActiveSessionSnapshot = state;

  const now = Date.now();
  const elapsedSinceLastPersist = now - lastActiveSessionPersistAt;
  if (elapsedSinceLastPersist >= ACTIVE_SESSION_PERSIST_INTERVAL_MS) {
    if (activeSessionPersistTimer) {
      clearTimeout(activeSessionPersistTimer);
      activeSessionPersistTimer = null;
    }
    const snapshot = pendingActiveSessionSnapshot;
    pendingActiveSessionSnapshot = null;
    if (snapshot) {
      writeActiveSession(snapshot);
      lastActiveSessionPersistAt = now;
    }
    return;
  }

  if (!activeSessionPersistTimer) {
    activeSessionPersistTimer = setTimeout(() => {
      activeSessionPersistTimer = null;
      const snapshot = pendingActiveSessionSnapshot;
      pendingActiveSessionSnapshot = null;
      if (snapshot) {
        writeActiveSession(snapshot);
        lastActiveSessionPersistAt = Date.now();
      }
    }, ACTIVE_SESSION_PERSIST_INTERVAL_MS - elapsedSinceLastPersist);
  }
};

const persistSessionHistory = (sessions: WorkoutSession[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('velopulse_sessions', JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to persist session history to localStorage:', e);
  }
};

const getSessionKey = (session: Pick<WorkoutSession, 'id' | 'sessionStartTime'>) =>
  session.sessionStartTime ? `start:${session.sessionStartTime}` : `id:${session.id}`;

const getSessionStartTimestamp = (session: Pick<WorkoutSession, 'sessionStartTime' | 'date'>) => {
  if (Number.isFinite(session.sessionStartTime) && session.sessionStartTime > 0) {
    return session.sessionStartTime;
  }

  const parsedDate = Date.parse(session.date);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
};

const getWorkoutDateISOString = (session: Pick<WorkoutSession, 'sessionStartTime' | 'date'>) => {
  const timestamp = getSessionStartTimestamp(session);
  return timestamp > 0 ? new Date(timestamp).toISOString() : session.date;
};

const isPotentialDuplicateSession = (a: WorkoutSession, b: WorkoutSession) => {
  const startDiffSeconds = Math.abs(a.sessionStartTime - b.sessionStartTime) / 1000;
  const durationDiffSeconds = Math.abs(a.duration - b.duration);
  const aDistance = a.history[a.history.length - 1]?.distance || 0;
  const bDistance = b.history[b.history.length - 1]?.distance || 0;
  const distanceDiffMeters = Math.abs(aDistance - bDistance);

  return startDiffSeconds <= 60 && durationDiffSeconds <= 10 && distanceDiffMeters <= 50;
};

const sortSessions = (sessions: WorkoutSession[]) =>
  [...sessions].sort((a, b) => getSessionStartTimestamp(b) - getSessionStartTimestamp(a));

const mergeSessionHistories = (localSessions: WorkoutSession[], remoteSessions: WorkoutSession[]) => {
  const merged = new Map<string, WorkoutSession>();

  for (const session of remoteSessions) {
    merged.set(getSessionKey(session), session);
  }

  for (const session of localSessions) {
    const key = getSessionKey(session);
    const remote = merged.get(key);
    if (!remote) {
      merged.set(key, session);
      continue;
    }

    merged.set(key, {
      ...session,
      ...remote,
      synced_to_google: session.synced_to_google || remote.synced_to_google,
      synced_to_supabase: true,
      supabase_id: remote.supabase_id,
      supabase_synced_at: remote.supabase_synced_at,
      supabase_sync_error: undefined
    });
  }

  return sortSessions(Array.from(merged.values()));
};

const mapSupabaseWorkout = (item: any): WorkoutSession => {
  const sessionStartTime = Number(item.session_start_time) || Date.parse(item.created_at) || 0;

  return {
    id: item.id,
    sessionStartTime,
    date: sessionStartTime > 0 ? new Date(sessionStartTime).toISOString() : item.created_at,
    duration: item.duration,
    stats: item.stats,
    history: item.history,
    synced_to_google: item.synced_to_google,
    synced_to_supabase: true,
    supabase_id: item.id,
    supabase_synced_at: item.created_at,
    supabase_sync_error: undefined
  };
};

const findSupabaseDuplicate = async (session: WorkoutSession) => {
  const client = await getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('workouts')
    .select('*')
    .eq('session_start_time', session.sessionStartTime)
    .limit(1);

  if (error) throw error;
  return data?.[0] ? mapSupabaseWorkout(data[0]) : null;
};

const buildSupabasePayload = (session: WorkoutSession) => ({
  session_start_time: session.sessionStartTime,
  duration: session.duration,
  stats: session.stats,
  history: session.history,
  synced_to_google: Boolean(session.synced_to_google)
});

const syncSessionToSupabase = async (session: WorkoutSession): Promise<WorkoutSession> => {
  const client = await getSupabaseClient();
  if (!client) {
    return {
      ...session,
      synced_to_supabase: false,
      supabase_sync_error: 'Supabase config unavailable'
    };
  }

  try {
    const payload = buildSupabasePayload(session);
    const { data: existingRows, error: lookupError } = await client
      .from('workouts')
      .select('id, created_at, synced_to_google')
      .eq('session_start_time', session.sessionStartTime)
      .limit(1);

    if (lookupError) throw lookupError;

    const existing = existingRows?.[0];
    if (existing) {
      const updatePayload = {
        ...payload,
        synced_to_google: Boolean(session.synced_to_google || existing.synced_to_google)
      };
      const { error: updateError } = await client
        .from('workouts')
        .update(updatePayload)
        .eq('id', existing.id);

      if (updateError) throw updateError;

      return {
        ...session,
        synced_to_google: Boolean(session.synced_to_google || existing.synced_to_google),
        synced_to_supabase: true,
        supabase_id: existing.id,
        supabase_synced_at: new Date().toISOString(),
        supabase_sync_error: undefined
      };
    }

    const { data, error } = await client
      .from('workouts')
      .insert([payload])
      .select('id, created_at')
      .single();

    if (error) throw error;

    return {
      ...session,
      synced_to_supabase: true,
      supabase_id: data?.id,
      supabase_synced_at: new Date().toISOString(),
      supabase_sync_error: undefined
    };
  } catch (err: any) {
    return {
      ...session,
      synced_to_supabase: false,
      supabase_sync_error: err?.message || JSON.stringify(err) || 'Supabase sync failed'
    };
  }
};

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  isRecording: false,
  elapsed: 0,
  sessionStartTime: null,
  startDistance: 0,
  startCalories: 0,
  history: [],
  sessionHistory: [],
  hrrScore: null,
  hrrClassification: null,
  liveStats: EMPTY_LIVE_STATS,
  liveStatsTotals: EMPTY_LIVE_TOTALS,
  supabaseHistoryLoadedCount: 0,
  hasMoreSupabaseHistory: false,

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
      const nextElapsed = state.elapsed + 1;
      const nextState = { ...state, elapsed: nextElapsed };
      persistActiveSession(nextState);
      return { elapsed: nextElapsed };
    });
  },

  addHistoryPoint: (data) => {
    if (!get().isRecording) return;
    const { startDistance, startCalories } = get();
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // To prevent timeline stretching, don't add multiple points for the same second
    const lastPoint = get().history[get().history.length - 1];
    if (lastPoint && lastPoint.time === timeStr) return;

    set((state) => {
      const point = {
        time: timeStr,
        hr: data.heartRate || 0,
        cadence: data.cadence || 0,
        power: data.power || 0,
        speed: data.speed || 0,
        distance: Math.max(0, (data.distance || 0) - startDistance),
        resistance: data.resistance || 0,
        calories: Math.max(0, (data.calories || 0) - startCalories)
      };
      const newHistory = [...state.history, point];
      const nextTotals = {
        count: state.liveStatsTotals.count + 1,
        hr: state.liveStatsTotals.hr + point.hr,
        power: state.liveStatsTotals.power + point.power,
        cadence: state.liveStatsTotals.cadence + point.cadence,
        speed: state.liveStatsTotals.speed + (point.speed || 0)
      };
      const nextLiveStats = {
        avgHr: Math.round(nextTotals.hr / nextTotals.count),
        maxHr: Math.max(state.liveStats.maxHr, point.hr),
        avgPower: Math.round(nextTotals.power / nextTotals.count),
        maxPower: Math.max(state.liveStats.maxPower, point.power),
        avgCadence: Math.round(nextTotals.cadence / nextTotals.count),
        maxCadence: Math.max(state.liveStats.maxCadence, point.cadence),
        avgSpeed: Number((nextTotals.speed / nextTotals.count).toFixed(1)),
        maxSpeed: Number(Math.max(state.liveStats.maxSpeed, point.speed || 0).toFixed(1)),
        hrrScore: state.hrrScore,
        hrrClassification: state.hrrClassification
      };
      const nextState = { ...state, history: newHistory };
      persistActiveSession(nextState);
      return {
        history: newHistory,
        liveStats: nextLiveStats,
        liveStatsTotals: nextTotals
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
    const { history, elapsed, sessionHistory, sessionStartTime } = get();
    if (!sessionStartTime) return;

    // Allow saving if there's history OR if there's significant elapsed time
    if (history.length === 0 && elapsed < 1) {
      get().discardSession();
      return;
    }

    const stats = {
      avgHr: Math.round(history.reduce((a, b) => a + b.hr, 0) / history.length) || 0,
      maxHr: Math.max(...history.map(h => h.hr)) || 0,
      avgPower: Math.round(history.reduce((a, b) => a + b.power, 0) / history.length) || 0,
      maxPower: Math.max(...history.map(h => h.power)) || 0,
      avgCadence: Math.round(history.reduce((a, b) => a + b.cadence, 0) / history.length) || 0,
      maxCadence: Math.max(...history.map(h => h.cadence)) || 0,
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

    // Save to LocalStorage first
    const updatedHistory = [newSession, ...sessionHistory];
    set({ sessionHistory: updatedHistory });
    persistSessionHistory(updatedHistory);

    // Save to Supabase (Background)
    const syncedSession = await syncSessionToSupabase(newSession);
    if (!syncedSession.synced_to_supabase && syncedSession.supabase_sync_error) {
      console.warn('[Supabase] Workout sync pending:', syncedSession.supabase_sync_error);
    }

    set((state) => {
      const nextHistory = state.sessionHistory.map(session =>
        session.id === syncedSession.id ? syncedSession : session
      );
      persistSessionHistory(nextHistory);
      return { sessionHistory: nextHistory };
    });
    
    // Clear current workout after saving
    get().discardSession();
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
      } catch (err: any) {
        result.messages.push(`Could not check Supabase duplicate for ${filename}: ${err?.message || err}`);
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

  discardSession: () => {
    set({
      history: [],
      elapsed: 0,
      sessionStartTime: null,
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
      history: []
    }, { immediate: true });
  },

  loadHistory: () => {
    // 1. Load general workout session history
    const saved = localStorage.getItem('velopulse_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sessions = Array.isArray(parsed)
          ? parsed.map((session: WorkoutSession) => ({
              ...session,
              date: getWorkoutDateISOString(session),
              synced_to_supabase: Boolean(session.synced_to_supabase || session.supabase_id)
            }))
          : [];
        set({ sessionHistory: sessions });
        persistSessionHistory(sessions);
      } catch (e) {
        console.error('Failed to load session history');
      }
    }

    // 2. Recover active workout session if it exists from a previous crash/reload
    if (typeof window !== 'undefined') {
      try {
        const activeSession = localStorage.getItem('velopulse_active_session');
        if (activeSession) {
          const parsed = JSON.parse(activeSession);
          if (parsed && parsed.sessionStartTime) {
            console.log('[Recovery] Restoring active session from crash/reload:', parsed);
            const restoredHistory = parsed.history || [];
            const restoredLiveStats = calculateLiveStats(restoredHistory);
            set({
              isRecording: parsed.isRecording || false,
              elapsed: parsed.elapsed || 0,
              sessionStartTime: parsed.sessionStartTime,
              startDistance: parsed.startDistance || 0,
              startCalories: parsed.startCalories || 0,
              history: restoredHistory,
              liveStats: restoredLiveStats.stats,
              liveStatsTotals: restoredLiveStats.totals
            });
          }
        }
      } catch (e) {
        console.error('Failed to recover active session:', e);
      }
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
          hasMoreSupabaseHistory: data.length === SUPABASE_HISTORY_PAGE_SIZE
        });
        persistSessionHistory(mergedSessions);
      }
    } catch (err: any) {
      console.error('Failed to fetch from Supabase:', err?.message || JSON.stringify(err) || err);
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
        hasMoreSupabaseHistory: (data?.length || 0) === SUPABASE_HISTORY_PAGE_SIZE
      });
      persistSessionHistory(mergedSessions);
    } catch (err: any) {
      console.error('Failed to fetch older sessions from Supabase:', err?.message || JSON.stringify(err) || err);
    }
  },

  markAsSynced: async (startTime: number) => {
    try {
      const client = await getSupabaseClient();
      if (!client) {
        console.warn('[Supabase] Client not available. Skipping markAsSynced (config not set).');
        return;
      }

      await client
        .from('workouts')
        .update({ synced_to_google: true })
        .eq('session_start_time', startTime);
      
      // Also update local state if needed
      set((state) => ({
        sessionHistory: state.sessionHistory.map(s => 
          s.sessionStartTime === startTime ? { ...s, synced_to_google: true } : s
        )
      }));
      persistSessionHistory(get().sessionHistory);
    } catch (err: any) {
      console.error('Failed to update sync status in Supabase:', err?.message || JSON.stringify(err) || err);
    }
  },

  formatTime: (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}));
