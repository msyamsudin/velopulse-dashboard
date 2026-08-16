import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAppConfig } from '@/lib/config-helper';
import { classifySupabaseError } from '@/lib/supabase-errors';

const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Builds a Supabase client from the latest runtime config (config.json > .env).
 * This runs server-side, so `fs` access via config-helper is available.
 */
function getServerSupabase() {
  const config = getAppConfig();
  const url = config.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = config.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('Supabase is not configured. Please set URL and key via Settings.');
  return createClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS) }),
    },
  });
}

function errorResponse(err: unknown) {
  const info = classifySupabaseError(err);
  console.error('Profile fetch error:', err);
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

const MASTER_PROFILE_ID = '00000000-0000-0000-0000-000000000000';

// GET: Returns current profile
export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', MASTER_PROFILE_ID)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
      throw error;
    }

    return NextResponse.json(data || {
      age: 30,
      max_hr: 185,
      ftp: 200,
      weight: 75
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST: Saves new profile
export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    const profile = await request.json();
    
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: MASTER_PROFILE_ID,
        age: profile.age,
        max_hr: profile.maxHr || profile.max_hr,
        ftp: profile.ftp,
        weight: profile.weight,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
