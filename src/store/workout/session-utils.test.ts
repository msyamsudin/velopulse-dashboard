import { describe, expect, it } from 'vitest';
import { getSessionKey, isSupabaseSyncPending, mergeSessionHistories, sanitizeLegacySessionDuration } from './session-utils';
import type { WorkoutSession } from './types';

const makeHistory = (pointCount: number, finalDistanceMeters: number, maxSpeed: number) => {
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    points.push({
      time: `00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
      ts: i * 1000,
      hr: 110,
      cadence: 70,
      power: 50,
      speed: i === pointCount - 1 ? maxSpeed : 20,
      distance: Math.round((finalDistanceMeters * i) / (pointCount - 1)),
      resistance: 10,
      calories: 10,
    });
  }
  return points;
};

const makeSession = (overrides: Partial<WorkoutSession>): WorkoutSession => ({
  id: 's1',
  sessionStartTime: Date.parse('2026-04-19T07:17:22.350Z'),
  date: '2026-04-19T07:17:22.350Z',
  duration: 60,
  stats: {
    avgHr: 107,
    maxHr: 126,
    avgPower: 41,
    maxPower: 85,
    avgCadence: 68,
    maxCadence: 105,
    maxSpeed: 35,
  },
  history: makeHistory(150, 2000, 35),
  ...overrides,
});

describe('sanitizeLegacySessionDuration', () => {
  it('repairs a legacy session whose stored duration froze far below the ride length', () => {
    // Mirrors the real 2026-04-19 session: ~2 km recorded over 150 points
    // (≈1 point/second ⇒ ~2:30 real) but stored with duration = 60 s, which
    // would imply an impossible 120 km/h average (max recorded speed 35).
    const session = makeSession({});

    const repaired = sanitizeLegacySessionDuration(session);

    expect(repaired.duration).toBe(149); // point-count derived (ts span = 149 s)
    expect(repaired.id).toBe('s1');
    expect(repaired.history).toBe(session.history);
  });

  it('leaves a consistent session untouched (same object)', () => {
    // 600 s stored, 600 points, 4 km ⇒ ~24 km/h average ≤ max 30 km/h.
    const session = makeSession({
      duration: 600,
      history: makeHistory(600, 4000, 30),
    });

    const result = sanitizeLegacySessionDuration(session);

    expect(result).toBe(session);
  });

  it('ignores sessions with no speed reference to compare against', () => {
    const session = makeSession({
      duration: 60,
      history: makeHistory(150, 2000, 0).map(point => ({ ...point, speed: 0 })),
      stats: {
        avgHr: 107,
        maxHr: 126,
        avgPower: 41,
        maxPower: 85,
        avgCadence: 68,
        maxCadence: 105,
      },
    });

    expect(sanitizeLegacySessionDuration(session)).toBe(session);
  });

  it('does not lengthen when the derived time is not clearly larger (below 2×)', () => {
    const session = makeSession({
      duration: 120,
      history: makeHistory(150, 2000, 35), // derived 149 s < 2 × 120 s
    });

    expect(sanitizeLegacySessionDuration(session)).toBe(session);
  });
});

describe('isSupabaseSyncPending', () => {
  it('treats an unsynced real session as pending', () => {
    expect(isSupabaseSyncPending({ synced_to_supabase: false })).toBe(true);
    expect(isSupabaseSyncPending({})).toBe(true);
  });

  it('never counts a synced session as pending', () => {
    expect(isSupabaseSyncPending({ synced_to_supabase: true })).toBe(false);
  });

  it('excludes demo sessions even though they are not in the cloud', () => {
    // Data demo hidup hanya di perangkat ini: kalau ikut terhitung, setiap
    // auto-sync akan mencoba mengirimnya dan melaporkan kegagalan.
    expect(isSupabaseSyncPending({ simulated: true, synced_to_supabase: false })).toBe(false);
  });
});

describe('getSessionKey', () => {
  it('mempertahankan sesi berbeda yang memiliki timestamp sama', () => {
    const first = makeSession({ id: 'session_1' });
    const second = makeSession({ id: 'imported_1_0' });

    expect(getSessionKey(first)).not.toBe(getSessionKey(second));
    expect(mergeSessionHistories([first], [second])).toHaveLength(2);
  });

  it('menggabungkan salinan cloud lama hanya saat isi sesi juga sama', () => {
    const legacyRemote = makeSession({ id: 'remote-uuid', supabase_id: 'remote-uuid' });
    const localCopy = makeSession({ id: 'session_1', supabase_id: 'remote-uuid' });

    expect(getSessionKey(legacyRemote)).not.toBe(getSessionKey(localCopy));
    expect(mergeSessionHistories([localCopy], [legacyRemote])).toHaveLength(1);
    expect(mergeSessionHistories([localCopy], [makeSession({
      id: 'another-session', sessionStartTime: localCopy.sessionStartTime,
      duration: localCopy.duration + 1, supabase_id: 'another-session',
    })])).toHaveLength(2);
  });

  it('membuang salinan lokal saat baris cloud dengan ID yang sama telah dimuat', () => {
    const cloudSession = makeSession({ id: 'cloud-source-id', supabase_id: 'cloud-row-id' });
    const localCopy = makeSession({
      id: 'session_1792060701828',
      supabase_id: 'cloud-row-id',
      // Isi lokal bisa berbeda karena riwayat lama dikompaksi di localStorage.
      history: makeHistory(20, 2000, 35),
    });

    const merged = mergeSessionHistories([localCopy], [cloudSession]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('cloud-source-id');
    expect(merged[0].supabase_id).toBe('cloud-row-id');
    expect(merged[0].history).toBe(cloudSession.history);
  });
});
