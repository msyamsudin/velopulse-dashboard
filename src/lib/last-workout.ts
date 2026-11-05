import type { WorkoutSession } from '@/store/useWorkoutStore';

const MS_PER_DAY = 86_400_000;

/** Awal hari lokal, supaya selisih dihitung per tanggal dan bukan per 24 jam. */
const startOfLocalDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Menghitung berapa hari kalender sejak sesi terakhir.
 *
 * Patokannya awal hari lokal, bukan selisih 24 jam: sesi kemarin malam dan sesi
 * pagi ini tetap berjarak satu hari, bukan nol. `Math.round` menjaga hasilnya
 * tetap benar saat pergantian DST membuat satu hari berdurasi 23 atau 25 jam.
 *
 * `null` berarti belum ada sesi bertanggal valid sama sekali — pemanggil yang
 * memutuskan bagaimana menampilkannya.
 */
export const daysSinceLastWorkout = (
  sessions: readonly Pick<WorkoutSession, 'date'>[],
  now: Date = new Date()
): number | null => {
  let latest = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    const timestamp = new Date(session.date).getTime();
    if (Number.isNaN(timestamp)) continue;
    if (timestamp > latest) latest = timestamp;
  }
  if (latest === Number.NEGATIVE_INFINITY) return null;

  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(new Date(latest))) / MS_PER_DAY);
  // Sesi bertanggal masa depan tidak boleh menghasilkan angka negatif.
  return Math.max(0, days);
};
