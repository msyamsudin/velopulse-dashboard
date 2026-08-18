import { create } from 'zustand';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { claimOrphanWorkouts, getSupabaseClient } from '@/lib/supabase';
import { useWorkoutStore } from './useWorkoutStore';

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

let currentClient: SupabaseClient | null = null;
let unsubscribeAuth: (() => void) | null = null;

const runPostAuthSync = async () => {
  await claimOrphanWorkouts();
  const store = useWorkoutStore.getState();
  store.syncPendingSupabaseSessions();
  store.loadHistoryFromSupabase();
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  loading: false,
  error: null,
  notice: null,

  initialize: async () => {
    set({ loading: true });
    const client = await getSupabaseClient();
    if (!client) {
      set({ loading: false });
      return;
    }

    // Subscribe once per client instance (the client changes when the user
    // saves new Supabase credentials in Settings).
    if (currentClient !== client) {
      if (unsubscribeAuth) unsubscribeAuth();
      currentClient = client;
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        set({ session, loading: false, error: null });
      });
      unsubscribeAuth = () => subscription.unsubscribe();
    }

    const { data } = await client.auth.getSession();
    set({ session: data.session, loading: false });

    // A persisted session from a previous visit: claim pre-auth rows and
    // refresh cloud history so the app is up to date immediately.
    if (data.session) {
      runPostAuthSync();
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null, notice: null });
    try {
      const client = await getSupabaseClient();
      if (!client) {
        set({ loading: false, error: 'Supabase is not configured.' });
        return false;
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        set({ loading: false, error: error.message });
        return false;
      }

      set({ session: data.session, loading: false });
      await runPostAuthSync();
      return true;
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Sign in failed.'
      });
      return false;
    }
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null, notice: null });
    try {
      const client = await getSupabaseClient();
      if (!client) {
        set({ loading: false, error: 'Supabase is not configured.' });
        return false;
      }

      const { data, error } = await client.auth.signUp({ email, password });
      if (error) {
        set({ loading: false, error: error.message });
        return false;
      }

      if (data.session) {
        // Email confirmation is disabled: the user is signed in immediately.
        set({ session: data.session, loading: false });
        await runPostAuthSync();
      } else {
        // Confirmation email required before the account can sign in.
        set({ loading: false, notice: 'Check your email to confirm your account.' });
      }
      return true;
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Could not create account.'
      });
      return false;
    }
  },

  signOut: async () => {
    try {
      const client = await getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
    } catch (err) {
      console.warn('[Auth] Sign out failed:', err);
    }
    set({ session: null });
  },

  clearError: () => {
    if (get().error) set({ error: null });
  }
}));
