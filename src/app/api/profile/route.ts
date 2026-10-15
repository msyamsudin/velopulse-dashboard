import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAppConfig } from '@/lib/config-helper';
import { classifySupabaseError } from '@/lib/supabase-errors';
import { buildLogTag } from '@/lib/version';
import { getUserProfile, saveUserProfile } from '@/lib/profile-helper';

const SUPABASE_FETCH_TIMEOUT_MS = 10_000;
const EMPTY_PROFILE = { age: 0, max_hr: 190, ftp: 0, weight: 0 };

/**
 * Builds a Supabase client from the latest runtime config (config.json > .env).
 * This runs server-side, so `fs` access via config-helper is available.
 */
function getServerSupabase(accessToken: string) {
  const config = getAppConfig();
  const url = config.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = config.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('Supabase is not configured. Please set URL and key via Settings.');
  return createClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS) }),
    },
  });
}

async function getAuthenticatedClient(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const supabase = getServerSupabase(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}

function errorResponse(err: unknown) {
  const info = classifySupabaseError(err);
  console.error('Profile fetch error:', err, buildLogTag());
  return NextResponse.json(
    {
      error: info.message,
      code: info.code,
      userMessage: info.userMessage,
      retryable: info.retryable,
    },
    { status: 500 }
  );
}

// GET: Returns current profile
export async function GET(request: Request) {
  try {
    const hasAuthorization = Boolean(request.headers.get('authorization'));
    const auth = await getAuthenticatedClient(request);
    if (!auth) {
      if (hasAuthorization) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      return NextResponse.json(getUserProfile());
    }
    const { supabase, userId } = auth;
    const { data: ownedProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
      throw error;
    }

    let profile = ownedProfile;
    if (!profile) {
      const { data: claimedProfiles, error: claimError } = await supabase.rpc('claim_my_orphan_profile');
      if (claimError) throw claimError;
      profile = Array.isArray(claimedProfiles) ? claimedProfiles[0] || null : claimedProfiles;
    }

    // Jika profil cloud belum berisi nilai wajib, pulihkan profil lokal yang
    // pernah disimpan sebelum login lalu tautkan ke akun ini.
    const cloudProfileReady = profile?.age > 0 && profile?.max_hr > 0;
    const localProfile = getUserProfile();
    const localProfileReady = localProfile.age > 0 && localProfile.maxHr > 0;
    if (!cloudProfileReady && localProfileReady) {
      const { data: savedProfile, error: saveError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          age: localProfile.age,
          max_hr: localProfile.maxHr,
          ftp: localProfile.ftp,
          weight: localProfile.weight,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select('*')
        .single();
      if (saveError) throw saveError;
      profile = savedProfile;
    }

    return NextResponse.json(profile || EMPTY_PROFILE);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST: Saves new profile
export async function POST(request: NextRequest) {
  try {
    const profile = await request.json();
    const hasAuthorization = Boolean(request.headers.get('authorization'));
    const auth = await getAuthenticatedClient(request);
    const normalized = {
      age: profile.age,
      maxHr: profile.maxHr || profile.max_hr,
      ftp: profile.ftp,
      weight: profile.weight,
      restingHr: profile.restingHr ?? profile.resting_hr,
    };
    if (!auth) {
      if (hasAuthorization) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
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
        ftp: profile.ftp,
        weight: profile.weight,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
