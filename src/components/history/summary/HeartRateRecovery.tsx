import { Activity } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { GlobalSummary } from '@/lib/history-types';

interface HeartRateRecoveryProps {
  globalSummary: GlobalSummary;
}

export const HeartRateRecovery = ({ globalSummary }: HeartRateRecoveryProps) => {
  const { t } = useI18n();

  return (
    <div className="hardware-card border-emerald-400/20 bg-emerald-400/5 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-emerald-400/10 pb-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-2">
            <Activity size={12} />
            {t('Heart Rate Recovery')}
          </div>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">
            {t('Recovery scores from workouts in the selected range')}
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">
          {globalSummary.hrrSessions}/{globalSummary.totalSessions} {t('sessions')}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
          <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Avg HRR')}</div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-300 tabular-nums">
            {globalSummary.avgHrr} <span className="text-[10px] font-normal text-white/40">BPM</span>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
          <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Best HRR')}</div>
          <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
            {globalSummary.bestHrr} <span className="text-[10px] font-normal text-white/40">BPM</span>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
          <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Coverage')}</div>
          <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
            {Math.round((globalSummary.hrrSessions / Math.max(1, globalSummary.totalSessions)) * 100)}
            <span className="text-[10px] font-normal text-white/40">%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
