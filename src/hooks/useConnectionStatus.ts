import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { classifySupabaseError, SupabaseErrorInfo } from '@/lib/supabase-errors';

export type CloudStatus =
  | { state: 'ok' }
  | { state: 'offline' }
  | { state: 'config-missing' }
  | { state: 'unreachable'; detail: SupabaseErrorInfo };

const PROBE_INTERVAL_MS = 60_000;
const PROBE_TIMEOUT_MS = 8_000;

const isBrowserOnline = () =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

/**
 * Lightweight probe that distinguishes the failure modes the UI cares about:
 *  - config is missing entirely (Settings never filled in),
 *  - the app has no network connection,
 *  - Supabase itself is unreachable / paused / rejecting the anon key.
 *
 * It fetches the client-safe config directly instead of reusing
 * getSupabaseClient(), because that helper caches a null client for 30s after
 * any failure — which would mislabel a network outage as "not configured".
 */
export const probeCloudStatus = async (): Promise<CloudStatus> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch('/api/config/public', { signal: controller.signal });
    if (!res.ok) throw new Error(`Config endpoint returned ${res.status}`);

    const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = await res.json();
    if (!url || !key || !url.startsWith('https://')) {
      return { state: 'config-missing' };
    }

    const client = createClient(url, key);
    const { error } = await client
      .from('workouts')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) throw error;
    return { state: 'ok' };
  } catch (err) {
    return { state: 'unreachable', detail: classifySupabaseError(err) };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Tracks the connection state for the cloud indicator:
 *  - 'offline' is driven by the browser's online/offline events,
 *  - everything else comes from a periodic (60s) probe, re-run immediately
 *    whenever the connection comes back or the tab becomes visible.
 */
export const useConnectionStatus = () => {
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const inFlight = useRef(false);

  const runProbe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (document.visibilityState === 'hidden') return;
    if (inFlight.current) return;

    if (!isBrowserOnline()) {
      setStatus({ state: 'offline' });
      return;
    }

    inFlight.current = true;
    try {
      const result = await probeCloudStatus();
      setStatus(result);
    } catch {
      // probeCloudStatus never rejects; keep the previous status as a fallback.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setStatus(null); // re-check from a clean slate
      runProbe();
    };
    const handleOffline = () => setStatus({ state: 'offline' });
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runProbe();
    };

    // Defer the first probe out of the effect body (callback-based) to avoid
    // the react-hooks/set-state-in-effect rule and keep setState calls in
    // event/interval callbacks only.
    const initialProbeTimer = setTimeout(runProbe, 0);
    const interval = setInterval(runProbe, PROBE_INTERVAL_MS);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initialProbeTimer);
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [runProbe]);

  return { status };
};
