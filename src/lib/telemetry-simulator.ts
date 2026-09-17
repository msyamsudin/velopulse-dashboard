import { calcCaloriesFromPower } from './physics';

/**
 * Simulator telemetri untuk mode demo.
 *
 * Kokpit latihan tidak bisa dibuka tanpa perangkat BLE sungguhan (strap HR
 * wajib, sepeda statis mengisi power/cadence). Untuk verifikasi visual — dan
 * untuk menguji alur latihan di mesin tanpa perangkat keras — modul ini
 * menghasilkan telemetri sintetis yang bentuknya mengikuti ride sungguhan:
 * interval daya berulang, detak jantung yang tertinggal di belakang daya, dan
 * kecepatan yang diturunkan dari daya.
 *
 * Semua fungsi di sini murni dan deterministik (PRNG ber-seed), sehingga hasil
 * tiap tick bisa diuji dan setiap perulangan demo menghasilkan pola yang sama.
 */

export interface SimulationProfile {
  /** FTP pengguna (W); 0 atau negatif memakai nilai fallback. */
  ftp: number;
  /** Detak jantung maksimum (bpm); 0 atau negatif memakai nilai fallback. */
  maxHr: number;
  /** Detak jantung istirahat (bpm); nilai tidak masuk akal memakai fallback. */
  restingHr: number;
}

export interface SimulationState {
  elapsedSeconds: number;
  phaseIndex: number;
  phaseElapsedSeconds: number;
  heartRate: number;
  cadence: number;
  power: number;
  speedKmh: number;
  resistance: number;
  distanceMeters: number;
  calories: number;
  /** Benih PRNG yang dibawa antar tick agar noise tetap deterministik. */
  randomSeed: number;
}

export interface SimulationTelemetry {
  heartRate: number;
  cadence: number;
  power: number;
  speed: number;
  resistance: number;
  distance: number;
  calories: number;
}

export interface SimulationInterval {
  id: 'warmup' | 'endurance' | 'tempo' | 'threshold' | 'recovery';
  durationSeconds: number;
  /** Target daya sebagai fraksi FTP. */
  intensity: number;
}

/**
 * Rencana interval demo: satu putaran ±10 menit yang menyapu zona HR Z2–Z5 lalu
 * kembali turun, supaya gauge, zona, dan beban latihan terlihat bergerak.
 */
export const SIMULATION_PLAN: SimulationInterval[] = [
  { id: 'warmup', durationSeconds: 90, intensity: 0.45 },
  { id: 'endurance', durationSeconds: 180, intensity: 0.65 },
  { id: 'tempo', durationSeconds: 150, intensity: 0.82 },
  { id: 'threshold', durationSeconds: 90, intensity: 1 },
  { id: 'recovery', durationSeconds: 120, intensity: 0.5 }
];

/** Satu tick = satu detik, sama dengan laju paket FTMS pada umumnya. */
export const SIMULATION_TICK_MS = 1000;

const FALLBACK_FTP = 150;
const FALLBACK_MAX_HR = 185;
/** Tahanan udara kasar: P = k × v³, dengan v dalam m/s (150 W ≈ 30 km/h). */
const DRAG_COEFFICIENT = 0.26;
/** Detak jantung istirahat cadangan bila profil belum punya nilai wajar. */
const RESTING_HR_RATIO = 0.32;

/** Seberapa cepat tiap besaran mendekati targetnya per detik (0–1). */
const POWER_LAG = 0.2;
const CADENCE_LAG = 0.25;
const SPEED_LAG = 0.15;
/** HR punya inersia fisiologis: naik/turun jauh lebih lambat dari daya. */
const HR_LAG = 0.05;

/** Pemetaan intensitas daya ke cadangan detak jantung (Karvonen). */
const HR_RESERVE_BASE = 0.28;
const HR_RESERVE_SPAN = 0.55;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Pendekatan eksponensial terhadap target. Faktornya ikut diskalakan dengan dt
 * (dari konstanta per detik), jadi tick berdurasi nol tidak mengubah apa pun.
 */
const approach = (current: number, target: number, factorPerSecond: number, dt: number) =>
  current + (target - current) * (1 - Math.pow(1 - factorPerSecond, dt));

/** PRNG mulberry32: deterministik, tanpa dependensi, cukup untuk noise demo. */
const nextRandom = (seed: number): { seed: number; value: number } => {
  const nextSeed = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(nextSeed ^ (nextSeed >>> 15), 1 | nextSeed);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { seed: nextSeed, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
};

/** Melengkapi profil yang kosong dengan nilai wajar agar demo tidak menghasilkan 0 W. */
export const resolveSimulationProfile = (profile: SimulationProfile): Required<SimulationProfile> => {
  const maxHr = profile.maxHr > 0 ? profile.maxHr : FALLBACK_MAX_HR;
  const restingHr = profile.restingHr > 0 && profile.restingHr < maxHr
    ? profile.restingHr
    : Math.round(maxHr * RESTING_HR_RATIO);
  return {
    ftp: profile.ftp > 0 ? profile.ftp : FALLBACK_FTP,
    maxHr,
    restingHr
  };
};

/** Keadaan awal: pengendara diam sebelum kayuhan pertama. */
export const createSimulationState = (profile: SimulationProfile): SimulationState => {
  const { restingHr } = resolveSimulationProfile(profile);
  return {
    elapsedSeconds: 0,
    phaseIndex: 0,
    phaseElapsedSeconds: 0,
    heartRate: restingHr,
    cadence: 0,
    power: 0,
    speedKmh: 0,
    resistance: 0,
    distanceMeters: 0,
    calories: 0,
    randomSeed: 0x5eed
  };
};

/**
 * Memajukan simulasi sejumlah detik dan mengembalikan keadaan baru beserta
 * telemetri yang siap ditulis ke store BLE.
 */
export const advanceSimulation = (
  state: SimulationState,
  profile: SimulationProfile,
  seconds = 1
): { state: SimulationState; telemetry: SimulationTelemetry } => {
  const { ftp, maxHr, restingHr } = resolveSimulationProfile(profile);
  const dt = Math.max(seconds, 0);

  // 1. Majukan interval dan putar kembali ke awal setelah rencana habis.
  let phaseIndex = state.phaseIndex;
  let phaseElapsedSeconds = state.phaseElapsedSeconds + dt;
  while (phaseElapsedSeconds >= SIMULATION_PLAN[phaseIndex].durationSeconds) {
    phaseElapsedSeconds -= SIMULATION_PLAN[phaseIndex].durationSeconds;
    phaseIndex = (phaseIndex + 1) % SIMULATION_PLAN.length;
  }
  const intensity = SIMULATION_PLAN[phaseIndex].intensity;

  // 2. Noise deterministik: sedikit variasi supaya angka tidak terlihat beku.
  const first = nextRandom(state.randomSeed);
  const second = nextRandom(first.seed);
  const third = nextRandom(second.seed);

  // 3. Target dari intensitas interval.
  const targetPower = ftp * intensity * (1 + (first.value - 0.5) * 0.06);
  const targetCadence = 78 + intensity * 14 + (second.value - 0.5) * 3;
  const targetSpeedKmh = 3.6 * Math.cbrt(Math.max(targetPower, 0) / DRAG_COEFFICIENT);
  const hrReserveFraction = HR_RESERVE_BASE + intensity * HR_RESERVE_SPAN;
  const targetHr = restingHr + (maxHr - restingHr) * hrReserveFraction;

  // 4. Pendekatan bertahap: besaran mekanis cepat, detak jantung lambat.
  const power = approach(state.power, targetPower, POWER_LAG, dt);
  const cadence = approach(state.cadence, targetCadence, CADENCE_LAG, dt);
  const speedKmh = approach(state.speedKmh, targetSpeedKmh, SPEED_LAG, dt);
  const heartRate = clamp(
    approach(state.heartRate, targetHr, HR_LAG, dt) + (third.value - 0.5) * 2,
    restingHr,
    maxHr
  );

  // 5. Integrasi jarak dan kalori dengan rumus yang sama seperti sesi sungguhan.
  const distanceMeters = state.distanceMeters + (speedKmh / 3.6) * dt;
  const calories = state.calories + calcCaloriesFromPower(power, dt);
  const resistance = Math.round(2 + intensity * 8);

  return {
    state: {
      elapsedSeconds: state.elapsedSeconds + dt,
      phaseIndex,
      phaseElapsedSeconds,
      heartRate,
      cadence,
      power,
      speedKmh,
      resistance,
      distanceMeters,
      calories,
      randomSeed: third.seed
    },
    telemetry: {
      heartRate: Math.round(heartRate),
      cadence: Math.round(cadence),
      power: Math.round(power),
      speed: Number(speedKmh.toFixed(1)),
      resistance,
      distance: distanceMeters,
      calories
    }
  };
};
