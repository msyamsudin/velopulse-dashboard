import { getSupabaseClient, getSupabaseUserId } from '@/lib/supabase';
import { classifySupabaseError } from '@/lib/supabase-errors';
import type { HistoryData, WorkoutSession } from './types';

interface SupabaseWorkoutRow {
  id: string;
  created_at: string;
  session_start_time?: string | number;
  duration: number;
  stats: WorkoutSession['stats'];
  history: HistoryData[];
  synced_to_google?: boolean;
}

export const mapSupabaseWorkout = (item: SupabaseWorkoutRow): WorkoutSession => {
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

export const findSupabaseDuplicate = async (session: WorkoutSession) => {
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

export const buildSupabasePayload = async (session: WorkoutSession) => {
  const userId = await getSupabaseUserId();
  return {
    session_start_time: session.sessionStartTime,
    duration: session.duration,
    stats: session.stats,
    history: session.history,
    synced_to_google: Boolean(session.synced_to_google),
    ...(userId ? { user_id: userId } : {})
  };
};

export const syncSessionToSupabase = async (session: WorkoutSession): Promise<WorkoutSession> => {
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
