import {
  Activity,
  Bike,
  Bluetooth,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Play,
  Radio,
  Route,
  Scale,
  SlidersHorizontal,
  WifiOff,
  Zap
} from 'lucide-react';
import { type ReactNode } from 'react';
import { EmptyState, InlineNotice, MetricCard, Panel, StatusPill } from '../ui';
import { ResistancePlanPanel } from './ResistancePlanPanel';
import { useI18n } from '@/i18n';
import type { RiderProfile, TelemetrySnapshot } from '@/lib/cockpit-types';
import type { WorkoutSession } from '@/store/useWorkoutStore';

interface PreRideCockpitProps {
  currentData: TelemetrySnapshot;
  userProfile: RiderProfile;
  sessions: WorkoutSession[];
  hrConnected: boolean;
  bikeConnected: boolean;
  bleError: string | null;
  connectHeartRate: () => void;
  connectBike: () => void;
  onStart: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}

interface ReadinessRowProps {
  label: string;
  detail: string;
  connected: boolean;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
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

const getLastDistanceKm = (session: WorkoutSession) => {
  const lastPoint = session?.history?.[session.history.length - 1];
  return lastPoint?.distance ? (lastPoint.distance / 1000).toFixed(2) : '--';
};

const ReadinessRow = ({ label, detail, connected, icon, onClick, disabled = connected, ariaLabel }: ReadinessRowProps) => {
  const { t } = useI18n();
  const interactive = Boolean(onClick);
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <div className={connected ? 'text-vp-accent' : 'text-vp-dim'}>{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-vp-text">{label}</div>
          <div className="truncate text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted">{detail}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill label={t(connected ? 'Ready' : 'Offline')} tone={connected ? 'ready' : 'neutral'} compact />
        {interactive && !disabled && <ChevronRight size={14} className="text-vp-muted" />}
      </div>
    </>
  );
  const rowClass = 'flex items-center justify-between gap-4 border-b border-vp-border py-3 last:border-b-0';
  if (!interactive) {
    return <div className={rowClass}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`vp-focus-ring w-full rounded-lg text-left transition-colors hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent ${rowClass}`}
    >
      {content}
    </button>
  );
};

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
  bleError,
  connectHeartRate,
  connectBike,
  onStart,
  onDisconnect,
  onOpenSettings
}: PreRideCockpitProps) => {
  const { locale, t } = useI18n();
  const sensorCount = Number(hrConnected) + Number(bikeConnected);
  const hasSignal = Boolean(currentData.hr || currentData.cadence || currentData.power || currentData.speed);
  const lastSession = sessions[0];
  const profileReady = Boolean(userProfile.ftp && userProfile.maxHr && userProfile.weight);
  // The HR strap is REQUIRED to start a workout: there is no fallback
  // heart-rate source anymore, so a session without it would record no HR.
  const canStart = hrConnected;
  const readinessLabel = !hrConnected
    ? t('Heart rate strap required')
    : bikeConnected
      ? t('Ready to ride')
      : t('Partial tracking');
  const startHint = !hrConnected
    ? t('Connect your heart rate strap to start a workout.')
    : bikeConnected
      ? t('All core sensors are online.')
      : t('Heart rate is online. You can start without the bike.');
  const handleDisconnect = () => {
    if (confirm(t('Disconnect all devices? You will need to reconnect before recording live telemetry.'))) {
      onDisconnect();
    }
  };

  return (
    <div className="grid h-full min-h-[620px] grid-cols-1 gap-4 overflow-y-auto no-scrollbar p-1 md:p-2 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid content-start grid-cols-1 gap-4">
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
              <SummaryMetric label={t('Max HR')} value={`${userProfile.maxHr || '--'} BPM`} tone="text-vp-hr" />
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
            </div>
            <div className="flex flex-col gap-2 sm:min-w-56">
              <button
                type="button"
                onClick={onStart}
                disabled={!canStart}
                aria-label={t('Start workout session')}
                title={canStart ? t('Start workout session') : t('Connect your heart rate strap to start a workout.')}
                className="vp-focus-ring flex min-h-14 items-center justify-center gap-3 rounded-lg bg-vp-accent px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-vp-bg transition-colors hover:bg-vp-accent/90 disabled:cursor-not-allowed disabled:bg-vp-muted/25 disabled:text-vp-dim disabled:hover:bg-vp-muted/25"
              >
                <Play size={20} fill="currentColor" />
                {t('Start')}
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

      <div className="grid grid-cols-1 gap-4">
        <Panel
          title={t('Readiness checklist')}
          eyebrow={t('Session inputs')}
          action={<Bluetooth size={18} className={hasSignal ? 'text-vp-accent' : 'text-vp-muted'} />}
        >
          <ReadinessRow
            label={t('Heart Rate Monitor')}
            detail={hrConnected ? t('Live heart-rate stream') : t('Rockbros / Standard BLE')}
            connected={hrConnected}
            icon={<Heart size={17} />}
            onClick={connectHeartRate}
            disabled={hrConnected}
            ariaLabel={t(hrConnected ? 'Heart rate monitor connected' : 'Connect heart rate monitor')}
          />
          <ReadinessRow
            label={t('Stationary Bike')}
            detail={bikeConnected ? t('FTMS metrics stream') : t('Yesoul / FTMS service')}
            connected={bikeConnected}
            icon={<Bike size={17} />}
            onClick={connectBike}
            disabled={bikeConnected}
            ariaLabel={t(bikeConnected ? 'Stationary bike connected' : 'Connect stationary bike')}
          />
          <ReadinessRow
            label={t('Profile')}
            detail={`${userProfile.ftp || 0} FTP / ${userProfile.maxHr || 0} max HR / ${userProfile.weight || 0} kg`}
            connected={profileReady}
            icon={<SlidersHorizontal size={17} />}
            onClick={onOpenSettings}
            ariaLabel={t('Open settings')}
          />

          {bleError && (
            <div className="pt-3">
              <InlineNotice tone="danger">
                Error: {bleError}
              </InlineNotice>
            </div>
          )}
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

        <ResistancePlanPanel />
      </div>

    </div>
  );
};
