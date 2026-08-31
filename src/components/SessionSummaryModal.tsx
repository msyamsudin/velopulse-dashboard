import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Check, ChevronRight, Download, Heart, Loader2, Save, Timer, Trash2, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { downloadTCX } from '../lib/export-service';
import { calculateEdwardsTrimp } from '../lib/training-load';
import { Panel, StatusPill } from './ui';
import { useI18n } from '@/i18n';
import type { HistoryData, SaveSessionPhase, WorkoutSession } from '@/store/useWorkoutStore';

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
  /** Rider max HR, used to derive the TRIMP zone weights for the summary. */
  maxHr: number;
  history?: HistoryData[];
  sessionStartTime?: number;
  /** True while saveSession() is running; drives the progress bar. */
  isSaving?: boolean;
  /** 0–100 save progress reported by the workout store. */
  saveProgress?: number;
  /** Current save stage, used to pick a localized progress label. */
  savePhase?: SaveSessionPhase;
  onSave: () => void;
  onDiscard: () => void;
}

interface ResultMetricProps {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
  subValue?: string;
}

interface DetailMetricProps {
  label: string;
  value: string;
  subValue: string;
  tone: string;
}

const parseDurationSeconds = (duration: string) =>
  duration.split(':').reduce((acc, time) => (60 * acc) + Number(time), 0);

const SAVE_PHASE_LABEL: Record<SaveSessionPhase, string> = {
  idle: 'Saving...',
  preparing: 'Preparing workout data…',
  local: 'Saving to this device…',
  sync: 'Syncing to the cloud…',
  finalizing: 'Finalizing…',
  done: 'Saved',
};

const SAVE_SEGMENTS: SaveSessionPhase[] = ['preparing', 'local', 'sync', 'finalizing', 'done'];

export const SessionSummaryModal = ({
  stats,
  duration,
  calories,
  distance,
  maxHr,
  history,
  sessionStartTime,
  isSaving = false,
  saveProgress = 0,
  savePhase = 'idle',
  onSave,
  onDiscard
}: SessionSummaryModalProps) => {
  const { t } = useI18n();

  // Freeze the summary on first render: the store is cleared by
  // discardSession() right before the save completes, so the modal must keep
  // showing the ride it captured instead of zeroed-out live stats.
  const [snapshot] = useState(() => ({
    stats,
    duration,
    calories,
    distance,
    maxHr,
    history,
    sessionStartTime,
  }));
  const canExport = Boolean(snapshot.history && snapshot.sessionStartTime);

  // Edwards TRIMP for the captured session, computed from the same history +
  // duration + max HR the saved workout will use, so the summary value matches
  // the TRIMP shown in the training log afterwards.
  const trimp = useMemo(
    () => calculateEdwardsTrimp(snapshot.history, parseDurationSeconds(snapshot.duration), snapshot.maxHr),
    [snapshot]
  );

  const handleExport = () => {
    if (!snapshot.history || !snapshot.sessionStartTime) return;

    const tempSession: WorkoutSession = {
      id: 'temp',
      sessionStartTime: snapshot.sessionStartTime,
      date: new Date(snapshot.sessionStartTime).toISOString(),
      duration: parseDurationSeconds(snapshot.duration),
      stats: {
        avgHr: snapshot.stats.avgHr,
        maxHr: snapshot.stats.maxHr,
        avgPower: snapshot.stats.avgPower,
        maxPower: snapshot.stats.maxPower,
        avgCadence: snapshot.stats.avgCadence,
        maxCadence: snapshot.stats.maxCadence,
        hrrScore: snapshot.stats.hrrScore,
        hrrClassification: snapshot.stats.hrrClassification
      },
      history: snapshot.history
    };

    downloadTCX(tempSession);
  };
  const handleDiscard = () => {
    if (!isSaving && confirm(t('Discard this workout? Unsaved session data will be lost.'))) {
      onDiscard();
    }
  };

  const phaseLabel = isSaving ? t(SAVE_PHASE_LABEL[savePhase]) : '';
  const isDone = isSaving && savePhase === 'done';
  const activeSegmentIndex = SAVE_SEGMENTS.indexOf(savePhase);

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
              <div className="vp-label">{t('Session complete')}</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-vp-text">
                {t('Workout summary')}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-vp-muted">
                {t('Review the telemetry snapshot before saving this ride.')}
              </p>
            </div>
            <StatusPill label={`${snapshot.history?.length || 0} ${t('points')}`} tone={snapshot.history?.length ? 'ready' : 'neutral'} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <ResultMetric icon={<Timer size={15} />} label={t('Duration')} value={snapshot.duration} tone="text-vp-speed" />
            <ResultMetric icon={<ChevronRight size={15} />} label={t('Distance')} value={`${(snapshot.distance / 1000).toFixed(2)} KM`} tone="text-vp-distance" />
            <ResultMetric icon={<Zap size={15} />} label={t('Calories')} value={`${snapshot.calories} KCAL`} tone="text-vp-calories" />
            <ResultMetric icon={<Heart size={15} />} label={t('Avg HR')} value={`${snapshot.stats.avgHr} BPM`} tone="text-vp-hr" />
            <ResultMetric icon={<Activity size={15} />} label={t('TRIMP')} value={`${trimp.score} pts`} subValue={t(trimp.label)} tone="text-purple-300" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <DetailMetric label={t('Avg Power')} value={`${snapshot.stats.avgPower} W`} subValue={`${t('Max')} ${snapshot.stats.maxPower} W`} tone="text-vp-power" />
            <DetailMetric label={t('Avg Cadence')} value={`${snapshot.stats.avgCadence} RPM`} subValue={`${t('Max')} ${snapshot.stats.maxCadence} RPM`} tone="text-vp-cadence" />
            <DetailMetric label={t('Avg Speed')} value={`${snapshot.stats.avgSpeed} KM/H`} subValue={`${t('Max')} ${snapshot.stats.maxSpeed} KM/H`} tone="text-vp-speed" />
          </div>

          {snapshot.stats.hrrScore !== undefined && snapshot.stats.hrrScore !== null && (
            <Panel className="border-vp-accent/25 bg-vp-accent/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-vp-accent/25 bg-vp-accent/10 text-vp-accent">
                    <Heart size={20} fill="currentColor" />
                  </div>
                  <div>
                    <div className="vp-label">{t('Heart Rate Recovery')}</div>
                    <div className="mt-1 text-sm font-semibold uppercase text-vp-accent">
                      {snapshot.stats.hrrClassification}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-vp-text">
                  <span className="text-3xl font-black tabular-nums">{snapshot.stats.hrrScore}</span>
                  <span className="ml-1 text-xs text-vp-muted">{t('BPM drop')}</span>
                </div>
              </div>
            </Panel>
          )}

          {isSaving && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={saveProgress}
              aria-label={phaseLabel}
              className="border-t border-vp-border pt-5"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {isDone ? (
                    <Check size={14} className="shrink-0 text-vp-accent" />
                  ) : (
                    <Loader2 size={14} className="shrink-0 animate-spin text-vp-accent" />
                  )}
                  <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-vp-text/90">
                    {phaseLabel}
                  </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-vp-muted">
                  {saveProgress}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {SAVE_SEGMENTS.map((segment, index) => {
                  const isCompleted = index < activeSegmentIndex;
                  const isActive = index === activeSegmentIndex;
                  return (
                    <div key={segment} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-4 items-center justify-center">
                        {isCompleted ? (
                          <Check size={12} className="text-vp-accent" />
                        ) : isActive ? (
                          <Loader2 size={12} className="animate-spin text-vp-accent" />
                        ) : (
                          <span className="h-1 w-1 rounded-full bg-vp-muted/40" />
                        )}
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={false}
                          animate={{
                            width: isCompleted || isActive ? '100%' : '0%',
                            backgroundColor: isCompleted || isActive ? '#35f0bd' : 'rgba(255,255,255,0.04)'
                          }}
                          transition={{ ease: 'easeOut', duration: 0.3 }}
                          className={[
                            'h-full rounded-full',
                            savePhase === 'sync' && isActive ? 'vp-progress-stripes' : ''
                          ].filter(Boolean).join(' ')}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-vp-muted">
                {isDone
                  ? t('Workout saved to this device and synced to the cloud.')
                  : t('Please keep this window open until saving finishes.')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 border-t border-vp-border pt-5 md:grid-cols-3">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              aria-label={t('Save workout session')}
              className="vp-focus-ring flex min-h-12 items-center justify-center gap-2 rounded-lg bg-vp-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-vp-bg transition-colors hover:bg-vp-accent/90 disabled:pointer-events-none disabled:opacity-60"
            >
              {isDone ? <Check size={18} /> : isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isDone ? t('Saved') : isSaving ? t('Saving...') : t('Save')}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isSaving || !canExport}
              aria-label={canExport ? 'Export workout as TCX' : 'Export unavailable until session data is ready'}
              className="vp-button vp-focus-ring min-h-12 text-vp-accent disabled:text-vp-muted"
            >
              <Download size={18} />
              {t('Export TCX')}
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving}
              aria-label={t('Discard unsaved workout session')}
              className="vp-button vp-button-danger vp-focus-ring min-h-12"
            >
              <Trash2 size={18} />
              {t('Discard')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const ResultMetric = ({ icon, label, value, tone, subValue }: ResultMetricProps) => (
  <div className="rounded-lg border border-vp-border bg-white/[0.025] p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="vp-label">{label}</div>
      <div className={tone}>{icon}</div>
    </div>
    <div className={`font-mono text-2xl font-black tracking-normal tabular-nums ${tone}`}>
      {value}
    </div>
    {subValue && (
      <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted">
        {subValue}
      </div>
    )}
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
