import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PROFILE } from '@/lib/constants';
import { useBluetoothStore } from '../store/useBluetoothStore';
import { useWorkoutStore } from '../store/useWorkoutStore';

export const useAppInitialization = () => {
  const clearStaleData = useBluetoothStore(state => state.clearStaleData);
  const loadHistory = useWorkoutStore(state => state.loadHistory);

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userProfile, setUserProfile] = useState(DEFAULT_PROFILE);

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

  const { data: authStatus, refetch: refetchAuth } = useQuery({
    queryKey: ['authStatus'],
    queryFn: () => fetch('/api/auth/status').then(res => res.json()),
  });

  const { data: sysConfigCheck, refetch: refetchSysCheck } = useQuery({
    queryKey: ['sysConfigCheck'],
    queryFn: () => fetch('/api/config/check').then(res => res.json()),
  });

  useEffect(() => {
    loadHistory();
    
    setIsLoadingProfile(true);
    fetch('/api/profile')
      .then(res => {
        if (!res.ok) throw new Error('Fetch failed');
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
      })
      .finally(() => {
        setIsLoadingProfile(false);
      });
  }, [loadHistory]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        refetchAuth();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetchAuth]);

  return {
    userProfile,
    setUserProfile,
    profileStatus,
    authStatus,
    sysConfigCheck,
    refetchAuth,
    refetchSysCheck,
    isGoogleConnected: authStatus?.connected || false
  };
};
