import type { DailySummaryDay, MetricKey } from '@/lib/history-types';

export const formatChartMetric = (metric: MetricKey, value: number) =>
  metric === 'distance' ? value.toFixed(1) : `${Math.round(value)}`;

export const formatDailyMetric = (day: DailySummaryDay, weeklyMetric: MetricKey) => {
  if (weeklyMetric === 'distance') return `${day.distance.toFixed(1)} km`;
  if (weeklyMetric === 'calories') return `${day.calories} kcal`;
  if (weeklyMetric === 'duration') return `${Math.round(day.durationSeconds / 60)} min`;
  if (weeklyMetric === 'trimp') return `${day.trimp.toFixed(1)} pts`;
  return `${day.sessions} sessions`;
};
