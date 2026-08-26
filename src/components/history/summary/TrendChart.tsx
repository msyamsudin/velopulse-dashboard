import { Activity } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { MetricKey } from '@/lib/history-types';
import { METRIC_OPTIONS, PERIOD_OPTIONS, type SummaryPeriod } from './constants';
import type { AverageLine, HistoryChartDataPoint } from './useHistorySummary';
import { TrendBarChart } from './TrendBarChart';
import { TrendLineChart } from './TrendLineChart';

interface TrendChartProps {
  summaryPeriod: SummaryPeriod;
  setSummaryPeriod: (period: SummaryPeriod) => void;
  weeklyMetric: MetricKey;
  setWeeklyMetric: (metric: MetricKey) => void;
  chartData: HistoryChartDataPoint[];
  denseData: boolean;
  compactLabels: boolean;
  labelInterval: number;
  activePeriods: number;
  peakPoint?: HistoryChartDataPoint;
  averageLine: AverageLine | null;
  unit: string;
  metricColor: string;
  periodLabel: string;
  rangeLabel: string;
  primaryMetric: MetricKey;
  selectedMetrics: MetricKey[];
  effectiveChartType: 'line' | 'bar';
}

export const TrendChart = ({
  summaryPeriod,
  setSummaryPeriod,
  weeklyMetric,
  setWeeklyMetric,
  chartData,
  denseData,
  compactLabels,
  labelInterval,
  activePeriods,
  peakPoint,
  averageLine,
  unit,
  metricColor,
  periodLabel,
  rangeLabel,
  primaryMetric,
  selectedMetrics,
  effectiveChartType,
}: TrendChartProps) => {
  const { t } = useI18n();

  return (
    <div className="hardware-card border-hw-muted/20 p-5 flex flex-col bg-black/25">
      <div className="mb-5 flex flex-col gap-4 border-b border-white/5 pb-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-hw-accent/10 border border-hw-accent/25">
              <Activity size={14} className="text-hw-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Training Progress')}</div>
              <div className="text-white font-bold text-sm font-mono mt-0.5">
                {periodLabel}
                <span className="ml-2 text-[10px] font-normal text-hw-accent/80">
                  {t('{count} active periods in {range}', { count: activePeriods, range: rangeLabel })}
                </span>
              </div>
              {denseData && (
                <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.16em] text-hw-muted">
                  {t('Dense timeline detected. Showing line view for readability.')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-16 shrink-0 text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Timeline')}</div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="grid min-w-[220px] flex-1 grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-px overflow-hidden rounded-lg border border-white/8 bg-white/8 sm:max-w-md">
                {PERIOD_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSummaryPeriod(p)}
                    className={`min-w-0 whitespace-nowrap bg-black/80 px-2 py-2 text-[9px] font-mono uppercase tracking-[0.08em] font-bold transition-all ${summaryPeriod === p ? 'bg-white/10 text-white' : 'text-hw-muted hover:bg-black/60 hover:text-white'}`}
                  >
                    {t(p)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-white/6" />

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-16 shrink-0 text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Metric')}</div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="grid min-w-[260px] flex-1 grid-cols-5 overflow-hidden rounded-lg border border-white/8 bg-black/20 sm:max-w-md">
                {METRIC_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setWeeklyMetric(option.value)}
                    className={`px-2.5 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${weeklyMetric === option.value ? 'text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                    style={weeklyMetric === option.value ? { backgroundColor: option.color } : undefined}
                    title={`Show ${option.name}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {effectiveChartType === 'line' ? (
        <TrendLineChart
          chartData={chartData}
          activePeriods={activePeriods}
          peakPoint={peakPoint}
          averageLine={averageLine}
          unit={unit}
          metricColor={metricColor}
          primaryMetric={primaryMetric}
          selectedMetrics={selectedMetrics}
          denseData={denseData}
          compactLabels={compactLabels}
          labelInterval={labelInterval}
        />
      ) : (
        <TrendBarChart
          chartData={chartData}
          denseData={denseData}
          compactLabels={compactLabels}
          activePeriods={activePeriods}
          peakPoint={peakPoint}
          averageLine={averageLine}
          unit={unit}
          metricColor={metricColor}
          primaryMetric={primaryMetric}
          selectedMetrics={selectedMetrics}
        />
      )}
    </div>
  );
};
