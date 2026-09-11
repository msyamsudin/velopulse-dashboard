import { useMemo } from 'react';
import { formatDuration } from '../utils/formatters';
import { HR_ZONES, getSafeMaxHr } from '@/lib/constants';
import { calculateEdwardsTrimp, calculateLoadTrend, calculateTrainingLoadMetrics, LOAD_TREND_DAYS } from '@/lib/training-load';
import { computeBodyMetrics } from '@/lib/body-metrics';
import { summarizeBodyTrend, type BodyHistoryEntry } from '@/lib/body-history';
import { summarizePowerZones } from '@/lib/power-zones';
import { getProfileGate } from '@/lib/profile-gate';
import { getFinalMetrics, getSessionTypeBucket, getWorkoutQuality, SESSION_TYPE_BUCKETS, type SessionTypeBucket } from '@/lib/workout-analysis';
import { useI18n } from '@/i18n';
import type { WorkoutSession } from '@/store/useWorkoutStore';
import type { HistoryData } from '@/store/useWorkoutStore';
import type {
  ComparisonSummary,
  DailySummaryDay,
  FullWorkoutStats,
  GlobalSummary,
  HistoryChartPoint,
  IntensitySummary,
  AdvancedSummary,
  MetricKey,
  PeriodSummaryEntry,
  SessionTypeZones,
  SummaryInsights,
  WeeklyLoadPoint,
  WorkoutHistoryData,
  ZoneShare,
} from '@/lib/history-types';

interface UseWorkoutHistoryDataProps {
  sessions: WorkoutSession[];
  maxHr: number;
  /**
   * Rider FTP, used for the power-zone distribution. 0 means "not set": the
   * block reports no zones and the UI asks for the value instead of showing an
   * all-Z1 chart.
   */
  ftp?: number;
  /** Rider body weight, gating W/kg and kcal/kg/h. 0 means "not set". */
  weight?: number;
  /**
   * Dated weight / resting-HR entries for the body-mass trends. Kept as a prop
   * (read from storage once at startup) so this hook stays pure.
   */
  bodyHistory?: BodyHistoryEntry[];
  summaryPeriod: 'yearly' | 'monthly' | 'weekly' | 'daily';
  summaryRange: '7d' | '30d' | '90d' | '1y' | 'all';
  weeklyMetric: MetricKey;
  offsetDays?: number;
}

const DAY_MS = 86400000;

/** Duration-weighted average: Σ(value × duration) / Σ duration. */
const weightedAvg = (weightedSum: number, totalDuration: number) =>
  totalDuration > 0 ? Math.round(weightedSum / totalDuration) : 0;

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRangeStart = (range: UseWorkoutHistoryDataProps['summaryRange'], offsetDays: number = 0) => {
  if (range === 'all') return null;

  const end = new Date();
  end.setDate(end.getDate() - offsetDays);
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  if (range === '7d') start.setDate(end.getDate() - 6);
  if (range === '30d') start.setDate(end.getDate() - 29);
  if (range === '90d') start.setDate(end.getDate() - 89);
  // 365 days, matching RECORD_RANGE_DAYS['1y'] so the chart, the totals and the
  // record scope always cover the same window (setFullYear made it 366).
  if (range === '1y') start.setDate(end.getDate() - 364);
  start.setHours(0, 0, 0, 0);

  return start;
};

const getPreviousRangeBounds = (range: UseWorkoutHistoryDataProps['summaryRange'], offsetDays: number = 0) => {
  const currentStart = getRangeStart(range, offsetDays);
  if (!currentStart) return null;

  const currentEnd = new Date();
  currentEnd.setDate(currentEnd.getDate() - offsetDays);
  currentEnd.setHours(23, 59, 59, 999);

  const previousEnd = new Date(currentStart.getTime() - 1);
  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  previousStart.setHours(0, 0, 0, 0);

  return { previousStart, previousEnd };
};

const buildZoneStats = (maxHr: number) => {
  const ZONE_NAMES = ['Warm Up', 'Fat Burn', 'Aerobic', 'Anaerobic', 'Peak'];
  const ZONE_COLORS = ['text-hw-muted', 'text-green-400', 'text-hw-accent', 'text-orange-500', 'text-red-500'];

  return HR_ZONES.map((z, i) => ({
    label: ZONE_NAMES[i],
    min: z.minPct,
    max: z.maxPct,
    seconds: 0,
    color: ZONE_COLORS[i],
    range: i === 0
      ? `<${Math.round(maxHr * z.maxPct)}`
      : i === HR_ZONES.length - 1
        ? `>${Math.round(maxHr * z.minPct)}`
        : `${Math.round(maxHr * z.minPct)}-${Math.round(maxHr * z.maxPct)}`,
    percent: 0,
    time: '0:00',
  }));
};

/**
 * Module-level memo for calculateFullStats: keyed by session object identity
 * so each session is computed once per maxHr without mutating hook-owned state.
 */
const fullStatsCache = new WeakMap<WorkoutSession, { maxHr: number; stats: FullWorkoutStats }>();

export const useWorkoutHistoryData = ({ sessions, maxHr, ftp = 0, weight = 0, bodyHistory = [], summaryPeriod, summaryRange, offsetDays = 0 }: UseWorkoutHistoryDataProps): WorkoutHistoryData => {
  const { locale, t } = useI18n();

  // One definition of "which metric inputs are usable" for the whole app; the
  // hook only forwards the derived flags so no component has to re-test the
  // raw numbers.
  const profileGate = useMemo(() => getProfileGate({ ftp, weight }), [ftp, weight]);

  const calculateFullStats = useMemo(() => (session: WorkoutSession): FullWorkoutStats => {
    const history = session.history || [];
    const safeMax = getSafeMaxHr(maxHr);

    const cachedEntry = fullStatsCache.get(session);
    if (cachedEntry && cachedEntry.maxHr === maxHr) {
      return cachedEntry.stats;
    }

    const computeStats = (): FullWorkoutStats => {
      const emptyStats: FullWorkoutStats = {
        ...session.stats,
        avgSpeed: '0.0',
        maxSpeed: '0.0',
        totalDistance: '0.0',
        totalDistanceKm: 0,
        totalCalories: 0,
        avgResistance: 0,
        maxResistance: 0,
        moveMinutes: 0,
        trainingLoad: { score: 0, label: 'Recovery', activeMinutes: 0 },
        zones: [],
      };

      if (history.length === 0) return emptyStats;

      // Safe max for any array size (spread Math.max overflows the call
      // stack on very long recordings).
      const maxBy = <T>(items: T[], pick: (item: T) => number) =>
        items.reduce((max, item) => Math.max(max, pick(item)), 0);

      const trainingLoad = calculateEdwardsTrimp(history, session.duration || 0, safeMax);

      const activePoints = history.filter((h: HistoryData) => h.hr >= (safeMax * HR_ZONES[0].minPct)).length;
      const activeRatio = activePoints / history.length;
      const activeSeconds = Math.floor(session.duration * activeRatio);
      const moveMinutes = Math.floor(activeSeconds / 60);

      const zones = buildZoneStats(safeMax);

      history.forEach((h: HistoryData) => {
        const ratio = h.hr / safeMax;
        // Last zone is catch-all for >= 90% (handles HR above 100% maxHR)
        for (let i = zones.length - 1; i >= 0; i--) {
          if (ratio >= zones[i].min) {
            zones[i].seconds++;
            break;
          }
        }
      });

      const { distanceMeters: maxDistanceMeters, calories: maxCalories } = getFinalMetrics(history);
      const totalDistanceKm = maxDistanceMeters / 1000;

      // Per-zone time = share of samples in that zone × session duration.
      // Samples below Z1 (<50% max HR: warm-up, coasting, watchdog-zeroed
      // dropouts) belong to no zone and are therefore left out, instead of being
      // dumped into the last zone as before — that inflated Z5 by every
      // below-threshold minute of the session. Only the few seconds of rounding
      // error are redistributed, and they go to the largest zone.
      const rawZoneSeconds = zones.map(zone => (zone.seconds / history.length) * session.duration);
      const roundedZoneSeconds = rawZoneSeconds.map(value => Math.round(value));
      const roundingDelta = Math.round(rawZoneSeconds.reduce((total, value) => total + value, 0))
        - roundedZoneSeconds.reduce((total, value) => total + value, 0);
      if (roundingDelta !== 0) {
        const largestZone = rawZoneSeconds.indexOf(Math.max(...rawZoneSeconds));
        roundedZoneSeconds[largestZone] = Math.max(0, roundedZoneSeconds[largestZone] + roundingDelta);
      }

      return {
        ...session.stats,
        avgSpeed: (history.reduce((total, point) => total + point.speed, 0) / history.length).toFixed(1),
        maxSpeed: maxBy(history, point => point.speed).toFixed(1),
        totalDistance: totalDistanceKm.toFixed(2),
        totalDistanceKm,
        totalCalories: maxCalories,
        avgResistance: Math.round(history.reduce((total, point) => total + point.resistance, 0) / history.length),
        maxResistance: maxBy(history, point => point.resistance),
        moveMinutes,
        trainingLoad,
        zones: zones.map((zone, index) => ({
          ...zone,
          // `seconds` is public API that promises seconds; the counter in
          // buildZoneStats holds a sample count, so overwrite it here (the
          // percent share below is still sample-based, and unaffected).
          seconds: roundedZoneSeconds[index],
          percent: Math.round((zone.seconds / history.length) * 100),
          time: formatDuration(roundedZoneSeconds[index]),
        }))
      };
    };

    const stats = computeStats();
    fullStatsCache.set(session, { maxHr, stats });
    return stats;
  }, [maxHr]);

  const filteredSessions = useMemo(() => {
    const rangeStart = getRangeStart(summaryRange, offsetDays);
    if (!rangeStart) return sessions;

    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() - offsetDays);
    rangeEnd.setHours(23, 59, 59, 999);

    return sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return !Number.isNaN(sessionDate.getTime()) && sessionDate >= rangeStart && sessionDate <= rangeEnd;
    });
  }, [sessions, summaryRange, offsetDays]);

  const previousRangeSessions = useMemo(() => {
    const bounds = getPreviousRangeBounds(summaryRange, offsetDays);
    if (!bounds) return [];

    return sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return !Number.isNaN(sessionDate.getTime()) && sessionDate >= bounds.previousStart && sessionDate <= bounds.previousEnd;
    });
  }, [sessions, summaryRange, offsetDays]);

  const weeklyDailyData = useMemo<DailySummaryDay[]>(() => {
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - offsetDays);
    endDate.setHours(23, 59, 59, 999);
    const rangeStart = getRangeStart(summaryRange, offsetDays);

    const firstSessionDate = filteredSessions.reduce<Date | null>((earliest, session) => {
      const sessionDate = new Date(session.date);
      if (Number.isNaN(sessionDate.getTime())) return earliest;
      if (!earliest || sessionDate < earliest) return sessionDate;
      return earliest;
    }, null);

    const startDate = rangeStart
      ? new Date(rangeStart)
      : firstSessionDate
        ? new Date(firstSessionDate)
        : new Date(endDate);
    startDate.setHours(0, 0, 0, 0);

    const dayMap: Record<string, { distance: number; calories: number; duration: number; trimp: number; sessions: number; cadenceWeighted: number }> = {};

    const current = new Date(startDate);
    // Use a while loop to increment days safely
    while (current <= endDate) {
      const key = getLocalDateKey(current);
      dayMap[key] = { distance: 0, calories: 0, duration: 0, trimp: 0, sessions: 0, cadenceWeighted: 0 };
      current.setDate(current.getDate() + 1);
    }

    filteredSessions.forEach(session => {
      const key = getLocalDateKey(new Date(session.date));
      if (dayMap[key] !== undefined) {
        const full = calculateFullStats(session);
        const duration = session.duration || 0;
        dayMap[key].distance += full.totalDistanceKm || 0;
        dayMap[key].calories += full.totalCalories || 0;
        dayMap[key].duration += duration;
        dayMap[key].trimp += full.trainingLoad.score || 0;
        dayMap[key].sessions += 1;
        dayMap[key].cadenceWeighted += (session.stats.avgCadence || 0) * duration;
      }
    });

    const todayKey = getLocalDateKey(new Date());

    return Object.entries(dayMap).map(([dateStr, data]) => {
      const d = new Date(dateStr);
      const isToday = dateStr === todayKey;
      return {
        date: dateStr,
        label: isToday ? 'Today' : DAY_LABELS[d.getDay()],
        shortDate: `${d.getMonth() + 1}/${d.getDate()}`,
        distance: parseFloat(data.distance.toFixed(2)),
        calories: data.calories,
        durationSeconds: data.duration,
        trimp: Math.round(data.trimp * 10) / 10,
        sessions: data.sessions,
        cadence: weightedAvg(data.cadenceWeighted, data.duration),
        isToday,
        hasData: data.sessions > 0,
      };
    });
  }, [filteredSessions, calculateFullStats, summaryRange, offsetDays]);

  const trainingLoadMetrics = useMemo(() => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - offsetDays);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 27);
    startDate.setHours(0, 0, 0, 0);

    const dailyLoads = new Map<string, number>();
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dailyLoads.set(getLocalDateKey(cursor), 0);
      cursor.setDate(cursor.getDate() + 1);
    }

    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      if (Number.isNaN(sessionDate.getTime()) || sessionDate < startDate || sessionDate > endDate) return;

      const key = getLocalDateKey(sessionDate);
      const load = calculateFullStats(session).trainingLoad.score || 0;
      dailyLoads.set(key, (dailyLoads.get(key) || 0) + load);
    });

    return calculateTrainingLoadMetrics(Array.from(dailyLoads.values()));
  }, [sessions, offsetDays, calculateFullStats]);

  // Four rolling 7-day windows over the same 28-day span the Load Ratio uses:
  // the last bar is the acute week (its total equals acuteLoad) and the first
  // three form the chronic baseline, so the chart stays consistent with the
  // ratio numbers shown beside it.
  const loadRatioWeeklyData = useMemo<WeeklyLoadPoint[]>(() => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - offsetDays);
    endDate.setHours(23, 59, 59, 999);

    const windows: { start: Date; end: Date }[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(endDate);
      start.setDate(start.getDate() - (i * 7 + 6));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      windows.push({ start, end });
    }

    const windowTrimp = windows.map(() => 0);
    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      if (Number.isNaN(sessionDate.getTime()) || sessionDate < windows[0].start || sessionDate > windows[3].end) return;

      const load = calculateFullStats(session).trainingLoad.score || 0;
      for (let w = 0; w < windows.length; w++) {
        if (sessionDate >= windows[w].start && sessionDate <= windows[w].end) {
          windowTrimp[w] += load;
          break;
        }
      }
    });

    const formatWindowLabel = (start: Date, end: Date) => {
      const startLabel = `${start.getMonth() + 1}/${start.getDate()}`;
      const endLabel = start.getMonth() === end.getMonth()
        ? String(end.getDate())
        : `${end.getMonth() + 1}/${end.getDate()}`;
      return `${startLabel}–${endLabel}`;
    };

    return windows.map((window, index) => ({
      label: formatWindowLabel(window.start, window.end),
      trimp: Math.round(windowTrimp[index] * 10) / 10,
      isCurrent: index === windows.length - 1,
    }));
  }, [sessions, offsetDays, calculateFullStats]);

  interface PeriodGroup {
    key: string;
    label: string;
    sortKey: number;
    totalDistance: number;
    totalCalories: number;
    totalDuration: number;
    totalTrainingLoad: number;
    avgHrWeighted: number;
    avgPowerWeighted: number;
    avgCadenceWeighted: number;
    sessionCount: number;
  }

  const summaryData = useMemo<PeriodSummaryEntry[]>(() => {
    if (filteredSessions.length === 0) return [];

    if (summaryPeriod === 'daily') {
      return weeklyDailyData.map(d => ({
        label: d.shortDate,
        totalDistance: d.distance,
        totalCalories: d.calories,
        totalDuration: d.durationSeconds,
        totalTrainingLoad: d.trimp,
        sessionCount: d.sessions,
      }));
    }

    const groups: Record<string, PeriodGroup> = {};

    filteredSessions.forEach(session => {
      const date = new Date(session.date);
      let key = '';
      let sortKey = 0;
      let label = '';

      if (summaryPeriod === 'yearly') {
        key = date.getFullYear().toString();
        sortKey = date.getFullYear();
        label = key;
      } else if (summaryPeriod === 'monthly') {
        key = `${date.getFullYear()}-${date.getMonth()}`;
        sortKey = date.getFullYear() * 12 + date.getMonth();
        label = date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
      } else if (summaryPeriod === 'weekly') {
        // UTC day arithmetic avoids DST-fraction drift in the week number.
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const dateUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
        const startOfYearUtc = Date.UTC(date.getFullYear(), 0, 1);
        const pastDaysOfYear = Math.floor((dateUtc - startOfYearUtc) / DAY_MS);
        const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        key = `${date.getFullYear()}-W${weekNum}`;
        sortKey = date.getFullYear() * 100 + weekNum;
        label = t('Week {week}, {year}', { week: weekNum, year: date.getFullYear() });
      }

      const full = calculateFullStats(session);
      const duration = session.duration || 0;

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          sortKey,
          totalDistance: 0,
          totalCalories: 0,
          totalDuration: 0,
          totalTrainingLoad: 0,
          avgHrWeighted: 0,
          avgPowerWeighted: 0,
          avgCadenceWeighted: 0,
          sessionCount: 0,
        };
      }

      groups[key].totalDistance += full.totalDistanceKm || 0;
      groups[key].totalCalories += full.totalCalories || 0;
      groups[key].totalDuration += duration;
      groups[key].totalTrainingLoad += full.trainingLoad.score || 0;
      groups[key].avgHrWeighted += (session.stats.avgHr || 0) * duration;
      groups[key].avgPowerWeighted += (session.stats.avgPower || 0) * duration;
      groups[key].avgCadenceWeighted += (session.stats.avgCadence || 0) * duration;
      groups[key].sessionCount += 1;
    });

    return Object.values(groups)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(g => ({
        ...g,
        avgHr: weightedAvg(g.avgHrWeighted, g.totalDuration),
        avgPower: weightedAvg(g.avgPowerWeighted, g.totalDuration),
        avgCadence: weightedAvg(g.avgCadenceWeighted, g.totalDuration),
        totalDistance: parseFloat(g.totalDistance.toFixed(2)),
        totalTrainingLoad: Math.round(g.totalTrainingLoad * 10) / 10,
      }));
  }, [filteredSessions, summaryPeriod, calculateFullStats, weeklyDailyData, locale, t]);

  const globalSummary = useMemo<GlobalSummary | null>(() => {
    if (summaryData.length === 0) return null;
    const hrrSessions = filteredSessions.filter(session => typeof session.stats?.hrrScore === 'number');
    const hrrScores = hrrSessions.map(session => session.stats.hrrScore as number);
    const bestHrr = hrrScores.length > 0 ? Math.max(...hrrScores) : null;
    const avgHrr = hrrScores.length > 0
      ? Math.round(hrrScores.reduce((acc, score) => acc + score, 0) / hrrScores.length)
      : null;
    // Chronological copy for the trend sparkline (filteredSessions order is not
    // guaranteed — sessions arrive newest-first from the store).
    const hrrSeries = [...hrrSessions]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(session => session.stats.hrrScore as number);
    const totalTrainingLoad = summaryData.reduce((acc, curr) => acc + (curr.totalTrainingLoad || 0), 0);
    const totalSessions = summaryData.reduce((acc, curr) => acc + curr.sessionCount, 0);
    // Single source for the 7-day load: the raw acute load used by Load
    // Guidance (rounds only once, no per-day rounding accumulation).
    const sevenDayTrainingLoad = trainingLoadMetrics.acuteLoad;

    return {
      totalDistance: summaryData.reduce((acc, curr) => acc + curr.totalDistance, 0).toFixed(2),
      totalCalories: summaryData.reduce((acc, curr) => acc + curr.totalCalories, 0),
      totalDuration: formatDuration(summaryData.reduce((acc, curr) => acc + curr.totalDuration, 0)),
      totalSessions,
      totalTrainingLoad: Math.round(totalTrainingLoad * 10) / 10,
      averageTrainingLoad: totalSessions > 0 ? Math.round((totalTrainingLoad / totalSessions) * 10) / 10 : 0,
      sevenDayTrainingLoad,
      hrrSessions: hrrSessions.length,
      avgHrr,
      bestHrr,
      hrrSeries,
    };
  }, [summaryData, filteredSessions, trainingLoadMetrics]);

  // Intensity composition of the range: time in each HR zone, the same zones
  // split by session type, and the power-zone distribution. All of it comes
  // from data that is already computed or from one cheap pass over the session
  // histories; the power block stays empty while the FTP gate is shut.
  const intensity = useMemo<IntensitySummary>(() => {
    const zoneSeconds = HR_ZONES.map(() => 0);
    // Per bucket: session count plus its own zone seconds. Both are needed —
    // a bucket whose sessions recorded no HR must still show up by name.
    const buckets: Record<SessionTypeBucket, { sessions: number; zoneSeconds: number[] }> = {
      easy: { sessions: 0, zoneSeconds: HR_ZONES.map(() => 0) },
      moderate: { sessions: 0, zoneSeconds: HR_ZONES.map(() => 0) },
      hard: { sessions: 0, zoneSeconds: HR_ZONES.map(() => 0) },
    };
    let recordedSeconds = 0;

    filteredSessions.forEach(session => {
      recordedSeconds += session.duration || 0;

      const bucket = getSessionTypeBucket(getWorkoutQuality(session, maxHr).label);
      buckets[bucket].sessions += 1;

      calculateFullStats(session).zones.forEach((zone, index) => {
        if (index >= zoneSeconds.length) return;
        zoneSeconds[index] += zone.seconds;
        buckets[bucket].zoneSeconds[index] += zone.seconds;
      });
    });

    // Zone boundaries are identical for every session of a render, so the first
    // session supplies the absolute bpm ranges for the legend.
    const zoneRanges = filteredSessions.length > 0 ? calculateFullStats(filteredSessions[0]).zones : [];
    const buildZoneShares = (seconds: number[]): { zones: ZoneShare[]; countedSeconds: number } => {
      const counted = seconds.reduce((total, value) => total + value, 0);
      return {
        countedSeconds: counted,
        zones: seconds.map((value, index) => ({
          label: `Z${index + 1}`,
          range: zoneRanges[index]?.range ?? '',
          seconds: value,
          percent: counted > 0 ? Math.round((value / counted) * 100) : 0,
          time: formatDuration(value),
        })),
      };
    };

    const overall = buildZoneShares(zoneSeconds);
    const countedSeconds = overall.countedSeconds;
    const zones = overall.zones;
    const lastZone = zoneSeconds.length - 1;
    const easySeconds = (zoneSeconds[0] ?? 0) + (zoneSeconds[1] ?? 0);
    const hardSeconds = (zoneSeconds[lastZone - 1] ?? 0) + (zoneSeconds[lastZone] ?? 0);

    const zoneByType: SessionTypeZones[] = SESSION_TYPE_BUCKETS
      .map(type => ({
        type,
        sessions: buckets[type].sessions,
        ...buildZoneShares(buckets[type].zoneSeconds),
      }))
      .filter(entry => entry.sessions > 0);

    const power = summarizePowerZones(
      filteredSessions.map(session => ({ history: session.history || [], duration: session.duration || 0 })),
      ftp
    );

    return {
      zones,
      countedSeconds,
      belowZoneSeconds: Math.max(0, recordedSeconds - countedSeconds),
      easyShare: countedSeconds > 0 ? easySeconds / countedSeconds : 0,
      hardShare: countedSeconds > 0 ? hardSeconds / countedSeconds : 0,
      zoneByType,
      powerZones: power.zones,
      powerCountedSeconds: power.countedSeconds,
      powerBelowZoneSeconds: power.belowZoneSeconds,
      hasFtp: profileGate.hasFtp,
    };
  }, [filteredSessions, calculateFullStats, maxHr, ftp, profileGate]);

  // 90 days of daily TRIMP ending today, for the fitness/fatigue model. Load
  // guidance keeps its own 28-day window; this one is deliberately longer and,
  // like the guidance, is independent of the selected summary range.
  const loadTrend = useMemo(() => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - offsetDays);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (LOAD_TREND_DAYS - 1));
    startDate.setHours(0, 0, 0, 0);

    const dailyLoads = new Map<string, number>();
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dailyLoads.set(getLocalDateKey(cursor), 0);
      cursor.setDate(cursor.getDate() + 1);
    }

    sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      if (Number.isNaN(sessionDate.getTime()) || sessionDate < startDate || sessionDate > endDate) return;

      const key = getLocalDateKey(sessionDate);
      dailyLoads.set(key, (dailyLoads.get(key) || 0) + (calculateFullStats(session).trainingLoad.score || 0));
    });

    return calculateLoadTrend(Array.from(dailyLoads.values()));
  }, [sessions, offsetDays, calculateFullStats]);

  // Body-mass normalised metrics (W/kg, kcal/kg/h). Computed in its own pass so
  // that a rider without a weight never pays for the calorie scan, and skipped
  // entirely while the gate is shut: no per-kilogram figure is ever divided by
  // an empty profile.
  const bodyMetrics = useMemo(() => {
    if (!profileGate.hasWeight) return null;

    let totalSeconds = 0;
    let totalCalories = 0;
    // Session stats are the single source for average/peak power (the same
    // values the session list and detail view show), so a W/kg figure can never
    // contradict the watts printed next to it.
    const bodySessions = filteredSessions.map(session => {
      const duration = session.duration || 0;
      totalSeconds += duration;
      totalCalories += calculateFullStats(session).totalCalories || 0;
      return {
        avgPower: session.stats?.avgPower || 0,
        maxPower: session.stats?.maxPower || 0,
        duration,
      };
    });

    return computeBodyMetrics({ sessions: bodySessions, totalSeconds, totalCalories, weightKg: weight });
  }, [filteredSessions, calculateFullStats, profileGate.hasWeight, weight]);

  // L2 payload: how much of the range is actually backed by data, the
  // fitness/fatigue model, and the body-mass normalised metrics. Coverage and
  // W/kg are range-scoped; the model is not.
  const advanced = useMemo<AdvancedSummary>(() => {
    let withHeartRate = 0;
    let withPower = 0;
    let withHrv = 0;

    filteredSessions.forEach(session => {
      if ((session.stats?.avgHr || 0) > 0) withHeartRate += 1;
      if ((session.stats?.avgPower || 0) > 0) withPower += 1;
      if (typeof session.stats?.hrvRmssd === 'number') withHrv += 1;
    });

    return {
      coverage: {
        sessions: filteredSessions.length,
        withHeartRate,
        withPower,
        withHrr: globalSummary?.hrrSessions ?? 0,
        withHrv,
      },
      loadTrend,
      bodyMetrics,
      hasWeight: profileGate.hasWeight,
      // Trends come straight from the dated entries, independent of the range:
      // they answer "am I changing?" rather than "what did this range do?".
      bodyTrend: summarizeBodyTrend(bodyHistory),
    };
  }, [filteredSessions, globalSummary, loadTrend, bodyMetrics, profileGate, bodyHistory]);

  const summaryInsights = useMemo<SummaryInsights | null>(() => {
    if (filteredSessions.length === 0 || summaryData.length === 0) return null;

    const sortedSessions = [...filteredSessions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstSession = sortedSessions[0];
    const lastSession = sortedSessions[sortedSessions.length - 1];
    const firstDate = new Date(firstSession.date);
    const lastDate = new Date(lastSession.date);
    const spanDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / DAY_MS) + 1);
    const totalDistance = summaryData.reduce((acc, curr) => acc + curr.totalDistance, 0);
    const totalDuration = summaryData.reduce((acc, curr) => acc + curr.totalDuration, 0);
    const totalSessions = summaryData.reduce((acc, curr) => acc + curr.sessionCount, 0);
    const activeDays = weeklyDailyData.filter(day => day.hasData);
    const activeDayCount = activeDays.length;
    const bestPeriod = summaryData.reduce((best, current) =>
      current.totalDistance > best.totalDistance ? current : best
    , summaryData[0]);

    let longestStreak = 0;
    let runningStreak = 0;
    for (const day of weeklyDailyData) {
      if (day.hasData) {
        runningStreak += 1;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }

    // Grace: today has not ended yet — when the last day is today without
    // data, count the streak from yesterday instead of breaking to 0.
    let currentStreak = 0;
    let streakStartIndex = weeklyDailyData.length - 1;
    const lastDay = weeklyDailyData[streakStartIndex];
    if (lastDay?.isToday && !lastDay.hasData) {
      streakStartIndex -= 1;
    }
    for (let i = streakStartIndex; i >= 0; i--) {
      if (weeklyDailyData[i].hasData) currentStreak += 1;
      else break;
    }

    return {
      avgDistancePerSession: totalSessions > 0 ? (totalDistance / totalSessions).toFixed(1) : '0.0',
      avgDurationPerSession: totalSessions > 0 ? formatDuration(Math.round(totalDuration / totalSessions)) : '00:00',
      bestPeriodLabel: bestPeriod.label,
      bestPeriodDistance: bestPeriod.totalDistance.toFixed(1),
      lastWorkoutLabel: lastDate.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
      activeDaysLabel: t('{active}/{total} days', { active: activeDayCount, total: weeklyDailyData.length }),
      currentStreakLabel: t('{count} days', { count: currentStreak }),
      longestStreakLabel: t('{count} days', { count: longestStreak }),
      activeSpanLabel: spanDays >= 365
        ? t('{count} years', { count: (spanDays / 365).toFixed(1) })
        : spanDays >= 30
          ? t('{count} months', { count: Math.round(spanDays / 30) })
          : t('{count} days', { count: spanDays }),
    };
  }, [filteredSessions, summaryData, weeklyDailyData, locale, t]);

  const comparisonSummary = useMemo<ComparisonSummary | null>(() => {
    const bounds = getPreviousRangeBounds(summaryRange, offsetDays);
    if (!bounds || filteredSessions.length === 0) return null;

    const summarizeSessions = (targetSessions: WorkoutSession[]) => {
      return targetSessions.reduce((acc, session) => {
        const full = calculateFullStats(session);
        acc.distance += full.totalDistanceKm || 0;
        acc.calories += full.totalCalories || 0;
        acc.duration += session.duration || 0;
        acc.trimp += full.trainingLoad.score || 0;
        acc.sessions += 1;
        return acc;
      }, { distance: 0, calories: 0, duration: 0, trimp: 0, sessions: 0 });
    };

    const currentTotals = summarizeSessions(filteredSessions);
    const previousTotals = summarizeSessions(previousRangeSessions);
    const metrics = {
      distance: currentTotals.distance,
      calories: currentTotals.calories,
      duration: currentTotals.duration / 60,
      sessions: currentTotals.sessions,
      trimp: currentTotals.trimp,
    };
    const previousMetrics = {
      distance: previousTotals.distance,
      calories: previousTotals.calories,
      duration: previousTotals.duration / 60,
      sessions: previousTotals.sessions,
      trimp: previousTotals.trimp,
    };

    const getDelta = (current: number, previous: number) => {
      if (previous <= 0) {
        return current > 0 ? { value: null, direction: 'up' as const, hasBaseline: false } : { value: 0, direction: 'flat' as const, hasBaseline: false };
      }
      const raw = ((current - previous) / previous) * 100;
      return {
        value: Math.round(raw),
        direction: raw > 0 ? 'up' as const : raw < 0 ? 'down' as const : 'flat' as const,
        hasBaseline: true
      };
    };

    const deltas = {
      distance: getDelta(metrics.distance, previousMetrics.distance),
      calories: getDelta(metrics.calories, previousMetrics.calories),
      duration: getDelta(metrics.duration, previousMetrics.duration),
      sessions: getDelta(metrics.sessions, previousMetrics.sessions),
      trimp: getDelta(metrics.trimp, previousMetrics.trimp),
    };

    const rankedHeadline = [
      { label: 'distance', delta: deltas.distance },
      { label: 'sessions', delta: deltas.sessions },
      { label: 'duration', delta: deltas.duration },
      { label: 'calories', delta: deltas.calories },
      { label: 'training load', delta: deltas.trimp },
    ]
      .filter(entry => entry.delta.hasBaseline && entry.delta.value !== null)
      .sort((a, b) => Math.abs(b.delta.value ?? 0) - Math.abs(a.delta.value ?? 0))[0];

    const headline = rankedHeadline
      ? t('{metric} {direction} {value}%', {
          metric: t(rankedHeadline.label),
          direction: t(rankedHeadline.delta.direction === 'up' ? 'up' : rankedHeadline.delta.direction === 'down' ? 'down' : 'flat'),
          value: Math.abs(rankedHeadline.delta.value ?? 0),
        })
      : currentTotals.sessions > 0
        ? t('new activity in this range')
        : t('no activity in this range');

    return {
      label: t(summaryRange === '7d'
        ? 'vs previous 7 days'
        : summaryRange === '30d'
          ? 'vs previous 30 days'
          : summaryRange === '90d'
            ? 'vs previous 90 days'
            : 'vs previous year'),
      headline,
      metrics,
      deltas
    };
  }, [summaryRange, offsetDays, filteredSessions, previousRangeSessions, calculateFullStats, t]);

  const normalizedChartData = useMemo<HistoryChartPoint[]>(() => {
    if (summaryPeriod === 'daily') {
      return weeklyDailyData.map(d => {
        return {
          ...d,
          duration: Math.round(d.durationSeconds / 60),
          displayLabel: d.label === 'Today' ? 'NOW' : d.label,
          subLabel: d.shortDate,
          isHighlight: d.isToday,
          distance: d.distance,
          calories: d.calories,
          cadence: d.cadence,
          trimp: d.trimp,
        };
      });
    }

    return summaryData.map((d, idx, arr) => {
      let mainLabel = d.label;
      let subLabel = '';

      if (summaryPeriod === 'yearly') {
          mainLabel = d.label;
      } else if (summaryPeriod === 'monthly') {
          const parts = d.label.split(' ');
          mainLabel = parts[0];
          subLabel = parts[1] || '';
      } else if (summaryPeriod === 'weekly') {
          const match = d.label.match(/Week (\d+), (\d+)/);
          if (match) {
              mainLabel = `W${match[1]}`;
              subLabel = match[2];
          }
      }

      return {
          date: d.key || d.label,
          displayLabel: mainLabel,
          subLabel: subLabel,
          distance: d.totalDistance,
          calories: d.totalCalories,
          duration: Math.round(d.totalDuration / 60),
          cadence: d.avgCadence ?? 0,
          trimp: d.totalTrainingLoad,
          sessions: d.sessionCount,
          hasData: d.sessionCount > 0,
          isHighlight: idx === arr.length - 1,
      };
    });
  }, [summaryPeriod, weeklyDailyData, summaryData]);

  return {
    calculateFullStats,
    globalSummary,
    intensity,
    advanced,
    normalizedChartData,
    summaryInsights,
    comparisonSummary,
    trainingLoadMetrics,
    weeklyDailyData,
    loadRatioWeeklyData
  };
};
