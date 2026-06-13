import { motion } from 'motion/react';
import { Bike, ChevronRight, Download, Heart, Save, Timer, Trash2, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { downloadTCX } from '../lib/export-service';
import { Panel, StatusPill } from './ui';

interface SessionSummaryModalProps {
  stats: {
    avgHr: number;
    maxHr: number;
    avgPower: number;
    maxPower: number;
    avgCadence: number;
    maxCadence: number;
    avgSpeed: number;
    maxSpeed: number;
    hrrScore?: number | null;
    hrrClassification?: string | null;
  };
  duration: string;
  calories: number;
  distance: number;
  history?: any[];
  sessionStartTime?: number;
  onSave: () => void;
  onDiscard: () => void;
}

interface ResultMetricProps {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}

interface DetailMetricProps {
  label: string;
  value: string;
  subValue: string;
  tone: string;
}

const parseDurationSeconds = (duration: string) =>
  duration.split(':').reduce((acc, time) => (60 * acc) + Number(time), 0);

export const SessionSummaryModal = ({
  stats,
  duration,
  calories,
  distance,
  history,
  sessionStartTime,
  onSave,
  onDiscard
}: SessionSummaryModalProps) => {
  const canExport = Boolean(history && sessionStartTime);

  const handleExport = () => {
    if (!history || !sessionStartTime) return;

    const tempSession = {
      id: 'temp',
      sessionStartTime,
      date: new Date(sessionStartTime).toISOString(),
      duration: parseDurationSeconds(duration),
      stats: {
        avgHr: stats.avgHr,
        maxHr: stats.maxHr,
        avgPower: stats.avgPower,
        maxPower: stats.maxPower,
        avgCadence: stats.avgCadence,
        maxCadence: stats.maxCadence,
        hrrScore: stats.hrrScore,
        hrrClassification: stats.hrrClassification
      },
      history: history as any[]
    };

    downloadTCX(tempSession as any);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-vp-bg/90 p-4 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="vp-panel-raised max-h-[92dvh] w-full max-w-3xl overflow-y-auto p-0 shadow-2xl"
      >
        <div className="space-y-6 p-5 md:p-7">
          <div className="flex flex-col gap-3 border-b border-vp-border pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="vp-label">Session complete</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-vp-text">
                Workout summary
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-vp-muted">
                Review the telemetry snapshot before saving this ride.
              </p>
            </div>
            <StatusPill label={`${history?.length || 0} points`} tone={history?.length ? 'ready' : 'neutral'} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ResultMetric icon={<Timer size={15} />} label="Duration" value={duration} tone="text-vp-speed" />
            <ResultMetric icon={<ChevronRight size={15} />} label="Distance" value={`${(distance / 1000).toFixed(2)} KM`} tone="text-vp-distance" />
            <ResultMetric icon={<Zap size={15} />} label="Calories" value={`${calories} KCAL`} tone="text-vp-calories" />
            <ResultMetric icon={<Heart size={15} />} label="Avg HR" value={`${stats.avgHr} BPM`} tone="text-vp-hr" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <DetailMetric label="Avg Power" value={`${stats.avgPower} W`} subValue={`Max ${stats.maxPower} W`} tone="text-vp-power" />
            <DetailMetric label="Avg Cadence" value={`${stats.avgCadence} RPM`} subValue={`Max ${stats.maxCadence} RPM`} tone="text-vp-cadence" />
            <DetailMetric label="Avg Speed" value={`${stats.avgSpeed} KM/H`} subValue={`Max ${stats.maxSpeed} KM/H`} tone="text-vp-speed" />
          </div>

          {stats.hrrScore !== undefined && stats.hrrScore !== null && (
            <Panel className="border-vp-accent/25 bg-vp-accent/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-vp-accent/25 bg-vp-accent/10 text-vp-accent">
                    <Heart size={20} fill="currentColor" />
                  </div>
                  <div>
                    <div className="vp-label">Heart Rate Recovery</div>
                    <div className="mt-1 text-sm font-semibold uppercase text-vp-accent">
                      {stats.hrrClassification}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-vp-text">
                  <span className="text-3xl font-black tabular-nums">{stats.hrrScore}</span>
                  <span className="ml-1 text-xs text-vp-muted">BPM drop</span>
                </div>
              </div>
            </Panel>
          )}

          <div className="grid grid-cols-1 gap-3 border-t border-vp-border pt-5 md:grid-cols-3">
            <button
              onClick={onSave}
              className="vp-focus-ring flex min-h-12 items-center justify-center gap-2 rounded-lg bg-vp-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-vp-bg transition-colors hover:bg-vp-accent/90"
            >
              <Save size={18} />
              Save
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="vp-button vp-focus-ring min-h-12 text-vp-accent disabled:text-vp-muted"
            >
              <Download size={18} />
              Export TCX
            </button>
            <button
              onClick={onDiscard}
              className="vp-button vp-button-danger vp-focus-ring min-h-12"
            >
              <Trash2 size={18} />
              Discard
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ResultMetric = ({ icon, label, value, tone }: ResultMetricProps) => (
  <div className="rounded-lg border border-vp-border bg-white/[0.025] p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="vp-label">{label}</div>
      <div className={tone}>{icon}</div>
    </div>
    <div className={`font-mono text-2xl font-black tracking-normal tabular-nums ${tone}`}>
      {value}
    </div>
  </div>
);

const DetailMetric = ({ label, value, subValue, tone }: DetailMetricProps) => (
  <div className="rounded-lg border border-vp-border bg-white/[0.025] p-4">
    <div className="vp-label">{label}</div>
    <div className={`mt-2 font-mono text-2xl font-black tracking-normal tabular-nums ${tone}`}>
      {value}
    </div>
    <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted">
      {subValue}
    </div>
  </div>
);
