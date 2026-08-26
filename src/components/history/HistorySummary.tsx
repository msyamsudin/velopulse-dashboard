import type { TrainingLoadMetrics } from '@/lib/training-load';
import type { ComparisonSummary, DailySummaryDay, GlobalSummary, HistoryChartPoint, MetricKey, SummaryInsights, WorkoutSession } from '@/lib/history-types';
import type { SummaryPeriod, SummaryRange } from './summary/constants';
import { useHistorySummary } from './summary/useHistorySummary';
import { SummaryHeader } from './summary/SummaryHeader';
import { QuickStats } from './summary/QuickStats';
import { AutoInsights } from './summary/AutoInsights';
import { PersonalRecords } from './summary/PersonalRecords';
import { TrendChart } from './summary/TrendChart';
import { TrainingLoadOverview } from './summary/TrainingLoadOverview';
import { LoadGuidance } from './summary/LoadGuidance';
import { HeartRateRecovery } from './summary/HeartRateRecovery';
import { SummaryInsightsCard } from './summary/SummaryInsights';

export interface HistorySummaryProps {
  sessions: WorkoutSession[];
  onSelectSession?: (id: string) => void;
  globalSummary: GlobalSummary | null;
  summaryPeriod: SummaryPeriod;
  setSummaryPeriod: (period: SummaryPeriod) => void;
  summaryRange: SummaryRange;
  setSummaryRange: (range: SummaryRange) => void;
  weeklyMetric: MetricKey;
  setWeeklyMetric: (metric: MetricKey) => void;
  normalizedChartData: HistoryChartPoint[];
  weeklyDailyData: DailySummaryDay[];
  summaryInsights: SummaryInsights | null;
  comparisonSummary: ComparisonSummary | null;
  trainingLoadMetrics: TrainingLoadMetrics;
}

export const HistorySummary = ({
  sessions,
  onSelectSession,
  globalSummary,
  summaryPeriod,
  setSummaryPeriod,
  summaryRange,
  setSummaryRange,
  weeklyMetric,
  setWeeklyMetric,
  normalizedChartData,
  weeklyDailyData,
  summaryInsights,
  comparisonSummary,
  trainingLoadMetrics,
}: HistorySummaryProps) => {
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
    autoInsights,
    recordSessions,
    personalRecords,
    trainingLoadChange,
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
    sessions,
    globalSummary,
    summaryPeriod,
    summaryRange,
    weeklyMetric,
    normalizedChartData,
    weeklyDailyData,
    summaryInsights,
    comparisonSummary,
    trainingLoadMetrics,
  });

  // Guard placed after the hook so hook order stays stable across renders.
  if (!globalSummary) return null;

  return (
    <div className="pb-8 flex flex-col gap-4">
      <SummaryHeader
        summaryRange={summaryRange}
        setSummaryRange={setSummaryRange}
      />

      <QuickStats
        summaryInsights={summaryInsights}
        metricColor={metricColor}
      />

      {autoInsights.length > 0 && (
        <AutoInsights
          autoInsights={autoInsights}
          rangeLabel={rangeLabel}
        />
      )}

      <PersonalRecords
        personalRecords={personalRecords}
        onSelectSession={onSelectSession}
        rangeLabel={rangeLabel}
        recordCount={recordSessions.length}
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

      <TrainingLoadOverview
        globalSummary={globalSummary}
        trainingLoadChange={trainingLoadChange}
        comparisonLabel={comparisonSummary?.label ?? ''}
        rangeLabel={rangeLabel}
      />

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

      <SummaryInsightsCard
        comparisonSummary={comparisonSummary}
        summaryInsights={summaryInsights}
        summaryPeriod={summaryPeriod}
        weeklyDailyData={weeklyDailyData}
        rangeLabel={rangeLabel}
        metricColor={metricColor}
        weeklyMetric={weeklyMetric}
      />
    </div>
  );
};
