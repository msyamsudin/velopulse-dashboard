import {
  Activity,
  Bike,
  Bluetooth,
  Check,
  Clock3,
  Heart,
  Play,
  Radio,
  Route,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  WifiOff,
  Zap
} from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState, MetricCard, Panel, StatusPill } from '../ui';

interface PreRideCockpitProps {
  currentData: any;
  userProfile: any;
  sessions: any[];
  hrConnected: boolean;
  bikeConnected: boolean;
  isGoogleConnected: boolean;
  onStart: () => void;
  onDisconnect: () => void;
}

interface ReadinessRowProps {
  label: string;
  detail: string;
  connected: boolean;
  icon: ReactNode;
}

interface SummaryMetricProps {
  label: string;
  value: ReactNode;
  tone?: string;
}

const formatDuration = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
};

const getLastDistanceKm = (session: any) => {
  const lastPoint = session?.history?.[session.history.length - 1];
  return lastPoint?.distance ? (lastPoint.distance / 1000).toFixed(2) : '--';
};

const ReadinessRow = ({ label, detail, connected, icon }: ReadinessRowProps) => (
  <div className="flex items-center justify-between gap-4 border-b border-vp-border py-3 last:border-b-0">
    <div className="flex min-w-0 items-center gap-3">
      <div className={connected ? 'text-vp-accent' : 'text-vp-dim'}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-vp-text">{label}</div>
        <div className="truncate text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted">{detail}</div>
      </div>
    </div>
    <StatusPill label={connected ? 'Ready' : 'Offline'} tone={connected ? 'ready' : 'neutral'} compact />
  </div>
);

const SummaryMetric = ({ label, value, tone = 'text-vp-text' }: SummaryMetricProps) => (
  <div className="min-w-0">
    <div className="vp-label">{label}</div>
    <div className={`mt-1 truncate font-mono text-xl font-bold tabular-nums ${tone}`}>{value}</div>
  </div>
);

export const PreRideCockpit = ({
  currentData,
  userProfile,
  sessions,
  hrConnected,
  bikeConnected,
  isGoogleConnected,
  onStart,
  onDisconnect
}: PreRideCockpitProps) => {
  const sensorCount = Number(hrConnected) + Number(bikeConnected);
  const hasSignal = Boolean(currentData.hr || currentData.cadence || currentData.power || currentData.speed);
  const lastSession = sessions[0];
  const profileReady = Boolean(userProfile.ftp && userProfile.maxHr && userProfile.weight);
  const readinessLabel = sensorCount === 2 ? 'Ready to ride' : sensorCount === 1 ? 'Partial tracking' : 'Manual session';
  const startHint = sensorCount === 2
    ? 'All core sensors are online.'
    : sensorCount === 1
      ? 'One core sensor is online. You can start with partial telemetry.'
      : 'You can start now, but live telemetry will be limited.';

  return (
    <div className="grid h-full min-h-[620px] grid-cols-1 gap-4 p-1 md:p-2 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid min-h-0 grid-cols-1 gap-4">
        <Panel raised className="flex min-h-[340px] flex-col justify-between">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="vp-label">Ready mode</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal text-vp-text md:text-4xl">
                  {readinessLabel}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-vp-muted">
                  {startHint} Check signal stability, then start the session.
                </p>
              </div>
              <StatusPill
                label={hasSignal ? 'Signal detected' : 'Waiting signal'}
                tone={hasSignal ? 'ready' : 'neutral'}
                icon={hasSignal ? <Radio size={13} /> : <WifiOff size={13} />}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-lg border border-vp-border bg-white/[0.025] p-3">
              <SummaryMetric label="FTP" value={`${userProfile.ftp || '--'} W`} tone="text-vp-power" />
              <SummaryMetric label="Max HR" value={`${userProfile.maxHr || '--'} BPM`} tone="text-vp-hr" />
              <SummaryMetric
                label="Weight"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Scale size={15} />
                    {userProfile.weight || '--'} KG
                  </span>
                }
                tone="text-vp-speed"
              />
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="flex flex-wrap gap-2">
              <StatusPill label={`${sensorCount}/2 sensors`} tone={sensorCount === 2 ? 'ready' : sensorCount === 1 ? 'warning' : 'neutral'} />
              <StatusPill label={profileReady ? 'Profile ready' : 'Profile incomplete'} tone={profileReady ? 'ready' : 'warning'} />
              <StatusPill label={isGoogleConnected ? 'Sync ready' : 'Sync offline'} tone={isGoogleConnected ? 'ready' : 'neutral'} />
            </div>
            <div className="flex flex-col gap-2 sm:min-w-56">
              <button
                onClick={onStart}
                className="vp-focus-ring flex min-h-14 items-center justify-center gap-3 rounded-lg bg-vp-accent px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-vp-bg transition-colors hover:bg-vp-accent/90"
              >
                <Play size={20} fill="currentColor" />
                Start
              </button>
              {sensorCount > 0 && (
                <button
                  onClick={onDisconnect}
                  className="vp-button vp-button-danger vp-focus-ring"
                >
                  Disconnect devices
                </button>
              )}
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Heart Rate"
            value={currentData.hr || '--'}
            unit="BPM"
            icon={<Heart size={13} />}
            tone="heart"
            size="sm"
            waiting={!currentData.hr}
          />
          <MetricCard
            label="Cadence"
            value={currentData.cadence || '--'}
            unit="RPM"
            icon={<Bike size={13} />}
            tone="cadence"
            size="sm"
            waiting={!currentData.cadence}
          />
          <MetricCard
            label="Power"
            value={currentData.power || '--'}
            unit="W"
            icon={<Zap size={13} />}
            tone="power"
            size="sm"
            waiting={!currentData.power}
          />
          <MetricCard
            label="Speed"
            value={currentData.speed ? currentData.speed.toFixed(1) : '--'}
            unit="KM/H"
            icon={<Activity size={13} />}
            tone="speed"
            size="sm"
            waiting={!currentData.speed}
          />
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4">
        <Panel
          title="Readiness checklist"
          eyebrow="Session inputs"
          action={<Bluetooth size={18} className={hasSignal ? 'text-vp-accent' : 'text-vp-muted'} />}
        >
          <ReadinessRow
            label="Heart Rate Monitor"
            detail={hrConnected ? 'Live heart-rate stream' : 'Rockbros / Standard BLE'}
            connected={hrConnected}
            icon={<Heart size={17} />}
          />
          <ReadinessRow
            label="Stationary Bike"
            detail={bikeConnected ? 'FTMS metrics stream' : 'Yesoul / FTMS service'}
            connected={bikeConnected}
            icon={<Bike size={17} />}
          />
          <ReadinessRow
            label="Google Fit"
            detail={isGoogleConnected ? 'Workout sync enabled' : 'Can be connected later'}
            connected={isGoogleConnected}
            icon={<ShieldCheck size={17} />}
          />
          <ReadinessRow
            label="Profile"
            detail={`${userProfile.ftp || 0} FTP / ${userProfile.maxHr || 0} max HR / ${userProfile.weight || 0} kg`}
            connected={profileReady}
            icon={<SlidersHorizontal size={17} />}
          />
        </Panel>

        <Panel
          title={lastSession ? new Date(lastSession.date).toLocaleDateString() : 'No ride logged yet'}
          eyebrow="Last session"
          action={<Clock3 size={18} className="text-vp-muted" />}
        >
          {lastSession ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <SummaryMetric label="Duration" value={formatDuration(lastSession.duration)} />
              <SummaryMetric
                label="Distance"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Route size={16} />
                    {getLastDistanceKm(lastSession)} KM
                  </span>
                }
                tone="text-vp-distance"
              />
              <SummaryMetric label="Avg HR" value={`${lastSession.stats?.avgHr || '--'} BPM`} tone="text-vp-hr" />
              <SummaryMetric label="Avg Power" value={`${lastSession.stats?.avgPower || '--'} W`} tone="text-vp-power" />
            </div>
          ) : (
            <EmptyState
              title="First session ready"
              detail="Your summary appears here after saving a workout"
              icon={<Check size={18} />}
            />
          )}
        </Panel>
      </div>
    </div>
  );
};
