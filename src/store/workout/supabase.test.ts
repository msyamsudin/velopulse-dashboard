import { describe, expect, it } from 'vitest';
import { syncSessionToSupabase } from './supabase';
import type { WorkoutSession } from './types';

const makeSession = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'session_demo',
  sessionStartTime: 1_750_000_000_000,
  date: '2026-06-15T10:00:00.000Z',
  duration: 120,
  stats: {
    avgHr: 120,
    maxHr: 140,
    avgPower: 150,
    maxPower: 180,
    avgCadence: 84,
    maxCadence: 90,
    avgSpeed: 30,
    maxSpeed: 32,
  },
  history: [],
  synced_to_supabase: false,
  ...overrides,
});

describe('syncSessionToSupabase dengan sesi demo', () => {
  it('keluar lebih awal tanpa menyentuh klien Supabase', async () => {
    const demo = makeSession({ simulated: true });

    const result = await syncSessionToSupabase(demo);

    // Objek yang sama persis: tidak ada lookup, insert, maupun update.
    expect(result).toBe(demo);
    expect(result.synced_to_supabase).toBe(false);
    expect(result.supabase_id).toBeUndefined();
    // Sesi biasa di lingkungan ini menempelkan error konfigurasi; sesi demo
    // tidak boleh sampai ke titik itu.
    expect(result.supabase_sync_error).toBeUndefined();
  });

  it('tidak salah menandai sebagai tersinkron', async () => {
    const demo = makeSession({ simulated: true, supabase_sync_error_code: undefined });

    const result = await syncSessionToSupabase(demo);

    expect(result.synced_to_supabase).toBe(false);
    expect(result.supabase_sync_error_code).toBeUndefined();
  });
});
