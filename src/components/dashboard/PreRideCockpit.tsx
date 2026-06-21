import {
  Activity,
  Bike,
  Bluetooth,
  Check,
  Clock3,
  Heart,
  MonitorPlay,
  Play,
  Radio,
  Route,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  WifiOff,
  X,
  Zap
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EmptyState, MetricCard, Panel, StatusPill } from '../ui';
import { WorkoutJourney } from '../journey/WorkoutJourney';
import { useI18n } from '@/i18n';

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
  const { locale, t } = useI18n();
  const [showJourneyPreview, setShowJourneyPreview] = useState(false);
  const [debugCadence, setDebugCadence] = useState(86);
  const [debugPower, setDebugPower] = useState(215);
  const [debugZone, setDebugZone] = useState(3);
  const sensorCount = Number(hrConnected) + Number(bikeConnected);
  const hasSignal = Boolean(currentData.hr || currentData.cadence || currentData.power || currentData.speed);
  const lastSession = sessions[0];
  const profileReady = Boolean(userProfile.ftp && userProfile.maxHr && userProfile.weight);
  const debugMaxHeartRate = userProfile.maxHr || 190;
  const debugHeartRate = Math.round(debugMaxHeartRate * (0.55 + (debugZone - 1) * 0.1));
  const readinessLabel = t(sensorCount === 2 ? 'Ready to ride' : sensorCount === 1 ? 'Partial tracking' : 'Manual session');
  const startHint = sensorCount === 2
    ? t('All core sensors are online.')
    : sensorCount === 1
      ? t('One core sensor is online. You can start with partial telemetry.')
      : t('You can start now, but live telemetry will be limited.');
  const handleDisconnect = () => {
    if (confirm(t('Disconnect all devices? You will need to reconnect before recording live telemetry.'))) {
      onDisconnect();
    }
  };

  return (
    <div className="grid h-full min-h-[620px] grid-cols-1 gap-4 p-1 md:p-2 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid min-h-0 content-start grid-cols-1 gap-4">
        <Panel raised className="flex min-h-[340px] flex-col justify-between">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="vp-label">{t('Ready mode')}</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal text-vp-text md:text-4xl">
                  {readinessLabel}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-vp-muted">
                  {startHint} {t('Check signal stability, then start the session.')}
                </p>
              </div>
              <StatusPill
                label={t(hasSignal ? 'Signal detected' : 'Waiting signal')}
                tone={hasSignal ? 'ready' : 'neutral'}
                icon={hasSignal ? <Radio size={13} /> : <WifiOff size={13} />}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-lg border border-vp-border bg-white/[0.025] p-3">
              <SummaryMetric label="FTP" value={`${userProfile.ftp || '--'} W`} tone="text-vp-power" />
              <SummaryMetric label="Max HR" value={`${userProfile.maxHr || '--'} BPM`} tone="text-vp-hr" />
              <SummaryMetric
                label={t('Weight')}
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
              <StatusPill label={`${sensorCount}/2 ${t('sensors')}`} tone={sensorCount === 2 ? 'ready' : sensorCount === 1 ? 'warning' : 'neutral'} />
              <StatusPill label={t(profileReady ? 'Profile ready' : 'Profile incomplete')} tone={profileReady ? 'ready' : 'warning'} />
              <StatusPill label={t(isGoogleConnected ? 'Sync ready' : 'Sync offline')} tone={isGoogleConnected ? 'ready' : 'neutral'} />
            </div>
            <div className="flex flex-col gap-2 sm:min-w-56">
              <button
                type="button"
                onClick={onStart}
                aria-label={t('Start workout session')}
                className="vp-focus-ring flex min-h-14 items-center justify-center gap-3 rounded-lg bg-vp-accent px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-vp-bg transition-colors hover:bg-vp-accent/90"
              >
                <Play size={20} fill="currentColor" />
                {t('Start')}
              </button>
              <button
                type="button"
                onClick={() => setShowJourneyPreview(true)}
                aria-label="Preview journey animation without starting a session"
                className="vp-button vp-focus-ring flex items-center justify-center gap-2"
              >
                <MonitorPlay size={16} />
                Preview animation
              </button>
              {sensorCount > 0 && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  aria-label={t('Disconnect all connected devices')}
                  className="vp-button vp-button-danger vp-focus-ring"
                >
                  {t('Disconnect devices')}
                </button>
              )}
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label={t('Heart Rate')}
            value={currentData.hr || '--'}
            unit="BPM"
            icon={<Heart size={13} />}
            tone="heart"
            size="sm"
            waiting={!currentData.hr}
          />
          <MetricCard
            label={t('Cadence')}
            value={currentData.cadence || '--'}
            unit="RPM"
            icon={<Bike size={13} />}
            tone="cadence"
            size="sm"
            waiting={!currentData.cadence}
          />
          <MetricCard
            label={t('Power')}
            value={currentData.power || '--'}
            unit="W"
            icon={<Zap size={13} />}
            tone="power"
            size="sm"
            waiting={!currentData.power}
          />
          <MetricCard
            label={t('Speed')}
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
          title={t('Readiness checklist')}
          eyebrow={t('Session inputs')}
          action={<Bluetooth size={18} className={hasSignal ? 'text-vp-accent' : 'text-vp-muted'} />}
        >
          <ReadinessRow
            label={t('Heart Rate Monitor')}
            detail={hrConnected ? t('Live heart-rate stream') : 'Rockbros / Standard BLE'}
            connected={hrConnected}
            icon={<Heart size={17} />}
          />
          <ReadinessRow
            label={t('Stationary Bike')}
            detail={bikeConnected ? t('FTMS metrics stream') : 'Yesoul / FTMS service'}
            connected={bikeConnected}
            icon={<Bike size={17} />}
          />
          <ReadinessRow
            label="Google Fit"
            detail={t(isGoogleConnected ? 'Workout sync enabled' : 'Can be connected later')}
            connected={isGoogleConnected}
            icon={<ShieldCheck size={17} />}
          />
          <ReadinessRow
            label={t('Profile')}
            detail={`${userProfile.ftp || 0} FTP / ${userProfile.maxHr || 0} max HR / ${userProfile.weight || 0} kg`}
            connected={profileReady}
            icon={<SlidersHorizontal size={17} />}
          />
        </Panel>

        <Panel
          title={lastSession ? new Date(lastSession.date).toLocaleDateString(locale) : t('No ride logged yet')}
          eyebrow={t('Last session')}
          action={<Clock3 size={18} className="text-vp-muted" />}
        >
          {lastSession ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <SummaryMetric label={t('Duration')} value={formatDuration(lastSession.duration)} />
              <SummaryMetric
                label={t('Distance')}
                value={
                  <span className="inline-flex items-center gap-2">
                    <Route size={16} />
                    {getLastDistanceKm(lastSession)} KM
                  </span>
                }
                tone="text-vp-distance"
              />
              <SummaryMetric label={t('Avg HR')} value={`${lastSession.stats?.avgHr || '--'} BPM`} tone="text-vp-hr" />
              <SummaryMetric label={t('Avg Power')} value={`${lastSession.stats?.avgPower || '--'} W`} tone="text-vp-power" />
            </div>
          ) : (
            <EmptyState
              title={t('First session ready')}
              detail={t('Your summary appears here after saving a workout')}
              icon={<Check size={18} />}
            />
          )}
        </Panel>
      </div>

      {showJourneyPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Journey animation debug preview"
        >
          <div className="relative h-[min(760px,90vh)] w-full max-w-6xl">
            <WorkoutJourney
              telemetry={{
                heartRate: debugHeartRate,
                cadence: debugCadence,
                power: debugPower,
                speed: Math.min(50, debugCadence * 0.36),
                resistance: Math.min(100, 20 + debugZone * 10)
              }}
              elapsed={620}
              maxHeartRate={debugMaxHeartRate}
              bikeConnected
            />
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              <span className="rounded-md border border-vp-accent/30 bg-black/70 px-3 py-2 text-[9px] font-mono uppercase tracking-[0.14em] text-vp-accent backdrop-blur-md">
                Debug preview
              </span>
              <button
                type="button"
                onClick={() => setShowJourneyPreview(false)}
                aria-label="Close animation preview"
                className="vp-focus-ring flex size-9 items-center justify-center rounded-md border border-white/15 bg-black/70 text-white transition-colors hover:bg-white/10"
              >
                <X size={17} />
              </button>
            </div>
            <div className="absolute right-3 top-16 z-10 w-[min(18rem,calc(100%-1.5rem))] rounded-lg border border-white/15 bg-black/75 p-4 text-white shadow-xl backdrop-blur-md">
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-vp-accent">
                Animation controls
              </div>
              <DebugRangeControl
                label="Cadence"
                value={debugCadence}
                min={0}
                max={130}
                unit="RPM"
                onChange={setDebugCadence}
              />
              <DebugRangeControl
                label="Power"
                value={debugPower}
                min={0}
                max={500}
                step={5}
                unit="W"
                onChange={setDebugPower}
              />
              <label className="block">
                <span className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-white/65">
                  Heart-rate zone
                  <span className="text-vp-accent">Zone {debugZone} · {debugHeartRate} BPM</span>
                </span>
                <select
                  value={debugZone}
                  onChange={event => setDebugZone(Number(event.target.value))}
                  className="vp-focus-ring w-full rounded-md border border-white/15 bg-black/70 px-3 py-2 text-sm text-white"
                >
                  {[1, 2, 3, 4, 5].map(zone => (
                    <option key={zone} value={zone}>Zone {zone}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DebugRangeControl = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}) => (
  <label className="mb-4 block">
    <span className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-white/65">
      {label}
      <span className="text-vp-accent">{value} {unit}</span>
    </span>
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={event => onChange(Number(event.target.value))}
      className="vp-focus-ring w-full accent-[var(--color-vp-accent)]"
    />
  </label>
);
