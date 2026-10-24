/**
 * Profil pesepeda: satu-satunya definisi bentuk, nilai default, dan turunan
 * `maxHr`.
 *
 * Sebelum modul ini ada, bentuk profil dideklarasikan ulang di formulir, modal,
 * helper server, dan tipe cockpit, sementara nilai default hidup di dua berkas
 * yang harus "tetap sinkron" secara manual. Perubahan satu field berarti
 * menyentuh enam tempat, dan ketidakcocokan sudah terjadi: klien menganggap
 * `restingHr` bagian dari profil, server membuangnya tanpa peringatan.
 *
 * Modul ini murni (tanpa `fs`, tanpa React) supaya dapat dipakai klien, route
 * API, dan tes dengan cara yang sama.
 */

export interface UserProfile {
  /** Usia dalam tahun; 0 berarti belum diisi. */
  age: number;
  /** Detak jantung maksimum (bpm); diturunkan dari usia atau diukur manual. */
  maxHr: number;
  /** FTP dalam watt; 0 berarti belum diisi dan mematikan zona daya. */
  ftp: number;
  /** Berat badan dalam kg; 0 berarti belum diisi dan mematikan metrik W/kg. */
  weight: number;
  /** Detak jantung istirahat (bpm); 0 berarti belum diisi. */
  restingHr: number;
}

export const DEFAULT_PROFILE: UserProfile = {
  age: 0,
  maxHr: 190, // Aman untuk pembagian; age = 0 tetap memicu onboarding
  ftp: 0,
  weight: 0,
  restingHr: 0,
};

/**
 * Max HR memakai rumus Robergs & Landwehr, yang lebih akurat daripada Fox
 * (220 − usia): meta-analisis 18.712 subjek.
 */
export const calculateMaxHr = (age: number): number => {
  if (age <= 0) return DEFAULT_PROFILE.maxHr;
  return Math.round(205.8 - (0.685 * age));
};

/** Angka dari JSON, angka dari string formulir, atau NaN bila tidak terbaca. */
const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
};

/**
 * Menormalkan payload API maupun baris database ke bentuk kanonik.
 *
 * Nama field camelCase (kontrak aplikasi) dan snake_case (kolom Supabase)
 * sama-sama diterima karena baris cloud dibaca apa adanya. Field yang tidak
 * ada memakai `fallback` (default: `DEFAULT_PROFILE`), sedangkan field yang
 * ada tetapi tidak terbaca menjadi NaN agar validasi dapat menolaknya alih-alih
 * diam-diam menyimpannya sebagai 0.
 */
export const normalizeProfile = (
  input: unknown,
  fallback: UserProfile = DEFAULT_PROFILE
): UserProfile => {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const read = (field: keyof UserProfile, ...keys: string[]): number => {
    for (const key of keys) {
      if (key in source) return toNumber(source[key]);
    }
    return fallback[field];
  };

  return {
    age: read('age', 'age'),
    maxHr: read('maxHr', 'maxHr', 'max_hr'),
    ftp: read('ftp', 'ftp'),
    weight: read('weight', 'weight'),
    restingHr: read('restingHr', 'restingHr', 'resting_hr'),
  };
};
