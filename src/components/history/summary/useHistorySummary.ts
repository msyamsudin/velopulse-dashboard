import { useMemo } from 'react';
import { useI18n } from '@/i18n';
import type {
  ComparisonSummary,
  HistoryChartPoint,
  MetricKey,
  WeeklyLoadPoint,
} from '@/lib/history-types';
import type { TrainingLoadMetrics } from '@/lib/training-load';
import { metricConfigByKey, METRIC_OPTIONS, type MetricOption, type SummaryPeriod, type SummaryRange } from './constants';
import { formatChartMetric } from './format';

export type HistoryChartDataPoint = HistoryChartPoint & {
  scaledValues: Record<MetricKey, number>;
  showMainLabel: boolean;
  showSubLabel: boolean;
};

export interface AverageLine {
  value: number;
  pct: number;
  label: string;
  config: MetricOption;
}

export interface LoadRatioDot {
  color: string;
  isPast: boolean;
  isCurrent: boolean;
}

export interface UseHistorySummaryInput {
  summaryPeriod: SummaryPeriod;
  summaryRange: SummaryRange;
  weeklyMetric: MetricKey;
  normalizedChartData: HistoryChartPoint[];
  loadRatioWeeklyData: WeeklyLoadPoint[];
  comparisonSummary: ComparisonSummary | null;
  trainingLoadMetrics: TrainingLoadMetrics;
}

export const useHistorySummary = (input: UseHistorySummaryInput) => {
  const { t } = useI18n();
  const {
    summaryPeriod,
    summaryRange,
    weeklyMetric,
    normalizedChartData,
    loadRatioWeeklyData,
    comparisonSummary,
    trainingLoadMetrics,
  } = input;

  const denseData = normalizedChartData.length > 45;
  const compactLabels = normalizedChartData.length > 14;
  const labelInterval = normalizedChartData.length > 60
    ? 14
    : normalizedChartData.length > 45
      ? 7
      : normalizedChartData.length > 30
        ? 5
        : normalizedChartData.length > 20
          ? 3
          : 1;
  const primaryMetric = weeklyMetric;
  const selectedMetrics = useMemo(() => [weeklyMetric], [weeklyMetric]);

  const chartData = useMemo(() => {
    const maxByMetric = selectedMetrics.reduce((acc, metric) => {
      acc[metric] = Math.max(0.001, ...normalizedChartData.map(point => Number(point[metric]) || 0));
      return acc;
    }, {} as Record<MetricKey, number>);

    return normalizedChartData.map((point, index) => {
      const hasData = Boolean(point.hasData);
      const showSubLabel = !compactLabels || (hasData && index % labelInterval === 0) || point.isHighlight;
      const showMainLabel = !compactLabels || (hasData && index % labelInterval === 0) || point.isHighlight;
      const scaledValues = {} as Record<MetricKey, number>;

      METRIC_OPTIONS.forEach(metric => {
        const key = metric.value;
        const maxMetricValue = maxByMetric[key] || 0.001;
        scaledValues[key] = Math.min(100, Math.max(0, ((Number(point[key]) || 0) / maxMetricValue) * 100));
      });

      return {
        ...point,
        scaledValues,
        showMainLabel,
        showSubLabel,
      };
    });
  }, [normalizedChartData, compactLabels, labelInterval, selectedMetrics]);

  const chartStats = useMemo(() => {
    return chartData.reduce((stats, point) => {
      const metricValue = Number(point[primaryMetric]) || 0;

      if (metricValue > stats.maxVal) stats.maxVal = metricValue;
      if (point.hasData) stats.activePeriods += 1;
      if (!stats.peakPoint || metricValue > (Number(stats.peakPoint[primaryMetric]) || 0)) {
        stats.peakPoint = point;
      }

      return stats;
    }, {
      maxVal: 0.001,
      activePeriods: 0,
      peakPoint: chartData[0],
    } as {
      maxVal: number;
      activePeriods: number;
      peakPoint: HistoryChartDataPoint | undefined;
    });
  }, [chartData, primaryMetric]);
  const unit = metricConfigByKey[primaryMetric].unit;
  const metricColor = metricConfigByKey[primaryMetric].color;
  const effectiveChartType: 'line' | 'bar' = denseData ? 'line' : 'bar';
  const activePeriods = chartStats.activePeriods;
  const averageLine = useMemo(() => {
    const activePoints = chartData.filter(point => point.hasData);
    if (activePoints.length === 0) return null;

    const averageValue = activePoints.reduce((total, point) => total + (Number(point[primaryMetric]) || 0), 0) / activePoints.length;
    const maxMetricValue = Math.max(0.001, ...chartData.map(point => Number(point[primaryMetric]) || 0));

    return {
      value: averageValue,
      pct: Math.min(100, Math.max(0, (averageValue / maxMetricValue) * 100)),
      label: formatChartMetric(primaryMetric, averageValue),
      config: metricConfigByKey[primaryMetric],
    };
  }, [chartData, primaryMetric]);
  const peakPoint = chartStats.peakPoint;
  const periodLabel = t(summaryPeriod === 'daily'
    ? 'Daily Trends'
    : summaryPeriod === 'weekly'
      ? 'Weekly Trends'
      : summaryPeriod === 'monthly'
        ? 'Monthly Trends'
        : 'Yearly Trends');
  const rangeLabel = t(summaryRange === '7d'
    ? '7 days'
    : summaryRange === '30d'
      ? '30 days'
      : summaryRange === '90d'
        ? '90 days'
        : summaryRange === '1y'
          ? '1 year'
          : 'all time');
  // Training-load delta reused by the ratio delta badge in Load Guidance.
  const trainingLoadDelta = comparisonSummary?.deltas.trimp;
  const loadRatio = trainingLoadMetrics.acuteChronicRatio;
  const loadRatioValue = loadRatio ?? 0;
  const loadRatioNeedle = Math.min(100, Math.max(0, (loadRatioValue / 2) * 100));
  const loadRatioStatus = loadRatio === null
    ? t('No baseline')
    : loadRatio < 0.8
      ? t('Low')
      : loadRatio <= 1.3
        ? t('Balanced')
        : loadRatio <= 1.5
          ? t('Elevated')
          : t('High');
  const loadRatioDelta = trainingLoadDelta?.hasBaseline && typeof trainingLoadDelta.value === 'number'
    ? `${trainingLoadDelta.direction === 'up' ? '+' : trainingLoadDelta.direction === 'down' ? '-' : ''}${Math.abs(trainingLoadDelta.value)}%`
    : '--';
  // Four rolling weeks (acute week last) over the same 28-day span the ratio
  // uses, so the chart's last bar equals the acute load shown beside it.
  const loadRatioChartData = loadRatioWeeklyData;
  const loadRatioChartMax = Math.max(
    ...loadRatioChartData.map(point => point.trimp),
    trainingLoadMetrics.chronicLoad,
    1
  );
  const loadRatioDotCount = 37;
  const loadRatioActiveDot = Math.round((loadRatioNeedle / 100) * (loadRatioDotCount - 1));
  const loadRatioDots: LoadRatioDot[] = Array.from({ length: loadRatioDotCount }, (_, index) => {
    const progress = index / (loadRatioDotCount - 1);
    const zoneColor = progress <= 0.4
      ? '#5da8ff'
      : progress <= 0.65
        ? '#35f0bd'
        : progress <= 0.75
          ? '#f5c542'
          : '#f05252';

    return {
      color: zoneColor,
      isPast: loadRatio !== null && index <= loadRatioActiveDot,
      isCurrent: loadRatio !== null && index === loadRatioActiveDot,
    };
  });
  const loadAnalysisSummary = loadRatio === null
    ? t('There is not enough baseline data yet.')
    : loadRatio < 0.8
      ? t('This week is lighter than your usual training load.')
      : loadRatio <= 1.3
        ? t('This week is close to your usual training load.')
        : loadRatio <= 1.5
          ? t('This week is above your usual load, so avoid another sharp increase.')
          : t('This week is much higher than your usual load, so recovery should be prioritized.');
  const loadAnalysisDetail = loadRatio === null
    ? t('Keep adding easy sessions so the app can build a reliable 3-week baseline.')
    : loadRatio < 0.8
      ? t('If you feel recovered, you can build gradually; avoid jumping straight into a very hard week.')
      : loadRatio <= 1.3
        ? t('The load is balanced. A controlled next session is more useful than chasing a bigger spike.')
        : loadRatio <= 1.5
          ? t('Your recent load is ramping up. Keep volume steady and watch sleep, soreness, and fatigue.')
          : t('The recent load spike is large. Prefer rest or an easy session unless you feel clearly recovered.');
  const loadAnalysisText = loadRatio === null
    ? t('This week is {acute} TRIMP, but the usual-week baseline is still not stable.', {
      acute: trainingLoadMetrics.acuteLoad,
    })
    : t('This week is {acute} TRIMP versus your usual {chronic} TRIMP, so your load ratio is {ratio}.', {
      acute: trainingLoadMetrics.acuteLoad,
      chronic: trainingLoadMetrics.chronicLoad,
      ratio: loadRatio.toFixed(2),
    });

  return {
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
    loadRatio,
    loadRatioStatus,
    loadRatioDelta,
    loadRatioChartData,
    loadRatioChartMax,
    loadRatioDots,
    loadAnalysisSummary,
    loadAnalysisDetail,
    loadAnalysisText,
  };
};
