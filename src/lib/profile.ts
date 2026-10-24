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

export type ProfileField = keyof UserProfile;

/** Field yang gagal validasi. Pesan untuk pengguna hidup di lapisan UI. */
export type ProfileErrors = Partial<Record<ProfileField, true>>;

/**
 * Batas nilai yang dianggap masuk akal untuk seorang pesepeda.
 *
 * `ftp`, `weight`, dan `restingHr` menerima 0 sebagai "belum diisi", mengikuti
 * gate metrik di profile-gate.ts yang memperlakukan 0 sebagai tidak tersedia.
 */
export const PROFILE_LIMITS = {
  age: { min: 10, max: 100 },
  maxHr: { min: 100, max: 230 },
  ftp: { min: 0, max: 2000 },
  weight: { min: 20, max: 300 },
  restingHr: { min: 25, max: 120 },
} as const;

const within = (value: number, min: number, max: number): boolean =>
  Number.isFinite(value) && value >= min && value <= max;

/** Satu desimal: 72,5 lolos, 72,55 ditolak. */
const hasAtMostOneDecimal = (value: number): boolean => Math.round(value * 10) / 10 === value;

/**
 * Memeriksa profil sebelum disimpan, baik di klien (pesan inline) maupun di
 * route API (400 sebelum menyentuh database). Tanpa ini, usia negatif atau
 * field yang hilang berakhir sebagai error database yang tidak bisa dijelaskan
 * kepada pengguna.
 */
export const validateProfile = (profile: UserProfile): ProfileErrors => {
  const errors: ProfileErrors = {};

  if (!Number.isInteger(profile.age) || !within(profile.age, PROFILE_LIMITS.age.min, PROFILE_LIMITS.age.max)) {
    errors.age = true;
  }
  if (!Number.isInteger(profile.maxHr) || !within(profile.maxHr, PROFILE_LIMITS.maxHr.min, PROFILE_LIMITS.maxHr.max)) {
    errors.maxHr = true;
  }
  if (!Number.isInteger(profile.ftp) || !within(profile.ftp, PROFILE_LIMITS.ftp.min, PROFILE_LIMITS.ftp.max)) {
    errors.ftp = true;
  }

  const weightUsable = profile.weight === 0
    || (within(profile.weight, PROFILE_LIMITS.weight.min, PROFILE_LIMITS.weight.max)
      && hasAtMostOneDecimal(profile.weight));
  if (!weightUsable) errors.weight = true;

  const restingUsable = profile.restingHr === 0
    || (Number.isInteger(profile.restingHr)
      && within(profile.restingHr, PROFILE_LIMITS.restingHr.min, PROFILE_LIMITS.restingHr.max)
      && profile.restingHr < profile.maxHr);
  if (!restingUsable) errors.restingHr = true;

  return errors;
};

export const profileErrorFields = (errors: ProfileErrors): ProfileField[] =>
  (Object.keys(errors) as ProfileField[]);

export const hasProfileErrors = (errors: ProfileErrors): boolean =>
  profileErrorFields(errors).length > 0;
