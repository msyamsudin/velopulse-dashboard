import { getSupabaseClient, getSupabaseUserId } from '@/lib/supabase';
import { classifySupabaseError } from '@/lib/supabase-errors';
import type { HistoryData, WorkoutSession } from './types';
import { sanitizeLegacySessionDuration } from './session-utils';

interface SupabaseWorkoutRow {
  id: string;
  created_at: string;
  session_start_time?: string | number;
  duration: number;
  stats: WorkoutSession['stats'];
  history: HistoryData[];
  synced_to_google?: boolean;
  source_session_id?: string | null;
}

const isSameWorkout = (row: Pick<SupabaseWorkoutRow, 'duration' | 'stats' | 'history'>, session: WorkoutSession) =>
  row.duration === session.duration &&
  JSON.stringify(row.stats) === JSON.stringify(session.stats) &&
  JSON.stringify(row.history) === JSON.stringify(session.history);

const findMatchingRows = async (session: WorkoutSession, existingClient?: Awaited<ReturnType<typeof getSupabaseClient>>) => {
  const client = existingClient ?? await getSupabaseClient();
  if (!client) return { rows: [] as SupabaseWorkoutRow[] };

  const { data, error } = await client
    .from('workouts')
    .select('*')
    .eq('session_start_time', session.sessionStartTime);

  if (error) throw error;
  const rows = (data ?? []) as SupabaseWorkoutRow[];
  const exactId = rows.find(row => row.source_session_id === session.id);
  const legacyMatch = rows.find(row => !row.source_session_id && isSameWorkout(row, session));
  return { rows: exactId ? [exactId] : legacyMatch ? [legacyMatch] : [] };
};

export const mapSupabaseWorkout = (item: SupabaseWorkoutRow): WorkoutSession => {
  const sessionStartTime = Number(item.session_start_time) || Date.parse(item.created_at) || 0;

  return sanitizeLegacySessionDuration({
    id: item.source_session_id || item.id,
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
  });
};

export const findSupabaseDuplicate = async (session: WorkoutSession) => {
  const { rows } = await findMatchingRows(session);
  return rows[0] ? mapSupabaseWorkout(rows[0]) : null;
};

export const buildSupabasePayload = async (session: WorkoutSession) => {
  const userId = await getSupabaseUserId();
  return {
    source_session_id: session.id,
    session_start_time: session.sessionStartTime,
    duration: session.duration,
    stats: session.stats,
    history: session.history,
    synced_to_google: Boolean(session.synced_to_google),
    ...(userId ? { user_id: userId } : {})
  };
};

export const syncSessionToSupabase = async (session: WorkoutSession): Promise<WorkoutSession> => {
  // Sesi demo hanya untuk verifikasi lokal dan tidak pernah ditulis ke cloud.
  // Penjaganya diletakkan di pintu keluar ini supaya jalur panggil mana pun
  // (saveSession, retry antrean, impor) tetap aman.
  if (session.simulated) return session;

  const client = await getSupabaseClient();
  if (!client) {
    return {
      ...session,
      synced_to_supabase: false,
      supabase_sync_error: 'Supabase config unavailable'
    };
  }

  try {
    const payload = await buildSupabasePayload(session);
    const { rows } = await findMatchingRows(session, client);
    const existing = rows[0];
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
  } catch (err) {
    const info = classifySupabaseError(err);
    return {
      ...session,
      synced_to_supabase: false,
      supabase_sync_error: info.message || 'Supabase sync failed',
      supabase_sync_error_code: info.code
    };
  }
};
