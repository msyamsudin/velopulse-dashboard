import type { WorkoutSession } from '@/store/useWorkoutStore';
import { getSessionOutcome } from './workout-analysis';

export interface MilestoneBadge {
  id: string;
  type: 'session_count' | 'distance' | 'calories' | 'duration' | 'pr';
  title: string;
  subtitle: string;
  icon: string; // e.g. '🏆' | '🚀' | '👑' | '🔥' | '⚡' | '🚴' | '🫀'
  valueFormatted: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export interface SessionMilestonesResult {
  sessionIndex: number;
  totalSessions: number;
  milestones: MilestoneBadge[];
  personalRecords: MilestoneBadge[];
  isCenturion: boolean;
  hasAchievements: boolean;
}

export interface UpcomingMilestone {
  type: 'session_count' | 'distance' | 'calories';
  title: string;
  current: number;
  target: number;
  remaining: number;
  progressPercent: number;
  unit: string;
  icon: string;
}

const SESSION_COUNT_MILESTONES = [
  { count: 1, title: 'First Ride', subtitle: 'Welcome to the saddle!', tier: 'bronze' as const, icon: '🚴' },
  { count: 10, title: '10 Rides', subtitle: 'Consistency in motion', tier: 'bronze' as const, icon: '🔥' },
  { count: 25, title: 'Quarter Century', subtitle: '25 sessions logged', tier: 'silver' as const, icon: '⚡' },
  { count: 50, title: 'Half Century', subtitle: '50 sessions achieved', tier: 'silver' as const, icon: '⭐' },
  { count: 100, title: 'Centurion Club', subtitle: '100 workouts completed!', tier: 'gold' as const, icon: '🏆' },
  { count: 200, title: 'Double Centurion', subtitle: '200 workouts logged', tier: 'gold' as const, icon: '👑' },
  { count: 250, title: '250 Rides', subtitle: 'Elite persistence', tier: 'gold' as const, icon: '🌟' },
  { count: 500, title: 'Grand Master', subtitle: '500 workouts recorded', tier: 'diamond' as const, icon: '💎' },
  { count: 1000, title: 'Legendary Rider', subtitle: '1,000 sessions conquered!', tier: 'diamond' as const, icon: '🪐' },
];

const DISTANCE_MILESTONES_KM = [
  { km: 50, title: '50 KM Total', subtitle: 'First 50 kilometers in the books', tier: 'bronze' as const, icon: '🚴' },
  { km: 100, title: '100 KM Century', subtitle: '100 km cumulative distance', tier: 'bronze' as const, icon: '⚡' },
  { km: 250, title: '250 KM', subtitle: 'Quarter-thousand km milestone', tier: 'silver' as const, icon: '🔥' },
  { km: 500, title: '500 KM', subtitle: 'Half-thousand km milestone', tier: 'silver' as const, icon: '⭐' },
  { km: 1000, title: '1,000 KM Club', subtitle: 'Four-digit distance milestone!', tier: 'gold' as const, icon: '🏆' },
  { km: 2500, title: '2,500 KM Odyssey', subtitle: 'Cross-continent equivalent distance', tier: 'gold' as const, icon: '👑' },
  { km: 5000, title: '5,000 KM Epic', subtitle: '5,000 kilometers conquered', tier: 'diamond' as const, icon: '💎' },
  { km: 10000, title: '10,000 KM Titan', subtitle: 'Circumnavigating legends', tier: 'diamond' as const, icon: '🪐' },
];

const CALORIE_MILESTONES_KCAL = [
  { kcal: 5000, title: '5,000 KCAL', subtitle: 'Fuel ignited', tier: 'bronze' as const, icon: '🔥' },
  { kcal: 10000, title: '10,000 KCAL', subtitle: '10k calories burned', tier: 'silver' as const, icon: '⚡' },
  { kcal: 25000, title: '25,000 KCAL', subtitle: '25k calorie furnace', tier: 'silver' as const, icon: '🌟' },
  { kcal: 50000, title: '50,000 KCAL', subtitle: '50k calories conquered', tier: 'gold' as const, icon: '🏆' },
  { kcal: 100000, title: '100,000 KCAL', subtitle: '100k power engine', tier: 'diamond' as const, icon: '💎' },
];

/** Sort sessions chronologically (oldest first). */
export const sortSessionsAscending = (sessions: WorkoutSession[]): WorkoutSession[] => {
  return [...sessions].sort((a, b) => {
    const timeA = a.sessionStartTime || new Date(a.date).getTime() || 0;
    const timeB = b.sessionStartTime || new Date(b.date).getTime() || 0;
    return timeA - timeB;
  });
};

/**
 * Detects whether a specific session reached milestones or broke personal records,
 * taking into account all sessions up to that point.
 */
export const detectSessionAchievements = (
  session: WorkoutSession,
  allSessions: WorkoutSession[]
): SessionMilestonesResult => {
  const sorted = sortSessionsAscending(allSessions);
  const sessionIndex = sorted.findIndex(s => s.id === session.id);

  if (sessionIndex === -1) {
    return {
      sessionIndex: 0,
      totalSessions: allSessions.length,
      milestones: [],
      personalRecords: [],
      isCenturion: false,
      hasAchievements: false,
    };
  }

  const chronologicalIndex = sessionIndex + 1; // 1-based (1st, 2nd, ...)
  const priorSessions = sorted.slice(0, sessionIndex);
  const currentOutcome = getSessionOutcome(session);
  const currentSpeed = currentOutcome.duration > 0 ? currentOutcome.distanceKm / (currentOutcome.duration / 3600) : 0;
  const currentAvgPower = session.stats?.avgPower || 0;
  const currentMaxPower = session.stats?.maxPower || 0;
  const currentHrr = typeof session.stats?.hrrScore === 'number' ? session.stats.hrrScore : null;

  const milestones: MilestoneBadge[] = [];
  const personalRecords: MilestoneBadge[] = [];

  // 1. Session Count Milestones
  const countMilestone = SESSION_COUNT_MILESTONES.find(m => m.count === chronologicalIndex);
  if (countMilestone) {
    milestones.push({
      id: `session_count_${countMilestone.count}`,
      type: 'session_count',
      title: countMilestone.title,
      subtitle: countMilestone.subtitle,
      icon: countMilestone.icon,
      valueFormatted: `#${chronologicalIndex}`,
      tier: countMilestone.tier,
    });
  }

  // 2. Cumulative Distance Milestones
  const priorTotalKm = priorSessions.reduce((acc, s) => acc + getSessionOutcome(s).distanceKm, 0);
  const newTotalKm = priorTotalKm + currentOutcome.distanceKm;

  for (const m of DISTANCE_MILESTONES_KM) {
    if (priorTotalKm < m.km && newTotalKm >= m.km) {
      milestones.push({
        id: `cumulative_distance_${m.km}`,
        type: 'distance',
        title: m.title,
        subtitle: m.subtitle,
        icon: m.icon,
        valueFormatted: `${newTotalKm.toFixed(1)} km`,
        tier: m.tier,
      });
    }
  }

  // 3. Cumulative Calorie Milestones
  const priorTotalKcal = priorSessions.reduce((acc, s) => acc + getSessionOutcome(s).calories, 0);
  const newTotalKcal = priorTotalKcal + currentOutcome.calories;

  for (const m of CALORIE_MILESTONES_KCAL) {
    if (priorTotalKcal < m.kcal && newTotalKcal >= m.kcal) {
      milestones.push({
        id: `cumulative_calories_${m.kcal}`,
        type: 'calories',
        title: m.title,
        subtitle: m.subtitle,
        icon: m.icon,
        valueFormatted: `${newTotalKcal.toLocaleString()} kcal`,
        tier: m.tier,
      });
    }
  }

  // 4. Personal Records (for sessions after the first one)
  if (priorSessions.length > 0) {
    let priorBestDistance = 0;
    let priorLongestDuration = 0;
    let priorTopCalories = 0;
    let priorBestAvgPower = 0;
    let priorPeakPower = 0;
    let priorFastestSpeed = 0;
    let priorBestHrr = 0;

    for (const prev of priorSessions) {
      const outcome = getSessionOutcome(prev);
      const speed = outcome.duration > 0 ? outcome.distanceKm / (outcome.duration / 3600) : 0;
      if (outcome.distanceKm > priorBestDistance) priorBestDistance = outcome.distanceKm;
      if (outcome.duration > priorLongestDuration) priorLongestDuration = outcome.duration;
      if (outcome.calories > priorTopCalories) priorTopCalories = outcome.calories;
      if ((prev.stats?.avgPower || 0) > priorBestAvgPower) priorBestAvgPower = prev.stats.avgPower;
      if ((prev.stats?.maxPower || 0) > priorPeakPower) priorPeakPower = prev.stats.maxPower;
      if (speed > priorFastestSpeed) priorFastestSpeed = speed;
      if (typeof prev.stats?.hrrScore === 'number' && prev.stats.hrrScore > priorBestHrr) {
        priorBestHrr = prev.stats.hrrScore;
      }
    }

    if (currentOutcome.distanceKm > priorBestDistance && currentOutcome.distanceKm >= 5) {
      personalRecords.push({
        id: 'pr_distance',
        type: 'pr',
        title: 'New Distance PR',
        subtitle: `+${(currentOutcome.distanceKm - priorBestDistance).toFixed(2)} km vs previous best`,
        icon: '🚀',
        valueFormatted: `${currentOutcome.distanceKm.toFixed(2)} km`,
        tier: 'gold',
      });
    }

    if (currentOutcome.duration > priorLongestDuration && currentOutcome.duration >= 900) {
      const diffMin = Math.round((currentOutcome.duration - priorLongestDuration) / 60);
      personalRecords.push({
        id: 'pr_duration',
        type: 'pr',
        title: 'Longest Ride PR',
        subtitle: `+${diffMin} min longer endurance`,
        icon: '⏱️',
        valueFormatted: `${Math.round(currentOutcome.duration / 60)} min`,
        tier: 'gold',
      });
    }

    if (currentOutcome.calories > priorTopCalories && currentOutcome.calories >= 200) {
      personalRecords.push({
        id: 'pr_calories',
        type: 'pr',
        title: 'Top Calorie Burn PR',
        subtitle: `+${currentOutcome.calories - priorTopCalories} kcal vs previous best`,
        icon: '🔥',
        valueFormatted: `${currentOutcome.calories} kcal`,
        tier: 'gold',
      });
    }

    if (currentMaxPower > priorPeakPower && currentMaxPower >= 150) {
      personalRecords.push({
        id: 'pr_peak_power',
        type: 'pr',
        title: 'Peak Power PR',
        subtitle: `+${currentMaxPower - priorPeakPower} W sprint power record`,
        icon: '⚡',
        valueFormatted: `${currentMaxPower} W`,
        tier: 'diamond',
      });
    }

    if (currentAvgPower > priorBestAvgPower && currentAvgPower >= 100 && currentOutcome.duration >= 600) {
      personalRecords.push({
        id: 'pr_avg_power',
        type: 'pr',
        title: 'Best Avg Power PR',
        subtitle: `+${currentAvgPower - priorBestAvgPower} W higher average`,
        icon: '👑',
        valueFormatted: `${currentAvgPower} W`,
        tier: 'diamond',
      });
    }

    if (currentSpeed > priorFastestSpeed && currentSpeed >= 20 && currentOutcome.distanceKm >= 5) {
      personalRecords.push({
        id: 'pr_speed',
        type: 'pr',
        title: 'Fastest Pace PR',
        subtitle: `+${(currentSpeed - priorFastestSpeed).toFixed(1)} km/h faster`,
        icon: '🚴',
        valueFormatted: `${currentSpeed.toFixed(1)} km/h`,
        tier: 'gold',
      });
    }

    if (currentHrr !== null && currentHrr > priorBestHrr && currentHrr >= 15) {
      personalRecords.push({
        id: 'pr_hrr',
        type: 'pr',
        title: 'Best HR Recovery PR',
        subtitle: `+${currentHrr - priorBestHrr} bpm recovery score`,
        icon: '🫀',
        valueFormatted: `${currentHrr} bpm`,
        tier: 'diamond',
      });
    }
  }

  const isCenturion = chronologicalIndex === 100;
  const hasAchievements = milestones.length > 0 || personalRecords.length > 0;

  return {
    sessionIndex: chronologicalIndex,
    totalSessions: allSessions.length,
    milestones,
    personalRecords,
    isCenturion,
    hasAchievements,
  };
};

/**
 * Calculates next upcoming milestones across session count, distance, and calories.
 */
export const getUpcomingMilestones = (allSessions: WorkoutSession[]): UpcomingMilestone[] => {
  const totalSessions = allSessions.length;
  let totalKm = 0;
  let totalKcal = 0;

  for (const s of allSessions) {
    const outcome = getSessionOutcome(s);
    totalKm += outcome.distanceKm;
    totalKcal += outcome.calories;
  }

  const upcoming: UpcomingMilestone[] = [];

  // Next session count milestone
  const nextSessionMilestone = SESSION_COUNT_MILESTONES.find(m => m.count > totalSessions);
  if (nextSessionMilestone) {
    const prevCount = SESSION_COUNT_MILESTONES.filter(m => m.count <= totalSessions).pop()?.count || 0;
    const progressSpan = nextSessionMilestone.count - prevCount;
    const currentProgress = totalSessions - prevCount;
    const progressPercent = Math.min(Math.max(Math.round((currentProgress / progressSpan) * 100), 0), 100);

    upcoming.push({
      type: 'session_count',
      title: nextSessionMilestone.title,
      current: totalSessions,
      target: nextSessionMilestone.count,
      remaining: nextSessionMilestone.count - totalSessions,
      progressPercent,
      unit: 'rides',
      icon: nextSessionMilestone.icon,
    });
  }

  // Next distance milestone
  const nextDistMilestone = DISTANCE_MILESTONES_KM.find(m => m.km > totalKm);
  if (nextDistMilestone) {
    const prevKm = DISTANCE_MILESTONES_KM.filter(m => m.km <= totalKm).pop()?.km || 0;
    const progressSpan = nextDistMilestone.km - prevKm;
    const currentProgress = totalKm - prevKm;
    const progressPercent = Math.min(Math.max(Math.round((currentProgress / progressSpan) * 100), 0), 100);

    upcoming.push({
      type: 'distance',
      title: nextDistMilestone.title,
      current: Number(totalKm.toFixed(1)),
      target: nextDistMilestone.km,
      remaining: Number((nextDistMilestone.km - totalKm).toFixed(1)),
      progressPercent,
      unit: 'km',
      icon: nextDistMilestone.icon,
    });
  }

  // Next calorie milestone
  const nextKcalMilestone = CALORIE_MILESTONES_KCAL.find(m => m.kcal > totalKcal);
  if (nextKcalMilestone) {
    const prevKcal = CALORIE_MILESTONES_KCAL.filter(m => m.kcal <= totalKcal).pop()?.kcal || 0;
    const progressSpan = nextKcalMilestone.kcal - prevKcal;
    const currentProgress = totalKcal - prevKcal;
    const progressPercent = Math.min(Math.max(Math.round((currentProgress / progressSpan) * 100), 0), 100);

    upcoming.push({
      type: 'calories',
      title: nextKcalMilestone.title,
      current: Math.round(totalKcal),
      target: nextKcalMilestone.kcal,
      remaining: Math.round(nextKcalMilestone.kcal - totalKcal),
      progressPercent,
      unit: 'kcal',
      icon: nextKcalMilestone.icon,
    });
  }

  return upcoming;
};
