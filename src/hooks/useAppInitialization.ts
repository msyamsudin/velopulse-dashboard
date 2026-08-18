import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PROFILE } from '@/lib/constants';
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
  const [userProfile, setUserProfile] = useState(DEFAULT_PROFILE);
  const [profileError, setProfileError] = useState<ProfileLoadError | null>(null);

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
        if (data && !data.error && data.age > 0 && data.weight > 0 && (data.maxHr > 0 || data.max_hr > 0)) {
          setUserProfile({
            age: data.age,
            maxHr: data.maxHr ?? data.max_hr,
            ftp: data.ftp ?? 0,
            weight: data.weight,
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

  const profileStatus = ((): 'loading' | 'ready' | 'error' | 'new' => {
    if (isLoadingProfile) return 'loading';
    const isComplete = userProfile.age > 0 &&
                      userProfile.weight > 0 &&
                      userProfile.maxHr > 0 &&
                      userProfile.ftp > 0;
    return isComplete ? 'ready' : 'new';
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
    profileStatus,
    profileError,
    retryProfile: loadProfile,
    sysConfigCheck,
    refetchSysCheck,
  };
};
