import type { MetricKey } from '@/lib/history-types';

export type SummaryPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type SummaryRange = '7d' | '30d' | '90d' | '1y' | 'all';

export const RECORD_RANGE_DAYS: Record<SummaryRange, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  'all': null,
};

export const RANGE_OPTIONS: readonly { value: SummaryRange; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'ALL' },
];

export const PERIOD_OPTIONS: readonly SummaryPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

export interface MetricOption {
  value: MetricKey;
  label: string;
  name: string;
  unit: string;
  color: string;
  colorRgba: string;
}

export const METRIC_OPTIONS: readonly MetricOption[] = [
  { value: 'distance', label: 'KM', name: 'Distance', unit: 'km', color: '#00d2ff', colorRgba: '0,210,255' },
  { value: 'calories', label: 'KCAL', name: 'Calories', unit: 'kcal', color: '#f472b6', colorRgba: '244,114,182' },
  { value: 'duration', label: 'MIN', name: 'Duration', unit: 'min', color: '#fbbf24', colorRgba: '251,191,36' },
  { value: 'cadence', label: 'RPM', name: 'Cadence', unit: 'rpm', color: '#00ffaa', colorRgba: '0,255,170' },
  { value: 'trimp', label: 'TRIMP', name: 'Training Load', unit: 'pts', color: '#c084fc', colorRgba: '192,132,252' },
];

export const metricConfigByKey = METRIC_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option;
  return acc;
}, {} as Record<MetricKey, MetricOption>);
