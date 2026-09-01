import { Activity, Bike, Compass, Flame, Heart, Maximize2, Minimize2, Radio, Route, Square, Timer, Zap } from 'lucide-react';
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';
import { getActiveHrZoneIndex, HR_ZONES } from '@/lib/constants';
import { calculateEdwardsTrimp } from '@/lib/training-load';
import { DELTA_MAX_SECONDS } from '@/lib/physics';
import { HrZoneBar } from '../HrZoneBar';
import { Sparkline } from '../Sparkline';
import { PowerGauge } from '../PowerGauge';
import { CadenceGauge } from '../CadenceGauge';
import { useI18n } from '@/i18n';
import { useResistanceAdvisor } from '@/hooks/useResistanceAdvisor';
import type { RiderProfile, TelemetrySnapshot, WorkoutView } from '@/lib/cockpit-types';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import { useResistancePlanStore } from '@/store/useResistancePlanStore';
import { useWorkoutStore, type LiveWorkoutStats } from '@/store/useWorkoutStore';

interface RecordingCockpitProps {
  currentData: TelemetrySnapshot;
  liveStats: LiveWorkoutStats;
  userProfile: RiderProfile;
  workout: WorkoutView;
  hrConnected: boolean;
  bikeConnected: boolean;
  hrrStatus?: 'idle' | 'detecting' | 'buffer' | 'measuring' | 'complete';
  canStartHrr?: boolean;
  onStartHrr?: () => void;
  chartAvailable?: boolean;
  onOpenChart?: () => void;
  onStopSession?: () => void;
}

interface MainEngineCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  colorClass: string;
  subLabel: string;
  subValue: ReactNode;
  visual: ReactNode;
  isWaiting?: boolean;
  accentStyle?: CSSProperties;
  badge?: ReactNode;
  spark?: { data: number[]; color: string };
}

interface MiniMetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  colorClass: string;
  progress?: number;
  detail?: string;
  subValue?: ReactNode;
  badge?: ReactNode;
  visual?: ReactNode;
  isWaiting?: boolean;
}

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

const HRV_READINESS_COLORS: Record<string, string> = {
  strained: 'text-red-400',
  balanced: 'text-yellow-300',
  recovered: 'text-green-400',
};

const HRV_READINESS_LABELS: Record<string, string> = {
  strained: 'Strained',
  balanced: 'Balanced',
  recovered: 'Recovered',
};

const HR_CARD_AURAS = [
  { rgb: '74, 92, 86', borderAlpha: 0.35, bgAlpha: 0.04, glowAlpha: 0.15 },
  { rgb: '74, 222, 128', borderAlpha: 0.5, bgAlpha: 0.06, glowAlpha: 0.25 },
  { rgb: '250, 204, 21', borderAlpha: 0.5, bgAlpha: 0.06, glowAlpha: 0.25 },
  { rgb: '249, 115, 22', borderAlpha: 0.55, bgAlpha: 0.07, glowAlpha: 0.3 },
  { rgb: '239, 68, 68', borderAlpha: 0.6, bgAlpha: 0.08, glowAlpha: 0.35 },
];

/**
 * Main Engine Card (Hero telemetry card for HR and Power)
 */
const MainEngineCard = ({
  label,
  value,
  unit,
  icon,
  colorClass,
  subLabel,
  subValue,
  visual,
  isWaiting = false,
  accentStyle,
  badge,
  spark,
}: MainEngineCardProps) => {
  const { t } = useI18n();

  return (
    <section
      className={`vp-panel-raised flex-1 min-h-[260px] flex flex-col justify-between transition-all duration-300 ${
        isWaiting ? 'opacity-70' : ''
      }`}
      style={accentStyle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-2 border-b border-vp-border/40">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-vp-muted flex items-center gap-2">
          <span className={`${colorClass} animate-pulse`}>{icon}</span>
          <span>{label}</span>
          {badge}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-vp-muted">{subLabel}</div>
          <div className={`text-sm md:text-base font-bold font-mono ${colorClass}`}>{subValue}</div>
        </div>
      </div>

      {/* Hero Value Display */}
      <div className="my-auto py-2 flex flex-col items-center justify-center text-center">
        <div className={`font-mono text-[clamp(3.5rem,7vw,6rem)] leading-none font-black tracking-tight tabular-nums ${colorClass}`}>
          {value}
          {unit && <span className="ml-2 text-lg md:text-2xl font-normal text-vp-muted align-baseline">{unit}</span>}
        </div>
        {isWaiting && (
          <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-vp-muted">
            {t('Waiting signal')}
          </div>
        )}
      </div>

      {/* Visual Component & Sparkline */}
      <div className="flex flex-col gap-2 pt-2 border-t border-vp-border/30">
        <div className="w-full">{visual}</div>
        {spark && spark.data.length > 1 && (
          <div className="-mx-2 px-2 h-7 overflow-hidden rounded bg-black/20">
            <Sparkline data={spark.data} color={spark.color} height={28} />
          </div>
        )}
      </div>
    </section>
  );
};

/**
 * Mini Metric Card for secondary telemetry (Cadence, Speed, Resistance, TRIMP)
 */
const MiniMetricCard = ({
  label,
  value,
  unit,
  icon,
  colorClass,
  progress,
  detail,
  subValue,
  badge,
  visual,
  isWaiting = false,
}: MiniMetricCardProps) => (
  <section className={`vp-panel flex-1 min-h-[120px] flex flex-col justify-between p-3.5 ${isWaiting ? 'opacity-70' : ''}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="font-mono text-xs uppercase tracking-[0.16em] text-vp-muted flex items-center gap-1.5 min-w-0 truncate">
        <span className={colorClass}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {badge}
        {detail && <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted">{detail}</span>}
      </div>
    </div>

    <div className="flex items-end justify-between gap-3 mt-1">
      <div className="flex flex-col">
        <div className={`font-mono text-3xl md:text-4xl font-black leading-none tabular-nums ${colorClass}`}>
          {value}
          {unit && <span className="ml-1.5 text-xs font-normal text-vp-muted">{unit}</span>}
        </div>
        {subValue && <div className="mt-1 text-[11px] font-mono text-vp-muted">{subValue}</div>}
      </div>

      {visual ? (
        <div className="shrink-0">{visual}</div>
      ) : progress !== undefined ? (
        <div className="w-16 md:w-24 h-2 rounded-full bg-vp-muted/15 overflow-hidden shrink-0">
          <div className={`h-full rounded-full bg-current ${colorClass} transition-all duration-300`} style={{ width: `${clampPct(progress)}%` }} />
        </div>
      ) : null}
    </div>
  </section>
);

/**
 * Bottom Accumulator Cell
 */
const AccumCell = ({
  label,
  value,
  unit,
  colorClass,
}: {
  label: string;
  value: string | number;
  unit?: string;
  colorClass: string;
}) => (
  <div className="flex flex-col gap-0.5 min-w-0 bg-white/[0.02] p-2.5 rounded-lg border border-vp-border/40">
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-vp-muted truncate">{label}</div>
    <div className={`font-mono text-xl md:text-2xl font-black leading-tight tabular-nums ${colorClass}`}>
      {value}
      {unit && <span className="ml-1 text-xs font-normal text-vp-muted">{unit}</span>}
    </div>
  </div>
);

export const RecordingCockpit = ({
  currentData,
  liveStats,
  userProfile,
  workout,
  hrConnected,
  bikeConnected,
  hrrStatus = 'idle',
  canStartHrr = false,
  onStartHrr,
  chartAvailable = false,
  onOpenChart,
  onStopSession,
}: RecordingCockpitProps) => {
  const { t } = useI18n();
  const [hudView, setHudView] = useState<'pro' | 'focus'>('pro');

  const safeMaxHr = userProfile.maxHr > 0 ? userProfile.maxHr : 1;
  const hrPct = currentData.hr > 0 ? Math.round((currentData.hr / safeMaxHr) * 100) : 0;
  const distanceKm = currentData.distance ? (currentData.distance / 1000).toFixed(2) : '--';
  const speed = currentData.speed || 0;
  const cadence = currentData.cadence || 0;
  const power = currentData.power || 0;
  const calories = currentData.calories || 0;
  const hasPowerSource = useWorkoutStore(state => state.hasPowerSource);
  const calorieSource: 'power' | 'sensor' | 'none' = hasPowerSource
    ? 'power'
    : calories > 0
      ? 'sensor'
      : 'none';
  const burnRate = Math.round(power * 3.6);
  const burnRatePerMin = Math.round(burnRate / 60);
  const resistance = currentData.resistance || 0;

  // Live Edwards TRIMP
  const trimp = useMemo(
    () => calculateEdwardsTrimp(workout.history, workout.elapsed, userProfile.maxHr),
    [workout.history, workout.elapsed, userProfile.maxHr]
  );

  // Recent points for 30s Sparkline
  const recentPoints = useMemo(() => {
    const history = workout.history;
    if (history.length === 0) return [];
    const last = history[history.length - 1];
    if (last.ts !== undefined) {
      const cutoff = last.ts - 30_000;
      const recent = history.filter(p => (p.ts ?? 0) >= cutoff);
      if (recent.length >= 2) return recent;
    }
    return history.slice(-30);
  }, [workout.history]);

  const hrTrend = useMemo(() => recentPoints.map(p => p.hr), [recentPoints]);
  const powerTrend = useMemo(() => recentPoints.map(p => p.power), [recentPoints]);

  // Zone times
  const zoneTimes = useMemo(() => {
    const times = [0, 0, 0, 0, 0];
    const history = workout.history;
    for (let i = 0; i < history.length; i++) {
      const point = history[i];
      const zone = getActiveHrZoneIndex(point.hr, userProfile.maxHr);
      let delta = 1;
      if (i > 0) {
        const prev = history[i - 1];
        if (prev.ts !== undefined && point.ts !== undefined) {
          delta = Math.min(Math.max((point.ts - prev.ts) / 1000, 0), DELTA_MAX_SECONDS);
        }
      }
      if (zone >= 0) times[zone] += delta;
    }
    return times.map(t => t / 60);
  }, [workout.history, userProfile.maxHr]);

  const activeHrZoneIndex = getActiveHrZoneIndex(currentData.hr, userProfile.maxHr);
  const activeHrZone = activeHrZoneIndex >= 0 ? HR_ZONES[activeHrZoneIndex] : null;
  const hrZoneLabel = activeHrZone?.label || 'IDLE';
  const hrZoneColor = activeHrZone?.color || 'text-vp-muted';
  const hrCardAura = activeHrZoneIndex >= 0 ? HR_CARD_AURAS[activeHrZoneIndex] : null;
  const hrCardStyle = hrCardAura
    ? {
        backgroundColor: `rgba(${hrCardAura.rgb}, ${hrCardAura.bgAlpha})`,
        borderColor: `rgba(${hrCardAura.rgb}, ${hrCardAura.borderAlpha})`,
        boxShadow: `0 10px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(${hrCardAura.rgb}, 0.12) inset, 0 0 40px -10px rgba(${hrCardAura.rgb}, ${hrCardAura.glowAlpha})`,
      }
    : undefined;

  const hrrInProgress = hrrStatus === 'buffer' || hrrStatus === 'measuring';
  const advisor = useResistanceAdvisor(currentData.distance || 0, currentData.resistance || 0);
  const planVariations = useResistancePlanStore(s => s.variations);
  const hrvRmssd = useBluetoothStore(s => s.hrvRmssd);
  const hrvReadiness = useBluetoothStore(s => s.hrvReadiness);
  const hrvColor = hrvReadiness ? HRV_READINESS_COLORS[hrvReadiness] : 'text-vp-muted';
  const hrvLabel = hrvReadiness ? HRV_READINESS_LABELS[hrvReadiness] : null;

  const wkg = userProfile.weight > 0 && power > 0 ? (power / userProfile.weight).toFixed(1) : '--';
  const ftpIntensityPct = userProfile.ftp > 0 && power > 0 ? Math.round((power / userProfile.ftp) * 100) : 0;

  return (
    <div className="relative h-full flex flex-col gap-3.5 overflow-y-auto no-scrollbar px-1 md:px-2 pb-4">
      {/* ──────────────── Top HUD Action & Status Bar ──────────────── */}
      <header className="relative shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-vp-border-strong bg-vp-surface-raised/95 px-4 py-3 shadow-lg backdrop-blur-md">
        {/* Left: REC Status + Elapsed Clock */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 shadow-[0_0_10px_#ef4444]" />
            </span>
            <span className="font-mono text-xs font-black tracking-widest text-red-400 uppercase">REC</span>
          </div>

          <div className="h-6 w-px bg-vp-border" />

          <div className="flex items-center gap-2 text-vp-accent">
            <Timer size={20} className="animate-pulse" />
            <span className="font-mono text-2xl md:text-3xl font-black leading-none tracking-tight tabular-nums text-vp-text">
              {workout.formatTime(workout.elapsed)}
            </span>
          </div>
        </div>

        {/* Center: Device & Metric Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* HR Strap Status */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition-colors ${
              hrConnected ? 'border-vp-hr/30 bg-vp-hr/10 text-vp-hr' : 'border-vp-border bg-white/[0.02] text-vp-dim'
            }`}
          >
            <Heart size={13} className={hrConnected && currentData.hr > 0 ? 'animate-pulse' : ''} />
            <span className="font-bold">{hrConnected ? `${currentData.hr || '--'} BPM` : 'HR Offline'}</span>
          </div>

          {/* Bike Status */}
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition-colors ${
              bikeConnected ? 'border-vp-accent/30 bg-vp-accent/10 text-vp-accent' : 'border-vp-border bg-white/[0.02] text-vp-dim'
            }`}
          >
            <Bike size={13} />
            <span className="font-bold">{bikeConnected ? `${power}W · ${cadence}RPM` : 'Bike Offline'}</span>
          </div>

          {/* HR Zone Badge */}
          {currentData.hr > 0 && (
            <div className={`hidden sm:flex items-center gap-1.5 rounded-lg border border-vp-border-strong bg-white/[0.04] px-2.5 py-1 text-xs font-mono ${hrZoneColor}`}>
              <Radio size={12} />
              <span className="font-bold tracking-wider uppercase">{t('Zone')} {hrZoneLabel}</span>
            </div>
          )}

          {/* HRV RMSSD */}
          {hrvRmssd !== null && (
            <div className={`hidden md:flex items-center gap-1.5 rounded-lg border border-vp-border bg-white/[0.03] px-2.5 py-1 text-xs font-mono ${hrvColor}`}>
              <Activity size={12} />
              <span>{t('HRV')} {hrvRmssd}ms{hrvLabel ? ` (${t(hrvLabel)})` : ''}</span>
            </div>
          )}
        </div>

        {/* Right: Mode Switcher & Quick Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Mode Switcher: Pro HUD vs Focus HUD */}
          <div className="flex rounded-lg border border-vp-border bg-black/30 p-0.5">
            <button
              type="button"
              onClick={() => setHudView('pro')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase transition-all ${
                hudView === 'pro'
                  ? 'bg-vp-accent text-vp-bg shadow-sm'
                  : 'text-vp-muted hover:text-vp-text'
              }`}
              title="Full telemetry cockpit mode"
            >
              <Minimize2 size={12} />
              <span>{t('Pro Cockpit')}</span>
            </button>
            <button
              type="button"
              onClick={() => setHudView('focus')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase transition-all ${
                hudView === 'focus'
                  ? 'bg-vp-accent text-vp-bg shadow-sm'
                  : 'text-vp-muted hover:text-vp-text'
              }`}
              title="High-contrast large numbers interval mode"
            >
              <Maximize2 size={12} />
              <span>{t('Focus Mode')}</span>
            </button>
          </div>

          {/* Live Telemetry Chart */}
          {onOpenChart && (
            <button
              type="button"
              onClick={onOpenChart}
              disabled={!chartAvailable}
              className="vp-button border-vp-accent/30 bg-vp-accent/10 text-vp-accent hover:border-vp-accent/60 hover:bg-vp-accent/20"
              title={t('Live Telemetry Chart')}
            >
              <Activity size={13} />
              <span className="hidden sm:inline">{t('Chart')}</span>
            </button>
          )}

          {/* Measure HRR */}
          <button
            type="button"
            onClick={onStartHrr}
            disabled={!canStartHrr || hrrInProgress}
            className="vp-button vp-button-danger disabled:opacity-35"
            title={t('Measure Heart Rate Recovery')}
          >
            <Heart size={13} />
            <span className="hidden sm:inline">{t(hrrInProgress ? 'HRR running' : 'Measure HRR')}</span>
          </button>

          {/* Stop Session Button */}
          {onStopSession && (
            <button
              type="button"
              onClick={onStopSession}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-400 hover:border-red-500 hover:bg-red-500 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer"
              title={t('Stop Workout')}
            >
              <Square size={13} className="fill-current" />
              <span>{t('Stop Session')}</span>
            </button>
          )}
        </div>
      </header>

      {/* ──────────────── MAIN HUD DISPLAY AREA ──────────────── */}
      {hudView === 'pro' ? (
        /* ══════════════ PRO HUD VIEW ══════════════ */
        <div className="flex flex-col flex-1 gap-3.5 min-h-0">
          {/* Top Row: Cardio Hero, Power Hero, and Machine Matrix */}
          <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-3.5 min-h-[420px]">
            {/* 1. CARDIO HERO ENGINE (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col">
              <MainEngineCard
                label={t('Heart Rate')}
                value={currentData.hr || '--'}
                unit="BPM"
                icon={<Heart size={16} />}
                colorClass="text-vp-hr"
                subLabel="% Max HR"
                subValue={currentData.hr ? `${hrPct}% · Z${activeHrZoneIndex + 1}` : t('Waiting')}
                visual={<HrZoneBar currentHr={currentData.hr} maxHr={userProfile.maxHr} zoneTimes={zoneTimes} />}
                isWaiting={!currentData.hr}
                accentStyle={hrCardStyle}
                spark={{ data: hrTrend, color: '#f05252' }}
                badge={
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-current ${hrZoneColor}`}>
                    {hrZoneLabel}
                  </span>
                }
              />
            </div>

            {/* 2. POWER & METABOLIC HERO ENGINE (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col">
              <MainEngineCard
                label={t('Power Output')}
                value={power || '--'}
                unit="W"
                icon={<Zap size={16} />}
                colorClass="text-vp-power"
                subLabel={t('Intensity')}
                subValue={
                  <div className="flex items-center gap-2">
                    <span>{wkg} W/KG</span>
                    <span className="text-xs font-normal opacity-70">({ftpIntensityPct}% FTP)</span>
                  </div>
                }
                visual={
                  <div className="flex flex-col gap-2.5">
                    <PowerGauge power={power} ftp={userProfile.ftp} weight={userProfile.weight} />

                    {/* Instantaneous Burn Rate */}
                    <div className="flex items-center justify-between bg-black/25 px-2.5 py-1.5 rounded-lg border border-vp-border/40 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-vp-calories font-bold">
                        <Flame size={13} />
                        <span>{burnRate} KCAL/HR</span>
                        <span className="text-[10px] font-normal text-vp-muted">({burnRatePerMin} /min)</span>
                      </div>
                      <div className="text-[10px] uppercase text-vp-muted font-bold">
                        {calorieSource === 'power' ? '⚡ Power' : calorieSource === 'sensor' ? '🚲 Sensor' : '--'}
                      </div>
                    </div>
                  </div>
                }
                isWaiting={!power}
                spark={{ data: powerTrend, color: '#f5c542' }}
                badge={
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-vp-power/40 text-vp-power">
                    MAX {liveStats.maxPower || 0}W
                  </span>
                }
              />
            </div>

            {/* 3. MACHINE & RHYTHM GRID (4 Cols) */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-3 flex-1">
              {/* Cadence Card */}
              <MiniMetricCard
                label={t('Cadence')}
                value={cadence || '--'}
                unit="RPM"
                icon={<Bike size={14} />}
                colorClass="text-vp-cadence"
                detail={`Max ${liveStats.maxCadence || 0}`}
                subValue={<span className="text-[10px] text-vp-muted">{t('Sweet Spot')}: 70-100 RPM</span>}
                visual={<CadenceGauge value={cadence} max={liveStats.maxCadence || 0} />}
                isWaiting={!cadence}
              />

              {/* Speed Card */}
              <MiniMetricCard
                label={t('Speed')}
                value={speed ? speed.toFixed(1) : '--'}
                unit="KM/H"
                icon={<Activity size={14} />}
                colorClass="text-vp-speed"
                progress={(speed / Math.max(40, liveStats.maxSpeed + 10)) * 100}
                detail={`Avg ${liveStats.avgSpeed || 0}`}
                subValue={<span className="text-[10px] text-vp-muted">{t('Peak Speed')}: {liveStats.maxSpeed || 0} km/h</span>}
                isWaiting={!speed}
              />

              {/* Smart Resistance & Segment Advisor */}
              <section className="col-span-2 vp-panel p-3.5 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-vp-border/40 pb-2">
                  <div className="font-mono text-xs uppercase tracking-[0.16em] text-vp-muted flex items-center gap-1.5">
                    <Route size={14} className="text-vp-resistance" />
                    <span>{t('Resistance')}</span>
                  </div>
                  {advisor.enabled && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-vp-accent">
                      <Compass size={12} />
                      <span>
                        {t('Segment')} {Math.min(advisor.currentKmSegment + 1, planVariations.length)}/{planVariations.length}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 my-2">
                  <div className="flex flex-col">
                    <div className="font-mono text-3xl font-black text-vp-resistance tabular-nums">
                      {resistance}%
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-vp-muted">
                      {t(resistance > 70 ? 'climb' : resistance > 30 ? 'rolling' : resistance > 0 ? 'easy' : 'waiting')}
                    </div>
                  </div>

                  {advisor.enabled && advisor.suggestedResistance !== null ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-md border border-vp-border">
                        <span className="text-[10px] font-mono text-vp-muted uppercase">{t('Target')}:</span>
                        <span className="font-mono text-lg font-black text-vp-accent">{advisor.suggestedResistance}%</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                        advisor.matched ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {advisor.matched ? `✓ ${t('Match!')}` : `↑ ${t('Adjust')}`}
                      </span>
                    </div>
                  ) : (
                    <div className="w-24 h-2 rounded-full bg-vp-muted/15 overflow-hidden">
                      <div className="h-full rounded-full bg-vp-resistance" style={{ width: `${clampPct(resistance)}%` }} />
                    </div>
                  )}
                </div>

                {advisor.enabled && planVariations.length > 0 && (
                  <div className="w-full bg-vp-muted/15 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-vp-accent transition-all duration-300"
                      style={{
                        width: `${clampPct(
                          (Math.min(advisor.currentKmSegment + 1, planVariations.length) / planVariations.length) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </section>

              {/* Edwards TRIMP Card */}
              <div className="col-span-2">
                <MiniMetricCard
                  label={t('Training Load (TRIMP)')}
                  value={trimp.score || '--'}
                  unit="pts"
                  icon={<Activity size={14} />}
                  colorClass="text-vp-distance"
                  progress={(trimp.score / 150) * 100}
                  detail={trimp.score > 0 ? t(trimp.label) : t('waiting')}
                  subValue={<span className="text-[10px] text-vp-muted">{t('Edwards TRIMP from heart-rate zones')}</span>}
                  isWaiting={trimp.score === 0}
                />
              </div>
            </div>
          </div>

          {/* 4. BOTTOM ACCUMULATOR RIBBON (6 Key Metrics) */}
          <footer className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 vp-panel p-2.5">
            <AccumCell label={t('Distance')} value={distanceKm} unit="KM" colorClass="text-vp-distance" />
            <AccumCell label={t('Calories')} value={calories || '--'} unit="KCAL" colorClass="text-vp-calories" />
            <AccumCell label={t('Avg HR')} value={liveStats.avgHr || '--'} unit="BPM" colorClass="text-vp-hr" />
            <AccumCell label={t('Avg Power')} value={liveStats.avgPower || '--'} unit="W" colorClass="text-vp-power" />
            <AccumCell label={t('Avg Speed')} value={liveStats.avgSpeed || '--'} unit="KM/H" colorClass="text-vp-speed" />
            <AccumCell label={t('Avg Cadence')} value={liveStats.avgCadence || '--'} unit="RPM" colorClass="text-vp-cadence" />
          </footer>
        </div>
      ) : (
        /* ══════════════ FOCUS / BIG NUMBERS HUD VIEW ══════════════ */
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Quadrant 1: HEART RATE */}
          <section
            className="vp-panel-raised flex flex-col justify-between p-6 md:p-8"
            style={hrCardStyle}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-vp-hr font-bold">
                <Heart size={18} className="animate-pulse" />
                <span>{t('Heart Rate')}</span>
              </div>
              <div className={`px-2.5 py-1 rounded-md border font-mono text-xs font-bold uppercase ${hrZoneColor}`}>
                {t('Zone')} {hrZoneLabel} ({hrPct}%)
              </div>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="font-mono text-[clamp(4.5rem,12vw,9rem)] font-black leading-none text-vp-hr tabular-nums tracking-tighter">
                {currentData.hr || '--'}
                <span className="ml-3 text-2xl md:text-3xl font-normal text-vp-muted">BPM</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-vp-muted border-t border-vp-border/40 pt-3">
              <span>Avg: {liveStats.avgHr || '--'} BPM</span>
              <span>Max: {userProfile.maxHr} BPM</span>
            </div>
          </section>

          {/* Quadrant 2: POWER OUTPUT */}
          <section className="vp-panel-raised flex flex-col justify-between p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-vp-power font-bold">
                <Zap size={18} />
                <span>{t('Power Output')}</span>
              </div>
              <div className="px-2.5 py-1 rounded-md border border-vp-power/30 bg-vp-power/10 font-mono text-xs font-bold text-vp-power">
                {wkg} W/KG · {ftpIntensityPct}% FTP
              </div>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="font-mono text-[clamp(4.5rem,12vw,9rem)] font-black leading-none text-vp-power tabular-nums tracking-tighter">
                {power || '--'}
                <span className="ml-3 text-2xl md:text-3xl font-normal text-vp-muted">W</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-vp-muted border-t border-vp-border/40 pt-3">
              <span>Avg: {liveStats.avgPower || '--'} W</span>
              <span>Max: {liveStats.maxPower || 0} W</span>
            </div>
          </section>

          {/* Quadrant 3: CADENCE */}
          <section className="vp-panel-raised flex flex-col justify-between p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-vp-cadence font-bold">
                <Bike size={18} />
                <span>{t('Cadence')}</span>
              </div>
              <div className="px-2.5 py-1 rounded-md border border-vp-cadence/30 bg-vp-cadence/10 font-mono text-xs font-bold text-vp-cadence">
                {cadence >= 70 && cadence <= 100 ? '✓ OPTIMAL (70-100)' : 'TARGET 70-100'}
              </div>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="font-mono text-[clamp(4.5rem,12vw,9rem)] font-black leading-none text-vp-cadence tabular-nums tracking-tighter">
                {cadence || '--'}
                <span className="ml-3 text-2xl md:text-3xl font-normal text-vp-muted">RPM</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-vp-muted border-t border-vp-border/40 pt-3">
              <span>Avg: {liveStats.avgCadence || '--'} RPM</span>
              <span>Max: {liveStats.maxCadence || 0} RPM</span>
            </div>
          </section>

          {/* Quadrant 4: SPEED & SESSION PROGRESS */}
          <section className="vp-panel-raised flex flex-col justify-between p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-vp-speed font-bold">
                <Activity size={18} />
                <span>{t('Speed')} & {t('Distance')}</span>
              </div>
              <div className="px-2.5 py-1 rounded-md border border-vp-speed/30 bg-vp-speed/10 font-mono text-xs font-bold text-vp-speed">
                {distanceKm} KM
              </div>
            </div>

            <div className="my-auto py-4 text-center">
              <div className="font-mono text-[clamp(4.5rem,12vw,9rem)] font-black leading-none text-vp-speed tabular-nums tracking-tighter">
                {speed ? speed.toFixed(1) : '--'}
                <span className="ml-3 text-2xl md:text-3xl font-normal text-vp-muted">KM/H</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-vp-muted border-t border-vp-border/40 pt-3">
              <span>Avg: {liveStats.avgSpeed || 0} km/h</span>
              <span>Burn: {calories} kcal</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

