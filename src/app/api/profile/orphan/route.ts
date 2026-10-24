import { NextResponse } from 'next/server';
import { errorResponse, getAuthenticatedClient } from '@/lib/profile-server';

/**
 * Apakah ada profil lama tanpa pemilik yang bisa ditawarkan untuk ditautkan.
 *
 * Hanya satu bit; isi profil tidak pernah dikirim sebelum pengguna memilih
 * untuk menautkannya.
 *
 * Bila fungsi migrasinya belum diterapkan, RPC gagal dan endpoint ini
 * mengembalikan 500, bukan `false`. Klien membaca respons gagal sebagai
 * "tidak tersedia", sehingga layar setup tetap tidak menawarkan tautan yang
 * pasti gagal — tetapi kegagalannya tetap terlihat di log, bukan disembunyikan.
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
