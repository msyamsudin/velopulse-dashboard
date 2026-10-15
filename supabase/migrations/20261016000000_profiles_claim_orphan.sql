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
