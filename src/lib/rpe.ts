/**
 * Subjective effort (RPE / sRPE).
 *
 * Sensors measure what the body did; only the rider knows how hard it felt.
 * Session RPE (sRPE = RPE × minutes) is a load in its own arbitrary unit, which
 * is exactly why it cannot be compared with Edwards TRIMP by ratio: 300 sRPE is
 * not "twice" 150 TRIMP. The comparison therefore happens on **rank**: where
 * this session's perceived load sits among the rider's other rated sessions,
 * versus where its heart-rate load sits among the same rides. A big rank gap
 * means the ride felt different from how it scored — the signal worth showing.
 */
import { calculateEdwardsTrimp } from './training-load';

export interface RatedEffortSession {
  id: string;
  duration: number;
  history?: { hr?: number }[];
  stats?: { rpe?: number };
}

export type EffortAgreement = 'aligned' | 'perceived-harder' | 'perceived-easier';

/** i18n keys for the verdict, rendered with t(). */
export const EFFORT_AGREEMENT_KEYS: Record<EffortAgreement, string> = {
  aligned: 'Matched the recorded load',
  'perceived-harder': 'Felt harder than the recorded load',
  'perceived-easier': 'Felt easier than the recorded load',
};

/** Other rated sessions needed before a rank comparison means anything. */
export const RPE_MIN_RATED_SESSIONS = 3;

/** Rank gap (percentage points) still counted as agreement. */
export const RPE_AGREEMENT_TOLERANCE = 20;

export interface EffortComparison {
  /** Share (0..1) of the other rated sessions with a lower perceived load. */
  rpePercentile: number;
  /** Share (0..1) of them with a lower heart-rate load. */
  trimpPercentile: number;
  /** Percentage points; positive when the ride felt harder than it scored. */
  gap: number;
  agreement: EffortAgreement;
}

/**
 * Session RPE in arbitrary units: RPE (1–10) × duration in minutes.
 * Returns null for an unrated session, so callers never show a 0 AU effort.
 */
export const getSessionRpeLoad = (
  rpe: number | null | undefined,
  durationSeconds: number
): number | null => {
  if (typeof rpe !== 'number' || !Number.isFinite(rpe) || rpe <= 0) return null;
  if (!(durationSeconds > 0)) return null;
  return Math.round(rpe * (durationSeconds / 60));
};

interface EffortPair {
  srpe: number;
  trimp: number;
}

/**
 * Both sides of one session, or null when the session cannot take part:
 * unrated, or without a heart-rate load to compare the perception against.
 */
const getEffortPair = (session: RatedEffortSession, maxHr: number): EffortPair | null => {
  const srpe = getSessionRpeLoad(session.stats?.rpe, session.duration);
  if (srpe === null) return null;

  const trimp = calculateEdwardsTrimp(session.history || [], session.duration, maxHr).score;
  if (!(trimp > 0)) return null;

  return { srpe, trimp };
};

const shareBelow = (values: number[], value: number): number =>
  values.length > 0 ? values.filter(entry => entry < value).length / values.length : 0;

/**
 * Rank-based effort comparison for one session against the rider's other rated
 * sessions. Returns null when the session is unrated, carries no heart-rate
 * load, or fewer than `RPE_MIN_RATED_SESSIONS` comparable rides exist.
 */
export const compareSessionEffort = (
  session: RatedEffortSession,
  allSessions: RatedEffortSession[] | undefined,
  maxHr: number
): EffortComparison | null => {
  const target = getEffortPair(session, maxHr);
  if (!target) return null;

  const others = (allSessions || [])
    .filter(other => other.id !== session.id)
    .map(other => getEffortPair(other, maxHr))
    .filter((entry): entry is EffortPair => entry !== null);

  if (others.length < RPE_MIN_RATED_SESSIONS) return null;

  const rpePercentile = shareBelow(others.map(entry => entry.srpe), target.srpe);
  const trimpPercentile = shareBelow(others.map(entry => entry.trimp), target.trimp);
  const gap = Math.round((rpePercentile - trimpPercentile) * 100);

  return {
    rpePercentile,
    trimpPercentile,
    gap,
    agreement: gap > RPE_AGREEMENT_TOLERANCE
      ? 'perceived-harder'
      : gap < -RPE_AGREEMENT_TOLERANCE
        ? 'perceived-easier'
        : 'aligned',
  };
};
