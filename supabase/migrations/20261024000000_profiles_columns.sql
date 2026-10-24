-- ============================================================================
-- 20261024000000_profiles_columns.sql
--
-- Melengkapi `profiles` dengan nilai yang selama ini tidak punya rumah di
-- cloud, lalu menutup celah data yang sebelumnya hanya dijaga oleh klien.
--
-- `resting_hr` hanya hidup di localStorage (lihat lib/body-history.ts) sehingga
-- hilang saat berganti perangkat. `max_hr_source` menandai apakah max HR
-- diturunkan dari usia atau diukur manual. Constraint rentang menjaga jalur
-- tulis lain (SQL editor, impor, klien lama) agar tidak bisa memasukkan usia
-- negatif atau berat 0,5 kg yang selama ini lolos ke database.
--
-- Nilai 0 tetap diizinkan untuk age, max_hr, ftp, weight, dan resting_hr:
-- itulah arti "belum diisi" di aplikasi, dan baris lama mungkin masih memakainya.
-- ============================================================================

alter table profiles add column if not exists resting_hr integer not null default 0;
alter table profiles add column if not exists max_hr_source text not null default 'auto';

alter table profiles drop constraint if exists profiles_age_range;
alter table profiles add constraint profiles_age_range
  check (age = 0 or age between 10 and 100);

alter table profiles drop constraint if exists profiles_max_hr_range;
alter table profiles add constraint profiles_max_hr_range
  check (max_hr = 0 or max_hr between 100 and 230);

alter table profiles drop constraint if exists profiles_ftp_range;
alter table profiles add constraint profiles_ftp_range
  check (ftp between 0 and 2000);

alter table profiles drop constraint if exists profiles_weight_range;
alter table profiles add constraint profiles_weight_range
  check (weight = 0 or weight between 20 and 300);

alter table profiles drop constraint if exists profiles_resting_hr_range;
alter table profiles add constraint profiles_resting_hr_range
  check (
    resting_hr = 0
    or (resting_hr between 25 and 120 and (max_hr = 0 or resting_hr < max_hr))
  );

alter table profiles drop constraint if exists profiles_max_hr_source_check;
alter table profiles add constraint profiles_max_hr_source_check
  check (max_hr_source in ('auto', 'manual'));

-- `updated_at` sebelumnya diisi klien; trigger membuatnya benar walau baris
-- ditulis dari jalur lain.
create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();
