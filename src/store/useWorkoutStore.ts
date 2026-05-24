import { create } from 'zustand';
import { BluetoothData, useBluetoothStore } from './useBluetoothStore';
import { getSupabaseClient } from '@/lib/supabase';

export interface HistoryData {
  time: string;
  hr: number;
  cadence: number;
  power: number;
  speed: number;
  distance: number;
  resistance: number;
  calories: number;
}

export interface WorkoutSession {
  id: string;
  sessionStartTime: number;
  date: string;
  duration: number;
  stats: {
    avgHr: number;
    maxHr: number;
    avgPower: number;
    maxPower: number;
    avgCadence: number;
    maxCadence: number;
  };
  history: HistoryData[];
  synced_to_google?: boolean;
}

interface WorkoutState {
  isRecording: boolean;
  elapsed: number;
  sessionStartTime: number | null;
  startDistance: number;
  startCalories: number;
  history: HistoryData[];
  sessionHistory: WorkoutSession[];
  
  // Actions
  toggleRecording: () => void;
  incrementElapsed: () => void;
  addHistoryPoint: (data: BluetoothData) => void;
  saveSession: () => Promise<void>;
  discardSession: () => void;
  loadHistory: () => void;
  loadHistoryFromSupabase: () => Promise<void>;
  markAsSynced: (startTime: number) => Promise<void>;
  formatTime: (seconds: number) => string;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  isRecording: false,
  elapsed: 0,
  sessionStartTime: null,
  startDistance: 0,
  startCalories: 0,
  history: [],
  sessionHistory: [],

  toggleRecording: () => {
    const { isRecording } = get();
    if (!isRecording) {
      set({
        history: [],
        elapsed: 0,
        sessionStartTime: Date.now(),
        startDistance: useBluetoothStore.getState().data.distance || 0,
        startCalories: useBluetoothStore.getState().data.calories || 0,
        isRecording: true,
      });
    } else {
      set({ isRecording: false });
    }
  },

  incrementElapsed: () => set((state) => ({ elapsed: state.elapsed + 1 })),

  addHistoryPoint: (data) => {
    if (!get().isRecording) return;
    const { startDistance, startCalories } = get();
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // To prevent timeline stretching, don't add multiple points for the same second
    const lastPoint = get().history[get().history.length - 1];
    if (lastPoint && lastPoint.time === timeStr) return;

    set((state) => ({
      history: [...state.history, {
        time: timeStr,
        hr: data.heartRate || 0,
        cadence: data.cadence || 0,
        power: data.power || 0,
        speed: data.speed || 0,
        distance: Math.max(0, (data.distance || 0) - startDistance),
        resistance: data.resistance || 0,
        calories: Math.max(0, (data.calories || 0) - startCalories)
      }]
    }));
  },


  saveSession: async () => {
    const { history, elapsed, sessionHistory, sessionStartTime } = get();
    if (!sessionStartTime) return;

    // Allow saving if there's history OR if there's significant elapsed time
    if (history.length === 0 && elapsed < 1) {
      get().discardSession();
      return;
    }

    const stats = {
      avgHr: Math.round(history.reduce((a, b) => a + b.hr, 0) / history.length),
      maxHr: Math.max(...history.map(h => h.hr)),
      avgPower: Math.round(history.reduce((a, b) => a + b.power, 0) / history.length),
      maxPower: Math.max(...history.map(h => h.power)),
      avgCadence: Math.round(history.reduce((a, b) => a + b.cadence, 0) / history.length),
      maxCadence: Math.max(...history.map(h => h.cadence)),
    };

    const newSession: WorkoutSession = {
      id: `session_${Date.now()}`,
      sessionStartTime,
      date: new Date().toISOString(),
      duration: elapsed,
      stats,
      history,
      synced_to_google: false
    };

    // Save to LocalStorage first
    const updatedHistory = [newSession, ...sessionHistory].slice(0, 50);
    set({ sessionHistory: updatedHistory });
    localStorage.setItem('velopulse_sessions', JSON.stringify(updatedHistory));

    // Save to Supabase (Background)
    try {
      const client = await getSupabaseClient();
      if (!client) {
        console.warn('[Supabase] Client not available. Skipping sync (config not set).');
        return;
      }
      await client.from('workouts').insert([{
        session_start_time: sessionStartTime,
        duration: elapsed,
        stats,
        history,
        synced_to_google: false
      }]);
    } catch (err: any) {
      console.error('Failed to sync workout to Supabase:', err?.message || JSON.stringify(err) || err);
    }
    
    // Clear current workout after saving
    get().discardSession();
  },

  discardSession: () => {
    set({
      history: [],
      elapsed: 0,
      sessionStartTime: null
    });
  },

  loadHistory: () => {
    const saved = localStorage.getItem('velopulse_sessions');
    if (saved) {
      try {
        set({ sessionHistory: JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to load session history');
      }
    }
  },

  loadHistoryFromSupabase: async () => {
    try {
      const client = await getSupabaseClient();
      if (!client) {
        console.warn('[Supabase] Client not available. Skipping load (config not set).');
        return;
      }

      const { data, error } = await client
        .from('workouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        const mappedSessions: WorkoutSession[] = data.map(item => ({
          id: item.id,
          sessionStartTime: item.session_start_time,
          date: item.created_at,
          duration: item.duration,
          stats: item.stats,
          history: item.history,
          synced_to_google: item.synced_to_google
        }));
        set({ sessionHistory: mappedSessions });
        localStorage.setItem('velopulse_sessions', JSON.stringify(mappedSessions));
      }
    } catch (err: any) {
      console.error('Failed to fetch from Supabase:', err?.message || JSON.stringify(err) || err);
    }
  },

  markAsSynced: async (startTime: number) => {
    try {
      const client = await getSupabaseClient();
      if (!client) {
        console.warn('[Supabase] Client not available. Skipping markAsSynced (config not set).');
        return;
      }

      await client
        .from('workouts')
        .update({ synced_to_google: true })
        .eq('session_start_time', startTime);
      
      // Also update local state if needed
      set((state) => ({
        sessionHistory: state.sessionHistory.map(s => 
          s.sessionStartTime === startTime ? { ...s, synced_to_google: true } : s
        )
      }));
    } catch (err: any) {
      console.error('Failed to update sync status in Supabase:', err?.message || JSON.stringify(err) || err);
    }
  },

  formatTime: (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}));
