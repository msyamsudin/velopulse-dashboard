-- ============================================================================
-- VeloPulse — Supabase schema migration
-- Scope: lock the `workouts` table to the signed-in Supabase user.
--
-- Run this ONCE in Supabase Dashboard > SQL Editor. It is safe to re-run:
-- every statement is idempotent.
--
-- Before running:
--   1. Enable the Email provider in Supabase Dashboard > Authentication >
--      Providers > Email (turn ON "Enable Sign ups" if you want self-registration).
--   2. Stop using the app's "Continue without account" flow for cloud sync —
--      cloud data now requires a signed-in user.
--
-- After running, open the app and sign in. Rows that existed before auth
-- (user_id IS NULL) are claimed automatically by the first signed-in user
-- via the "users claim orphan workouts" policy; no manual backfill needed.
-- ============================================================================

-- 1. User ownership column ------------------------------------------------
alter table workouts add column if not exists user_id uuid;

create index if not exists workouts_user_id_idx on workouts (user_id);

-- 2. Drop ALL old open policies (the app no longer exposes data to
--    unauthenticated clients). The original policies may have any name
--    (e.g. Supabase's default "Allow public ..." names) and target the
--    `public` or `anon` roles — both are reachable without signing in, and
--    `public` even overrides the authenticated scoping below. Drop by role
--    instead of by name to catch every one of them.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where tablename = 'workouts'
      and (roles && array['anon', 'public']::name[])
  loop
    execute format('drop policy if exists %I on workouts', p.policyname);
  end loop;
end $$;

-- 3. Row-level security scoped to the signed-in user ------------------------
create policy "users read own workouts" on workouts for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own workouts" on workouts for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own workouts" on workouts for update to authenticated
  using (user_id = auth.uid());

create policy "users delete own workouts" on workouts for delete to authenticated
  using (user_id = auth.uid());

-- 4. Claim pre-auth rows -----------------------------------------------------
-- Lets the first signed-in user adopt workouts recorded before auth existed
-- (user_id IS NULL). The app calls this automatically after sign-in.
create policy "users claim orphan workouts" on workouts for update to authenticated
  using (user_id is null)
  with check (user_id = auth.uid());
