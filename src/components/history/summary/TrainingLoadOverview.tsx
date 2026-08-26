import { Activity } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { GlobalSummary } from '@/lib/history-types';

interface TrainingLoadOverviewProps {
  globalSummary: GlobalSummary;
  trainingLoadChange: string;
  comparisonLabel: string;
  rangeLabel: string;
}

export const TrainingLoadOverview = ({
  globalSummary,
  trainingLoadChange,
  comparisonLabel,
  rangeLabel,
}: TrainingLoadOverviewProps) => {
  const { t } = useI18n();

  return (
    <div className="hardware-card border-purple-400/20 bg-purple-400/5 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-purple-400/10 pb-3">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-purple-300">
            <Activity size={12} />
            {t('Training Load')}
          </div>
          <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-white/45">
            {t('Edwards TRIMP from heart-rate zones')}
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">{rangeLabel}</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('Period Load'), value: globalSummary.totalTrainingLoad, detail: `${globalSummary.totalSessions} ${t('sessions')}` },
          { label: t('Avg / Session'), value: globalSummary.averageTrainingLoad, detail: t('TRIMP points') },
          { label: t('7-Day Load'), value: globalSummary.sevenDayTrainingLoad, detail: t('Latest 7 days') },
          { label: t('Vs Previous'), value: trainingLoadChange, detail: comparisonLabel ?? t('No comparison') },
        ].map(metric => (
          <div key={metric.label} className="rounded-xl border border-purple-400/15 bg-black/20 px-4 py-3">
            <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{metric.label}</div>
            <div className="mt-1 text-2xl font-bold font-mono text-purple-200 tabular-nums">{metric.value}</div>
            <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">{metric.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
