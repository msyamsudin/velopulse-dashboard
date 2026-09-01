import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Calendar, Trophy, Sparkles } from 'lucide-react';
import { getSessionOutcome, getWorkoutQuality } from '../../lib/workout-analysis';
import { calculateEdwardsTrimp } from '../../lib/training-load';
import { detectSessionAchievements } from '../../lib/milestone-records';
import { getSafeMaxHr } from '@/lib/constants';
import { RANGE_OPTIONS, RECORD_RANGE_DAYS, type SummaryRange } from './summary/constants';
import { EmptyState, StatusPill } from '../ui';
import { useI18n } from '@/i18n';
import { formatDuration } from '../../utils/formatters';
import type { WorkoutSession } from '@/store/useWorkoutStore';

/** Hex colors mirroring getWorkoutQuality's Tailwind classes. */
const QUALITY_HEX: Record<string, string> = {
  Easy: '#93c5fd',
  Endurance: '#4ade80',
  Tempo: '#fde047',
  Hard: '#fb923c',
  Peak: '#f87171',
};
const QUALITY_ORDER = ['Easy', 'Endurance', 'Tempo', 'Hard', 'Peak'];

const SESSION_METRICS = [
  { value: 'distance', label: 'KM', name: 'Distance', unit: 'km', color: '#00d2ff' },
  { value: 'calories', label: 'KCAL', name: 'Calories', unit: 'kcal', color: '#f472b6' },
  { value: 'duration', label: 'MIN', name: 'Duration', unit: 'min', color: '#fbbf24' },
  { value: 'trimp', label: 'TRIMP', name: 'Training Load', unit: 'pts', color: '#c084fc' },
  { value: 'avgHr', label: 'HR', name: 'Avg HR', unit: 'bpm', color: '#ef4444' },
  { value: 'avgPower', label: 'PWR', name: 'Avg Power', unit: 'w', color: '#facc15' },
] as const;

type SessionMetricKey = typeof SESSION_METRICS[number]['value'];
const metricConfigByKey = SESSION_METRICS.reduce((acc, option) => {
  acc[option.value] = option;
  return acc;
}, {} as Record<SessionMetricKey, (typeof SESSION_METRICS)[number]>);

/** One session; every value is the session's total (or average). */
export interface SessionChartPoint {
  id: string;
  ts: number;
  fullLabel: string;
  timeLabel: string;
  distanceKm: number;
  calories: number;
  duration: number;
  trimp: number;
  avgHr: number;
  avgPower: number;
  quality: string;
  fill: string;
  hasAchievement?: boolean;
  isCenturion?: boolean;
  achievementLabels?: string[];
}

/** One day on the chart; its sessions render as stacked segments. */
export interface DayChartPoint {
  key: string;
  label: string;
  fullLabel: string;
  /** Local midnight timestamp of the day (X position of the bar). */
  ts: number;
  /** Sessions of that day, sorted by time of day. */
  sessions: SessionChartPoint[];
}

interface SessionChartsProps {
  sessions: WorkoutSession[];
  maxHr: number;
  onSelectSession: (id: string) => void;
}

/**
 * Resolves the selected metric value for a session point. Metric keys
 * ('distance', ...) intentionally differ from the point field names
 * ('distanceKm', ...), so the mapping is explicit instead of an index —
 * a plain `point[metric]` would silently be undefined at runtime.
 */
export const resolveSessionMetric = (point: SessionChartPoint, metric: SessionMetricKey): number => {
  switch (metric) {
    case 'distance': return point.distanceKm;
    case 'calories': return point.calories;
    case 'duration': return point.duration;
    case 'trimp': return point.trimp;
    case 'avgHr': return point.avgHr;
    case 'avgPower': return point.avgPower;
  }
};

/** Groups sessions into local-day buckets, one bar per day. */
export const groupSessionsByDay = (points: SessionChartPoint[], includeYear: boolean): DayChartPoint[] => {
  const byKey = new Map<string, DayChartPoint>();

  for (const point of points) {
    const date = new Date(point.ts);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    let day = byKey.get(key);
    if (!day) {
      day = {
        key,
        label: date.toLocaleDateString('en-US', includeYear
          ? { month: 'short', day: 'numeric', year: 'numeric' }
          : { month: 'short', day: 'numeric' }),
        fullLabel: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        ts: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
        sessions: [],
      };
      byKey.set(key, day);
    }
    day.sessions.push(point);
  }

  return [...byKey.values()]
    .sort((a, b) => a.ts - b.ts)
    .map(day => ({
      ...day,
      sessions: [...day.sessions].sort((a, b) => a.ts - b.ts),
    }));
};

const formatMetricTick = (metric: SessionMetricKey, value: number) => {
  if (metric === 'distance') return value.toFixed(1);
  if (metric === 'duration') return String(Math.round(value / 60));
  return String(Math.round(value));
};

/** Day-level value shown as the tooltip "Total" row (average for avg metrics). */
const formatDayValue = (sessions: SessionChartPoint[], metric: SessionMetricKey) => {
  const values = sessions.map(session => resolveSessionMetric(session, metric));
  if (metric === 'avgHr' || metric === 'avgPower') {
    return String(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (metric === 'distance') return total.toFixed(2);
  if (metric === 'duration') return formatDuration(Math.round(total));
  return String(Math.round(total));
};

export const SessionCharts = ({ sessions, maxHr, onSelectSession }: SessionChartsProps) => {
  const { t } = useI18n();
  const [metric, setMetric] = useState<SessionMetricKey>('trimp');
  const [range, setRange] = useState<SummaryRange>('all');

  const safeMax = getSafeMaxHr(maxHr);

  const points = useMemo<SessionChartPoint[]>(() => {
    const raw = sessions.map(session => {
      const ts = new Date(session.date).getTime();
      const outcome = getSessionOutcome(session);
      const quality = getWorkoutQuality(session, maxHr);
      const trimp = calculateEdwardsTrimp(session.history, session.duration || 0, safeMax).score;
      const date = new Date(ts);
      const fullLabel = Number.isNaN(ts)
        ? 'Unknown date'
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const timeLabel = Number.isNaN(ts)
        ? ''
        : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const achievements = detectSessionAchievements(session, sessions);
      const achievementLabels = [
        ...achievements.milestones.map(m => `${m.icon} ${m.title}`),
        ...achievements.personalRecords.map(pr => `${pr.icon} ${pr.title}`),
      ];

      return {
        id: session.id,
        ts,
        fullLabel,
        timeLabel,
        distanceKm: outcome.distanceKm,
        calories: outcome.calories,
        duration: outcome.duration,
        trimp,
        avgHr: session.stats?.avgHr || 0,
        avgPower: outcome.avgPower,
        quality: quality.label,
        fill: achievements.isCenturion ? '#f59e0b' : QUALITY_HEX[quality.label] ?? '#94a3b8',
        hasAchievement: achievements.hasAchievements,
        isCenturion: achievements.isCenturion,
        achievementLabels,
      };
    });

    const valid = raw.filter(point => !Number.isNaN(point.ts));
    // Range is anchored to the newest session so rendering stays pure and
    // deterministic (no wall-clock reads during render).
    const maxTs = valid.reduce((max, point) => Math.max(max, point.ts), -Infinity);
    const days = RECORD_RANGE_DAYS[range];
    const cutoff = days === null || maxTs === -Infinity ? null : maxTs - days * 86_400_000;

    return valid
      .filter(point => cutoff === null || point.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);
  }, [sessions, maxHr, safeMax, range]);

  const dayPoints = useMemo(
    () => groupSessionsByDay(points, range === '1y' || range === 'all'),
    [points, range],
  );

  // Number of stacked segments needed = most sessions seen in a single day.
  const maxSegments = useMemo(
    () => dayPoints.reduce((max, day) => Math.max(max, day.sessions.length), 0),
    [dayPoints],
  );

  const metricConfig = metricConfigByKey[metric];
  const activeMetric = (point: SessionChartPoint) => resolveSessionMetric(point, metric);

  const metricTotal = points.length === 0
    ? null
    : (() => {
        const total = points.reduce((sum, point) => sum + activeMetric(point), 0);
        if (metric === 'distance') return `${total.toFixed(1)} km`;
        if (metric === 'duration') return formatDuration(Math.round(total));
        if (metric === 'trimp') return `${Math.round(total)} pts`;
        return `${Math.round(total / points.length)} ${metricConfig.unit}`;
      })();

  const average = points.length === 0
    ? null
    : points.reduce((sum, point) => sum + activeMetric(point), 0) / points.length;

  if (sessions.length === 0) {
    return (
      <EmptyState
        title={t('No matching sessions')}
        detail={t('Try a different search or import workouts')}
        icon={<Calendar size={20} />}
        className="py-20"
      />
    );
  }

  if (points.length === 0) {
    return (
      <EmptyState
        title={t('No sessions in this range')}
        detail={t('Try a wider range or clear the search')}
        icon={<Calendar size={20} />}
        className="py-20"
      />
    );
  }

  return (
    <div className="pb-8">
      <div className="rounded-lg border border-vp-border bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-vp-border pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-vp-accent/10 border border-vp-accent/25 shrink-0">
              <Activity size={14} className="text-vp-accent" />
            </div>
            <div className="min-w-0">
              <div className="vp-label">{t('Workout totals per day')}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-vp-text/70">
                {t('Each bar is a day, each segment is one session. Height is the selected total; color shows intensity. Click a segment to open the session.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill label={`${points.length} ${t('sessions')} / ${dayPoints.length} ${t('days')}`} tone="neutral" />
            {metricTotal && (
              <StatusPill label={`${metricConfig.name}: ${metricTotal}`} tone="ready" />
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-vp-border bg-black/20 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-14 shrink-0 text-[8px] font-mono uppercase tracking-[0.2em] text-vp-muted">{t('Metric')}</div>
            <div className="grid min-w-[320px] flex-1 grid-cols-6 overflow-hidden rounded-lg border border-vp-border bg-black/40 sm:max-w-md">
              {SESSION_METRICS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMetric(option.value)}
                  className={`px-2 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${metric === option.value ? 'text-vp-bg' : 'text-vp-muted hover:text-vp-text'}`}
                  style={metric === option.value ? { backgroundColor: option.color } : undefined}
                  title={option.name}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-white/6" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-14 shrink-0 text-[8px] font-mono uppercase tracking-[0.2em] text-vp-muted">{t('Range')}</div>
            <div className="grid min-w-[220px] flex-1 grid-cols-5 overflow-hidden rounded-lg border border-vp-border bg-black/40 sm:max-w-xs">
              {RANGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`px-2 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${range === option.value ? 'bg-vp-accent text-vp-bg' : 'text-vp-muted hover:text-vp-text'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[clamp(260px,40vh,420px)] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={1}>
            <BarChart data={dayPoints} margin={{ top: 16, right: 24, left: 8, bottom: 8 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin - 43200000', 'dataMax + 43200000']}
                stroke="#ffffff50"
                fontSize={10}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tickFormatter={(ts: number) =>
                  new Date(ts).toLocaleDateString('en-US',
                    range === '1y' || range === 'all'
                      ? { month: 'short', year: '2-digit' }
                      : { month: 'short', day: 'numeric' })
                }
              />
              <YAxis
                stroke="#ffffff50"
                fontSize={10}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(value: number) => formatMetricTick(metric, value)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                    const day = payload[0].payload as DayChartPoint;
                  const config = metricConfigByKey[metric];
                  const dayHasAchievements = day.sessions.some(s => s.hasAchievement);
                  return (
                    <div className="min-w-[220px] rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 shadow-xl">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-vp-muted">{day.fullLabel}</span>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
                          {day.sessions.length} {t('sessions')}
                        </span>
                      </div>

                      {dayHasAchievements && (
                        <div className="mt-2 mb-1 p-2 rounded bg-amber-400/10 border border-amber-400/30">
                          <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest font-bold text-amber-300">
                            <Trophy size={10} />
                            {t('Achievements Recorded')}
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {day.sessions.flatMap(s => s.achievementLabels).map((lbl, i) => (
                              <div key={i} className="text-[9px] font-mono text-amber-100 flex items-center gap-1">
                                <span>•</span> {lbl}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 space-y-1">
                        {day.sessions.map(session => {
                          const value = resolveSessionMetric(session, metric);
                          return (
                            <div key={session.id} className="flex items-center justify-between gap-4 text-[10px] font-mono uppercase">
                              <span className="flex items-center gap-1.5 text-white/70">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: session.fill }} />
                                <span>{session.timeLabel}</span>
                                <span className="text-[8px] opacity-50">{session.quality}</span>
                                {session.hasAchievement && <span className="text-[9px]">🏆</span>}
                              </span>
                              <span className="text-right text-white">
                                {metric === 'distance' ? session.distanceKm.toFixed(2) : metric === 'duration' ? formatDuration(session.duration) : metric === 'trimp' ? Math.round(session.trimp) : Math.round(value)} <span className="text-[8px] opacity-40">{config.unit}</span>
                              </span>
                            </div>
                          );
                        })}
                        <div className="mt-1 flex items-center justify-between gap-4 border-t border-white/10 pt-1.5 text-[10px] font-mono uppercase">
                          <span className="text-white/50">{t('Total')}</span>
                          <span className="text-right font-bold text-white">
                            {formatDayValue(day.sessions, metric)} <span className="text-[8px] font-normal opacity-40">{config.unit}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              {average !== null && (
                <ReferenceLine
                  y={average}
                  stroke="#ffffff55"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `AVG ${formatMetricTick(metric, average)}`,
                    position: 'insideTopRight',
                    fill: '#ffffff80',
                    fontSize: 9,
                    fontFamily: 'monospace',
                  }}
                />
              )}
              {Array.from({ length: maxSegments }, (_, segmentIndex) => (
                <Bar
                  key={segmentIndex}
                  stackId="day"
                  dataKey={(day: DayChartPoint) =>
                    day.sessions[segmentIndex] ? resolveSessionMetric(day.sessions[segmentIndex], metric) : 0
                  }
                  radius={segmentIndex === maxSegments - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                  onClick={(entry) => {
                    const day = (entry as { payload?: DayChartPoint } | undefined)?.payload;
                    const session = day?.sessions?.[segmentIndex];
                    if (session) onSelectSession(session.id);
                  }}
                >
                  {dayPoints.map(day => {
                    const session = day.sessions[segmentIndex];
                    const isSpecial = session?.hasAchievement;
                    return (
                      <Cell
                        key={day.key}
                        fill={session?.fill ?? 'transparent'}
                        fillOpacity={isSpecial ? 1 : 0.85}
                        stroke={isSpecial ? '#fbbf24' : 'rgba(0,0,0,0.55)'}
                        strokeWidth={isSpecial ? 2 : 1}
                      />
                    );
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-vp-border pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-vp-muted">{t('Intensity')}</span>
            {QUALITY_ORDER.map(quality => (
              <span key={quality} className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-vp-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: QUALITY_HEX[quality] }} />
                {quality}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono text-amber-300 uppercase tracking-widest">
            <Trophy size={11} className="text-amber-400" />
            <span>{t('Gold Border = Milestone / Record')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
