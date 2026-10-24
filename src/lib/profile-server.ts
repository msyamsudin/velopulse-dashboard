import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAppConfig } from './config-helper';
import { classifySupabaseError } from './supabase-errors';
import { buildLogTag } from './version';

const SUPABASE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Membangun klien Supabase dari konfigurasi runtime (config.json > .env).
 * Hanya berjalan di server, tempat `fs` tersedia lewat config-helper.
 */
export const getServerSupabase = (accessToken: string): SupabaseClient => {
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
};

/**
 * Klien yang sudah terbukti memegang sesi valid. `null` berarti tidak ada
 * token, token kedaluwarsa, atau sesi tidak dapat diverifikasi — pemanggil
 * membedakan keduanya lewat header agar bisa menjawab 401, bukan 500.
 */
export const getAuthenticatedClient = async (
  request: Request
): Promise<{ supabase: SupabaseClient; userId: string } | null> => {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const supabase = getServerSupabase(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
};

export const hasAuthorizationHeader = (request: Request): boolean =>
  Boolean(request.headers.get('authorization'));

/** Satu bentuk respons error untuk seluruh endpoint profil. */
export const errorResponse = (err: unknown) => {
  const info = classifySupabaseError(err);
  console.error('Profile API error:', err, buildLogTag());
  return NextResponse.json(
    {
      error: info.message,
      code: info.code,
      userMessage: info.userMessage,
      retryable: info.retryable,
    },
    { status: 500 }
  );
};
