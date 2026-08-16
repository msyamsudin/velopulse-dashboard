import { Activity, Bike, ChevronRight, Heart, Radio, Settings, Timer, Zap } from 'lucide-react';
import { type CSSProperties, type ReactNode } from 'react';
import { getActiveHrZoneIndex, HR_ZONES } from '@/lib/constants';
import { HrZoneBar } from '../HrZoneBar';
import { PowerGauge } from '../PowerGauge';
import { CadenceGauge } from '../CadenceGauge';
import { StatusPill } from '../ui';
import { useI18n } from '@/i18n';
import { useResistanceAdvisor } from '@/hooks/useResistanceAdvisor';
import type { RiderProfile, TelemetrySnapshot, WorkoutView } from '@/lib/cockpit-types';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import type { LiveWorkoutStats } from '@/store/useWorkoutStore';

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
}

interface MainMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  colorClass: string;
  subLabel: string;
  subValue: string;
  visual: ReactNode;
  isWaiting?: boolean;
  accentStyle?: CSSProperties;
}

interface StripMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  colorClass: string;
  progress: number;
  detail: string;
  isWaiting?: boolean;
}

interface AdvisorInfo {
  enabled: boolean;
  suggestedResistance: number | null;
  matched: boolean;
  userChanged: boolean;
  kmJustCrossed: boolean;
  currentKmSegment: number;
  hasMore: boolean;
}

interface ResistanceStripMetricProps extends StripMetricProps {
  advisor: AdvisorInfo;
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
  { rgb: '74, 92, 86', borderAlpha: 0.22, bgAlpha: 0.025, glowAlpha: 0.14 },
  { rgb: '74, 222, 128', borderAlpha: 0.34, bgAlpha: 0.035, glowAlpha: 0.2 },
  { rgb: '250, 204, 21', borderAlpha: 0.34, bgAlpha: 0.035, glowAlpha: 0.2 },
  { rgb: '249, 115, 22', borderAlpha: 0.36, bgAlpha: 0.035, glowAlpha: 0.22 },
  { rgb: '239, 68, 68', borderAlpha: 0.38, bgAlpha: 0.04, glowAlpha: 0.24 },
];

const MainMetric = ({
  label,
  value,
  unit,
  icon,
  colorClass,
  subLabel,
  subValue,
  visual,
  isWaiting = false,
  accentStyle
}: MainMetricProps) => {
  const { t } = useI18n();
  return (
  <section
    className={`vp-panel-raised h-full min-h-[240px] flex flex-col ${isWaiting ? 'opacity-75' : ''}`}
    style={accentStyle}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="vp-label flex items-center gap-2">
        <span className={colorClass}>{icon}</span>
        {label}
      </div>
      <div className="text-right">
        <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-vp-muted">{subLabel}</div>
        <div className={`text-sm font-bold font-mono ${colorClass}`}>{subValue}</div>
      </div>
    </div>

    <div className="flex-1 flex flex-col justify-center gap-5">
      <div className={`font-mono text-[clamp(3.25rem,8vw,6.5rem)] leading-none font-black tracking-normal tabular-nums ${colorClass}`}>
        {value}
        {unit && <span className="ml-3 text-lg font-normal text-vp-muted align-middle">{unit}</span>}
      </div>
      {isWaiting && (
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-vp-muted">
          {t('Waiting signal')}
        </div>
      )}
      <div className="min-h-24">{visual}</div>
    </div>
  </section>
  );
};

const StripMetric = ({
  label,
  value,
  unit,
  icon,
  colorClass,
  progress,
  detail,
  isWaiting = false
}: StripMetricProps) => (
  <section className={`vp-panel min-h-[118px] flex flex-col justify-between ${isWaiting ? 'opacity-70' : ''}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="vp-label flex items-center gap-2">
        <span className={colorClass}>{icon}</span>
        {label}
      </div>
      <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-vp-muted">{detail}</span>
    </div>

    <div className="flex items-end justify-between gap-4">
      <div className={`font-mono text-3xl md:text-4xl font-black leading-none tracking-normal tabular-nums ${colorClass}`}>
        {value}
        {unit && <span className="ml-2 text-xs font-normal text-vp-muted">{unit}</span>}
      </div>
      <div className="w-20 md:w-28 h-1.5 rounded-full bg-vp-muted/15 overflow-hidden">
        <div className={`h-full rounded-full bg-current ${colorClass}`} style={{ width: `${clampPct(progress)}%` }} />
      </div>
    </div>
  </section>
);

const ResistanceStripMetric = ({
  label,
  value,
  unit,
  icon,
  colorClass,
  progress,
  detail,
  isWaiting = false,
  advisor
}: ResistanceStripMetricProps) => {
  const { t } = useI18n();
  const targetPct = advisor.enabled && advisor.suggestedResistance !== null ? Math.min(100, Math.max(0, advisor.suggestedResistance)) : null;

  const glowColor = advisor.matched
    ? 'bg-green-400'
    : advisor.userChanged
      ? 'bg-blue-400'
      : 'bg-yellow-400';

  return (
    <section className={`vp-panel min-h-[118px] flex flex-col justify-between relative overflow-hidden ${isWaiting ? 'opacity-70' : ''}`}>
      {advisor.enabled && targetPct !== null && (
        <div className={`absolute -top-6 -right-6 size-16 rounded-full opacity-[0.10] ${glowColor}`} />
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="vp-label flex items-center gap-2">
          <span className={colorClass}>{icon}</span>
          {label}
        </div>
        <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-vp-muted">{detail}</span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <div className={`font-mono text-3xl md:text-4xl font-black leading-none tracking-normal tabular-nums ${colorClass}`}>
            {value}
            {unit && <span className="ml-2 text-xs font-normal text-vp-muted">{unit}</span>}
          </div>
          {advisor.enabled && targetPct !== null && (
            <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] ${advisor.matched ? 'text-green-400' : advisor.userChanged ? 'text-blue-400' : 'text-yellow-400'}`}>
              <span>{advisor.matched ? '✓' : '→'}</span>
              <span className="text-vp-muted">{t('Suggest')}</span>
              <span className="font-bold">{advisor.suggestedResistance}%</span>
              {advisor.matched && <span className="text-green-400">{t('Match!')}</span>}
            </div>
          )}
        </div>
        <div className="relative w-20 md:w-28 h-1.5 rounded-full bg-vp-muted/15 overflow-hidden">
          <div className={`h-full rounded-full bg-current ${colorClass}`} style={{ width: `${clampPct(progress)}%` }} />
          {targetPct !== null && (
            <div
              className={`absolute top-0 h-full w-0.5 rounded-full transition-all ${glowColor}`}
              style={{ left: `${targetPct}%`, transform: 'translateX(-50%)' }}
            />
          )}
        </div>
      </div>
    </section>
  );
};

const SignalPill = ({
  label,
  connected,
  icon
}: {
  label: string;
  connected: boolean;
  icon: ReactNode;
}) => {
  const { t } = useI18n();
  return <StatusPill
    label={`${label} ${t(connected ? 'online' : 'offline')}`}
    tone={connected ? 'ready' : 'neutral'}
    icon={icon}
  />;
};

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
  onOpenChart
}: RecordingCockpitProps) => {
  const { t } = useI18n();
  const safeMaxHr = userProfile.maxHr > 0 ? userProfile.maxHr : 1;
  const hrPct = currentData.hr > 0 ? Math.round((currentData.hr / safeMaxHr) * 100) : 0;
  const distanceKm = currentData.distance ? (currentData.distance / 1000).toFixed(2) : '--';
  const speed = currentData.speed || 0;
  const cadence = currentData.cadence || 0;
  const power = currentData.power || 0;
  const calories = currentData.calories || 0;
  const resistance = currentData.resistance || 0;
  const activeHrZoneIndex = getActiveHrZoneIndex(currentData.hr, userProfile.maxHr);
  const activeHrZone = activeHrZoneIndex >= 0 ? HR_ZONES[activeHrZoneIndex] : null;
  const hrZoneLabel = activeHrZone?.label || 'IDLE';
  const hrZoneColor = activeHrZone?.color || 'text-vp-muted';
  const hrCardAura = activeHrZoneIndex >= 0 ? HR_CARD_AURAS[activeHrZoneIndex] : null;
  const hrCardStyle = hrCardAura
    ? {
        backgroundColor: `rgba(${hrCardAura.rgb}, ${hrCardAura.bgAlpha})`,
        borderColor: `rgba(${hrCardAura.rgb}, ${hrCardAura.borderAlpha})`,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(${hrCardAura.rgb}, 0.08) inset, 0 0 34px -14px rgba(${hrCardAura.rgb}, ${hrCardAura.glowAlpha})`,
      }
    : undefined;
  const hrrInProgress = hrrStatus === 'buffer' || hrrStatus === 'measuring';
  const advisor = useResistanceAdvisor(currentData.distance || 0, currentData.resistance || 0);
  const hrvRmssd = useBluetoothStore((s) => s.hrvRmssd);
  const hrvReadiness = useBluetoothStore((s) => s.hrvReadiness);
  const hrvColor = hrvReadiness ? HRV_READINESS_COLORS[hrvReadiness] : 'text-vp-muted';
  const hrvLabel = hrvReadiness ? HRV_READINESS_LABELS[hrvReadiness] : null;

  return (
    <div className="relative h-full flex flex-col gap-4 overflow-y-auto no-scrollbar px-1 md:px-2 pb-4">
      <div className="relative shrink-0 flex flex-col gap-3 rounded-lg border border-vp-border bg-white/[0.03] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-2.5 w-2.5 rounded-full bg-vp-accent shadow-[0_0_12px_rgba(53,240,189,0.45)]" />
          <div>
            <div className="vp-label">{t('Recording')}</div>
            <div className="flex items-center gap-2 text-sm font-semibold text-vp-text">
              <span>{t('Ride cockpit')}</span>
              <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-vp-muted">
                {t('Live')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <SignalPill label="HR" connected={hrConnected} icon={<Heart size={12} />} />
          <SignalPill label="Bike" connected={bikeConnected} icon={<Bike size={12} />} />
          {onOpenChart && (
            <button
              type="button"
              onClick={onOpenChart}
              disabled={!chartAvailable}
              aria-label={t(chartAvailable ? 'Open live telemetry chart' : 'Live telemetry chart unavailable until data is recorded')}
              className="vp-button vp-focus-ring border-vp-accent/25 bg-vp-accent/8 text-vp-accent hover:border-vp-accent/45 hover:bg-vp-accent/15 disabled:border-vp-border disabled:bg-white/[0.02] disabled:text-vp-dim"
              title={t(chartAvailable ? 'Open live telemetry chart' : 'Live telemetry chart unavailable until data is recorded')}
            >
              <Activity size={12} />
              {t('Chart')}
            </button>
          )}
          <button
            type="button"
            onClick={onStartHrr}
            disabled={!canStartHrr || hrrInProgress}
            aria-label={t(hrrInProgress ? 'Heart rate recovery measurement running' : 'Start heart rate recovery measurement')}
            className="vp-button vp-button-danger vp-focus-ring disabled:opacity-35"
            title={t(canStartHrr ? 'Start HRR measurement' : 'HRR available while recording, HR online, bike online, and bike idle')}
          >
            <Heart size={12} />
            {t(hrrInProgress ? 'HRR running' : 'Measure HRR')}
          </button>
          <div className={`flex items-center gap-2 rounded-md border border-vp-border bg-white/[0.03] px-2.5 py-1.5 ${hrZoneColor}`}>
            <Radio size={12} />
            <span className="text-[9px] font-mono uppercase tracking-[0.14em]">{t('Zone')} {hrZoneLabel}</span>
          </div>
          {hrvRmssd !== null && (
            <div className={`flex items-center gap-2 rounded-md border border-vp-border bg-white/[0.03] px-2.5 py-1.5 ${hrvColor}`}>
              <Activity size={12} />
              <span className="text-[9px] font-mono uppercase tracking-[0.14em]">
                {t('HRV')} {hrvRmssd} ms{hrvLabel ? ` · ${t(hrvLabel)}` : ''}
              </span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-3 text-vp-accent lg:ml-3">
            <Timer size={18} />
            <div className="font-mono text-3xl md:text-4xl font-black leading-none tabular-nums">
              {workout.formatTime(workout.elapsed)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 min-h-[560px] grid-cols-1 xl:grid-cols-3 gap-4">
        <MainMetric
          label={t('Heart Rate')}
          value={currentData.hr || '--'}
          unit="BPM"
          icon={<Heart size={14} />}
          colorClass="text-red-400"
          subLabel="% Max"
          subValue={currentData.hr ? `${hrPct}%` : t('Waiting')}
          visual={<HrZoneBar currentHr={currentData.hr} maxHr={userProfile.maxHr} />}
          isWaiting={!currentData.hr}
          accentStyle={hrCardStyle}
        />
        <MainMetric
          label={t('Power')}
          value={power || '--'}
          unit="W"
          icon={<Zap size={14} />}
          colorClass="text-yellow-300"
          subLabel={t('Max')}
          subValue={`${liveStats.maxPower || 0} W`}
          visual={<PowerGauge power={power} ftp={userProfile.ftp} weight={userProfile.weight} />}
          isWaiting={!power}
        />
        <MainMetric
          label={t('Cadence')}
          value={cadence || '--'}
          unit="RPM"
          icon={<Bike size={14} />}
          colorClass="text-vp-cadence"
          subLabel={t('Max')}
          subValue={`${liveStats.maxCadence || 0} RPM`}
          visual={<CadenceGauge value={cadence} max={liveStats.maxCadence || 0} />}
          isWaiting={!cadence}
        />
      </div>

      <div className="grid shrink-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StripMetric
          label={t('Speed')}
          value={speed ? speed.toFixed(1) : '--'}
          unit="KM/H"
          icon={<Activity size={13} />}
          colorClass="text-blue-400"
          progress={(speed / Math.max(40, liveStats.maxSpeed + 10)) * 100}
          detail={speed ? `avg ${liveStats.avgSpeed || 0}` : t('waiting')}
          isWaiting={!speed}
        />
        <StripMetric
          label={t('Distance')}
          value={distanceKm}
          unit="KM"
          icon={<ChevronRight size={13} />}
          colorClass="text-vp-distance"
          progress={currentData.distance ? ((currentData.distance / 1000) % 10) * 10 : 0}
          detail={speed > 0 ? `${speed.toFixed(1)} km/h` : t('waiting')}
          isWaiting={!currentData.distance}
        />
        <StripMetric
          label={t('Calories')}
          value={calories || '--'}
          unit="KCAL"
          icon={<Zap size={13} />}
          colorClass="text-pink-400"
          progress={(calories % 500) / 5}
          detail={power ? `${Math.round(power * 3.6)} kcal/hr` : t('waiting')}
          isWaiting={!calories}
        />
        <ResistanceStripMetric
          label={t('Resistance')}
          value={resistance || 0}
          unit="%"
          icon={<Settings size={13} />}
          colorClass="text-orange-400"
          progress={resistance}
          detail={t(resistance > 70 ? 'climb' : resistance > 30 ? 'rolling' : resistance > 0 ? 'easy' : 'waiting')}
          isWaiting={!resistance}
          advisor={advisor}
        />
      </div>
    </div>
  );
};
