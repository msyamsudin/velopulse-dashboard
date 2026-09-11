-- ============================================================================
-- 20260524000000_baseline_workouts.sql
--
-- Baseline `workouts` table.
--
-- Reconstructed from the columns the app reads and writes
-- (src/store/workout/supabase.ts, src/lib/supabase.ts): the table was created by
-- hand in the Supabase dashboard before this repo tracked migrations, so this
-- file exists to make a fresh database match the live one.
--
-- On a project that already has `workouts` every statement is a no-op.
--
-- NOTE: `user_id` is intentionally absent. It arrived with auth, in
-- 20260818131159_workouts_user_scoping.sql — the history is kept honest rather
-- than squashed into one file.
-- ============================================================================

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  session_start_time timestamptz not null,
  duration integer not null default 0,
  stats jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  synced_to_google boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists workouts_session_start_time_idx
  on workouts (session_start_time);

comment on table workouts is
  'One row per recorded workout session. Ownership is enforced by RLS; see 20260818131159_workouts_user_scoping.sql.';
