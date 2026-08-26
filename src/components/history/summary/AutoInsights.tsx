import { useI18n } from '@/i18n';
import { getInsightToneClasses } from '@/lib/workout-analysis';
import type { SummaryInsight } from './useHistorySummary';

interface AutoInsightsProps {
  autoInsights: SummaryInsight[];
  rangeLabel: string;
}

export const AutoInsights = ({ autoInsights, rangeLabel }: AutoInsightsProps) => {
  const { t } = useI18n();

  return (
    <div className="hardware-card border-hw-muted/20 p-4 bg-black/20">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Automatic Insights')}</div>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">{t('Generated from range trends and consistency')}</div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">{rangeLabel}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {autoInsights.map(insight => (
          <div key={`${insight.title}-${insight.body}`} className={`rounded-xl border px-4 py-3 ${getInsightToneClasses(insight.tone)}`}>
            <div className="text-[9px] font-mono uppercase tracking-[0.18em]">{insight.title}</div>
            <div className="mt-2 text-[11px] leading-relaxed text-white/65">{insight.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
