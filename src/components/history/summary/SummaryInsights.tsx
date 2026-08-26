import { useI18n } from '@/i18n';
import type { ComparisonSummary, DailySummaryDay, MetricKey, SummaryInsights } from '@/lib/history-types';
import { ConsistencyMap } from './ConsistencyMap';
import type { SummaryPeriod } from './constants';

interface SummaryInsightsProps {
  comparisonSummary: ComparisonSummary | null;
  summaryInsights: SummaryInsights | null;
  summaryPeriod: SummaryPeriod;
  weeklyDailyData: DailySummaryDay[];
  rangeLabel: string;
  metricColor: string;
  weeklyMetric: MetricKey;
}

export const SummaryInsightsCard = ({
  comparisonSummary,
  summaryInsights,
  summaryPeriod,
  weeklyDailyData,
  rangeLabel,
  metricColor,
  weeklyMetric,
}: SummaryInsightsProps) => {
  const { t } = useI18n();

  return (
    <div className="hardware-card border-hw-muted/20 p-5 flex flex-col bg-black/25">
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-white/5 pb-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Summary Insights')}</div>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">
            {comparisonSummary?.headline ?? t('Contextual stats for the selected range')}
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">
          {rangeLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
        {comparisonSummary && (
          <div className="rounded-2xl border border-white/8 bg-white/2.5 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Range Comparison')}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">{comparisonSummary.label}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { key: 'distance', label: 'Distance', unit: 'km' },
                { key: 'sessions', label: 'Sessions', unit: '' },
                { key: 'duration', label: 'Duration', unit: 'min' },
                { key: 'calories', label: 'Calories', unit: 'kcal' },
                { key: 'trimp', label: 'TRIMP', unit: 'pts' },
              ].map(item => {
                const metric = comparisonSummary.metrics[item.key as keyof typeof comparisonSummary.metrics];
                const delta = comparisonSummary.deltas[item.key as keyof typeof comparisonSummary.deltas];
                const deltaColor = delta.direction === 'up'
                  ? 'text-green-400'
                  : delta.direction === 'down'
                    ? 'text-red-400'
                    : 'text-white';

                return (
                  <div key={item.key} className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                    <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-hw-muted">{t(item.label)}</div>
                    <div className="mt-1 text-sm font-bold font-mono text-white">
                      {item.key === 'distance' ? metric.toFixed(1) : Math.round(metric)}
                      {item.unit && <span className="ml-1 text-[9px] text-white/35">{item.unit}</span>}
                    </div>
                    <div className={`mt-1 text-[9px] font-mono uppercase tracking-[0.12em] ${deltaColor}`}>
                      {delta.hasBaseline
                        ? `${delta.direction === 'up' ? '+' : ''}${delta.value}%`
                        : metric > 0
                          ? t('new')
                          : t('none')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {summaryInsights && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Last Workout')}</div>
              <div className="mt-1 text-base font-bold font-mono text-white">{summaryInsights.lastWorkoutLabel}</div>
              <div className="text-[9px] font-mono text-white/45 mt-1">{t('Latest in range')}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
              <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Longest Streak')}</div>
              <div className="mt-1 text-base font-bold font-mono text-white">{summaryInsights.longestStreakLabel}</div>
              <div className="text-[9px] font-mono text-white/45 mt-1">{t('Best run in this range')}</div>
            </div>
          </div>
        )}
      </div>

      {summaryPeriod === 'daily' && weeklyDailyData.length > 0 && (
        <div className="mt-2 rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
          <ConsistencyMap
            weeklyDailyData={weeklyDailyData}
            metricColor={metricColor}
            weeklyMetric={weeklyMetric}
          />
        </div>
      )}
    </div>
  );
};
