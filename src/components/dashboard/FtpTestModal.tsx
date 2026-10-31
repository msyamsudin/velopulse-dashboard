'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Award, Bike, Timer, X, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  FTP_EFFORT_SECONDS,
  FTP_MIN_COVERAGE_SECONDS,
  getFtpCoveragePercent,
  type FtpResult,
} from '@/lib/ftp-test';
import type { FtpTestSaveState, FtpTestStatus } from '@/hooks/useFtpTest';

interface FtpTestModalProps {
  status: FtpTestStatus;
  warmupRemaining: number;
  effortRemaining: number;
  effortElapsed: number;
  avgPower: number;
  currentPower: number;
  currentHr: number;
  bikeConnected: boolean;
  deviceName: string | null;
  /** FTP yang sedang dipakai profil; hanya untuk konteks, tidak diubah otomatis. */
  currentFtp: number;
  result: FtpResult | null;
  saveState: FtpTestSaveState;
  abortReason: 'bike' | null;
  onStart: () => void;
  onSkipWarmup: () => void;
  onCancel: () => void;
  onClose: () => void;
  onApply: (ftp: number) => Promise<void>;
}

type ApplyState = 'idle' | 'saving' | 'done' | 'error';

const formatSeconds = (totalSeconds: number) => {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const FtpTestModal = ({
  status,
  warmupRemaining,
  effortRemaining,
  effortElapsed,
  avgPower,
  currentPower,
  currentHr,
  bikeConnected,
  deviceName,
  currentFtp,
  result,
  saveState,
  abortReason,
  onStart,
  onSkipWarmup,
  onCancel,
  onClose,
  onApply,
}: FtpTestModalProps) => {
  const { t } = useI18n();
  const [applyState, setApplyState] = useState<ApplyState>('idle');
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'result') {
      setApplyState('idle');
      setApplyError(null);
    }
  }, [status]);

  if (status === 'closed') return null;

  const isTesting = status === 'warmup' || status === 'effort';
  const progress = Math.min(100, Math.max(0, (effortElapsed / FTP_EFFORT_SECONDS) * 100));

  const handleCancel = () => {
    if (confirm(t('Cancel this FTP test? The effort will not be saved.'))) {
      onCancel();
    }
  };

  const handleApply = async () => {
    if (!result?.valid || result.ftp === null) return;
    setApplyState('saving');
    setApplyError(null);
    try {
      await onApply(result.ftp);
      setApplyState('done');
    } catch (error) {
      setApplyState('error');
      setApplyError(error instanceof Error ? error.message : t('Could not save your FTP. Try again.'));
    }
  };

  const saveNotice = (() => {
    if (saveState === 'saving') return t('Saving the test session...');
    if (saveState === 'saved') return t('Saved to History as an FTP test.');
    if (saveState === 'failed') return t('The result is ready, but the session could not be saved.');
    return null;
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('FTP test')}
      className="fixed inset-0 z-150 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-hw-card p-6 shadow-2xl backdrop-blur-xl"
        style={{ boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05) inset' }}
      >
        <div className="absolute -right-20 -top-20 -z-10 h-40 w-40 rounded-full bg-vp-power/10 blur-[80px]" />

        {!isTesting && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="vp-focus-ring absolute right-4 top-4 rounded-full p-1.5 text-hw-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        )}

        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-vp-power/25 bg-vp-power/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-vp-power">
            <Zap size={10} className="animate-pulse" />
            {t('FTP test')}
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-wide text-white">
            {status === 'intro' && t('Measure your FTP')}
            {status === 'warmup' && t('Warm-up')}
            {status === 'effort' && t('20-minute effort')}
            {status === 'result' && result?.valid && t('FTP result')}
            {status === 'result' && result && !result.valid && t('FTP not measured')}
          </h2>
        </div>

        {status === 'intro' && (
          <div className="space-y-5">
            <p className="text-center text-sm leading-6 text-hw-muted">
              {t('Ride all-out for 20 minutes. Your FTP is 95% of the average power you hold, so pacing matters more than a sprint.')}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-center">
                <Timer size={15} className="mx-auto text-vp-muted" />
                <div className="mt-2 font-mono text-sm font-bold text-white">5:00</div>
                <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-hw-muted">{t('Warm-up')}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-center">
                <Zap size={15} className="mx-auto text-vp-power" />
                <div className="mt-2 font-mono text-sm font-bold text-white">20:00</div>
                <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-hw-muted">{t('Effort')}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-center">
                <Activity size={15} className="mx-auto text-vp-accent" />
                <div className="mt-2 font-mono text-sm font-bold text-white">18:00</div>
                <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-hw-muted">{t('Minimum data')}</div>
              </div>
            </div>

            <p className="text-center text-xs leading-5 text-hw-muted">
              {t('A heart-rate strap is optional; the bike must stream power. The result is never applied automatically.')}
            </p>

            <p className="text-center text-[10px] leading-4 text-hw-muted/80">
              {t('Keep this screen open for the full test. Switching tabs or locking the screen interrupts the power data.')}
            </p>

            {!bikeConnected && (
              <div className="flex items-start gap-2 rounded-lg border border-vp-warning/25 bg-vp-warning/5 px-3 py-2 text-xs leading-5 text-vp-warning">
                <Bike size={14} className="mt-0.5 shrink-0" />
                {t('Connect the bike to start the test.')}
              </div>
            )}

            {abortReason === 'bike' && (
              <div className="rounded-lg border border-vp-danger/30 bg-vp-danger/10 px-3 py-2 text-xs leading-5 text-vp-danger">
                {t('The bike disconnected during the test, so it was cancelled. Reconnect it and start again.')}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onStart}
                disabled={!bikeConnected}
                className="vp-focus-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-vp-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-vp-bg transition-colors hover:bg-vp-accent/90 disabled:cursor-not-allowed disabled:bg-vp-muted/25 disabled:text-vp-dim"
              >
                <Zap size={16} />
                {t('Start test')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="vp-focus-ring rounded-xl border border-vp-border px-5 py-3 text-xs font-mono uppercase tracking-[0.14em] text-vp-muted transition-colors hover:text-vp-text"
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        )}

        {status === 'warmup' && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-vp-warning/25 bg-vp-warning/5">
              <div>
                <div className="font-mono text-4xl font-black tabular-nums text-white">{formatSeconds(warmupRemaining)}</div>
                <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-vp-warning">{t('Warm-up')}</div>
              </div>
            </div>

            <p className="text-xs leading-5 text-hw-muted">
              {t('Spin easy. The measured effort starts after the warm-up.')}
            </p>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Current power')}</div>
                <div className="mt-1 text-lg font-bold text-vp-power">{currentPower} W</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Heart Rate')}</div>
                <div className="mt-1 text-lg font-bold text-vp-hr">{currentHr || '--'} BPM</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onSkipWarmup}
                className="vp-focus-ring flex min-h-11 flex-1 items-center justify-center rounded-xl bg-vp-accent px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-vp-bg hover:bg-vp-accent/90"
              >
                {t('Skip warm-up')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="vp-focus-ring rounded-xl border border-vp-border px-4 py-2.5 text-xs font-mono uppercase tracking-[0.14em] text-vp-muted hover:text-vp-text"
              >
                {t('Cancel test')}
              </button>
            </div>
          </div>
        )}

        {status === 'effort' && (
          <div className="space-y-5 text-center">
            <div>
              <div className="font-mono text-5xl font-black tabular-nums text-white">{formatSeconds(effortRemaining)}</div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.14em] text-hw-muted">{t('Remaining')}</div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-vp-power transition-[width] duration-500"
                style={{ width: `${progress}%` }}
                aria-hidden="true"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Current power')}</div>
                <div className="mt-1 text-lg font-bold text-vp-power">{currentPower} W</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Avg Power')}</div>
                <div className="mt-1 text-lg font-bold text-white">{avgPower} W</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Heart Rate')}</div>
                <div className="mt-1 text-lg font-bold text-vp-hr">{currentHr || '--'} BPM</div>
              </div>
            </div>

            <p className="text-xs leading-5 text-hw-muted">
              {t('Hold a pace you can sustain for the full 20 minutes. This effort is what defines your zones.')}
            </p>

            <button
              type="button"
              onClick={handleCancel}
              className="vp-focus-ring w-full rounded-xl border border-vp-border px-4 py-2.5 text-xs font-mono uppercase tracking-[0.14em] text-vp-muted hover:text-vp-text"
            >
              {t('Cancel test')}
            </button>
          </div>
        )}

        {status === 'result' && result?.valid && result.ftp !== null && (
          <div className="space-y-5 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-vp-power/25 bg-vp-power/10 text-vp-power">
              <Award size={28} />
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">{t('Your FTP')}</div>
              <div className="mt-1 font-mono text-6xl font-black tracking-tight text-white">
                {result.ftp}
                <span className="ml-1 text-lg font-normal text-white/45">W</span>
              </div>
              <div className="mt-2 text-xs text-hw-muted">
                {t('95% of your 20-minute average power ({power} W).', { power: result.avgPower })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/5 bg-white/2 p-3 text-left font-mono text-xs">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Data coverage')}</div>
                <div className="mt-1 text-sm font-bold text-white">{getFtpCoveragePercent(result.coverageSeconds)}%</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Device')}</div>
                <div className="mt-1 truncate text-sm font-bold text-white">{deviceName || t('Unknown device')}</div>
              </div>
            </div>

            {saveNotice && (
              <p className={`text-[11px] leading-5 ${saveState === 'failed' ? 'text-vp-danger' : 'text-hw-muted'}`}>
                {saveNotice}
              </p>
            )}

            {applyError && (
              <p className="rounded-lg border border-vp-danger/30 bg-vp-danger/10 px-3 py-2 text-[11px] leading-5 text-vp-danger">
                {applyError}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleApply}
                disabled={applyState === 'saving' || applyState === 'done'}
                className="vp-focus-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-vp-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-vp-bg transition-colors hover:bg-vp-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Zap size={16} />
                {applyState === 'saving' ? t('Applying...') : applyState === 'done' ? t('FTP applied') : t('Use this FTP (optional)')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="vp-focus-ring rounded-xl border border-vp-border px-5 py-3 text-xs font-mono uppercase tracking-[0.14em] text-vp-muted hover:text-vp-text"
              >
                {t('Close')}
              </button>
            </div>

            <p className="text-[10px] leading-4 text-hw-muted">
              {currentFtp > 0
                ? t('Your profile FTP stays at {ftp} W. Applying this result is optional.', { ftp: currentFtp })
                : t('This is a measurement only. Your profile gains no FTP unless you apply it.')}
            </p>
          </div>
        )}

        {status === 'result' && result && !result.valid && (
          <div className="space-y-5 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-vp-warning/25 bg-vp-warning/10 text-vp-warning">
              <Activity size={26} />
            </div>

            <p className="text-sm leading-6 text-hw-muted">
              {result.reason === 'no-samples' && t('No power data reached the app during the effort.')}
              {result.reason === 'no-power' && t('The recorded power stayed at zero, so there is nothing to measure.')}
              {result.reason === 'short-coverage' && t(
                'Only {covered} of the required 18 minutes had clean power data. FTP is not reported from a shorter effort.',
                { covered: formatSeconds(Math.min(result.coverageSeconds, FTP_MIN_COVERAGE_SECONDS)) }
              )}
            </p>

            <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-left font-mono text-xs">
              <div className="text-[9px] uppercase tracking-wider text-hw-muted">{t('Data coverage')}</div>
              <div className="mt-1 text-sm font-bold text-white">{getFtpCoveragePercent(result.coverageSeconds)}%</div>
            </div>

            {saveNotice && (
              <p className={`text-[11px] leading-5 ${saveState === 'failed' ? 'text-vp-danger' : 'text-hw-muted'}`}>
                {saveNotice}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onStart}
                disabled={!bikeConnected}
                className="vp-focus-ring flex min-h-11 flex-1 items-center justify-center rounded-xl bg-vp-accent px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-vp-bg hover:bg-vp-accent/90 disabled:cursor-not-allowed disabled:bg-vp-muted/25 disabled:text-vp-dim"
              >
                {t('Try again')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="vp-focus-ring rounded-xl border border-vp-border px-4 py-2.5 text-xs font-mono uppercase tracking-[0.14em] text-vp-muted hover:text-vp-text"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
