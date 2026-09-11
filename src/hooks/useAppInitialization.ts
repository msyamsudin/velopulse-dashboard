import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PROFILE } from '@/lib/constants';
import {
  getLatestRestingHr,
  readBodyHistory,
  recordBodyEntry,
  type BodyHistoryEntry,
} from '@/lib/body-history';
import { useBluetoothStore } from '../store/useBluetoothStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

export interface ProfileLoadError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
}

export const useAppInitialization = () => {
  const clearStaleData = useBluetoothStore(state => state.clearStaleData);
  const loadHistory = useWorkoutStore(state => state.loadHistory);

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userProfile, setUserProfileState] = useState(DEFAULT_PROFILE);
  const [profileError, setProfileError] = useState<ProfileLoadError | null>(null);
  // Dated weight / resting-HR entries, kept on this device (lib/body-history).
  const [bodyHistory, setBodyHistory] = useState<BodyHistoryEntry[]>([]);

  useEffect(() => {
    setBodyHistory(readBodyHistory());
  }, []);

  /**
   * Every profile save also records a dated body entry, so past sessions can be
   * read against the weight they were actually ridden at. Saving does not go
   * through the cloud for this (no column exists), so it stays device-local.
   */
  const setUserProfile = useCallback((profile: typeof DEFAULT_PROFILE) => {
    setUserProfileState(profile);
    setBodyHistory(recordBodyEntry({ weight: profile.weight, restingHr: profile.restingHr }));
  }, []);

  const loadProfile = useCallback(() => {
    setIsLoadingProfile(true);
    setProfileError(null);
    fetch('/api/profile')
      .then(async res => {
        if (!res.ok) {
          let errorMsg = 'Fetch failed';
          let errorCode = 'UNKNOWN';
          let userMessage = 'Failed to load profile';
          let retryable = true;
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
            errorCode = errData.code || errorCode;
            userMessage = errData.userMessage || userMessage;
            retryable = errData.retryable !== false;
          } catch {
            errorMsg = `Fetch failed with status ${res.status}`;
          }
          const err: ProfileLoadError = {
            code: errorCode,
            message: errorMsg,
            userMessage,
            retryable,
          };
          throw err;
        }
        return res.json();
      })
      .then(data => {
        // The setup gate only needs the values the app cannot work without:
        // age (→ maxHr). A missing FTP or weight no longer discards the stored
        // profile — those fields gate metrics (power zones, W/kg) and are
        // surfaced as an invitation in Settings instead of a locked cockpit.
        if (data && !data.error && data.age > 0 && (data.maxHr > 0 || data.max_hr > 0)) {
          setUserProfileState({
            age: data.age,
            maxHr: data.maxHr ?? data.max_hr,
            ftp: data.ftp ?? 0,
            weight: data.weight ?? 0,
            // No cloud column yet: fall back to what this device recorded.
            restingHr: data.restingHr ?? data.resting_hr ?? getLatestRestingHr() ?? 0,
          });
        }
      })
      .catch(err => {
        console.error('Failed to load profile:', err);
        if (err && typeof err === 'object' && 'code' in err) {
          setProfileError(err as ProfileLoadError);
        } else {
          setProfileError({
            code: 'NETWORK_ERROR',
            message: err?.message || String(err),
            userMessage:
              'Could not reach the Supabase database. Check your internet connection, or the database may be paused.',
            retryable: true,
          });
        }
      })
      .finally(() => {
        setIsLoadingProfile(false);
      });
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // The setup gate asks a different question than the metric gates: it only
  // needs the values the app cannot work without (age → maxHr). FTP and weight
  // gate metrics (power zones, W/kg, kcal/kg/h), so they are surfaced as an
  // invitation in Settings and never turn into a locked cockpit. Consumers ask
  // `getProfileGate()` for those, so "complete" has one definition.
  const profileStatus = ((): 'loading' | 'ready' | 'error' | 'new' => {
    if (isLoadingProfile) return 'loading';
    const isUsable = userProfile.age > 0 && userProfile.maxHr > 0;
    return isUsable ? 'ready' : 'new';
  })();

  // Watchdog for stale data
  useEffect(() => {
    const interval = setInterval(() => {
      clearStaleData();
    }, 1000);
    return () => clearInterval(interval);
  }, [clearStaleData]);

  const { data: sysConfigCheck, refetch: refetchSysCheck } = useQuery({
    queryKey: ['sysConfigCheck'],
    queryFn: () => fetch('/api/config/check').then(res => res.json()),
  });

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    userProfile,
    setUserProfile,
    bodyHistory,
    profileStatus,
    profileError,
    retryProfile: loadProfile,
    sysConfigCheck,
    refetchSysCheck,
  };
};
