import { useMutation } from '@tanstack/react-query';
import { useWorkoutStore } from '../store/useWorkoutStore';

export const useGoogleFitSync = (isGoogleConnected: boolean, userProfile: any, liveStats: any) => {
  const workout = useWorkoutStore();

  const syncMutation = useMutation({
    mutationFn: (workoutData: any) => fetch('/api/sync/google-fit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workoutData),
    }).then(res => {
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    }),
    onSuccess: (data, variables) => {
      if (variables.startTime) {
        workout.markAsSynced(variables.startTime);
      }
      setTimeout(() => syncMutation.reset(), 3000);
    }
  });

  const handleSyncGoogle = () => {
    if (!isGoogleConnected) return;
    syncMutation.mutate({
      startTime: workout.sessionStartTime,
      endTime: workout.sessionStartTime! + workout.elapsed * 1000,
      stats: liveStats,
      history: workout.history,
      maxHr: userProfile.maxHr,
      weight: userProfile.weight
    });
  };

  return {
    syncMutation,
    handleSyncGoogle
  };
};
