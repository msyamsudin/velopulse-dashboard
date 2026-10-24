import { NextResponse } from 'next/server';
import { errorResponse, getAuthenticatedClient } from '@/lib/profile-server';

/**
 * Apakah ada profil lama tanpa pemilik yang bisa ditawarkan untuk ditautkan.
 *
 * Hanya satu bit; isi profil tidak pernah dikirim sebelum pengguna memilih
 * untuk menautkannya. `false` juga jawaban yang benar ketika fungsi migrasi
 * belum diterapkan, sehingga layar setup tidak menawarkan sesuatu yang gagal.
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedClient(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data, error } = await auth.supabase.rpc('orphan_profile_available');
    if (error) throw error;

    return NextResponse.json({ available: Boolean(data) });
  } catch (err) {
    return errorResponse(err);
  }
}
