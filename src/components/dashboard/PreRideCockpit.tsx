import { Activity, Bike, Bluetooth, Check, Clock3, Heart, Play, Radio, Route, Scale, ShieldCheck, Signal, SlidersHorizontal, WifiOff, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

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

interface ReadinessItemProps {
  label: string;
  detail: string;
  connected: boolean;
  icon: ReactNode;
}

interface LiveMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  colorClass: string;
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

const ReadinessItem = ({ label, detail, connected, icon }: ReadinessItemProps) => (
  <div className={`flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5 ${
    connected ? 'border-hw-accent/25 bg-hw-accent/5' : 'border-hw-muted/15 bg-white/[0.02]'
  }`}>
    <div className="flex min-w-0 items-center gap-3">
      <div className={connected ? 'text-hw-accent' : 'text-hw-muted'}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white">{label}</div>
        <div className="truncate text-[9px] font-mono uppercase tracking-[0.14em] text-hw-muted">{detail}</div>
      </div>
    </div>
    <div className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-mono uppercase tracking-[0.14em] ${
      connected ? 'bg-hw-accent text-hw-bg' : 'bg-hw-muted/10 text-hw-muted'
    }`}>
      {connected ? 'Ready' : 'Offline'}
    </div>
  </div>
);

const LiveMetric = ({ label, value, unit, icon, colorClass }: LiveMetricProps) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.025] p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="stat-label mb-0 flex items-center gap-2">
        <span className={colorClass}>{icon}</span>
        {label}
      </div>
      <Signal size={12} className={value === '--' ? 'text-hw-muted' : colorClass} />
    </div>
    <div className={`font-mono text-3xl font-black leading-none ${colorClass}`}>
      {value}
      {unit && <span className="ml-2 text-xs font-normal text-white/45">{unit}</span>}
    </div>
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
  const readinessLabel = sensorCount === 2 ? 'Ready to ride' : sensorCount === 1 ? 'Partial tracking' : 'Manual session';
  const startHint = sensorCount === 2
    ? 'All core sensors are online'
    : sensorCount === 1
      ? 'One sensor is online'
      : 'No live sensors connected';

  return (
    <div className="grid h-full min-h-[620px] grid-cols-1 gap-4 p-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="hardware-card flex min-h-[360px] flex-col justify-between">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="stat-label">Pre-Ride Cockpit</div>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{readinessLabel}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-hw-muted">
                {startHint}. Check the signal preview, then start when the readings look stable.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              {hasSignal ? <Radio size={14} className="text-hw-accent" /> : <WifiOff size={14} className="text-hw-muted" />}
              <span className={`text-[10px] font-mono uppercase tracking-[0.16em] ${hasSignal ? 'text-hw-accent' : 'text-hw-muted'}`}>
                {hasSignal ? 'Signal detected' : 'Waiting signal'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ReadinessItem
              label="Heart Rate Monitor"
              detail={hrConnected ? 'Live heart-rate stream' : 'Rockbros / Standard BLE'}
              connected={hrConnected}
              icon={<Heart size={17} />}
            />
            <ReadinessItem
              label="Stationary Bike"
              detail={bikeConnected ? 'FTMS metrics stream' : 'Yesoul / FTMS service'}
              connected={bikeConnected}
              icon={<Bike size={17} />}
            />
            <ReadinessItem
              label="Google Fit"
              detail={isGoogleConnected ? 'Workout sync enabled' : 'Sync can be connected later'}
              connected={isGoogleConnected}
              icon={<ShieldCheck size={17} />}
            />
            <ReadinessItem
              label="Profile"
              detail={`${userProfile.ftp || 0} FTP / ${userProfile.maxHr || 0} max HR / ${userProfile.weight || 0} kg`}
              connected={Boolean(userProfile.ftp && userProfile.maxHr && userProfile.weight)}
              icon={<SlidersHorizontal size={17} />}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">FTP</div>
              <div className="mt-1 font-mono text-xl font-bold text-yellow-300">{userProfile.ftp || '--'} W</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">Max HR</div>
              <div className="mt-1 font-mono text-xl font-bold text-red-300">{userProfile.maxHr || '--'} BPM</div>
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">Weight</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-xl font-bold text-blue-300">
                <Scale size={16} />
                {userProfile.weight || '--'} KG
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={onStart}
              className="flex min-h-16 items-center justify-center gap-3 rounded-xl bg-hw-accent px-8 py-4 text-sm font-black uppercase tracking-[0.18em] text-hw-bg transition-opacity hover:opacity-90"
            >
              <Play size={22} fill="currentColor" />
              Start Session
            </button>
            {sensorCount > 0 && (
              <button
                onClick={onDisconnect}
                className="rounded-lg border border-hw-muted/20 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-hw-muted transition-colors hover:border-red-400/40 hover:text-red-300"
              >
                Disconnect All Devices
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid min-h-0 grid-cols-1 gap-4">
        <section className="hardware-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="stat-label">Live Signal Preview</div>
              <div className="text-sm font-semibold text-white">Sensor check</div>
            </div>
            <Bluetooth size={18} className={hasSignal ? 'text-hw-accent' : 'text-hw-muted'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LiveMetric label="Heart Rate" value={currentData.hr || '--'} unit="BPM" icon={<Heart size={12} />} colorClass="text-red-400" />
            <LiveMetric label="Cadence" value={currentData.cadence || '--'} unit="RPM" icon={<Bike size={12} />} colorClass="text-hw-accent" />
            <LiveMetric label="Power" value={currentData.power || '--'} unit="W" icon={<Zap size={12} />} colorClass="text-yellow-300" />
            <LiveMetric label="Speed" value={currentData.speed ? currentData.speed.toFixed(1) : '--'} unit="KM/H" icon={<Activity size={12} />} colorClass="text-blue-400" />
          </div>
        </section>

        <section className="hardware-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="stat-label">Last Session</div>
              <div className="text-sm font-semibold text-white">{lastSession ? new Date(lastSession.date).toLocaleDateString() : 'No ride logged yet'}</div>
            </div>
            <Clock3 size={18} className="text-hw-muted" />
          </div>

          {lastSession ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/5 bg-white/[0.025] p-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">Duration</div>
                <div className="mt-2 font-mono text-2xl font-bold text-white">{formatDuration(lastSession.duration)}</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.025] p-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">Distance</div>
                <div className="mt-2 flex items-center gap-2 font-mono text-2xl font-bold text-purple-300">
                  <Route size={16} />
                  {getLastDistanceKm(lastSession)} KM
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.025] p-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">Avg HR</div>
                <div className="mt-2 font-mono text-2xl font-bold text-red-300">{lastSession.stats?.avgHr || '--'} BPM</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.025] p-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">Avg Power</div>
                <div className="mt-2 font-mono text-2xl font-bold text-yellow-300">{lastSession.stats?.avgPower || '--'} W</div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-hw-muted/20 bg-white/[0.015] text-center">
              <div>
                <Check size={18} className="mx-auto mb-3 text-hw-accent" />
                <div className="text-xs font-semibold text-white">First session ready</div>
                <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-hw-muted">Your summary will appear here after saving a workout</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
