import { NextResponse } from 'next/server';
import { normalizeProfile, withResolvedMaxHr } from '@/lib/profile';
import { saveUserProfile } from '@/lib/profile-helper';
import {
  errorResponse,
  getAuthenticatedClient,
  hasAuthorizationHeader,
} from '@/lib/profile-server';

/**
 * Menautkan satu profil lama tanpa pemilik ke akun yang sedang aktif.
 *
 * Sebelumnya klaim berjalan otomatis di dalam GET /api/profile, sehingga akun
 * pertama yang membuka aplikasi mengambil baris milik perangkat lain tanpa
 * bertanya. Sekarang klaim hanya terjadi bila pengguna menekan tombol di layar
 * setup, dan endpoint ini menolak permintaan tanpa sesi yang valid.
 */
export async function POST(request: Request) {
  try {
    if (!hasAuthorizationHeader(request)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const auth = await getAuthenticatedClient(request);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { supabase } = auth;
    const { data, error } = await supabase.rpc('claim_my_orphan_profile');
    if (error) throw error;

    const claimedRow = Array.isArray(data) ? data[0] ?? null : data;
    if (!claimedRow) {
      return NextResponse.json({ claimed: false });
    }

    const profile = withResolvedMaxHr(normalizeProfile(claimedRow));
    // Profil yang baru ditautkan menjadi cache perangkat, sama seperti hasil
    // penyimpanan biasa.
    saveUserProfile(profile);

    return NextResponse.json({ claimed: true, profile });
  } catch (err) {
    return errorResponse(err);
  }
}
