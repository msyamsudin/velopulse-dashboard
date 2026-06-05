import { useMemo } from 'react';
import { formatDuration } from '../utils/formatters';
import { HR_ZONES, getSafeMaxHr } from '@/lib/constants';

interface UseWorkoutHistoryDataProps {
  sessions: any[];
  maxHr: number;
  summaryPeriod: 'yearly' | 'monthly' | 'weekly' | 'daily';
  summaryRange: '7d' | '30d' | '90d' | '1y' | 'all';
  weeklyMetric: 'distance' | 'calories' | 'duration' | 'cadence';
  offsetDays?: number;
}

const DAY_MS = 86400000;

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
  if (range === '1y') start.setFullYear(end.getFullYear() - 1);
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

export const useWorkoutHistoryData = ({ sessions, maxHr, summaryPeriod, summaryRange, weeklyMetric, offsetDays = 0 }: UseWorkoutHistoryDataProps) => {
  
  const calculateFullStats = useMemo(() => (session: any) => {
    const history = session.history || [];
    const statsTemplate = {
      ...session.stats,
      avgSpeed: '0.0',
      maxSpeed: '0.0',
      totalDistance: 0,
      totalCalories: 0,
      avgResistance: 0,
      maxResistance: 0,
      moveMinutes: 0,
      zones: []
    };

    if (history.length === 0) return statsTemplate;

    const safeMax = getSafeMaxHr(maxHr);

    const activePoints = history.filter((h: any) => h.hr >= (safeMax * HR_ZONES[0].minPct)).length;
    const activeRatio = activePoints / history.length;
    const activeSeconds = Math.floor(session.duration * activeRatio);
    const moveMinutes = Math.floor(activeSeconds / 60);

    const ZONE_NAMES = ['Warm Up', 'Fat Burn', 'Aerobic', 'Anaerobic', 'Peak'];
    const ZONE_COLORS = ['text-hw-muted', 'text-green-400', 'text-hw-accent', 'text-orange-500', 'text-red-500'];

    const zones = HR_ZONES.map((z, i) => ({
      label: ZONE_NAMES[i],
      min: z.minPct,
      max: z.maxPct,
      seconds: 0,
      color: ZONE_COLORS[i],
      range: i === 0
        ? `<${Math.round(safeMax * z.maxPct)}`
        : i === HR_ZONES.length - 1
          ? `>${Math.round(safeMax * z.minPct)}`
          : `${Math.round(safeMax * z.minPct)}-${Math.round(safeMax * z.maxPct)}`,
    }));

    history.forEach((h: any) => {
      const ratio = h.hr / safeMax;
      // Last zone is catch-all for >= 90% (handles HR above 100% maxHR)
      for (let i = zones.length - 1; i >= 0; i--) {
        if (ratio >= zones[i].min) {
          zones[i].seconds++;
          break;
        }
      }
    });

    return {
      ...session.stats,
      avgSpeed: (history.reduce((a: any, b: any) => a + b.speed, 0) / history.length).toFixed(1),
      maxSpeed: Math.max(...history.map((h: any) => h.speed)).toFixed(1),
      totalDistance: (Math.max(...history.map((h: any) => h.distance)) / 1000).toFixed(2),
      totalCalories: Math.max(...history.map((h: any) => h.calories)),
      avgResistance: Math.round(history.reduce((a: any, b: any) => a + b.resistance, 0) / history.length),
      maxResistance: Math.max(...history.map((h: any) => h.resistance)),
      moveMinutes,
      zones: zones.map(z => {
        const ratio = z.seconds / history.length;
        const allocatedSeconds = Math.round(ratio * session.duration);
        return {
          ...z,
          percent: Math.round(ratio * 100),
          time: formatDuration(allocatedSeconds)
        };
      })
    };
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

  const weeklyDailyData = useMemo(() => {
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

    const dayMap: Record<string, { distance: number; calories: number; duration: number; sessions: number; cadenceSum: number }> = {};

    let current = new Date(startDate);
    // Use a while loop to increment days safely
    while (current <= endDate) {
      const key = getLocalDateKey(current);
      dayMap[key] = { distance: 0, calories: 0, duration: 0, sessions: 0, cadenceSum: 0 };
      current.setDate(current.getDate() + 1);
    }

    filteredSessions.forEach(session => {
      const key = getLocalDateKey(new Date(session.date));
      if (dayMap[key] !== undefined) {
        const full = calculateFullStats(session);
        dayMap[key].distance += parseFloat(full.totalDistance as string) || 0;
        dayMap[key].calories += full.totalCalories || 0;
        dayMap[key].duration += session.duration || 0;
        dayMap[key].sessions += 1;
        dayMap[key].cadenceSum += session.stats.avgCadence || 0;
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
        sessions: data.sessions,
        cadence: data.sessions > 0 ? Math.round(data.cadenceSum / data.sessions) : 0,
        isToday,
        hasData: data.sessions > 0,
      };
    });
  }, [filteredSessions, calculateFullStats, summaryRange, offsetDays]);

  const summaryData = useMemo(() => {
    if (filteredSessions.length === 0) return [];

    if (summaryPeriod === 'daily') {
      return weeklyDailyData.map(d => ({
        label: d.shortDate,
        totalDistance: d.distance,
        totalCalories: d.calories,
        totalDuration: d.durationSeconds,
        sessionCount: d.sessions,
      }));
    }

    const groups: { [key: string]: any } = {};

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
        label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else if (summaryPeriod === 'weekly') {
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        key = `${date.getFullYear()}-W${weekNum}`;
        sortKey = date.getFullYear() * 100 + weekNum;
        label = `Week ${weekNum}, ${date.getFullYear()}`;
      }

      const full = calculateFullStats(session);

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          sortKey,
          totalDistance: 0,
          totalCalories: 0,
          totalDuration: 0,
          avgHrSum: 0,
          avgPowerSum: 0,
          avgCadenceSum: 0,
          sessionCount: 0,
        };
      }

      groups[key].totalDistance += parseFloat(full.totalDistance) || 0;
      groups[key].totalCalories += full.totalCalories || 0;
      groups[key].totalDuration += session.duration || 0;
      groups[key].avgHrSum += session.stats.avgHr || 0;
      groups[key].avgPowerSum += session.stats.avgPower || 0;
      groups[key].avgCadenceSum += session.stats.avgCadence || 0;
      groups[key].sessionCount += 1;
    });

    return Object.values(groups)
      .sort((a: any, b: any) => a.sortKey - b.sortKey)
      .map((g: any) => ({
        ...g,
        avgHr: Math.round(g.avgHrSum / g.sessionCount),
        avgPower: Math.round(g.avgPowerSum / g.sessionCount),
        avgCadence: Math.round(g.avgCadenceSum / g.sessionCount),
        totalDistance: parseFloat(g.totalDistance.toFixed(2)),
      }));
  }, [filteredSessions, summaryPeriod, calculateFullStats, weeklyDailyData]);

  const globalSummary = useMemo(() => {
    if (summaryData.length === 0) return null;
    const hrrSessions = filteredSessions.filter(session => typeof session.stats?.hrrScore === 'number');
    const hrrScores = hrrSessions.map(session => session.stats.hrrScore as number);
    const bestHrr = hrrScores.length > 0 ? Math.max(...hrrScores) : null;
    const avgHrr = hrrScores.length > 0
      ? Math.round(hrrScores.reduce((acc, score) => acc + score, 0) / hrrScores.length)
      : null;

    return {
      totalDistance: summaryData.reduce((acc, curr) => acc + curr.totalDistance, 0).toFixed(2),
      totalCalories: summaryData.reduce((acc, curr) => acc + curr.totalCalories, 0),
      totalDuration: formatDuration(summaryData.reduce((acc, curr) => acc + curr.totalDuration, 0)),
      totalSessions: summaryData.reduce((acc, curr) => acc + curr.sessionCount, 0),
      hrrSessions: hrrSessions.length,
      avgHrr,
      bestHrr,
    };
  }, [summaryData, filteredSessions]);

  const summaryInsights = useMemo(() => {
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
    const bestPeriod = summaryData.reduce((best: any, current: any) =>
      current.totalDistance > best.totalDistance ? current : best
    , summaryData[0]);

    let currentStreak = 0;
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

    for (let i = weeklyDailyData.length - 1; i >= 0; i--) {
      if (weeklyDailyData[i].hasData) currentStreak += 1;
      else break;
    }

    return {
      avgDistancePerSession: totalSessions > 0 ? (totalDistance / totalSessions).toFixed(1) : '0.0',
      avgDurationPerSession: totalSessions > 0 ? formatDuration(Math.round(totalDuration / totalSessions)) : '00:00',
      bestPeriodLabel: bestPeriod.label,
      bestPeriodDistance: bestPeriod.totalDistance.toFixed(1),
      lastWorkoutLabel: lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      activeDaysLabel: `${activeDayCount}/${weeklyDailyData.length} days`,
      currentStreakLabel: `${currentStreak} days`,
      longestStreakLabel: `${longestStreak} days`,
      activeSpanLabel: spanDays >= 365
        ? `${(spanDays / 365).toFixed(1)} years`
        : spanDays >= 30
          ? `${Math.round(spanDays / 30)} months`
          : `${spanDays} days`,
    };
  }, [filteredSessions, summaryData, weeklyDailyData]);

  const comparisonSummary = useMemo(() => {
    const bounds = getPreviousRangeBounds(summaryRange);
    if (!bounds || filteredSessions.length === 0) return null;

    const summarizeSessions = (targetSessions: any[]) => {
      return targetSessions.reduce((acc, session) => {
        const full = calculateFullStats(session);
        acc.distance += parseFloat(full.totalDistance) || 0;
        acc.calories += full.totalCalories || 0;
        acc.duration += session.duration || 0;
        acc.sessions += 1;
        return acc;
      }, { distance: 0, calories: 0, duration: 0, sessions: 0 });
    };

    const currentTotals = summarizeSessions(filteredSessions);
    const previousTotals = summarizeSessions(previousRangeSessions);
    const metrics = {
      distance: currentTotals.distance,
      calories: currentTotals.calories,
      duration: currentTotals.duration / 60,
      sessions: currentTotals.sessions,
    };
    const previousMetrics = {
      distance: previousTotals.distance,
      calories: previousTotals.calories,
      duration: previousTotals.duration / 60,
      sessions: previousTotals.sessions,
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
    };

    const rankedHeadline = [
      { label: 'distance', delta: deltas.distance },
      { label: 'sessions', delta: deltas.sessions },
      { label: 'duration', delta: deltas.duration },
      { label: 'calories', delta: deltas.calories },
    ]
      .filter(entry => entry.delta.hasBaseline && entry.delta.value !== null)
      .sort((a, b) => Math.abs(b.delta.value ?? 0) - Math.abs(a.delta.value ?? 0))[0];

    const headline = rankedHeadline
      ? `${rankedHeadline.label} ${rankedHeadline.delta.direction === 'up' ? 'up' : rankedHeadline.delta.direction === 'down' ? 'down' : 'flat'} ${Math.abs(rankedHeadline.delta.value ?? 0)}%`
      : currentTotals.sessions > 0
        ? 'new activity in this range'
        : 'no activity in this range';

    return {
      label: summaryRange === '7d'
        ? 'vs previous 7 days'
        : summaryRange === '30d'
          ? 'vs previous 30 days'
          : summaryRange === '90d'
            ? 'vs previous 90 days'
            : 'vs previous year',
      headline,
      metrics,
      deltas
    };
  }, [summaryRange, filteredSessions, previousRangeSessions, calculateFullStats]);

  const normalizedChartData = useMemo(() => {
    if (summaryPeriod === 'daily') {
      return weeklyDailyData.map((d, idx) => {
        return {
          ...d,
          duration: Math.round(d.durationSeconds / 60),
          displayLabel: d.label === 'Today' ? 'NOW' : d.label,
          subLabel: d.shortDate,
          isHighlight: d.isToday,
          distance: d.distance,
          calories: d.calories,
          cadence: d.cadence,
        };
      });
    }

    return summaryData.map((d: any, idx, arr) => {
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
          cadence: d.avgCadence,
          sessions: d.sessionCount,
          hasData: d.sessionCount > 0,
          isHighlight: idx === arr.length - 1,
      };
    });
  }, [summaryPeriod, weeklyDailyData, summaryData]);

  return {
    calculateFullStats,
    globalSummary,
    normalizedChartData,
    summaryInsights,
    comparisonSummary,
    weeklyDailyData
  };
};
