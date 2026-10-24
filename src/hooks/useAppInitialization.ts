import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PROFILE, type UserProfile } from '@/lib/profile';
import {
  getLatestRestingHr,
  readBodyHistory,
  recordBodyEntry,
  type BodyHistoryEntry,
} from '@/lib/body-history';
import { useBluetoothStore } from '../store/useBluetoothStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useAuthStore } from '../store/useAuthStore';
import { fetchProfileApi } from '@/lib/profile-api';

export interface ProfileLoadError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
}

export const useAppInitialization = () => {
  const clearStaleData = useBluetoothStore(state => state.clearStaleData);
  const loadHistory = useWorkoutStore(state => state.loadHistory);
  const authUserId = useAuthStore(state => state.session?.user.id ?? null);

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userProfile, setUserProfileState] = useState(DEFAULT_PROFILE);
  const [profileError, setProfileError] = useState<ProfileLoadError | null>(null);
  // Ada baris profil lama tanpa pemilik yang bisa ditawarkan untuk ditautkan.
  const [orphanProfileAvailable, setOrphanProfileAvailable] = useState(false);
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
  const setUserProfile = useCallback((profile: UserProfile) => {
    setUserProfileState(profile);
    setBodyHistory(recordBodyEntry({ weight: profile.weight, restingHr: profile.restingHr }));
  }, []);

  const loadProfile = useCallback(() => {
    setIsLoadingProfile(true);
    setProfileError(null);
    fetchProfileApi('/api/profile')
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
            maxHrSource: data.maxHrSource === 'manual' ? 'manual' : 'auto',
            ftp: data.ftp ?? 0,
            weight: data.weight ?? 0,
            // Baris lama belum punya kolom resting HR: pakai yang tercatat di
            // riwayat perangkat ini.
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
  }, [loadProfile, authUserId]);

  /**
   * Klaim profil lama hanya ditawarkan, tidak pernah dilakukan otomatis: dulu
   * GET /api/profile mengambil baris tanpa pemilik saat akun pertama membuka
   * aplikasi, sehingga profil perangkat lain bisa berpindah akun.
   */
  useEffect(() => {
    if (!authUserId || isLoadingProfile) return undefined;
    // Hanya relevan saat akun ini belum punya profil sendiri.
    if (userProfile.age > 0) return undefined;
    let cancelled = false;

    fetchProfileApi('/api/profile/orphan')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled) setOrphanProfileAvailable(Boolean(data?.available));
      })
      .catch(() => {
        // Tanpa kepastian, jangan tawarkan sesuatu yang mungkin gagal diklaim.
      });

    return () => {
      cancelled = true;
    };
  }, [authUserId, isLoadingProfile, userProfile.age]);

  const claimOrphanProfile = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetchProfileApi('/api/profile/claim', { method: 'POST' });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.claimed || !data.profile) {
        setOrphanProfileAvailable(false);
        return false;
      }
      setUserProfile(data.profile as UserProfile);
      setOrphanProfileAvailable(false);
      return true;
    } catch {
      return false;
    }
  }, [setUserProfile]);

  // The setup gate asks a different question than the metric gates: it only
  // needs the values the app cannot work without (age → maxHr). FTP and weight
  // gate metrics (power zones, W/kg, kcal/kg/h), so they are surfaced as an
  // invitation in Settings and never turn into a locked cockpit. Consumers ask
  // `getProfileGate()` for those, so "complete" has one definition.
  //
  // `error` is kept distinct from `new`: a profile that failed to load tells us
  // nothing about what is stored, so the form must not treat it as empty and
  // save zeros over a profile that still exists in the cloud.
  const profileStatus = ((): 'loading' | 'ready' | 'error' | 'new' => {
    if (isLoadingProfile) return 'loading';
    if (profileError) return 'error';
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
    orphanProfileAvailable,
    claimOrphanProfile,
    retryProfile: loadProfile,
    sysConfigCheck,
    refetchSysCheck,
  };
};
