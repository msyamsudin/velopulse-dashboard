import { Activity, Bike, ChevronRight, Heart, Radio, Settings, Timer, Zap } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { getActiveHrZoneIndex, HR_ZONES } from '@/lib/constants';
import { HrZoneBar } from '../HrZoneBar';
import { PowerGauge } from '../PowerGauge';
import { DistanceVisual } from '../DistanceVisual';

interface RecordingCockpitProps {
  currentData: any;
  liveStats: any;
  userProfile: any;
  workout: any;
  hrConnected: boolean;
  bikeConnected: boolean;
  hrrStatus?: 'idle' | 'detecting' | 'buffer' | 'measuring' | 'complete';
  canStartHrr?: boolean;
  onStartHrr?: () => void;
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

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

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
}: MainMetricProps) => (
  <section
    className={`hardware-card h-full min-h-[240px] flex flex-col ${isWaiting ? 'opacity-75' : ''}`}
    style={accentStyle}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="stat-label flex items-center gap-2 mb-0">
        <span className={colorClass}>{icon}</span>
        {label}
      </div>
      <div className="text-right">
        <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">{subLabel}</div>
        <div className={`text-sm font-bold font-mono ${colorClass}`}>{subValue}</div>
      </div>
    </div>

    <div className="flex-1 flex flex-col justify-center gap-5">
      <div className={`font-mono text-[clamp(3.25rem,8vw,6.5rem)] leading-none font-black ${colorClass}`}>
        {value}
        {unit && <span className="ml-3 text-lg font-normal text-white/45 align-middle">{unit}</span>}
      </div>
      {isWaiting && (
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-hw-muted">
          Waiting signal
        </div>
      )}
      <div className="min-h-24">{visual}</div>
    </div>
  </section>
);

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
  <section className={`hardware-card min-h-[118px] flex flex-col justify-between ${isWaiting ? 'opacity-70' : ''}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="stat-label flex items-center gap-2 mb-0">
        <span className={colorClass}>{icon}</span>
        {label}
      </div>
      <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">{detail}</span>
    </div>

    <div className="flex items-end justify-between gap-4">
      <div className={`font-mono text-3xl md:text-4xl font-black leading-none ${colorClass}`}>
        {value}
        {unit && <span className="ml-2 text-xs font-normal text-white/45">{unit}</span>}
      </div>
      <div className="w-20 md:w-28 h-1.5 rounded-full bg-hw-muted/15 overflow-hidden">
        <div className={`h-full rounded-full bg-current ${colorClass}`} style={{ width: `${clampPct(progress)}%` }} />
      </div>
    </div>
  </section>
);

const SignalPill = ({
  label,
  connected,
  icon
}: {
  label: string;
  connected: boolean;
  icon: ReactNode;
}) => (
  <div
    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
      connected
        ? 'border-hw-accent/25 bg-hw-accent/5 text-hw-accent'
        : 'border-hw-muted/20 bg-white/[0.02] text-hw-muted'
    }`}
  >
    {icon}
    <span className="text-[9px] font-mono uppercase tracking-[0.14em]">
      {label} {connected ? 'online' : 'offline'}
    </span>
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
  onStartHrr
}: RecordingCockpitProps) => {
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
  const hrZoneColor = activeHrZone?.color || 'text-hw-muted';
  const hrCardAura = activeHrZoneIndex >= 0 ? HR_CARD_AURAS[activeHrZoneIndex] : null;
  const hrCardStyle = hrCardAura
    ? {
        backgroundColor: `rgba(${hrCardAura.rgb}, ${hrCardAura.bgAlpha})`,
        borderColor: `rgba(${hrCardAura.rgb}, ${hrCardAura.borderAlpha})`,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(${hrCardAura.rgb}, 0.08) inset, 0 0 34px -14px rgba(${hrCardAura.rgb}, ${hrCardAura.glowAlpha})`,
      }
    : undefined;
  const hrrInProgress = hrrStatus === 'buffer' || hrrStatus === 'measuring';

  return (
    <div className="relative h-full flex flex-col gap-4 overflow-y-auto no-scrollbar px-2 md:px-4 pb-4">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/10 opacity-40" />

      <div className="relative shrink-0 flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-2 w-2 rounded-full bg-hw-accent shadow-[0_0_10px_rgba(0,255,170,0.45)]" />
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-hw-muted">Recording</div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <span>Ride cockpit</span>
              <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">
                Live
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <SignalPill label="HR" connected={hrConnected} icon={<Heart size={12} />} />
          <SignalPill label="Bike" connected={bikeConnected} icon={<Bike size={12} />} />
          <button
            onClick={onStartHrr}
            disabled={!canStartHrr || hrrInProgress}
            className="flex items-center gap-2 rounded-md border border-red-400/25 bg-red-400/8 px-2.5 py-1.5 text-red-300 transition-colors hover:border-red-300/45 hover:bg-red-400/15 disabled:pointer-events-none disabled:opacity-35"
            title={canStartHrr ? 'Mulai ukur HRR' : 'HRR tersedia saat recording, HR online, bike online, dan sepeda idle'}
          >
            <Heart size={12} />
            <span className="text-[9px] font-mono uppercase tracking-[0.14em]">
              {hrrInProgress ? 'HRR running' : 'Ukur HRR'}
            </span>
          </button>
          <div className={`flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 ${hrZoneColor}`}>
            <Radio size={12} />
            <span className="text-[9px] font-mono uppercase tracking-[0.14em]">Zone {hrZoneLabel}</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-hw-accent lg:ml-3">
            <Timer size={18} />
            <div className="font-mono text-3xl md:text-4xl font-black leading-none tabular-nums">
              {workout.formatTime(workout.elapsed)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 min-h-[560px] grid-cols-1 xl:grid-cols-3 gap-4">
        <MainMetric
          label="Heart Rate"
          value={currentData.hr || '--'}
          unit="BPM"
          icon={<Heart size={14} />}
          colorClass="text-red-400"
          subLabel="% Max"
          subValue={currentData.hr ? `${hrPct}%` : 'Waiting'}
          visual={<HrZoneBar currentHr={currentData.hr} maxHr={userProfile.maxHr} />}
          isWaiting={!currentData.hr}
          accentStyle={hrCardStyle}
        />
        <MainMetric
          label="Power"
          value={power || '--'}
          unit="W"
          icon={<Zap size={14} />}
          colorClass="text-yellow-300"
          subLabel="Max"
          subValue={`${liveStats.maxPower || 0} W`}
          visual={<PowerGauge power={power} ftp={userProfile.ftp} weight={userProfile.weight} />}
          isWaiting={!power}
        />
        <MainMetric
          label="Distance"
          value={distanceKm}
          unit="KM"
          icon={<ChevronRight size={14} />}
          colorClass="text-purple-300"
          subLabel="Speed"
          subValue={speed > 0 ? `${speed.toFixed(1)} KM/H` : 'Waiting'}
          visual={<DistanceVisual distanceMeters={currentData.distance || 0} currentSpeedKmh={speed} />}
          isWaiting={!currentData.distance}
        />
      </div>

      <div className="grid shrink-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StripMetric
          label="Speed"
          value={speed ? speed.toFixed(1) : '--'}
          unit="KM/H"
          icon={<Activity size={13} />}
          colorClass="text-blue-400"
          progress={(speed / Math.max(40, liveStats.maxSpeed + 10)) * 100}
          detail={speed ? `avg ${liveStats.avgSpeed || 0}` : 'waiting'}
          isWaiting={!speed}
        />
        <StripMetric
          label="Cadence"
          value={cadence || '--'}
          unit="RPM"
          icon={<Bike size={13} />}
          colorClass="text-hw-accent"
          progress={(cadence / 120) * 100}
          detail={cadence ? `max ${liveStats.maxCadence || 0}` : 'waiting'}
          isWaiting={!cadence}
        />
        <StripMetric
          label="Calories"
          value={calories || '--'}
          unit="KCAL"
          icon={<Zap size={13} />}
          colorClass="text-pink-400"
          progress={(calories % 500) / 5}
          detail={power ? `${Math.round(power * 3.6)} kcal/hr` : 'waiting'}
          isWaiting={!calories}
        />
        <StripMetric
          label="Resistance"
          value={resistance || '--'}
          unit="%"
          icon={<Settings size={13} />}
          colorClass="text-orange-400"
          progress={resistance}
          detail={resistance > 70 ? 'climb' : resistance > 30 ? 'rolling' : resistance > 0 ? 'easy' : 'waiting'}
          isWaiting={!resistance}
        />
      </div>
    </div>
  );
};
