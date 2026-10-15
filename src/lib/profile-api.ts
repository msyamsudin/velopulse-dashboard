import { getSupabaseClient } from './supabase';

/** Meneruskan sesi aktif agar endpoint profil dapat membatasi baris per pengguna. */
export const fetchProfileApi = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const client = await getSupabaseClient();
  const { data } = client ? await client.auth.getSession() : { data: { session: null } };
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
};
