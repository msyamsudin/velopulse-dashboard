import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client pre-initialized from build-time env vars.
 * This is suitable for server-side usage where env vars are available.
 * For client-side usage, prefer getSupabaseClient() instead.
 */
export const getSupabase = (): SupabaseClient => {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  supabaseClient = createClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder'
  );
  return supabaseClient;
};

let cachedRuntimeClientPromise: Promise<SupabaseClient | null> | null = null;

/** Allow re-attempting config fetch after this many ms (e.g. after user saves Settings). */
const RETRY_AFTER_MS = 30_000;
let lastFailedAt = 0;

/** Call this to force a fresh config fetch (e.g. after user saves Supabase credentials). */
export const resetSupabaseClientCache = () => {
  cachedRuntimeClientPromise = null;
  lastFailedAt = 0;
};

/**
 * Fetches Supabase config from the server at runtime (via /api/config/public),
 * then creates a fresh client. Use this on the client-side to pick up any
 * config saved through the Settings UI (stored in .app-data/config.json).
 *
 * Returns null if config is missing or the request fails.
 */
export const getSupabaseClient = async (): Promise<SupabaseClient | null> => {
  // Return cached result (including a previously resolved null) without re-fetching.
  if (cachedRuntimeClientPromise) return cachedRuntimeClientPromise;

  // Don't hammer the server if we already know config is missing — wait for RETRY_AFTER_MS.
  if (lastFailedAt && Date.now() - lastFailedAt < RETRY_AFTER_MS) {
    return null;
  }

  cachedRuntimeClientPromise = (async () => {
    try {
      const res = await fetch('/api/config/public');
      if (!res.ok) throw new Error(`Config endpoint returned ${res.status}`);

      const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = await res.json();

      // Validate that we have a real-looking URL before creating the client.
      if (!url || !key || !url.startsWith('https://')) {
        console.warn('[Supabase] URL or anon key is empty/invalid. Please configure via Settings.');
        lastFailedAt = Date.now();
        // Cache a null-resolving promise so callers don't re-fetch immediately.
        cachedRuntimeClientPromise = Promise.resolve(null);
        return null;
      }

      return createClient(url, key);
    } catch (err) {
      // Cache failure as null so we don't retry immediately on every call.
      console.warn('[Supabase] Could not initialize client (will retry after 30 s):', (err as Error)?.message ?? err);
      lastFailedAt = Date.now();
      cachedRuntimeClientPromise = Promise.resolve(null);
      return null;
    }
  })();

  return cachedRuntimeClientPromise;
};

// Database Types for reference
export type Workout = {
  id: string;
  user_id: string;
  date: string;
  duration: number;
  stats: any;
  history: any[];
  synced_to_google: boolean;
};

export type Profile = {
  id: string;
  max_hr: number;
  ftp: number;
  weight: number;
  display_name: string;
};
