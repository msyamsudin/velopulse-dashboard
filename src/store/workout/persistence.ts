import {
  ACTIVE_SESSION_HISTORY_POINT_LIMITS,
  ACTIVE_SESSION_PERSIST_INTERVAL_MS,
  ACTIVE_SESSION_STORAGE_KEY,
  SESSION_HISTORY_STORAGE_ATTEMPTS,
  SESSION_HISTORY_STORAGE_KEY,
  WORKOUT_INDEXED_DB_NAME,
  WORKOUT_INDEXED_DB_STORE,
  WORKOUT_INDEXED_DB_VERSION,
} from './constants';
import type { ActiveSessionSnapshot, HistoryData, WorkoutSession } from './types';

let pendingActiveSessionSnapshot: ActiveSessionSnapshot | null = null;
let activeSessionPersistTimer: ReturnType<typeof setTimeout> | null = null;
let lastActiveSessionPersistAt = 0;
let hasActiveSessionFlushListener = false;
let warnedActiveSessionStorageQuota = false;
let warnedSessionHistoryFallbackStorageFailure = false;
let workoutDatabasePromise: Promise<IDBDatabase | null> | null = null;
let activeSessionIndexedDbQueue: Promise<void> = Promise.resolve();
let sessionHistoryIndexedDbQueue: Promise<void> = Promise.resolve();

export const isStorageQuotaError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { name?: string; code?: number };
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014
  );
};

export const sampleHistoryPoints = (history: HistoryData[], maxPoints: number) => {
  if (history.length <= maxPoints) return history;
  if (maxPoints <= 0) return [];
  if (maxPoints === 1) return [history[history.length - 1]];

  const sampled: HistoryData[] = [];
  const lastIndex = history.length - 1;
  let previousIndex = -1;

  for (let i = 0; i < maxPoints; i += 1) {
    const nextIndex = Math.round((i * lastIndex) / (maxPoints - 1));
    if (nextIndex !== previousIndex) {
      sampled.push(history[nextIndex]);
      previousIndex = nextIndex;
    }
  }

  return sampled;
};

export const buildActiveSessionStorageSnapshot = (
  state: ActiveSessionSnapshot,
  maxHistoryPoints = state.history.length
) => ({
  isRecording: state.isRecording,
  elapsed: state.elapsed,
  sessionStartTime: state.sessionStartTime,
  startDistance: state.startDistance,
  startCalories: state.startCalories,
  calorieAccumulator: state.calorieAccumulator,
  hasPowerSource: state.hasPowerSource,
  lastHistoryPointTs: state.lastHistoryPointTs,
  history: sampleHistoryPoints(state.history, maxHistoryPoints)
});

export const compactSessionsForStorage = (
  sessions: WorkoutSession[],
  maxSessions: number,
  maxHistoryPoints: number
) =>
  sessions.slice(0, maxSessions).map(session => ({
    ...session,
    history: sampleHistoryPoints(session.history || [], maxHistoryPoints)
  }));

export const trySetLocalStorageItem = (
  key: string,
  value: string,
  options: { removeExisting?: boolean } = {}
) => {
  try {
    if (options.removeExisting) {
      localStorage.removeItem(key);
    }
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isStorageQuotaError(error)) {
      console.warn(`Failed to persist ${key} to localStorage:`, error);
    }
    return false;
  }
};

export const compactStoredSessionHistoryForQuota = () => {
  try {
    const saved = localStorage.getItem(SESSION_HISTORY_STORAGE_KEY);
    if (!saved) return false;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return false;

    for (const attempt of SESSION_HISTORY_STORAGE_ATTEMPTS) {
      const compacted = compactSessionsForStorage(
        parsed,
        attempt.maxSessions,
        attempt.maxHistoryPoints
      );
      if (
        trySetLocalStorageItem(
          SESSION_HISTORY_STORAGE_KEY,
          JSON.stringify(compacted),
          { removeExisting: true }
        )
      ) {
        return true;
      }
    }
  } catch (error) {
    console.warn('Failed to compact local workout history after storage quota error:', error);
  }

  try {
    localStorage.removeItem(SESSION_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore cleanup failures; the active session fallback below will still fail gracefully.
  }
  return true;
};

const getWorkoutDatabase = () => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  if (workoutDatabasePromise) return workoutDatabasePromise;

  workoutDatabasePromise = new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(WORKOUT_INDEXED_DB_NAME, WORKOUT_INDEXED_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKOUT_INDEXED_DB_STORE)) {
        db.createObjectStore(WORKOUT_INDEXED_DB_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      console.warn('Failed to open IndexedDB workout storage:', request.error);
      workoutDatabasePromise = null;
      resolve(null);
    };
  });

  return workoutDatabasePromise;
};

const runWorkoutStorageTransaction = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
) => {
  const db = await getWorkoutDatabase();
  if (!db) return null;

  return new Promise<T | null>((resolve, reject) => {
    const transaction = db.transaction(WORKOUT_INDEXED_DB_STORE, mode);
    const store = transaction.objectStore(WORKOUT_INDEXED_DB_STORE);
    const request = action(store);
    let result: T | null = null;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => {
        reject(request.error);
      };
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};

export const getWorkoutStorageValue = async <T>(key: string) => {
  try {
    return await runWorkoutStorageTransaction<T>('readonly', store => store.get(key));
  } catch (error) {
    console.warn(`Failed to read ${key} from IndexedDB:`, error);
    return null;
  }
};

export const setWorkoutStorageValue = async <T>(key: string, value: T) => {
  try {
    await runWorkoutStorageTransaction<IDBValidKey>('readwrite', store => store.put(value, key));
  } catch (error) {
    console.warn(`Failed to persist ${key} to IndexedDB:`, error);
  }
};

export const removeWorkoutStorageValue = async (key: string) => {
  try {
    await runWorkoutStorageTransaction<undefined>('readwrite', store => store.delete(key));
  } catch (error) {
    console.warn(`Failed to remove ${key} from IndexedDB:`, error);
  }
};

export const persistActiveSessionToIndexedDb = (state: ActiveSessionSnapshot) => {
  activeSessionIndexedDbQueue = activeSessionIndexedDbQueue
    .catch(() => undefined)
    .then(() => {
      if (state.sessionStartTime === null) {
        return removeWorkoutStorageValue(ACTIVE_SESSION_STORAGE_KEY);
      }

      return setWorkoutStorageValue(
        ACTIVE_SESSION_STORAGE_KEY,
        buildActiveSessionStorageSnapshot(state)
      );
    });
};

export const persistSessionHistoryToIndexedDb = (sessions: WorkoutSession[]) => {
  sessionHistoryIndexedDbQueue = sessionHistoryIndexedDbQueue
    .catch(() => undefined)
    .then(() => setWorkoutStorageValue(SESSION_HISTORY_STORAGE_KEY, sessions));
};

export const writeActiveSession = (state: ActiveSessionSnapshot) => {
  if (typeof window === 'undefined') return;
  persistActiveSessionToIndexedDb(state);

  try {
    if (state.sessionStartTime === null) {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } else {
      const historyLimits = [
        state.history.length,
        ...ACTIVE_SESSION_HISTORY_POINT_LIMITS
      ].filter((limit, index, limits) =>
        limit >= 0 && limit <= state.history.length && limits.indexOf(limit) === index
      );

      let triedCompactingHistory = false;
      for (const limit of historyLimits) {
        const snapshot = buildActiveSessionStorageSnapshot(state, limit);
        const serialized = JSON.stringify(snapshot);

        if (trySetLocalStorageItem(ACTIVE_SESSION_STORAGE_KEY, serialized)) {
          warnedActiveSessionStorageQuota = false;
          return;
        }

        if (!triedCompactingHistory && compactStoredSessionHistoryForQuota()) {
          triedCompactingHistory = true;
          if (trySetLocalStorageItem(ACTIVE_SESSION_STORAGE_KEY, serialized)) {
            warnedActiveSessionStorageQuota = false;
            return;
          }
        }
      }

      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!warnedActiveSessionStorageQuota) {
        console.warn(
          'Active workout recovery data exceeded browser storage quota and was not persisted. The in-memory workout is still recording.'
        );
        warnedActiveSessionStorageQuota = true;
      }
    }
  } catch (e) {
    console.warn('Failed to persist active session to localStorage:', e);
  }
};

export const persistActiveSession = (
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

export const persistSessionHistory = (sessions: WorkoutSession[]) => {
  if (typeof window === 'undefined') return;
  persistSessionHistoryToIndexedDb(sessions);

  const localStorageFallback = compactSessionsForStorage(sessions, 10, 20);
  if (
    trySetLocalStorageItem(
      SESSION_HISTORY_STORAGE_KEY,
      JSON.stringify(localStorageFallback),
      { removeExisting: true }
    )
  ) {
    warnedSessionHistoryFallbackStorageFailure = false;
    return;
  }

  try {
    localStorage.removeItem(SESSION_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore cleanup failures; the in-memory history remains available until reload.
  }

  if (!warnedSessionHistoryFallbackStorageFailure) {
    console.warn(
      'Compact workout history fallback could not be persisted to localStorage. Full history is still stored in IndexedDB when available.'
    );
    warnedSessionHistoryFallbackStorageFailure = true;
  }
};
