import {
  Activity,
  Bike,
  Bluetooth,
  ChevronRight,
  Heart,
  Play,
  Radio,
  Scale,
  SlidersHorizontal,
  WifiOff,
  Zap
} from 'lucide-react';
import { type ReactNode } from 'react';
import { InlineNotice, MetricCard, Panel, StatusPill } from '../ui';
import { ResistancePlanPanel } from './ResistancePlanPanel';
import { useI18n } from '@/i18n';
import type { RiderProfile, TelemetrySnapshot } from '@/lib/cockpit-types';
import { useBluetoothStore } from '@/store/useBluetoothStore';

const HRV_READINESS_TONES: Record<string, 'danger' | 'warning' | 'ready'> = {
  strained: 'danger',
  balanced: 'warning',
  recovered: 'ready',
};

const HRV_READINESS_LABELS: Record<string, string> = {
  strained: 'Strained',
  balanced: 'Balanced',
  recovered: 'Recovered',
};

interface PreRideCockpitProps {
  currentData: TelemetrySnapshot;
  userProfile: RiderProfile;
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
  pillLabel?: string;
  pillTone?: 'ready' | 'neutral' | 'warning';
  connectCta?: boolean;
}

interface SummaryMetricProps {
  label: string;
  value: ReactNode;
  tone?: string;
}

const ReadinessRow = ({
  label,
  detail,
  connected,
  icon,
  onClick,
  disabled = connected,
  ariaLabel,
  pillLabel,
  pillTone,
  connectCta = false
}: ReadinessRowProps) => {
  const { t } = useI18n();
  const interactive = Boolean(onClick);
  const offline = interactive && !disabled;
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
        <StatusPill
          label={pillLabel ?? t(connected ? 'Ready' : 'Offline')}
          tone={pillTone ?? (connected ? 'ready' : 'neutral')}
          compact
        />
        {offline &&
          (connectCta ? (
            <span className="rounded-md border border-vp-accent/30 bg-vp-accent/8 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-vp-accent">
              {t('Connect')}
            </span>
          ) : (
            <ChevronRight size={14} className="text-vp-muted" />
          ))}
      </div>
    </>
  );
  const rowClass = `flex items-center justify-between gap-4 border-b py-3 last:border-b-0 ${
    offline && connectCta ? 'border-dashed border-vp-border-strong' : 'border-vp-border'
  }`;
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
  hrConnected,
  bikeConnected,
  bleError,
  connectHeartRate,
  connectBike,
  onStart,
  onDisconnect,
  onOpenSettings
}: PreRideCockpitProps) => {
  const { t } = useI18n();
  const hrvReadiness = useBluetoothStore((s) => s.hrvReadiness);
  const sensorCount = Number(hrConnected) + Number(bikeConnected);
  const hasSignal = Boolean(currentData.hr || currentData.cadence || currentData.power || currentData.speed);
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
                icon={
                  hasSignal ? (
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vp-accent opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-vp-accent" />
                      </span>
                      <Radio size={13} />
                    </span>
                  ) : (
                    <WifiOff size={13} />
                  )
                }
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
              {hrvReadiness && (
                <StatusPill
                  label={`${t('HRV')} ${t(HRV_READINESS_LABELS[hrvReadiness])}`}
                  tone={HRV_READINESS_TONES[hrvReadiness]}
                  icon={<Activity size={12} />}
                />
              )}
              <StatusPill label={t(profileReady ? 'Profile ready' : 'Profile incomplete')} tone={profileReady ? 'ready' : 'warning'} />
            </div>
            <div className="flex flex-col gap-2 sm:min-w-56">
              <button
                type="button"
                onClick={onStart}
                disabled={!canStart}
                aria-label={t('Start workout session')}
                title={canStart ? t('Start workout session') : t('Connect your heart rate strap to start a workout.')}
                className={`vp-focus-ring flex min-h-14 items-center justify-center gap-3 rounded-lg bg-vp-accent px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-vp-bg transition-all hover:bg-vp-accent/90 ${
                  canStart ? 'shadow-lg shadow-vp-accent/25' : ''
                } disabled:cursor-not-allowed disabled:bg-vp-muted/25 disabled:text-vp-dim disabled:shadow-none disabled:hover:bg-vp-muted/25`}
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

        {hasSignal ? (
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
        ) : (
          <div className="vp-panel flex min-h-32 flex-col items-center justify-center gap-2 text-vp-muted">
            <Radio size={20} className="animate-pulse" />
            <div className="font-mono text-[10px] uppercase tracking-[0.14em]">{t('Waiting signal')}</div>
          </div>
        )}
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
            connectCta
          />
          <ReadinessRow
            label={t('Stationary Bike')}
            detail={bikeConnected ? t('FTMS metrics stream') : t('Yesoul / FTMS service')}
            connected={bikeConnected}
            icon={<Bike size={17} />}
            onClick={connectBike}
            disabled={bikeConnected}
            ariaLabel={t(bikeConnected ? 'Stationary bike connected' : 'Connect stationary bike')}
            connectCta
          />
          <ReadinessRow
            label={t('Profile')}
            detail={`${userProfile.ftp || 0} FTP / ${userProfile.maxHr || 0} max HR / ${userProfile.weight || 0} kg`}
            connected={profileReady}
            icon={<SlidersHorizontal size={17} />}
            onClick={onOpenSettings}
            ariaLabel={t('Open settings')}
            pillLabel={t(profileReady ? 'Ready' : 'Profile incomplete')}
            pillTone={profileReady ? 'ready' : 'warning'}
          />

          {bleError && (
            <div className="pt-3">
              <InlineNotice tone="danger">
                Error: {bleError}
              </InlineNotice>
            </div>
          )}
        </Panel>

        <ResistancePlanPanel />
      </div>

    </div>
  );
};
