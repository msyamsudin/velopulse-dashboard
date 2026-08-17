import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import type { CloudStatus } from './useConnectionStatus';

export interface AutoSyncNotice {
  kind: 'success' | 'failure';
  count: number;
}

const SUCCESS_DISMISS_MS = 5_000;

/**
 * Watches the shared cloud status and, when the connection recovers
 * (offline / unreachable / config-missing → ok), automatically retries the
 * Supabase sync for any pending sessions. Produces a notice that reports
 * whether the auto-sync succeeded or failed. Success notices dismiss
 * themselves; failures stay visible until the user dismisses or retries.
 *
 * Triggering on the probe result (rather than the raw 'online' event) avoids
 * false attempts when the network is back but Supabase itself is still down.
 */
export const useAutoSync = (status: CloudStatus | null) => {
  const syncPendingSupabaseSessions = useWorkoutStore(state => state.syncPendingSupabaseSessions);
  const [notice, setNotice] = useState<AutoSyncNotice | null>(null);
  const wasProblematic = useRef(false);
  const syncing = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((next: AutoSyncNotice) => {
    setNotice(next);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    // Only success notices auto-dismiss; failures stay until dismissed or retried.
    if (next.kind !== 'success') return;
    dismissTimer.current = setTimeout(() => setNotice(null), SUCCESS_DISMISS_MS);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setNotice(null);
  }, []);

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    },
    []
  );

  const runAutoSync = useCallback(async () => {
    const state = useWorkoutStore.getState();
    const pendingBefore = state.sessionHistory.filter(session => !session.synced_to_supabase);
    if (pendingBefore.length === 0) return;
    if (syncing.current) return;

    syncing.current = true;
    try {
      await syncPendingSupabaseSessions();

      const after = useWorkoutStore.getState().sessionHistory;
      const stillPending = after.filter(session => !session.synced_to_supabase);
      const syncedCount = pendingBefore.length - stillPending.length;

      if (syncedCount > 0) {
        showNotice({ kind: 'success', count: syncedCount });
      } else if (stillPending.length > 0) {
        showNotice({ kind: 'failure', count: stillPending.length });
      }
    } catch {
      showNotice({ kind: 'failure', count: pendingBefore.length });
    } finally {
      syncing.current = false;
    }
  }, [syncPendingSupabaseSessions, showNotice]);

  // Fire once the cloud becomes reachable again after a problem. Deferred out
  // of the effect body (callback-based) to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!status) return;

    if (
      status.state === 'offline' ||
      status.state === 'unreachable' ||
      status.state === 'config-missing'
    ) {
      wasProblematic.current = true;
      return;
    }

    if (status.state === 'ok' && wasProblematic.current) {
      wasProblematic.current = false;
      const timer = setTimeout(runAutoSync, 0);
      return () => clearTimeout(timer);
    }
  }, [status, runAutoSync]);

  return { autoSyncNotice: notice, dismissAutoSyncNotice: dismiss };
};
