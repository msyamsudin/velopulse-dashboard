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

/**
 * Repairs legacy sessions whose stored `duration` froze far below the ride's
 * real length. Very old builds ticked `elapsed` from a JS timer that could
 * sleep while the BLE point stream kept recording (1 point/second), leaving a
 * session like a real ~23-minute ride stored with `duration: 262`.
 *
 * The physical signature of that corruption: the distance-derived average
 * speed (distance ÷ duration) exceeds the fastest speed the session ever
 * recorded — an average can never be higher than the maximum. When detected,
 * the duration is re-derived from the recorded point series (real wall-clock
 * timestamps when present, otherwise the legacy 1-point-per-second count).
 * Only ever lengthens the duration and only when the evidence is unambiguous.
 */
export const sanitizeLegacySessionDuration = (session: WorkoutSession): WorkoutSession => {
  const history = session?.history || [];
  if (history.length < 2 || !(session.duration > 0)) return session;

  let distanceMeters = 0;
  let maxPointSpeed = 0;
  for (const point of history) {
    if (point.distance > distanceMeters) distanceMeters = point.distance;
    if ((point.speed || 0) > maxPointSpeed) maxPointSpeed = point.speed || 0;
  }

  const recordedMaxSpeed = Math.max(session.stats?.maxSpeed || 0, maxPointSpeed);
  if (distanceMeters <= 0 || recordedMaxSpeed <= 0) return session;

  const distanceKm = distanceMeters / 1000;
  const avgSpeedKmh = distanceKm / (session.duration / 3600);
  // Small tolerance for rounding/unit noise: physical average ≤ recorded max.
  if (avgSpeedKmh <= recordedMaxSpeed * 1.05 + 0.5) return session;

  let derivedSeconds = history.length - 1;
  const firstTs = history[0]?.ts;
  const lastTs = history[history.length - 1]?.ts;
  if (typeof firstTs === 'number' && typeof lastTs === 'number' && lastTs > firstTs) {
    derivedSeconds = Math.max(derivedSeconds, Math.round((lastTs - firstTs) / 1000));
  }

  // Only act on clear-cut corruption (derived time at least twice the stored).
  if (derivedSeconds <= session.duration * 2) return session;

  return { ...session, duration: derivedSeconds };
};
