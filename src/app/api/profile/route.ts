import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_PROFILE,
  normalizeProfile,
  profileErrorFields,
  validateProfile,
  withResolvedMaxHr,
} from '@/lib/profile';
import { getUserProfile, saveUserProfile } from '@/lib/profile-helper';
import {
  errorResponse,
  getAuthenticatedClient,
  hasAuthorizationHeader,
} from '@/lib/profile-server';
import { buildLogTag } from '@/lib/version';

// GET: Returns current profile
export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedClient(request);
    if (!auth) {
      if (hasAuthorizationHeader(request)) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      return NextResponse.json(withResolvedMaxHr(getUserProfile()));
    }

    const { supabase, userId } = auth;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
      throw error;
    }

    // GET tidak menulis apa pun: klaim baris milik perangkat lain dan
    // penyalinan profil perangkat ke akun hanya terjadi lewat aksi eksplisit.
    if (!profile) {
      const localProfile = getUserProfile();
      const localReady = localProfile.age > 0
        && localProfile.maxHr > 0
        && profileErrorFields(validateProfile(localProfile)).length === 0;
      return NextResponse.json(localReady ? withResolvedMaxHr(localProfile) : DEFAULT_PROFILE);
    }

    // Kontrak API memakai camelCase; baris Supabase memakai snake_case dan
    // dinormalkan di satu tempat agar klien tidak perlu menebak bentuknya.
    return NextResponse.json(withResolvedMaxHr(normalizeProfile(profile)));
  } catch (err) {
    return errorResponse(err);
  }
}

// POST: Saves new profile
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedClient(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Saat mode Auto, nilai maxHr ditentukan server dari usia: klien tidak bisa
    // menyelipkan angka yang tidak sesuai dengan rumus.
    const normalized = withResolvedMaxHr(normalizeProfile(body));
    const invalidFields = profileErrorFields(validateProfile(normalized));
    if (invalidFields.length > 0) {
      return NextResponse.json({ error: 'Invalid profile', fields: invalidFields }, { status: 400 });
    }

    if (!auth) {
      if (hasAuthorizationHeader(request)) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      const saved = saveUserProfile(normalized);
      return saved
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: 'Failed to save profile locally' }, { status: 500 });
    }

    const { supabase, userId } = auth;
    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        age: normalized.age,
        max_hr: normalized.maxHr,
        max_hr_source: normalized.maxHrSource,
        ftp: normalized.ftp,
        weight: normalized.weight,
        resting_hr: normalized.restingHr,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;

    // Cache perangkat selalu mengikuti penyimpanan terakhir, baik pengguna
    // sedang login atau tidak. Sebelumnya jalur login tidak menyentuh berkas
    // lokal, sehingga profil yang terbaca setelah logout bisa tertinggal
    // berbulan-bulan. Kegagalan cache tidak membatalkan penyimpanan cloud.
    if (!saveUserProfile(normalized)) {
      console.warn('Failed to cache profile locally after cloud save', buildLogTag());
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
