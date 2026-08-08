import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Calendar, Timer, Zap, Heart, Bike, Activity, ChevronRight, Settings, Download, Route, Flame, Cloud, CloudOff } from 'lucide-react';
import { StackedWorkoutChart } from './StackedWorkoutChart';
import { formatDate, formatDuration } from '../../utils/formatters';
import { downloadTCX } from '../../lib/export-service';
import { generateSessionInsights, getInsightToneClasses, getMetricDelta, getSessionOutcome, getWorkoutQuality, getZoneInsight } from '../../lib/workout-analysis';

interface HistoryDetailProps {
  session: any;
  fullStats: any;
  previousSession?: any;
  previousFullStats?: any;
  maxHr?: number;
  onBack: () => void;
  onClose: () => void;
}

const toNumber = (value: any) => Number(value || 0);
const MAX_DETAIL_CHART_POINTS = 600;

const sampleHistoryForChart = (data: any[]) => {
  if (!data || data.length === 0) return [];
  if (data.length <= MAX_DETAIL_CHART_POINTS) {
    return data.map((point, index) => ({
      ...point,
      relativeTime: formatDuration(index),
    }));
  }

  const factor = data.length / MAX_DETAIL_CHART_POINTS;
  const result: any[] = [];

  for (let i = 0; i < MAX_DETAIL_CHART_POINTS; i++) {
    const sourceIndex = Math.floor(i * factor);
    result.push({
      ...data[sourceIndex],
      relativeTime: formatDuration(sourceIndex),
    });
  }

  const lastIndex = data.length - 1;
  result[result.length - 1] = {
    ...data[lastIndex],
    relativeTime: formatDuration(lastIndex),
  };

  return result;
};

const DeltaPill = ({ delta, unit = '', decimals = 0 }: { delta: ReturnType<typeof getMetricDelta>; unit?: string; decimals?: number }) => {
  if (!delta) return <span className="text-[9px] font-mono uppercase text-white/30">No baseline</span>;
  if (delta.direction === 'flat') return <span className="text-[9px] font-mono uppercase text-white/35">No change</span>;

  const sign = delta.direction === 'up' ? '+' : '';
  const color = delta.direction === 'up' ? 'text-green-400' : 'text-red-400';

  return (
    <span className={`text-[9px] font-mono uppercase tracking-widest ${color}`}>
      {sign}{delta.delta.toFixed(decimals)}{unit}
    </span>
  );
};

const OutcomeCard = ({
  label,
  value,
  unit,
  icon,
  colorClass,
  delta,
  deltaUnit,
  decimals = 0
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  colorClass: string;
  delta?: ReturnType<typeof getMetricDelta>;
  deltaUnit?: string;
  decimals?: number;
}) => (
  <div className="hardware-card border-hw-muted/20 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="text-[10px] text-hw-muted uppercase font-mono flex items-center gap-2">
        <span className={colorClass}>{icon}</span>
        {label}
      </div>
      <DeltaPill delta={delta ?? null} unit={deltaUnit ?? (unit ? ` ${unit}` : '')} decimals={decimals} />
    </div>
    <div className="text-2xl font-bold text-white tabular-nums">
      {value} {unit && <span className="text-xs font-normal opacity-40">{unit}</span>}
    </div>
  </div>
);

const MiniMetric = ({ label, value, unit, icon, colorClass }: { label: string; value: string | number; unit: string; icon: ReactNode; colorClass: string }) => (
  <div className="rounded-lg border border-white/8 bg-black/20 p-3">
    <div className="mb-2 flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-hw-muted">
      <span className={colorClass}>{icon}</span>
      {label}
    </div>
    <div className="text-lg font-bold text-white tabular-nums">
      {value} <span className="text-[10px] font-normal opacity-40">{unit}</span>
    </div>
  </div>
);

const OverviewChart = ({ data }: { data: any[] }) => {
  const chartData = useMemo(() => sampleHistoryForChart(data), [data]);

  return (
    <div
      className="h-[clamp(320px,48vh,560px)] rounded-2xl border border-hw-border p-4 backdrop-blur-xl"
      style={{ backgroundColor: 'var(--color-hw-card)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Overview</div>
          <div className="text-sm font-bold font-mono text-white">Power, heart rate, and cadence</div>
        </div>
        <div className="flex flex-wrap gap-3 text-[9px] font-mono uppercase tracking-widest text-white/45">
          <span className="text-yellow-400">Power</span>
          <span className="text-red-400">Heart Rate</span>
          <span className="text-hw-accent">Cadence</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="88%" minWidth={1} minHeight={1}>
        <LineChart data={chartData} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="relativeTime" stroke="#ffffff55" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            cursor={{ stroke: '#ffffff30', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload;
              return (
                <div className="rounded-lg border border-hw-border bg-hw-bg/95 px-4 py-3 shadow-xl">
                  <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-hw-muted">{point.relativeTime}</div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[10px] font-mono uppercase">
                    <span className="text-yellow-400">Power</span><span className="text-right text-white">{point.power} W</span>
                    <span className="text-red-400">HR</span><span className="text-right text-white">{point.hr} BPM</span>
                    <span className="text-hw-accent">Cadence</span><span className="text-right text-white">{point.cadence} RPM</span>
                  </div>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="power" stroke="#facc15" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="cadence" stroke="#00ffaa" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const HistoryDetail = ({
  session,
  fullStats,
  previousSession,
  previousFullStats,
  maxHr = 190,
  onBack,
  onClose
}: HistoryDetailProps) => {
  const [isDetailReady, setIsDetailReady] = useState(false);
  const [showZoneBpm, setShowZoneBpm] = useState(false);
  const [chartMode, setChartMode] = useState<'overview' | 'telemetry'>('overview');
  const chartHistory = useMemo(
    () => sampleHistoryForChart(session?.history || []),
    [session?.history]
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsDetailReady(true), 350);
    return () => clearTimeout(timer);
  }, []);

  if (!session || !fullStats) return null;

  const currentOutcome = getSessionOutcome(session);
  const previousOutcome = previousSession ? getSessionOutcome(previousSession) : null;
  const quality = getWorkoutQuality(session, maxHr);
  const zoneInsight = getZoneInsight(fullStats.zones);
  const autoInsights = generateSessionInsights({ session, fullStats, previousSession, previousFullStats, maxHr });
  const hrrScore = typeof session.stats?.hrrScore === 'number' ? session.stats.hrrScore : null;
  const hrrClassification = session.stats?.hrrClassification || 'Not classified';

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-100 bg-hw-bg/95 backdrop-blur-xl p-4 md:p-8 flex flex-col overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-full bg-hw-muted/10 border border-white/10 hover:bg-hw-accent hover:text-hw-bg transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight uppercase font-mono">
                Workout <span className="text-hw-accent">Report</span>
              </h2>
              <span className={`rounded border px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest ${quality.bg} ${quality.color}`}>
                {quality.label}
              </span>
              {session.synced_to_supabase ? (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-emerald-300">
                  <Cloud size={10} />
                  Supabase synced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-yellow-400/25 bg-yellow-400/5 px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-yellow-300">
                  <CloudOff size={10} />
                  Supabase pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-hw-muted text-xs font-mono uppercase tracking-widest mt-1">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(session.date)}</span>
              <span className="w-1 h-1 rounded-full bg-hw-muted/30" />
              <span className="flex items-center gap-1"><Timer size={12} /> {formatDuration(session.duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadTCX(session)}
            className="px-4 py-2 rounded border border-hw-muted/30 text-hw-muted hover:border-hw-accent hover:text-hw-accent font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
            title="Export for Strava/Garmin manual upload"
          >
            <Download size={12} />
            Export TCX
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-hw-muted/30 text-hw-muted hover:border-hw-muted hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all"
          >
            Close Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <OutcomeCard
            label="Duration"
            value={formatDuration(currentOutcome.duration)}
            icon={<Timer size={13} />}
            colorClass="text-blue-400"
            delta={getMetricDelta(currentOutcome.duration / 60, previousOutcome ? previousOutcome.duration / 60 : undefined)}
            deltaUnit=" min"
          />
          <OutcomeCard
            label="Distance"
            value={currentOutcome.distanceKm.toFixed(2)}
            unit="km"
            icon={<Route size={13} />}
            colorClass="text-blue-400"
            delta={getMetricDelta(currentOutcome.distanceKm, previousOutcome?.distanceKm)}
            decimals={2}
          />
          <OutcomeCard
            label="Calories"
            value={currentOutcome.calories}
            unit="kcal"
            icon={<Flame size={13} />}
            colorClass="text-pink-400"
            delta={getMetricDelta(currentOutcome.calories, previousOutcome?.calories)}
          />
          <OutcomeCard
            label="Avg Power"
            value={session.stats.avgPower}
            unit="w"
            icon={<Zap size={13} />}
            colorClass="text-yellow-400"
            delta={getMetricDelta(session.stats.avgPower, previousSession?.stats?.avgPower)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="flex flex-col gap-6">
            {autoInsights.length > 0 && (
              <div className="hardware-card border-hw-muted/20 p-4">
                <div className="mb-4 border-b border-white/5 pb-3">
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Automatic Insights</div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">Session interpretation from current telemetry</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {autoInsights.map(insight => (
                    <div key={`${insight.title}-${insight.body}`} className={`rounded-xl border px-4 py-3 ${getInsightToneClasses(insight.tone)}`}>
                      <div className="text-[9px] font-mono uppercase tracking-[0.18em]">{insight.title}</div>
                      <div className="mt-2 text-[11px] leading-relaxed text-white/65">{insight.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="hardware-card border-hw-muted/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Performance</div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45">Secondary metrics and session load</div>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-hw-accent">{zoneInsight}</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                <MiniMetric label="Avg HR" value={session.stats.avgHr} unit="bpm" icon={<Heart size={11} />} colorClass="text-red-500" />
                <MiniMetric label="Max HR" value={session.stats.maxHr} unit="bpm" icon={<Heart size={11} />} colorClass="text-red-500" />
                <MiniMetric label="Cadence" value={session.stats.avgCadence} unit="rpm" icon={<Bike size={11} />} colorClass="text-hw-accent" />
                <MiniMetric label="Resistance" value={fullStats.avgResistance} unit="lvl" icon={<Settings size={11} />} colorClass="text-orange-400" />
                <MiniMetric label="Speed" value={fullStats.avgSpeed} unit="km/h" icon={<Activity size={11} />} colorClass="text-blue-400" />
                <MiniMetric label="Move Min" value={fullStats.moveMinutes} unit="min" icon={<ChevronRight size={11} />} colorClass="text-purple-400" />
                <MiniMetric label="TRIMP Load" value={fullStats.trainingLoad.score} unit={fullStats.trainingLoad.label} icon={<Activity size={11} />} colorClass="text-purple-300" />
              </div>
            </div>

            {hrrScore !== null && (
              <div className="hardware-card border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-emerald-400/10 pb-3">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300">Heart Rate Recovery</div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">2 minute post-ride recovery score</div>
                  </div>
                  <Heart size={16} className="text-emerald-300" fill="currentColor" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <MiniMetric label="HRR Score" value={hrrScore} unit="bpm" icon={<Heart size={11} />} colorClass="text-emerald-300" />
                  <div className="md:col-span-2 rounded-lg border border-emerald-400/15 bg-black/20 p-3">
                    <div className="mb-2 text-[9px] font-mono uppercase tracking-widest text-hw-muted">Classification</div>
                    <div className="text-lg font-bold uppercase tracking-wide text-emerald-300">{hrrClassification}</div>
                    <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.12em] text-white/40">
                      Saved with this workout session
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="hardware-card border-hw-muted/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="text-[10px] text-hw-muted uppercase font-mono flex items-center gap-2">
                  <Activity size={10} className="text-hw-accent" /> Heart Rate Zones
                </div>
                <button
                  onClick={() => setShowZoneBpm(!showZoneBpm)}
                  className="text-[8px] font-mono text-hw-accent hover:text-white transition-colors uppercase tracking-widest border border-hw-accent/30 px-2 py-1 rounded"
                >
                  {showZoneBpm ? 'Hide BPM' : 'Show BPM'}
                </button>
              </div>
              <div className="space-y-3">
                {fullStats.zones.map((zone: any) => (
                  <div key={zone.label} className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex flex-col w-32">
                      <span className={`uppercase ${zone.color}`}>{zone.label}</span>
                      {showZoneBpm && <span className="text-[8px] text-hw-muted mt-0.5">{zone.range} BPM</span>}
                    </div>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full mx-4 overflow-hidden">
                      <div
                        className={`h-full bg-current ${zone.color.replace('text-', 'bg-')}`}
                        style={{ width: `${zone.percent}%` }}
                      />
                    </div>
                    <span className="text-white w-12 text-right">{zone.time}</span>
                    <span className="text-hw-muted w-10 text-right opacity-50">{zone.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Chart Mode</div>
                <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
                  <button
                    onClick={() => setChartMode('overview')}
                    className={`px-3 py-1.5 rounded-md font-mono text-[9px] uppercase tracking-widest transition-colors ${chartMode === 'overview' ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setChartMode('telemetry')}
                    className={`px-3 py-1.5 rounded-md font-mono text-[9px] uppercase tracking-widest transition-colors ${chartMode === 'telemetry' ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                  >
                    Telemetry
                  </button>
                </div>
              </div>
              {isDetailReady ? (
                chartMode === 'overview' ? (
                  <OverviewChart data={session.history} />
                ) : (
                  <StackedWorkoutChart
                    data={chartHistory}
                    stats={{
                      avgHr: session.stats.avgHr,
                      maxHr: session.stats.maxHr,
                      avgPower: session.stats.avgPower,
                      maxPower: session.stats.maxPower,
                      avgCadence: session.stats.avgCadence,
                      maxCadence: session.stats.maxCadence,
                      avgSpeed: fullStats.avgSpeed,
                      maxSpeed: fullStats.maxSpeed,
                      avgResistance: fullStats.avgResistance,
                      maxResistance: fullStats.maxResistance,
                    }}
                  />
                )
              ) : (
                <div className="h-[420px] w-full bg-black/20 rounded-xl flex items-center justify-center border border-white/5">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-hw-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-mono text-hw-muted uppercase tracking-widest">Generating Telemetry...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-5 self-start">
            <div className="mb-4 border-b border-white/5 pb-3">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Vs Previous Workout</div>
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">
                {previousSession ? formatDate(previousSession.date) : 'No earlier session'}
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Distance', current: currentOutcome.distanceKm, previous: previousOutcome?.distanceKm, unit: 'km', decimals: 2 },
                { label: 'Duration', current: currentOutcome.duration / 60, previous: previousOutcome ? previousOutcome.duration / 60 : undefined, unit: 'min', decimals: 0 },
                { label: 'Calories', current: currentOutcome.calories, previous: previousOutcome?.calories, unit: 'kcal', decimals: 0 },
                { label: 'Avg Power', current: session.stats.avgPower, previous: previousSession?.stats?.avgPower, unit: 'w', decimals: 0 },
                { label: 'Avg HR', current: session.stats.avgHr, previous: previousSession?.stats?.avgHr, unit: 'bpm', decimals: 0 },
                { label: 'Speed', current: toNumber(fullStats.avgSpeed), previous: previousFullStats ? toNumber(previousFullStats.avgSpeed) : undefined, unit: 'km/h', decimals: 1 },
                { label: 'TRIMP Load', current: fullStats.trainingLoad.score, previous: previousFullStats?.trainingLoad?.score, unit: 'pts', decimals: 1 },
              ].map(item => {
                const delta = getMetricDelta(item.current, item.previous);
                return (
                  <div key={item.label} className="flex items-center justify-between gap-4 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-hw-muted">{item.label}</div>
                      <div className="mt-1 text-sm font-bold text-white tabular-nums">
                        {item.current.toFixed(item.decimals)} <span className="text-[9px] font-normal opacity-40">{item.unit}</span>
                      </div>
                    </div>
                    <DeltaPill delta={delta} unit={` ${item.unit}`} decimals={item.decimals} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
