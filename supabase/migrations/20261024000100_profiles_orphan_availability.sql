-- ============================================================================
-- 20261024000100_profiles_orphan_availability.sql
--
-- Klaim profil lama tidak lagi terjadi di dalam GET: kepemilikan baris hanya
-- berpindah setelah pengguna menyetujuinya. Untuk menawarkan pilihan itu, layar
-- setup perlu tahu apakah ada baris tanpa pemilik — sesuatu yang tidak bisa
-- dibaca lewat RLS karena baris tersebut bukan milik siapa pun.
--
-- Fungsi ini hanya membocorkan satu bit (ada atau tidak), bukan isi profil, dan
-- hanya untuk pengguna terautentikasi.
-- ============================================================================

create or replace function public.orphan_profile_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id is null
  );
$$;

revoke all on function public.orphan_profile_available() from public;
revoke all on function public.orphan_profile_available() from anon;
grant execute on function public.orphan_profile_available() to authenticated;
