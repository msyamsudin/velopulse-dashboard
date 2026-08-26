import type { WorkoutSession } from './types';

export const getSessionKey = (session: Pick<WorkoutSession, 'id' | 'sessionStartTime'>) =>
  session.sessionStartTime ? `start:${session.sessionStartTime}` : `id:${session.id}`;

export const getSessionStartTimestamp = (session: Pick<WorkoutSession, 'sessionStartTime' | 'date'>) => {
  if (Number.isFinite(session.sessionStartTime) && session.sessionStartTime > 0) {
    return session.sessionStartTime;
  }

  const parsedDate = Date.parse(session.date);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
};

export const getWorkoutDateISOString = (session: Pick<WorkoutSession, 'sessionStartTime' | 'date'>) => {
  const timestamp = getSessionStartTimestamp(session);
  return timestamp > 0 ? new Date(timestamp).toISOString() : session.date;
};

export const isPotentialDuplicateSession = (a: WorkoutSession, b: WorkoutSession) => {
  const startDiffSeconds = Math.abs(a.sessionStartTime - b.sessionStartTime) / 1000;
  const durationDiffSeconds = Math.abs(a.duration - b.duration);
  const aDistance = a.history[a.history.length - 1]?.distance || 0;
  const bDistance = b.history[b.history.length - 1]?.distance || 0;
  const distanceDiffMeters = Math.abs(aDistance - bDistance);

  return startDiffSeconds <= 60 && durationDiffSeconds <= 10 && distanceDiffMeters <= 50;
};

export const sortSessions = (sessions: WorkoutSession[]) =>
  [...sessions].sort((a, b) => getSessionStartTimestamp(b) - getSessionStartTimestamp(a));

export const mergeSessionHistories = (localSessions: WorkoutSession[], remoteSessions: WorkoutSession[]) => {
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
