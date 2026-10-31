/**
 * Aturan pengukuran FTP.
 *
 * Protokolnya 20 menit all-out; hasilnya 95% rata-rata daya selama effort.
 * Modul ini murni: tidak tahu React, BLE, atau jam dinding, sehingga aturan
 * validitas bisa diuji tanpa timer.
 */

/** Pemanasan 5 menit; boleh dilewati karena yang diukur hanya effort 20 menit. */
export const FTP_WARMUP_SECONDS = 5 * 60;

/** Durasi effort utama. */
export const FTP_EFFORT_SECONDS = 20 * 60;

/**
 * Cakupan data minimal 18 menit. Rata-rata effort 15 menit selalu lebih tinggi
 * daripada rata-rata 20 menit, jadi angka yang lebih pendek tidak boleh dipakai
 * sebagai dasar FTP.
 */
export const FTP_MIN_COVERAGE_SECONDS = 18 * 60;

/** Hasil tes = 95% rata-rata daya effort. */
export const FTP_RESULT_FACTOR = 0.95;

/**
 * Jarak antar sampel yang lebih besar dari ini adalah lubang data, bukan bagian
 * effort. Nilai ini memberi ruang untuk satu detik yang terlewat tanpa
 * menganggapnya sebagai dropout.
 */
export const FTP_MAX_SAMPLE_GAP_SECONDS = 3;

export interface FtpSample {
  /** Wall-clock ms saat sampel diambil. */
  ts: number;
  power: number;
  /** True ketika watchdog BLE sudah mengosongkan nilai daya ini. */
  stalePower?: boolean;
}

export type FtpInvalidReason = 'no-samples' | 'no-power' | 'short-coverage';

export interface FtpResult {
  valid: boolean;
  /** Alasan hasil tidak dapat dipakai; null saat valid. */
  reason: FtpInvalidReason | null;
  /** 95% rata-rata daya effort, dibulatkan; null saat tidak valid. */
  ftp: number | null;
  /** Rata-rata daya pada interval yang tercakup, dibulatkan. */
  avgPower: number;
  /** Total detik data bersih yang jadi dasar perhitungan. */
  coverageSeconds: number;
  /** Jumlah lubang data di dalam window effort. */
  gapCount: number;
}

export interface FtpEffortWindow {
  effortStart: number;
  effortEnd: number;
}

const emptyResult = (reason: FtpInvalidReason): FtpResult => ({
  valid: false,
  reason,
  ftp: null,
  avgPower: 0,
  coverageSeconds: 0,
  gapCount: 0,
});

/**
 * Menghitung hasil FTP dari sampel daya dan window effort.
 *
 * Rata-rata ditimbang waktu, bukan rata-rata sampel: interval yang lebih panjang
 * membawa bobot lebih besar. Sampel `stalePower`, timestamp di luar window, dan
 * interval yang lebih panjang dari `FTP_MAX_SAMPLE_GAP_SECONDS` tidak dihitung.
 */
export const computeFtpResult = (
  samples: readonly FtpSample[],
  { effortStart, effortEnd }: FtpEffortWindow
): FtpResult => {
  const usable = samples
    .filter(
      sample =>
        Number.isFinite(sample.ts) &&
        Number.isFinite(sample.power) &&
        !sample.stalePower &&
        sample.ts >= effortStart &&
        sample.ts <= effortEnd
    )
    .sort((a, b) => a.ts - b.ts);

  if (usable.length === 0) return emptyResult('no-samples');

  let weightedPower = 0;
  let coverageSeconds = 0;
  let gapCount = 0;

  for (let index = 0; index < usable.length - 1; index += 1) {
    const deltaSeconds = (usable[index + 1].ts - usable[index].ts) / 1000;

    // Timestamp duplikat tidak menambah cakupan dan bukan lubang data.
    if (deltaSeconds <= 0) continue;

    if (deltaSeconds > FTP_MAX_SAMPLE_GAP_SECONDS) {
      gapCount += 1;
      continue;
    }

    // Daya negatif tidak mungkin dari powermeter; perlakukan sebagai nol agar
    // tidak menggeser rata-rata ke atas.
    weightedPower += Math.max(0, usable[index].power) * deltaSeconds;
    coverageSeconds += deltaSeconds;
  }

  const avgPower = coverageSeconds > 0 ? weightedPower / coverageSeconds : 0;
  const roundedAvgPower = Math.round(avgPower);
  const roundedCoverage = Math.round(coverageSeconds);

  if (coverageSeconds <= 0) {
    return {
      ...emptyResult('short-coverage'),
      avgPower: roundedAvgPower,
      coverageSeconds: roundedCoverage,
      gapCount,
    };
  }

  if (avgPower <= 0) {
    return {
      ...emptyResult('no-power'),
      avgPower: roundedAvgPower,
      coverageSeconds: roundedCoverage,
      gapCount,
    };
  }

  if (coverageSeconds < FTP_MIN_COVERAGE_SECONDS) {
    return {
      ...emptyResult('short-coverage'),
      avgPower: roundedAvgPower,
      coverageSeconds: roundedCoverage,
      gapCount,
    };
  }

  const ftp = Math.round(avgPower * FTP_RESULT_FACTOR);

  if (ftp <= 0) {
    return {
      ...emptyResult('no-power'),
      avgPower: roundedAvgPower,
      coverageSeconds: roundedCoverage,
      gapCount,
    };
  }

  return {
    valid: true,
    reason: null,
    ftp,
    avgPower: roundedAvgPower,
    coverageSeconds: roundedCoverage,
    gapCount,
  };
};

/** Cakupan data sebagai persentase effort 20 menit, untuk progress bar. */
export const getFtpCoveragePercent = (coverageSeconds: number): number => {
  if (!Number.isFinite(coverageSeconds) || coverageSeconds <= 0) return 0;
  return Math.min(100, Math.round((coverageSeconds / FTP_EFFORT_SECONDS) * 100));
};
