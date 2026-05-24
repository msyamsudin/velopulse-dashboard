export const DEFAULT_PROFILE = {
  age: 0,
  maxHr: 190,  // Safe fallback for division ops; age=0 still triggers onboarding
  ftp: 0,
  weight: 0
};

export const APP_METADATA = {
  name: 'VELOPULSE PRO',
  version: '1.1.0',
  buildDate: '2026.04.14'
};

export const HR_ZONES = [
  { label: 'Z1', minPct: 0.5, maxPct: 0.6, color: 'text-hw-muted', bg: 'bg-hw-muted/10' },
  { label: 'Z2', minPct: 0.6, maxPct: 0.7, color: 'text-green-400', bg: 'bg-green-400/10' },
  { label: 'Z3', minPct: 0.7, maxPct: 0.8, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { label: 'Z4', minPct: 0.8, maxPct: 0.9, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { label: 'Z5', minPct: 0.9, maxPct: 1.0, color: 'text-red-500', bg: 'bg-red-500/10' },
];

export const POWER_ZONES = [
  { label: 'Z1', name: 'Recovery', minPct: 0, maxPct: 0.55, color: 'bg-hw-muted', shadow: 'shadow-hw-muted/50' },
  { label: 'Z2', name: 'Endurance', minPct: 0.55, maxPct: 0.75, color: 'bg-blue-400', shadow: 'shadow-blue-400/50' },
  { label: 'Z3', name: 'Tempo', minPct: 0.75, maxPct: 0.90, color: 'bg-green-400', shadow: 'shadow-green-400/50' },
  { label: 'Z4', name: 'Threshold', minPct: 0.90, maxPct: 1.05, color: 'bg-yellow-400', shadow: 'shadow-yellow-400/50' },
  { label: 'Z5', name: 'VO2 Max', minPct: 1.05, maxPct: 1.20, color: 'bg-orange-500', shadow: 'shadow-orange-500/50' },
  { label: 'Z6', name: 'Anaerobic', minPct: 1.20, maxPct: 1.50, color: 'bg-red-500', shadow: 'shadow-red-500/50' },
  { label: 'Z7', name: 'Neuro', minPct: 1.50, maxPct: 2.00, color: 'bg-purple-500', shadow: 'shadow-purple-500/50' },
];

/**
 * Calculate Max HR using Robergs & Landwehr formula.
 * More accurate than Fox (220-age) — based on meta-analysis of 18,712 subjects.
 */
export const calculateMaxHr = (age: number): number => {
  if (age <= 0) return DEFAULT_PROFILE.maxHr;
  return Math.round(205.8 - (0.685 * age));
};

/** Safe maxHr — prevents division-by-zero throughout the app */
export const getSafeMaxHr = (maxHr: number): number => maxHr > 0 ? maxHr : DEFAULT_PROFILE.maxHr;

/**
 * Get absolute HR zone boundaries from a given maxHr.
 * Uses HR_ZONES as the single source of truth.
 */
export const getAbsoluteHrZones = (maxHr: number) => {
  const safe = getSafeMaxHr(maxHr);
  return HR_ZONES.map(z => ({
    label: z.label,
    min: Math.round(safe * z.minPct),
    max: Math.round(safe * z.maxPct),
    color: z.color,
    bg: z.bg,
  }));
};

/**
 * Determine the active HR zone index (0-4) for a given heart rate.
 * Returns -1 if HR is below Z1 threshold (< 50% maxHR) or HR <= 0.
 */
export const getActiveHrZoneIndex = (currentHr: number, maxHr: number): number => {
  if (currentHr <= 0) return -1;
  const safe = getSafeMaxHr(maxHr);
  const ratio = currentHr / safe;
  // Walk zones top-down for correct match
  for (let i = HR_ZONES.length - 1; i >= 0; i--) {
    if (ratio >= HR_ZONES[i].minPct) return i;
  }
  return -1; // Below Z1 (< 50%)
};
