import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { TrainingLoadMetrics } from '@/lib/training-load';
import type { ComparisonSummary, DailySummaryDay, GlobalSummary, HistoryChartPoint, MetricKey, SummaryInsights, WeeklyLoadPoint } from '@/lib/history-types';
import type { SummaryPeriod, SummaryRange } from './summary/constants';
import { useHistorySummary } from './summary/useHistorySummary';
import { SummaryHeader } from './summary/SummaryHeader';
import { RangeTotals } from './summary/RangeTotals';
import { TrendChart } from './summary/TrendChart';
import { LoadGuidance } from './summary/LoadGuidance';
import { HeartRateRecovery } from './summary/HeartRateRecovery';
import { ConsistencyMap } from './summary/ConsistencyMap';

export interface HistorySummaryProps {
  globalSummary: GlobalSummary | null;
  summaryPeriod: SummaryPeriod;
  setSummaryPeriod: (period: SummaryPeriod) => void;
  summaryRange: SummaryRange;
  setSummaryRange: (range: SummaryRange) => void;
  weeklyMetric: MetricKey;
  setWeeklyMetric: (metric: MetricKey) => void;
  normalizedChartData: HistoryChartPoint[];
  weeklyDailyData: DailySummaryDay[];
  loadRatioWeeklyData: WeeklyLoadPoint[];
  summaryInsights: SummaryInsights | null;
  comparisonSummary: ComparisonSummary | null;
  trainingLoadMetrics: TrainingLoadMetrics;
}

const capitalize = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

/**
 * Summary view — four working blocks plus one collapsed detail:
 *   1. RangeTotals      totals + deltas + per-session caption
 *   2. TrendChart       one metric over one timeline
 *   3. LoadGuidance     load, ratio, guidance
 *   4. HeartRateRecovery
 *   (collapsed) ConsistencyMap
 *
 * The header (and with it the only range selector) renders unconditionally, so
 * an empty range can never trap the user on a blank page. Personal records and
 * milestones live in the Records tab; nothing is deleted, only relocated.
 */
export const HistorySummary = ({
  globalSummary,
  summaryPeriod,
  setSummaryPeriod,
  summaryRange,
  setSummaryRange,
  weeklyMetric,
  setWeeklyMetric,
  normalizedChartData,
  weeklyDailyData,
  loadRatioWeeklyData,
  summaryInsights,
  comparisonSummary,
  trainingLoadMetrics,
}: HistorySummaryProps) => {
  const { t } = useI18n();
  const {
    denseData,
    compactLabels,
    labelInterval,
    primaryMetric,
    selectedMetrics,
    chartData,
    unit,
    metricColor,
    effectiveChartType,
    activePeriods,
    averageLine,
    peakPoint,
    periodLabel,
    rangeLabel,
    baselineDelta,
    baselineDeltaLabel,
    loadRatio,
    loadRatioStatus,
    loadRatioDelta,
    loadRatioChartData,
    loadRatioChartMax,
    loadRatioDots,
    loadAnalysisSummary,
    loadAnalysisDetail,
    loadAnalysisText,
  } = useHistorySummary({
    summaryPeriod,
    summaryRange,
    weeklyMetric,
    normalizedChartData,
    loadRatioWeeklyData,
    comparisonSummary,
    trainingLoadMetrics,
  });

  // Guard placed after the hook so hook order stays stable across renders.
  if (!globalSummary) {
    return (
      <div className="pb-8 flex flex-col gap-4">
        <SummaryHeader
          summaryRange={summaryRange}
          setSummaryRange={setSummaryRange}
          sessionCount={0}
          rangeLabel={rangeLabel}
          headline={t('No sessions in this range')}
        />
        <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">
            {t('Try a wider range or record a workout')}
          </div>
        </div>
      </div>
    );
  }

  // One sentence for the header: the range comparison followed by the current
  // load readout. The insight engine that used to feed this line is gone —
  // every number it described (deltas, averages, streak, volume) now lives in
  // RangeTotals directly below, so a second phrasing would only duplicate it.
  const comparisonSentence = comparisonSummary
    ? `${comparisonSummary.headline} ${comparisonSummary.label}`
    : '';
  const headline = capitalize(
    [comparisonSentence, loadAnalysisSummary].filter(Boolean).join(' · ')
  );

  return (
    <div className="pb-8 flex flex-col gap-4">
      <SummaryHeader
        summaryRange={summaryRange}
        setSummaryRange={setSummaryRange}
        sessionCount={globalSummary.totalSessions}
        rangeLabel={rangeLabel}
        headline={headline}
      />

      <RangeTotals
        globalSummary={globalSummary}
        comparisonSummary={comparisonSummary}
        summaryInsights={summaryInsights}
      />

      <TrendChart
        summaryPeriod={summaryPeriod}
        setSummaryPeriod={setSummaryPeriod}
        weeklyMetric={weeklyMetric}
        setWeeklyMetric={setWeeklyMetric}
        chartData={chartData}
        denseData={denseData}
        compactLabels={compactLabels}
        labelInterval={labelInterval}
        activePeriods={activePeriods}
        peakPoint={peakPoint}
        averageLine={averageLine}
        unit={unit}
        metricColor={metricColor}
        periodLabel={periodLabel}
        rangeLabel={rangeLabel}
        primaryMetric={primaryMetric}
        selectedMetrics={selectedMetrics}
        effectiveChartType={effectiveChartType}
      />

      {summaryPeriod === 'daily' && weeklyDailyData.length > 0 && (
        <details className="group rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
          <summary className="vp-focus-ring flex cursor-pointer list-none items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">
            <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
            {t('Consistency Map')}
            <span className="tracking-[0.12em] text-white/25">
              {t('Daily activity pattern for the selected range')}
            </span>
          </summary>
          <div className="mt-4">
            <ConsistencyMap
              weeklyDailyData={weeklyDailyData}
              metricColor={metricColor}
              weeklyMetric={weeklyMetric}
              embedded
            />
          </div>
        </details>
      )}

      <LoadGuidance
        trainingLoadMetrics={trainingLoadMetrics}
        loadRatio={loadRatio}
        baselineDelta={baselineDelta}
        baselineDeltaLabel={baselineDeltaLabel}
        loadRatioStatus={loadRatioStatus}
        loadRatioDelta={loadRatioDelta}
        loadRatioDots={loadRatioDots}
        loadRatioChartData={loadRatioChartData}
        loadRatioChartMax={loadRatioChartMax}
        loadAnalysisText={loadAnalysisText}
        loadAnalysisSummary={loadAnalysisSummary}
        loadAnalysisDetail={loadAnalysisDetail}
      />

      {globalSummary.hrrSessions > 0 && (
        <HeartRateRecovery globalSummary={globalSummary} />
      )}
    </div>
  );
};
