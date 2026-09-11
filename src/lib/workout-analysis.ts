import { getSafeMaxHr } from './constants';
import type { WorkoutSession, HistoryData } from '@/store/useWorkoutStore';
import type {
  FullWorkoutStats,
  WorkoutZoneStat,
} from '@/lib/history-types';

/**
 * Single source of truth for a session's final distance/calories (max over
 * the history, robust against counter resets). Shared by the summary
 * aggregates, personal records, and every export format.
 */
export const getFinalMetrics = (history: HistoryData[]) => {
  let distanceMeters = 0;
  let calories = 0;
  for (const point of history) {
    if (point.distance > distanceMeters) distanceMeters = point.distance;
    if (point.calories > calories) calories = point.calories;
  }
  return { distanceMeters, calories };
};

const outcomeCache = new WeakMap<WorkoutSession, ReturnType<typeof computeOutcome>>();

const computeOutcome = (session: WorkoutSession) => {
  const history = session?.history || [];
  const { distanceMeters, calories } = getFinalMetrics(history);

  return {
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    calories: Math.round(calories),
    duration: session?.duration || 0,
    avgPower: session?.stats?.avgPower || 0,
    avgHr: session?.stats?.avgHr || 0,
  };
};

export const getSessionOutcome = (session: WorkoutSession) => {
  if (!session) return computeOutcome(session);

  const cached = outcomeCache.get(session);
  if (cached) return cached;

  const outcome = computeOutcome(session);
  outcomeCache.set(session, outcome);
  return outcome;
};

export const getWorkoutQuality = (session: WorkoutSession, maxHr: number) => {
  const safeMax = getSafeMaxHr(maxHr);
  const avgHr = session?.stats?.avgHr || 0;
  const ratio = avgHr > 0 ? avgHr / safeMax : 0;
  const avgPower = session?.stats?.avgPower || 0;

  if (ratio >= 0.9) return { label: 'Peak', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25' };
  if (ratio >= 0.8) return { label: 'Hard', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' };
  if (ratio >= 0.7 || avgPower >= 180) return { label: 'Tempo', color: 'text-yellow-300', bg: 'bg-yellow-400/10 border-yellow-400/25' };
  if (ratio >= 0.6 || avgPower >= 100) return { label: 'Endurance', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/25' };
  return { label: 'Easy', color: 'text-blue-300', bg: 'bg-blue-400/10 border-blue-400/25' };
};

/** Translator injected by the UI layer; defaults to an English passthrough. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export const defaultTranslate: Translate = (key, values = {}) =>
  Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    key
  );

export const getZoneInsight = (zones: WorkoutZoneStat[] = [], translate: Translate = defaultTranslate) => {
  if (zones.length === 0) return translate('No heart-rate zone data');

  const dominant = zones.reduce((best, zone) => zone.percent > best.percent ? zone : best, zones[0]);
  const highZoneMinutes = zones
    .filter(zone => ['Anaerobic', 'Peak'].includes(zone.label))
    .reduce((total, zone) => total + (Number(zone.seconds) || 0) / 60, 0);

  if (highZoneMinutes >= 10) return translate('{minutes} min above Z3', { minutes: Math.round(highZoneMinutes) });
  if (dominant.label === 'Aerobic') return translate('Mostly aerobic');
  if (dominant.label === 'Fat Burn') return translate('Steady endurance');
  if (dominant.label === 'Warm Up') return translate('Low-intensity session');
  return translate('{zone} dominant', { zone: translate(dominant.label) });
};

export const getMetricDelta = (current: number, previous?: number) => {
  if (previous === undefined || previous === null || previous <= 0) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.01) return { delta: 0, direction: 'flat' as const };
  return { delta, direction: delta > 0 ? 'up' as const : 'down' as const };
};

type TrainingInsight = {
  title: string;
  body: string;
  tone: 'good' | 'watch' | 'neutral';
};

export type PersonalRecord = {
  title: string;
  value: string;
  unit: string;
  dateLabel: string;
  sessionId: string;
  /** Exact session duration in seconds (Longest Ride), so callers can avoid
   *  the rounding that the displayed minute value introduces. */
  seconds?: number;
};

const formatDelta = (value: number, unit: string, decimals = 0) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)} ${unit}`;
};

const getToneClasses = (tone: TrainingInsight['tone']) => {
  if (tone === 'good') return 'border-green-400/20 bg-green-400/5 text-green-300';
  if (tone === 'watch') return 'border-yellow-400/20 bg-yellow-400/5 text-yellow-200';
  return 'border-hw-border bg-white/[0.03] text-white/70';
};

export const getInsightToneClasses = getToneClasses;

export const generateSessionInsights = ({
  session,
  fullStats,
  previousSession,
  previousFullStats,
  maxHr,
  translate = defaultTranslate,
}: {
  session: WorkoutSession;
  fullStats: FullWorkoutStats;
  previousSession?: WorkoutSession;
  previousFullStats?: FullWorkoutStats;
  maxHr: number;
  translate?: Translate;
}): TrainingInsight[] => {
  const insights: TrainingInsight[] = [];
  const current = getSessionOutcome(session);
  const previous = previousSession ? getSessionOutcome(previousSession) : null;
  const quality = getWorkoutQuality(session, maxHr);
  const zoneText = getZoneInsight(fullStats?.zones || [], translate);
  const durationMinutes = current.duration / 60;
  const previousDurationMinutes = previous ? previous.duration / 60 : undefined;
  const powerDelta = getMetricDelta(session?.stats?.avgPower || 0, previousSession?.stats?.avgPower);
  const durationDelta = getMetricDelta(durationMinutes, previousDurationMinutes);
  const distanceDelta = getMetricDelta(current.distanceKm, previous?.distanceKm);
  const hrDelta = getMetricDelta(session?.stats?.avgHr || 0, previousSession?.stats?.avgHr);
  const speedDelta = getMetricDelta(Number(fullStats?.avgSpeed || 0), previousFullStats ? Number(previousFullStats.avgSpeed || 0) : undefined);

  insights.push({
    title: translate(quality.label),
    body: `${zoneText}. ${translate('Avg HR {hr} bpm with {minutes} active minutes.', {
      hr: session?.stats?.avgHr || 0,
      minutes: fullStats?.moveMinutes || 0,
    })}`,
    tone: quality.label === 'Easy' ? 'neutral' : quality.label === 'Peak' || quality.label === 'Hard' ? 'watch' : 'good',
  });

  if (powerDelta && durationDelta) {
    if (powerDelta.direction === 'up' && durationDelta.direction === 'down') {
      insights.push({
        title: translate('Higher intensity'),
        body: translate('Avg power {power} while duration {duration}. Shorter, harder effort.', {
          power: formatDelta(powerDelta.delta, 'W'),
          duration: formatDelta(durationDelta.delta, 'min'),
        }),
        tone: 'watch',
      });
    } else if (powerDelta.direction === 'up') {
      insights.push({
        title: translate('Power improved'),
        body: translate('Avg power rose {power} versus the previous workout.', {
          power: formatDelta(powerDelta.delta, 'W'),
        }),
        tone: 'good',
      });
    } else if (powerDelta.direction === 'down' && durationDelta.direction === 'up') {
      insights.push({
        title: translate('Longer endurance work'),
        body: translate('Duration {duration} with lower power, indicating an easier longer ride.', {
          duration: formatDelta(durationDelta.delta, 'min'),
        }),
        tone: 'neutral',
      });
    }
  }

  if (distanceDelta && distanceDelta.direction === 'up') {
    insights.push({
      title: translate('More distance'),
      body: translate('Distance increased {distance} from the previous workout.', {
        distance: formatDelta(distanceDelta.delta, 'km', 2),
      }),
      tone: 'good',
    });
  } else if (speedDelta && speedDelta.direction === 'up') {
    insights.push({
      title: translate('Faster pace'),
      body: translate('Average speed improved {speed} with this session.', {
        speed: formatDelta(speedDelta.delta, 'km/h', 1),
      }),
      tone: 'good',
    });
  }

  if (hrDelta && Math.abs(hrDelta.delta) >= 5 && powerDelta && powerDelta.direction !== 'down') {
    insights.push({
      title: translate(hrDelta.direction === 'up' ? 'Higher cardiac load' : 'Lower HR for similar work'),
      body: translate('Avg HR {hr} while power did not drop.', {
        hr: formatDelta(hrDelta.delta, 'bpm'),
      }),
      tone: hrDelta.direction === 'up' ? 'watch' : 'good',
    });
  }

  return insights.slice(0, 4);
};

export const getPersonalRecords = (sessions: WorkoutSession[], locale = 'en-US'): PersonalRecord[] => {
  if (sessions.length === 0) return [];

  const enriched = sessions.map(session => {
    const outcome = getSessionOutcome(session);
    const speed = outcome.duration > 0 ? outcome.distanceKm / (outcome.duration / 3600) : 0;
    const date = new Date(session.date);
    const dateLabel = Number.isNaN(date.getTime())
      ? 'Unknown date'
      : date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      session,
      outcome,
      speed,
      dateLabel,
    };
  });

  const pickBest = <T>(items: T[], selector: (item: T) => number): T | undefined =>
    items.length > 0
      ? items.reduce((best, current) => (selector(current) > selector(best) ? current : best), items[0])
      : undefined;

  // Distance-derived records (Longest Ride, Best Distance, Top Calories,
  // Fastest Avg Speed) only accept physically consistent rides: at least five
  // minutes and one kilometre, and an average speed (distance ÷ duration) that
  // can never exceed the fastest speed the session recorded. A trainer counter
  // offset (see parseFtmsIndoorBikeData) or a frozen legacy duration would
  // otherwise crown a broken session as the record — e.g. an impossible
  // 138 km/h "average" from a real ~23-minute ride stored with duration 262 s.
  const MIN_RECORD_SECONDS = 300;
  const MIN_RECORD_KM = 1;
  const plausibleRides = enriched.filter(item => {
    if (item.outcome.duration < MIN_RECORD_SECONDS) return false;
    if (item.outcome.distanceKm < MIN_RECORD_KM) return false;
    const maxPointSpeed = (item.session?.history || []).reduce(
      (max, point) => Math.max(max, point.speed || 0),
      0
    );
    const recordedMaxSpeed = Math.max(item.session?.stats?.maxSpeed || 0, maxPointSpeed);
    if (recordedMaxSpeed <= 0) return false;
    return item.speed <= recordedMaxSpeed * 1.05 + 0.5;
  });

  const longest = pickBest(plausibleRides, item => item.outcome.duration);
  const distance = pickBest(plausibleRides, item => item.outcome.distanceKm);
  const calories = pickBest(plausibleRides, item => item.outcome.calories);
  const fastestAvgSpeed = pickBest(plausibleRides, item => item.speed);
  // Power metrics are immune to distance-stream corruption, so every session
  // is a candidate regardless of the ride-distance plausibility above.
  const avgPower = pickBest(enriched, item => item.session?.stats?.avgPower || 0);
  const maxPower = pickBest(enriched, item => item.session?.stats?.maxPower || 0);

  const records: PersonalRecord[] = [];

  if (longest) {
    records.push({
      title: 'Longest Ride',
      value: `${Math.floor(longest.outcome.duration / 60)}`,
      seconds: longest.outcome.duration,
      unit: 'min',
      dateLabel: longest.dateLabel,
      sessionId: longest.session.id,
    });
  }

  if (distance) {
    records.push({
      title: 'Best Distance',
      value: distance.outcome.distanceKm.toFixed(2),
      unit: 'km',
      dateLabel: distance.dateLabel,
      sessionId: distance.session.id,
    });
  }

  if (calories) {
    records.push({
      title: 'Top Calories',
      value: `${calories.outcome.calories}`,
      unit: 'kcal',
      dateLabel: calories.dateLabel,
      sessionId: calories.session.id,
    });
  }

  if (avgPower) {
    records.push({
      title: 'Best Avg Power',
      value: `${avgPower.session?.stats?.avgPower || 0}`,
      unit: 'w',
      dateLabel: avgPower.dateLabel,
      sessionId: avgPower.session.id,
    });
  }

  if (maxPower) {
    records.push({
      title: 'Peak Power',
      value: `${maxPower.session?.stats?.maxPower || 0}`,
      unit: 'w',
      dateLabel: maxPower.dateLabel,
      sessionId: maxPower.session.id,
    });
  }

  if (fastestAvgSpeed) {
    records.push({
      title: 'Fastest Avg Speed',
      value: fastestAvgSpeed.speed.toFixed(1),
      unit: 'km/h',
      dateLabel: fastestAvgSpeed.dateLabel,
      sessionId: fastestAvgSpeed.session.id,
    });
  }

  return records;
};
