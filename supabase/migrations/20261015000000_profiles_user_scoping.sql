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
