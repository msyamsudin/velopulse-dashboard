/**
 * Heart-rate recovery (HRR) classification.
 *
 * The level is stored as a stable code — 'excellent' | 'good' | 'fair' | 'poor' —
 * so a session recorded in one language still reads correctly in another. Legacy
 * sessions stored the already-translated label instead (Indonesian, from the
 * cockpit measurement), so `hrrLevelKey` also accepts those strings.
 */
export type HrrLevel = 'excellent' | 'good' | 'fair' | 'poor';

export const HRR_LEVEL_KEYS: Record<HrrLevel, string> = {
  excellent: 'Excellent (athletic)',
  good: 'Good (normal)',
  fair: 'Fair',
  poor: 'Not optimal',
};

export const HRR_LEVELS: readonly HrrLevel[] = ['excellent', 'good', 'fair', 'poor'];

/** 2-minute HR-drop thresholds used by the cockpit measurement. */
export const classifyHrrScore = (score: number): HrrLevel => {
  if (score >= 29) return 'excellent';
  if (score >= 18) return 'good';
  if (score >= 12) return 'fair';
  return 'poor';
};

/** Labels written by older app versions, mapped back onto the stable codes. */
const LEGACY_LABELS: Record<string, HrrLevel> = {
  'sangat baik (atletis)': 'excellent',
  'excellent (athletic)': 'excellent',
  'baik (normal)': 'good',
  'good (normal)': 'good',
  'good': 'good',
  'normal': 'good',
  'cukup': 'fair',
  'fair': 'fair',
  'kurang optimal': 'poor',
  'not optimal': 'poor',
};

/** Translation key for a stored classification (code or legacy label). */
export const hrrLevelKey = (value?: string | null): string => {
  if (!value) return 'Not classified';
  const normalized = value.trim().toLowerCase();
  const level = (HRR_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as HrrLevel)
    : LEGACY_LABELS[normalized];
  return level ? HRR_LEVEL_KEYS[level] : 'Not classified';
};
