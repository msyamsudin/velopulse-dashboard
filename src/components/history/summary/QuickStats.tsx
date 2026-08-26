import { useI18n } from '@/i18n';
import type { SummaryInsights } from '@/lib/history-types';

interface QuickStatsProps {
  summaryInsights: SummaryInsights | null;
  metricColor: string;
}

export const QuickStats = ({ summaryInsights, metricColor }: QuickStatsProps) => {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Avg / Session')}</div>
        <div className="mt-1 text-sm font-bold font-mono text-white">{summaryInsights?.avgDistancePerSession ?? '--'} <span className="text-[9px] text-hw-muted">KM</span></div>
        <div className="text-[9px] font-mono text-white/45">{summaryInsights?.avgDurationPerSession ?? '--'}</div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Best Period')}</div>
        <div className="mt-1 text-sm font-bold font-mono" style={{ color: metricColor }}>{summaryInsights?.bestPeriodDistance ?? '--'} <span className="text-[9px] text-white/40">KM</span></div>
        <div className="text-[9px] font-mono text-white/45">{summaryInsights?.bestPeriodLabel ?? '--'}</div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Current Streak')}</div>
        <div className="mt-1 text-sm font-bold font-mono text-white">{summaryInsights?.currentStreakLabel ?? '--'}</div>
        <div className="text-[9px] font-mono text-white/45">{summaryInsights?.activeDaysLabel ?? '--'} {t('active')}</div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Active Span')}</div>
        <div className="mt-1 text-sm font-bold font-mono text-white">{summaryInsights?.activeSpanLabel ?? '--'}</div>
        <div className="text-[9px] font-mono text-white/45">{t('First to latest')}</div>
      </div>
    </div>
  );
};
