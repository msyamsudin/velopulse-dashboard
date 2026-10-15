-- ============================================================================
-- GENERATED FILE — do not edit by hand.
--
-- Built from supabase/migrations/*.sql by scripts/build-schema.mjs.
-- Change a migration, then run:  pnpm run schema:build
--
-- Paste this whole file into Supabase Dashboard > SQL Editor to bring a
-- project up to date. Every statement is idempotent, so re-running is safe.
--
-- Migrations bundled, in order:
--   20260524000000_baseline_workouts.sql
--   20260818131159_workouts_user_scoping.sql
--   20261015000000_profiles_user_scoping.sql
--   20261015000100_workouts_source_session_id.sql
--   20261016000000_profiles_claim_orphan.sql
-- ============================================================================

-- ===== 20260524000000_baseline_workouts.sql ====================================

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

-- ===== 20260818131159_workouts_user_scoping.sql ================================

-- ============================================================================
-- 20260818131159_workouts_user_scoping.sql
--
-- Scope: lock the `workouts` table to the signed-in Supabase user.
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

-- ===== 20261015000000_profiles_user_scoping.sql ================================

-- Profil cloud disimpan per akun; profil tanpa akun tetap berada di perangkat.
-- Baris legacy dengan ID bersama tidak dapat dikaitkan ke pengguna secara aman.

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  age integer not null default 0,
  max_hr integer not null default 190,
  ftp integer not null default 0,
  weight numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table profiles alter column id set default gen_random_uuid();
create unique index if not exists profiles_user_id_key on profiles (user_id);

alter table profiles enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on profiles', p.policyname);
  end loop;
end $$;

drop policy if exists "users read own profile" on profiles;
drop policy if exists "users insert own profile" on profiles;
drop policy if exists "users update own profile" on profiles;

create policy "users read own profile" on profiles for select to authenticated
  using (user_id = auth.uid());
create policy "users insert own profile" on profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy "users update own profile" on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===== 20261015000100_workouts_source_session_id.sql ===========================

-- ID lokal yang stabil mencegah sesi dengan waktu mulai sama tertukar saat sinkronisasi.
alter table workouts add column if not exists source_session_id text;

create index if not exists workouts_source_session_id_idx
  on workouts (source_session_id);

-- ===== 20261016000000_profiles_claim_orphan.sql ================================

-- Klaim satu profil lama tanpa pemilik untuk akun pertama yang masuk.
-- Fungsi ini hanya memperbarui baris profil yang user_id-nya masih NULL.

create or replace function public.claim_my_orphan_profile()
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Autentikasi diperlukan untuk mengklaim profil.'
      using errcode = '42501';
  end if;

  update public.profiles
  set user_id = auth.uid()
  where id = (
    select p.id
    from public.profiles as p
    where p.user_id is null
    order by p.updated_at desc, p.id
    for update skip locked
    limit 1
  )
  returning * into claimed;

  if claimed.id is not null then
    return next claimed;
  end if;
  return;
end;
$$;

revoke all on function public.claim_my_orphan_profile() from public;
revoke all on function public.claim_my_orphan_profile() from anon;
grant execute on function public.claim_my_orphan_profile() to authenticated;
