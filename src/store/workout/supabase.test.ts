import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncSessionToSupabase, mapSupabaseWorkout } from './supabase';
import type { WorkoutSession } from './types';

const { getSupabaseClient, getSupabaseUserId, update } = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getSupabaseUserId: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ getSupabaseClient, getSupabaseUserId }));

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
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseClient.mockResolvedValue(null);
  });

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

describe('sinkronisasi berdasarkan ID sesi sumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseUserId.mockResolvedValue(null);
  });

  it('memperbarui sesi dengan ID sumber yang sama saat timestamp bertabrakan', async () => {
    const session = makeSession({ id: 'imported_1750000000000_1' });
    const rows = [
      { id: 'remote-a', source_session_id: 'session_1750000000000', session_start_time: session.sessionStartTime, created_at: session.date, duration: 120, stats: session.stats, history: [], synced_to_google: false },
      { id: 'remote-b', source_session_id: session.id, session_start_time: session.sessionStartTime, created_at: session.date, duration: 120, stats: session.stats, history: [], synced_to_google: false },
    ];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      update: vi.fn(() => query),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null }),
    };
    query.update.mockImplementation(() => {
      update();
      return query;
    });
    const client = { from: vi.fn(() => query) };
    getSupabaseClient.mockResolvedValue(client);

    const result = await syncSessionToSupabase(session);

    expect(update).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenLastCalledWith('id', 'remote-b');
    expect(result.supabase_id).toBe('remote-b');
    expect(result.synced_to_supabase).toBe(true);
  });

  it('memetakan ID sumber kembali sebagai ID sesi lokal', () => {
    const session = makeSession({ id: 'session_1750000000000' });
    const mapped = mapSupabaseWorkout({
      id: 'remote-id', source_session_id: session.id, session_start_time: session.sessionStartTime,
      created_at: session.date, duration: 120, stats: session.stats, history: [],
    });

    expect(mapped.id).toBe(session.id);
    expect(mapped.supabase_id).toBe('remote-id');
  });
});
