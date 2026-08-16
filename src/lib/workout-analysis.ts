import { getSafeMaxHr } from './constants';
import type { WorkoutSession } from '@/store/useWorkoutStore';
import type {
  ComparisonSummary,
  DailySummaryDay,
  FullWorkoutStats,
  GlobalSummary,
  MetricDelta,
  SummaryInsights,
  WorkoutZoneStat,
} from '@/lib/history-types';

export const getSessionOutcome = (session: WorkoutSession) => {
  const history = session?.history || [];
  const lastPoint = history[history.length - 1];

  return {
    distanceKm: Number(((lastPoint?.distance || 0) / 1000).toFixed(2)),
    calories: Math.round(lastPoint?.calories || 0),
    duration: session?.duration || 0,
    avgPower: session?.stats?.avgPower || 0,
    avgHr: session?.stats?.avgHr || 0,
  };
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

export const getZoneInsight = (zones: WorkoutZoneStat[] = []) => {
  if (zones.length === 0) return 'No heart-rate zone data';

  const dominant = zones.reduce((best, zone) => zone.percent > best.percent ? zone : best, zones[0]);
  const highZoneMinutes = zones
    .filter(zone => ['Anaerobic', 'Peak'].includes(zone.label))
    .reduce((total, zone) => total + (Number(zone.seconds) || 0) / 60, 0);

  if (highZoneMinutes >= 10) return `${Math.round(highZoneMinutes)} min above Z3`;
  if (dominant.label === 'Aerobic') return 'Mostly aerobic';
  if (dominant.label === 'Fat Burn') return 'Steady endurance';
  if (dominant.label === 'Warm Up') return 'Low-intensity session';
  return `${dominant.label} dominant`;
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
}: {
  session: WorkoutSession;
  fullStats: FullWorkoutStats;
  previousSession?: WorkoutSession;
  previousFullStats?: FullWorkoutStats;
  maxHr: number;
}): TrainingInsight[] => {
  const insights: TrainingInsight[] = [];
  const current = getSessionOutcome(session);
  const previous = previousSession ? getSessionOutcome(previousSession) : null;
  const quality = getWorkoutQuality(session, maxHr);
  const zoneText = getZoneInsight(fullStats?.zones || []);
  const durationMinutes = current.duration / 60;
  const previousDurationMinutes = previous ? previous.duration / 60 : undefined;
  const powerDelta = getMetricDelta(session?.stats?.avgPower || 0, previousSession?.stats?.avgPower);
  const durationDelta = getMetricDelta(durationMinutes, previousDurationMinutes);
  const distanceDelta = getMetricDelta(current.distanceKm, previous?.distanceKm);
  const hrDelta = getMetricDelta(session?.stats?.avgHr || 0, previousSession?.stats?.avgHr);
  const speedDelta = getMetricDelta(Number(fullStats?.avgSpeed || 0), previousFullStats ? Number(previousFullStats.avgSpeed || 0) : undefined);

  insights.push({
    title: quality.label,
    body: `${zoneText}. Avg HR ${session?.stats?.avgHr || 0} bpm with ${fullStats?.moveMinutes || 0} active minutes.`,
    tone: quality.label === 'Easy' ? 'neutral' : quality.label === 'Peak' || quality.label === 'Hard' ? 'watch' : 'good',
  });

  if (powerDelta && durationDelta) {
    if (powerDelta.direction === 'up' && durationDelta.direction === 'down') {
      insights.push({
        title: 'Higher intensity',
        body: `Avg power ${formatDelta(powerDelta.delta, 'W')} while duration ${formatDelta(durationDelta.delta, 'min')}. Shorter, harder effort.`,
        tone: 'watch',
      });
    } else if (powerDelta.direction === 'up') {
      insights.push({
        title: 'Power improved',
        body: `Avg power rose ${formatDelta(powerDelta.delta, 'W')} versus the previous workout.`,
        tone: 'good',
      });
    } else if (powerDelta.direction === 'down' && durationDelta.direction === 'up') {
      insights.push({
        title: 'Longer endurance work',
        body: `Duration ${formatDelta(durationDelta.delta, 'min')} with lower power, indicating an easier longer ride.`,
        tone: 'neutral',
      });
    }
  }

  if (distanceDelta && distanceDelta.direction === 'up') {
    insights.push({
      title: 'More distance',
      body: `Distance increased ${formatDelta(distanceDelta.delta, 'km', 2)} from the previous workout.`,
      tone: 'good',
    });
  } else if (speedDelta && speedDelta.direction === 'up') {
    insights.push({
      title: 'Faster pace',
      body: `Average speed improved ${formatDelta(speedDelta.delta, 'km/h', 1)} with this session.`,
      tone: 'good',
    });
  }

  if (hrDelta && Math.abs(hrDelta.delta) >= 5 && powerDelta && powerDelta.direction !== 'down') {
    insights.push({
      title: hrDelta.direction === 'up' ? 'Higher cardiac load' : 'Lower HR for similar work',
      body: `Avg HR ${formatDelta(hrDelta.delta, 'bpm')} while power did not drop.`,
      tone: hrDelta.direction === 'up' ? 'watch' : 'good',
    });
  }

  return insights.slice(0, 4);
};

export const generateSummaryInsights = ({
  comparisonSummary,
  summaryInsights,
  globalSummary,
  weeklyDailyData,
  rangeLabel,
  translate = (key: string, values: Record<string, string | number> = {}) => Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    key
  ),
}: {
  comparisonSummary: ComparisonSummary | null;
  summaryInsights: SummaryInsights | null;
  globalSummary: GlobalSummary | null;
  weeklyDailyData: DailySummaryDay[];
  rangeLabel: string;
  translate?: (key: string, values?: Record<string, string | number>) => string;
}): TrainingInsight[] => {
  const insights: TrainingInsight[] = [];
  const activeDays = weeklyDailyData.filter(day => day.hasData).length;
  const totalDays = Math.max(weeklyDailyData.length, 1);
  const activeRatio = activeDays / totalDays;
  const bestDelta = comparisonSummary
    ? Object.entries(comparisonSummary.deltas)
      .filter(([, delta]: [string, MetricDelta]) => delta.hasBaseline && delta.value !== null)
      .sort(([, a]: [string, MetricDelta], [, b]: [string, MetricDelta]) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0))[0]
    : null;

  if (bestDelta) {
    const [metric, delta] = bestDelta;
    const direction = delta.direction === 'up' ? 'up' : delta.direction === 'down' ? 'down' : 'flat';
    const change = delta.direction === 'up' ? 'higher' : delta.direction === 'down' ? 'lower' : 'unchanged';
    insights.push({
      title: translate('{metric} {direction}', { metric: translate(metric), direction: translate(direction) }),
      body: translate('{metric} is {value}% {change} than the previous {range}.', {
        metric: translate(metric),
        value: Math.abs(delta.value),
        change: translate(change),
        range: rangeLabel,
      }),
      tone: delta.direction === 'up' ? 'good' : delta.direction === 'down' ? 'watch' : 'neutral',
    });
  }

  if (summaryInsights) {
    insights.push({
      title: translate('Consistency'),
      body: translate('{activeDays} active, current streak {currentStreak}, longest streak {longestStreak}.', {
        activeDays: summaryInsights.activeDaysLabel,
        currentStreak: summaryInsights.currentStreakLabel,
        longestStreak: summaryInsights.longestStreakLabel,
      }),
      tone: activeRatio >= 0.45 ? 'good' : activeRatio >= 0.25 ? 'neutral' : 'watch',
    });

    insights.push({
      title: translate('Typical session'),
      body: translate('Average workout is {distance} km and {duration}.', {
        distance: summaryInsights.avgDistancePerSession,
        duration: summaryInsights.avgDurationPerSession,
      }),
      tone: 'neutral',
    });
  }

  if (comparisonSummary?.metrics?.sessions > 0 && globalSummary) {
    insights.push({
      title: translate('Training volume'),
      body: translate('{distance} km over {sessions} sessions in this range.', {
        distance: globalSummary.totalDistance,
        sessions: comparisonSummary.metrics.sessions,
      }),
      tone: comparisonSummary.metrics.sessions >= 3 ? 'good' : 'neutral',
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

  const bestBy = (selector: (item: typeof enriched[number]) => number) =>
    enriched.reduce((best, current) => selector(current) > selector(best) ? current : best, enriched[0]);

  const longest = bestBy(item => item.outcome.duration);
  const distance = bestBy(item => item.outcome.distanceKm);
  const calories = bestBy(item => item.outcome.calories);
  const avgPower = bestBy(item => item.session?.stats?.avgPower || 0);
  const maxPower = bestBy(item => item.session?.stats?.maxPower || 0);
  const speed = bestBy(item => item.speed);

  return [
    {
      title: 'Longest Ride',
      value: `${Math.floor(longest.outcome.duration / 60)}`,
      unit: 'min',
      dateLabel: longest.dateLabel,
      sessionId: longest.session.id,
    },
    {
      title: 'Best Distance',
      value: distance.outcome.distanceKm.toFixed(2),
      unit: 'km',
      dateLabel: distance.dateLabel,
      sessionId: distance.session.id,
    },
    {
      title: 'Top Calories',
      value: `${calories.outcome.calories}`,
      unit: 'kcal',
      dateLabel: calories.dateLabel,
      sessionId: calories.session.id,
    },
    {
      title: 'Best Avg Power',
      value: `${avgPower.session?.stats?.avgPower || 0}`,
      unit: 'w',
      dateLabel: avgPower.dateLabel,
      sessionId: avgPower.session.id,
    },
    {
      title: 'Peak Power',
      value: `${maxPower.session?.stats?.maxPower || 0}`,
      unit: 'w',
      dateLabel: maxPower.dateLabel,
      sessionId: maxPower.session.id,
    },
    {
      title: 'Fastest Avg Speed',
      value: speed.speed.toFixed(1),
      unit: 'km/h',
      dateLabel: speed.dateLabel,
      sessionId: speed.session.id,
    },
  ];
};
