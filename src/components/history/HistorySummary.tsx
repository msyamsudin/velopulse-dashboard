import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Activity, Download, Trophy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, LabelList } from 'recharts';
import { generateSummaryInsights, getInsightToneClasses, getPersonalRecords } from '../../lib/workout-analysis';
import { downloadSummaryCSV, downloadSummaryJSON, printSummaryPDF } from '../../lib/export-service';

type MetricKey = 'distance' | 'calories' | 'duration' | 'cadence';

interface HistorySummaryProps {
  sessions: any[];
  onSelectSession?: (id: string) => void;
  globalSummary: any;
  showTotals: boolean;
  setShowTotals: (show: boolean) => void;
  summaryPeriod: string;
  setSummaryPeriod: (period: any) => void;
  summaryRange: '7d' | '30d' | '90d' | '1y' | 'all';
  setSummaryRange: (range: '7d' | '30d' | '90d' | '1y' | 'all') => void;
  chartType: 'bar' | 'line';
  setChartType: (type: 'bar' | 'line') => void;
  weeklyMetric: MetricKey;
  setWeeklyMetric: (metric: any) => void;
  normalizedChartData: any[];
  weeklyDailyData: Array<{
    date: string;
    label: string;
    shortDate: string;
    distance: number;
    calories: number;
    durationSeconds: number;
    sessions: number;
    isToday: boolean;
    hasData: boolean;
  }>;
  summaryInsights: {
    avgDistancePerSession: string;
    avgDurationPerSession: string;
    bestPeriodLabel: string;
    bestPeriodDistance: string;
    lastWorkoutLabel: string;
    activeDaysLabel: string;
    currentStreakLabel: string;
    longestStreakLabel: string;
    activeSpanLabel: string;
  } | null;
  comparisonSummary: {
    label: string;
    headline: string;
    metrics: {
      distance: number;
      calories: number;
      duration: number;
      sessions: number;
    };
    deltas: {
      distance: { value: number | null; direction: 'up' | 'down' | 'flat'; hasBaseline: boolean };
      calories: { value: number | null; direction: 'up' | 'down' | 'flat'; hasBaseline: boolean };
      duration: { value: number | null; direction: 'up' | 'down' | 'flat'; hasBaseline: boolean };
      sessions: { value: number | null; direction: 'up' | 'down' | 'flat'; hasBaseline: boolean };
    };
  } | null;
  offsetDays: number;
  setOffsetDays: (offset: number) => void;
}

export const HistorySummary = ({
  sessions,
  onSelectSession,
  globalSummary,
  showTotals,
  setShowTotals,
  summaryPeriod,
  setSummaryPeriod,
  summaryRange,
  setSummaryRange,
  chartType,
  setChartType,
  weeklyMetric,
  setWeeklyMetric,
  normalizedChartData,
  weeklyDailyData,
  summaryInsights,
  comparisonSummary,
  offsetDays,
  setOffsetDays
}: HistorySummaryProps) => {
  const [recordRange, setRecordRange] = useState<'30d' | '90d' | 'all'>('all');
  const [averageDisplayMode, setAverageDisplayMode] = useState<'hidden' | 'primary' | 'all'>('primary');
  const [averageStyle, setAverageStyle] = useState<'flat' | 'moving'>('flat');
  const [chartValueMode, setChartValueMode] = useState<'period' | 'cumulative'>('period');
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([weeklyMetric]);

  if (!globalSummary) return null;

  const rangeOptions = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'ALL' },
  ] as const;

  const denseData = normalizedChartData.length > 45;
  const barScrollable = normalizedChartData.length > 14;
  const compactLabels = normalizedChartData.length > 20;
  const metricOptions = [
    { value: 'distance', label: 'KM', name: 'Distance', unit: 'km', color: '#00d2ff', colorRgba: '0,210,255' },
    { value: 'calories', label: 'KCAL', name: 'Calories', unit: 'kcal', color: '#f472b6', colorRgba: '244,114,182' },
    { value: 'duration', label: 'MIN', name: 'Duration', unit: 'min', color: '#fbbf24', colorRgba: '251,191,36' },
    { value: 'cadence', label: 'RPM', name: 'Cadence', unit: 'rpm', color: '#00ffaa', colorRgba: '0,255,170' },
  ] as const;
  const metricConfigByKey = metricOptions.reduce((acc, option) => {
    acc[option.value] = option;
    return acc;
  }, {} as Record<MetricKey, typeof metricOptions[number]>);
  const hasSelectedMetrics = selectedMetrics.length > 0;
  const primaryMetric = selectedMetrics.includes(weeklyMetric) ? weeklyMetric : selectedMetrics[0] ?? weeklyMetric;
  const formatChartMetric = (metric: MetricKey, value: number) => metric === 'distance' ? value.toFixed(1) : `${Math.round(value)}`;
  const toggleSelectedMetric = (metric: MetricKey) => {
    if (selectedMetrics.includes(metric)) {
      const next = selectedMetrics.filter(item => item !== metric);
      setSelectedMetrics(next);

      if (metric === weeklyMetric && next[0]) {
        setWeeklyMetric(next[0]);
      }
      return;
    }

    setSelectedMetrics([...selectedMetrics, metric]);
    setWeeklyMetric(metric);
  };
  const chartData = useMemo(() => {
    const cumulativeTotals = metricOptions.reduce((acc, metric) => {
      acc[metric.value] = 0;
      return acc;
    }, {} as Record<MetricKey, number>);
    let cumulativeCadenceTotal = 0;
    let cumulativeCadenceCount = 0;
    const runningAverageTotals = metricOptions.reduce((acc, metric) => {
      acc[metric.value] = 0;
      return acc;
    }, {} as Record<MetricKey, number>);
    const runningAverageCounts = metricOptions.reduce((acc, metric) => {
      acc[metric.value] = 0;
      return acc;
    }, {} as Record<MetricKey, number>);

    const mappedData = normalizedChartData.map((point, index) => {
      const hasData = Boolean(point.hasData);
      const showSubLabel = !compactLabels || hasData || point.isHighlight;
      const showMainLabel = !compactLabels || hasData || point.isHighlight || index % 3 === 0;
      const metricValues = {} as Record<MetricKey, number>;
      const cumulativeValues = {} as Record<MetricKey, number>;
      const displayValues = {} as Record<MetricKey, number>;
      const averageTrendValues = {} as Record<MetricKey, number | null>;

      metricOptions.forEach(metric => {
        const key = metric.value;
        const metricValue = Number(point[key]) || 0;
        metricValues[key] = metricValue;
        cumulativeTotals[key] += metricValue;

        if (key === 'cadence' && hasData) {
          cumulativeCadenceTotal += metricValue;
          cumulativeCadenceCount += 1;
        }

        const cumulativeValue = key === 'cadence'
          ? cumulativeCadenceCount > 0 ? cumulativeCadenceTotal / cumulativeCadenceCount : 0
          : cumulativeTotals[key];
        const displayValue = chartValueMode === 'cumulative' ? cumulativeValue : metricValue;
        let averageTrendValue: number | null = null;

        if (hasData) {
          runningAverageTotals[key] += displayValue;
          runningAverageCounts[key] += 1;
          averageTrendValue = runningAverageTotals[key] / runningAverageCounts[key];
        }

        cumulativeValues[key] = cumulativeValue;
        displayValues[key] = displayValue;
        averageTrendValues[key] = averageTrendValue;
      });

      return {
        ...point,
        metricValues,
        cumulativeValues,
        displayValues,
        averageTrendValues,
        metricValue: metricValues[primaryMetric],
        cumulativeValue: cumulativeValues[primaryMetric],
        displayValue: displayValues[primaryMetric],
        averageTrendValue: averageTrendValues[primaryMetric],
        metricLabel: formatChartMetric(primaryMetric, metricValues[primaryMetric]),
        cumulativeLabel: formatChartMetric(primaryMetric, cumulativeValues[primaryMetric]),
        displayMetricLabel: formatChartMetric(primaryMetric, displayValues[primaryMetric]),
        averageTrendLabel: averageTrendValues[primaryMetric] === null ? '' : formatChartMetric(primaryMetric, averageTrendValues[primaryMetric] ?? 0),
        showMainLabel,
        showSubLabel,
      };
    });

    const maxByMetric = selectedMetrics.reduce((acc, metric) => {
      acc[metric] = Math.max(0.001, ...mappedData.map(point => point.displayValues[metric] || 0));
      return acc;
    }, {} as Record<MetricKey, number>);

    const rollingValues = metricOptions.reduce((acc, metric) => {
      acc[metric.value] = [];
      return acc;
    }, {} as Record<MetricKey, number[]>);

    return mappedData.map(point => {
      const scaledValues = {} as Record<MetricKey, number>;
      const movingAverageValues = {} as Record<MetricKey, number | null>;
      const movingAverageScaledValues = {} as Record<MetricKey, number | null>;

      metricOptions.forEach(metric => {
        const key = metric.value;
        const maxMetricValue = maxByMetric[key] || 0.001;
        scaledValues[key] = Math.min(100, Math.max(0, ((point.displayValues[key] || 0) / maxMetricValue) * 100));

        if (point.hasData) {
          rollingValues[key].push(point.displayValues[key] || 0);
          const windowValues = rollingValues[key].slice(-3);
          const movingAverageValue = windowValues.reduce((total, value) => total + value, 0) / windowValues.length;
          movingAverageValues[key] = movingAverageValue;
          movingAverageScaledValues[key] = Math.min(100, Math.max(0, (movingAverageValue / maxMetricValue) * 100));
        } else {
          movingAverageValues[key] = null;
          movingAverageScaledValues[key] = null;
        }
      });

      return {
        ...point,
        scaledValues,
        movingAverageValues,
        movingAverageScaledValues,
      };
    });
  }, [normalizedChartData, compactLabels, chartValueMode, primaryMetric, selectedMetrics]);
  const chartStats = useMemo(() => {
    return chartData.reduce((stats, point) => {
      const metricValue = point.displayValues[primaryMetric] || 0;

      if (metricValue > stats.maxVal) stats.maxVal = metricValue;
      if (point.hasData) {
        stats.activePeriods += 1;
        stats.averageTotal += metricValue;
        stats.averageCount += 1;
      }
      if (!stats.peakPoint || metricValue > (stats.peakPoint.displayValues[primaryMetric] || 0)) {
        stats.peakPoint = point;
      }

      return stats;
    }, {
      maxVal: 0.001,
      activePeriods: 0,
      averageTotal: 0,
      averageCount: 0,
      peakPoint: chartData[0],
    } as {
      maxVal: number;
      activePeriods: number;
      averageTotal: number;
      averageCount: number;
      peakPoint: typeof chartData[number] | undefined;
    });
  }, [chartData, primaryMetric]);
  const unit = metricConfigByKey[primaryMetric].unit;
  const metricColor = metricConfigByKey[primaryMetric].color;
  const metricColorRgba = metricConfigByKey[primaryMetric].colorRgba;
  const effectiveChartType = denseData && chartType === 'bar' ? 'line' : chartType;
  const activePeriods = chartStats.activePeriods;
  const averageMetrics = averageDisplayMode === 'hidden'
    ? []
    : averageDisplayMode === 'primary'
      ? hasSelectedMetrics ? [primaryMetric] : []
      : selectedMetrics;
  const averageLines = useMemo(() => {
    return averageMetrics
      .map(metric => {
        const activePoints = chartData.filter(point => point.hasData);
        if (activePoints.length === 0) return null;

        const averageValue = activePoints.reduce((total, point) => total + (point.displayValues[metric] || 0), 0) / activePoints.length;
        const maxMetricValue = Math.max(0.001, ...chartData.map(point => point.displayValues[metric] || 0));

        return {
          metric,
          value: averageValue,
          pct: Math.min(100, Math.max(0, (averageValue / maxMetricValue) * 100)),
          label: formatChartMetric(metric, averageValue),
          config: metricConfigByKey[metric],
        };
      })
      .filter((line): line is {
        metric: MetricKey;
        value: number;
        pct: number;
        label: string;
        config: typeof metricOptions[number];
      } => line !== null);
  }, [averageMetrics, chartData]);
  const movingAverageLines = useMemo(() => {
    if (averageStyle !== 'moving') return [];

    return averageMetrics
      .map(metric => {
        const activePoints = chartData
          .map((point, index) => ({
            index,
            value: point.movingAverageScaledValues[metric],
          }))
          .filter((point): point is { index: number; value: number } => typeof point.value === 'number');

        if (activePoints.length === 0) return null;

        const denominator = Math.max(chartData.length - 1, 1);
        const lastPoint = activePoints[activePoints.length - 1];
        const lastRawValue = chartData[lastPoint.index]?.movingAverageValues[metric] ?? 0;
        const points = activePoints
          .map(point => {
            const x = (point.index / denominator) * 100;
            const y = 100 - Math.min(100, Math.max(0, point.value));
            return `${x},${y}`;
          })
          .join(' ');

        return {
          metric,
          points,
          lastIndex: lastPoint.index,
          lastX: (lastPoint.index / denominator) * 100,
          lastY: 100 - Math.min(100, Math.max(0, lastPoint.value)),
          label: formatChartMetric(metric, lastRawValue),
          config: metricConfigByKey[metric],
        };
      })
      .filter((line): line is {
        metric: MetricKey;
        points: string;
        lastIndex: number;
        lastX: number;
        lastY: number;
        label: string;
        config: typeof metricOptions[number];
      } => line !== null);
  }, [averageMetrics, averageStyle, chartData]);
  const peakPoint = chartStats.peakPoint;
  const chartSummaryPoint = chartValueMode === 'cumulative' ? chartData[chartData.length - 1] : peakPoint;
  const chartValueModeLabel = chartValueMode === 'cumulative'
    ? hasSelectedMetrics
      ? selectedMetrics.includes('cadence') ? 'running total / avg' : 'running total'
      : 'no metrics'
    : selectedMetrics.length > 1 ? 'multi metric' : hasSelectedMetrics ? primaryMetric : 'no metrics';
  const periodLabel = summaryPeriod === 'daily'
    ? 'Daily Trends'
    : summaryPeriod === 'weekly'
      ? 'Weekly Trends'
      : summaryPeriod === 'monthly'
        ? 'Monthly Trends'
        : 'Yearly Trends';
  const rangeLabel = summaryRange === '7d'
    ? '7 days'
    : summaryRange === '30d'
      ? '30 days'
    : summaryRange === '90d'
      ? '90 days'
      : summaryRange === '1y'
        ? '1 year'
        : 'all time';
  const periodOptions = ['daily', 'weekly', 'monthly', 'yearly'] as const;
  const shiftDays = summaryRange === '7d' ? 7 : summaryRange === '30d' ? 30 : summaryRange === '90d' ? 90 : summaryRange === '1y' ? 365 : 0;
  const autoInsights = useMemo(() => generateSummaryInsights({
    comparisonSummary,
    summaryInsights,
    globalSummary,
    weeklyDailyData,
    rangeLabel,
  }), [comparisonSummary, summaryInsights, globalSummary, weeklyDailyData, rangeLabel]);
  const recordRangeOptions = [
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: 'all', label: 'ALL' },
  ] as const;
  const recordSessions = useMemo(() => {
    if (recordRange === 'all') return sessions;

    const days = recordRange === '30d' ? 30 : 90;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    return sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return !Number.isNaN(sessionDate.getTime()) && sessionDate >= start;
    });
  }, [sessions, recordRange]);
  const personalRecords = useMemo(() => getPersonalRecords(recordSessions), [recordSessions]);

  return (
    <div className="pb-8 flex flex-col gap-4">
      {globalSummary.hrrSessions > 0 && (
        <div className="hardware-card border-emerald-400/20 bg-emerald-400/5 p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-emerald-400/10 pb-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-2">
                <Activity size={12} />
                Heart Rate Recovery
              </div>
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">
                Recovery scores from workouts in the selected range
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">
              {globalSummary.hrrSessions}/{globalSummary.totalSessions} sessions
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">Avg HRR</div>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-300 tabular-nums">
                {globalSummary.avgHrr} <span className="text-[10px] font-normal text-white/40">BPM</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">Best HRR</div>
              <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                {globalSummary.bestHrr} <span className="text-[10px] font-normal text-white/40">BPM</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">Coverage</div>
              <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                {Math.round((globalSummary.hrrSessions / Math.max(1, globalSummary.totalSessions)) * 100)}
                <span className="text-[10px] font-normal text-white/40">%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTotals && summaryInsights && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">Avg / Session</div>
            <div className="mt-1 text-sm font-bold font-mono text-white">{summaryInsights.avgDistancePerSession} <span className="text-[9px] text-hw-muted">KM</span></div>
            <div className="text-[9px] font-mono text-white/45">{summaryInsights.avgDurationPerSession}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">Best Period</div>
            <div className="mt-1 text-sm font-bold font-mono" style={{ color: metricColor }}>{summaryInsights.bestPeriodDistance} <span className="text-[9px] text-white/40">KM</span></div>
            <div className="text-[9px] font-mono text-white/45">{summaryInsights.bestPeriodLabel}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">Current Streak</div>
            <div className="mt-1 text-sm font-bold font-mono text-white">{summaryInsights.currentStreakLabel}</div>
            <div className="text-[9px] font-mono text-white/45">{summaryInsights.activeDaysLabel} active</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">Active Span</div>
            <div className="mt-1 text-sm font-bold font-mono text-white">{summaryInsights.activeSpanLabel}</div>
            <div className="text-[9px] font-mono text-white/45">First to latest</div>
          </div>
        </div>
      )}

      {autoInsights.length > 0 && (
        <div className="hardware-card border-hw-muted/20 p-4 bg-black/20">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Automatic Insights</div>
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">Generated from range trends and consistency</div>
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
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="hardware-card border-hw-muted/20 p-4 bg-black/20">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted flex items-center gap-2">
                <Trophy size={12} className="text-yellow-300" />
                Personal Records
              </div>
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">Best efforts from the selected period</div>
            </div>
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
              {recordRangeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setRecordRange(option.value)}
                  className={`rounded-md px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-widest transition-colors ${recordRange === option.value ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {personalRecords.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {personalRecords.map(record => (
                <button
                  key={record.title}
                  onClick={() => onSelectSession?.(record.sessionId)}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-hw-accent/40 hover:bg-hw-accent/5"
                >
                  <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-hw-muted">{record.title}</div>
                  <div className="mt-1 text-lg font-bold font-mono text-white tabular-nums">
                    {record.value} <span className="text-[10px] font-normal text-white/35">{record.unit}</span>
                  </div>
                  <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-hw-accent/70">{record.dateLabel}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">No records in this period</div>
            </div>
          )}
          <div className="mt-3 text-[9px] font-mono uppercase tracking-[0.16em] text-white/35">
            {recordSessions.length} sessions in record scope
          </div>
        </div>

        <div className="hardware-card border-hw-muted/20 p-4 bg-black/20 self-start">
          <div className="mb-4 border-b border-white/5 pb-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted flex items-center gap-2">
              <Download size={12} className="text-hw-accent" />
              Summary Export
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">Download session report data</div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => downloadSummaryCSV(sessions)}
              disabled={sessions.length === 0}
              className="rounded-lg border border-hw-accent/30 bg-hw-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-hw-accent transition-colors hover:bg-hw-accent hover:text-hw-bg disabled:pointer-events-none disabled:opacity-40"
            >
              Export CSV
            </button>
            <button
              onClick={() => downloadSummaryJSON(sessions)}
              disabled={sessions.length === 0}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:pointer-events-none disabled:opacity-40"
            >
              Export JSON
            </button>
            <button
              onClick={() => printSummaryPDF(sessions)}
              disabled={sessions.length === 0}
              className="rounded-lg border border-yellow-400/25 bg-yellow-400/10 px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-yellow-200 transition-colors hover:bg-yellow-400 hover:text-black disabled:pointer-events-none disabled:opacity-40"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-4">
        <div className="hardware-card border-hw-muted/20 p-5 flex flex-col bg-black/25">
          <div className="mb-5 flex flex-col gap-4 border-b border-white/5 pb-5">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-hw-accent/10 border border-hw-accent/25">
                  <Activity size={14} className="text-hw-accent" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-hw-muted uppercase font-mono tracking-[0.2em]">Training Progress</div>
                  <div className="text-white font-bold text-sm font-mono mt-0.5">
                    {periodLabel}
                    <span className="ml-2 text-[10px] font-normal text-hw-accent/80">
                      {activePeriods} active periods in {rangeLabel}
                    </span>
                  </div>
                  {denseData && (
                    <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.16em] text-hw-muted">
                      Dense timeline detected. Showing line view for readability.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {summaryRange !== 'all' && (
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
                    <button
                      onClick={() => setOffsetDays(offsetDays + shiftDays)}
                      className="p-1 hover:bg-white/10 rounded transition-colors text-white/60 hover:text-white"
                      title="Previous Period"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <div className="min-w-20 px-2 text-center text-[8px] font-mono uppercase text-white/45 tracking-widest border-x border-white/5">
                      {offsetDays === 0 ? 'Current' : `${offsetDays}d back`}
                    </div>
                    <button
                      onClick={() => setOffsetDays(Math.max(0, offsetDays - shiftDays))}
                      disabled={offsetDays === 0}
                      className={`p-1 rounded transition-colors ${offsetDays === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                      title="Next Period"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowTotals(!showTotals)}
                  className={`rounded-lg border px-3 py-2 text-[9px] font-mono uppercase tracking-widest transition-colors ${showTotals ? 'border-hw-accent/40 bg-hw-accent/10 text-hw-accent' : 'border-white/10 bg-white/5 text-white/45 hover:text-white'}`}
                >
                  {showTotals ? 'Compact' : 'Totals'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-3">
              <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Timeline</div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-2">
                  <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-white/8 bg-black/20">
                    {periodOptions.map(p => (
                      <button
                        key={p}
                        onClick={() => setSummaryPeriod(p)}
                        className={`px-2.5 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${summaryPeriod === p ? 'bg-white/10 text-white' : 'text-hw-muted hover:text-white'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-white/8 bg-black/20">
                    {rangeOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSummaryRange(option.value)}
                        className={`px-2.5 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${summaryRange === option.value ? 'bg-white/10 text-white' : 'text-hw-muted hover:text-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 xl:min-w-[560px]">
                <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Display</div>
                <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)_174px_120px_76px] gap-2">
                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/8 bg-black/20">
                    <button
                      onClick={() => setChartType('bar')}
                      className={`px-2.5 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${chartType === 'bar' ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                      title={denseData ? 'Dense ranges are displayed as line view automatically' : undefined}
                    >
                      BAR
                    </button>
                    <button
                      onClick={() => setChartType('line')}
                      className={`px-2.5 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${chartType === 'line' ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                    >
                      LINE
                    </button>
                  </div>

                  <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-white/8 bg-black/20">
                    {metricOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => toggleSelectedMetric(option.value)}
                        className={`px-2.5 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${selectedMetrics.includes(option.value) ? 'text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                        style={selectedMetrics.includes(option.value) ? { backgroundColor: option.color } : undefined}
                        title={`Toggle ${option.name}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-white/8 bg-black/20" title="Average line display mode">
                    {[
                      { value: 'hidden', label: 'OFF' },
                      { value: 'primary', label: 'PRIMARY' },
                      { value: 'all', label: 'ALL' },
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setAverageDisplayMode(option.value as typeof averageDisplayMode)}
                        className={`px-2 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${averageDisplayMode === option.value ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/8 bg-black/20" title="Average line style">
                    {[
                      { value: 'flat', label: 'FLAT' },
                      { value: 'moving', label: 'MOVING' },
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setAverageStyle(option.value as typeof averageStyle)}
                        className={`px-2 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${averageStyle === option.value ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setChartValueMode(chartValueMode === 'period' ? 'cumulative' : 'period')}
                    className={`rounded-lg border px-2.5 py-2 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${chartValueMode === 'cumulative' ? 'border-hw-accent/40 bg-hw-accent text-hw-bg' : 'border-white/8 bg-black/20 text-hw-muted hover:text-white'}`}
                    title={selectedMetrics.includes('cadence') ? 'Cadence uses running average in total mode' : 'Show running total progress'}
                  >
                    TOTAL
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedMetrics.map(metric => {
                    const config = metricConfigByKey[metric];
                    return (
                      <button
                        key={metric}
                        onClick={() => setWeeklyMetric(metric)}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[8px] font-mono uppercase tracking-[0.14em] transition-colors ${weeklyMetric === metric ? 'border-white/35 bg-white/10 text-white' : 'border-white/8 text-white/45 hover:text-white'}`}
                        title={`Use ${config.name} as the primary summary metric`}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.color }} />
                        {config.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {effectiveChartType === 'line' ? (
            <div className="mt-2 min-h-[260px] h-[clamp(260px,40vh,420px)] w-full">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-4 py-2.5">
                <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.16em] text-white/60">
                  <span>{activePeriods} active periods</span>
                  <span>{effectiveChartType} view</span>
                  <span>{chartValueModeLabel}</span>
                </div>
                {hasSelectedMetrics && chartSummaryPoint && (
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
                    {chartValueMode === 'cumulative' ? 'Current' : 'Peak'}: <span style={{ color: metricColor }} className="font-bold">{formatChartMetric(primaryMetric, chartSummaryPoint.displayValues[primaryMetric] || 0)}</span> {unit} on {chartSummaryPoint.displayLabel} {chartSummaryPoint.subLabel}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={1}>
                <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />
                  <YAxis hide domain={[0, 100]} />
                  <XAxis
                    dataKey="displayLabel"
                    stroke="#ffffff50"
                    fontSize={10}
                    tickMargin={10}
                    axisLine={false}
                    tickLine={false}
                    interval={compactLabels ? 'preserveStartEnd' : 0}
                  />
                  <Tooltip
                    cursor={{ stroke: '#ffffff30', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const point = payload[0].payload;
                        return (
                          <div className="bg-[#1a1a1a] border border-white/10 px-4 py-3 rounded shadow-xl">
                            <div className="text-[10px] uppercase font-mono text-hw-muted mt-1">{point.displayLabel} {point.subLabel}</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-[10px] font-mono uppercase">
                              {selectedMetrics.map(metric => {
                                const config = metricConfigByKey[metric];
                                return (
                                  <div key={metric} className="contents">
                                    <div style={{ color: config.color }}>{config.name}</div>
                                    <div className="text-right text-white">
                                      {formatChartMetric(metric, point.displayValues[metric] || 0)} <span className="text-[8px] opacity-40">{config.unit}</span>
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="text-white/50">{chartValueMode === 'cumulative' ? 'Cumulative' : 'Period'}</div>
                              <div className="text-right text-white">{selectedMetrics.length} metric{selectedMetrics.length > 1 ? 's' : ''}</div>
                              <div className="text-white/50">Sessions</div>
                              <div className="text-right text-white">{point.sessions}</div>
                              <div className="text-white/50">Distance</div>
                              <div className="text-right text-white">{point.distance?.toFixed?.(1) ?? point.distance} <span className="text-[8px] opacity-40">km</span></div>
                              <div className="text-white/50">Duration</div>
                              <div className="text-right text-white">{point.duration} <span className="text-[8px] opacity-40">min</span></div>
                              <div className="text-white/50">Calories</div>
                              <div className="text-right text-white">{point.calories} <span className="text-[8px] opacity-40">kcal</span></div>
                              <div className="text-white/50">Cadence</div>
                              <div className="text-right text-white">{point.cadence} <span className="text-[8px] opacity-40">rpm</span></div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {averageStyle === 'flat' && averageLines.map((line, index) => (
                    <ReferenceLine
                      key={line.metric}
                      y={line.pct}
                      stroke={line.config.color}
                      strokeDasharray="5 5"
                      strokeOpacity={line.metric === primaryMetric ? 0.72 : 0.46}
                      ifOverflow="extendDomain"
                      label={index < 3 ? {
                        value: `AVG ${line.config.label} ${line.label}`,
                        position: index % 2 === 0 ? 'insideTopRight' : 'insideTopLeft',
                        fill: line.config.color,
                        fontSize: 10,
                        fontFamily: 'monospace'
                      } : undefined}
                    />
                  ))}
                  {averageStyle === 'moving' && movingAverageLines.map(line => (
                    <Line
                      key={`moving-${line.metric}`}
                      type="monotone"
                      dataKey={(point) => point.movingAverageScaledValues[line.metric]}
                      name={`${line.config.name} Moving Avg`}
                      stroke={line.config.color}
                      strokeWidth={line.metric === primaryMetric ? 1.4 : 1}
                      strokeDasharray="6 5"
                      dot={false}
                      activeDot={false}
                      connectNulls
                      isAnimationActive={false}
                    >
                      <LabelList
                        content={(props: any) => {
                          if (props.index !== line.lastIndex) return null;
                          const x = Number(props.x ?? 0);
                          const y = Number(props.y ?? 0);
                          return (
                            <g transform={`translate(${x - 6}, ${y - 8})`}>
                              <rect
                                x={-78}
                                y={-10}
                                width={74}
                                height={18}
                                rx={4}
                                fill="rgba(0,0,0,0.76)"
                                stroke="rgba(255,255,255,0.12)"
                              />
                              <text
                                x={-41}
                                y={3}
                                textAnchor="middle"
                                fill={line.config.color}
                                fontSize={10}
                                fontFamily="monospace"
                              >
                                {`MOV ${line.config.label} ${line.label}`}
                              </text>
                            </g>
                          );
                        }}
                      />
                    </Line>
                  ))}
                  {selectedMetrics.map(metric => {
                    const config = metricConfigByKey[metric];
                    return (
                      <Line
                        key={metric}
                        type="monotone"
                        dataKey={(point) => point.scaledValues[metric] || 0}
                        name={config.name}
                        stroke={config.color}
                        strokeWidth={metric === primaryMetric ? 3 : 2}
                        dot={denseData ? false : { r: 4, strokeWidth: 2, fill: '#1a1a1a', stroke: config.color }}
                        activeDot={{ r: 6, fill: config.color, stroke: '#fff', strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-4 py-2.5">
                <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.16em] text-white/60">
                  <span>{activePeriods} active periods</span>
                  <span>{effectiveChartType} view</span>
                  <span>{chartValueModeLabel}</span>
                </div>
                {hasSelectedMetrics && chartSummaryPoint && (
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
                    {chartValueMode === 'cumulative' ? 'Current' : 'Peak'}: <span style={{ color: metricColor }} className="font-bold">{formatChartMetric(primaryMetric, chartSummaryPoint.displayValues[primaryMetric] || 0)}</span> {unit} on {chartSummaryPoint.displayLabel} {chartSummaryPoint.subLabel}
                  </div>
                )}
              </div>
              <div className="relative flex items-end gap-2 min-h-[260px] h-[clamp(260px,40vh,420px)] w-full overflow-x-auto custom-scrollbar pb-2 pr-2">
                {averageStyle === 'flat' && averageLines.map((line, index) => (
                  <div
                    key={line.metric}
                    className="pointer-events-none absolute left-0 right-2 z-10 border-t border-dashed"
                    style={{
                      bottom: `${line.pct}%`,
                      borderColor: line.config.color,
                      opacity: line.metric === primaryMetric ? 0.76 : 0.48,
                    }}
                  >
                    {index < 3 && (
                      <div
                        className={`absolute -top-5 rounded-md border border-white/10 bg-black/75 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] ${index % 2 === 0 ? 'right-0' : 'left-0'}`}
                        style={{ color: line.config.color }}
                      >
                        AVG {line.config.label} {line.label}
                      </div>
                    )}
                  </div>
                ))}
                {averageStyle === 'moving' && movingAverageLines.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-x-0 top-0 z-10 h-full pr-2"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {movingAverageLines.map(line => (
                      <polyline
                        key={line.metric}
                        points={line.points}
                        fill="none"
                        stroke={line.config.color}
                        strokeOpacity={line.metric === primaryMetric ? 0.72 : 0.46}
                        strokeWidth={line.metric === primaryMetric ? '1.1' : '0.8'}
                        strokeDasharray="5 4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                )}
                {averageStyle === 'moving' && movingAverageLines.map((line, index) => (
                  <div
                    key={`moving-label-${line.metric}`}
                    className="pointer-events-none absolute z-20 rounded-md border border-white/10 bg-black/75 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]"
                    style={{
                      left: `${line.lastX}%`,
                      top: `${line.lastY}%`,
                      color: line.config.color,
                      transform: `translate(-100%, calc(-50% + ${(index % 3) * 18 - 18}px))`,
                    }}
                  >
                    MOV {line.config.label} {line.label}
                  </div>
                ))}
                {chartData.map((day) => {
                  return (
                    <div key={day.date} className="flex flex-col items-center justify-end gap-1.5 group h-full snap-end" style={{ minWidth: barScrollable ? '46px' : '0', flex: barScrollable ? '0 0 46px' : '1 1 0' }}>
                      <div className={`text-[9px] font-mono tabular-nums transition-all duration-200 ${day.hasData ? 'text-white/70 group-hover:text-white' : 'text-transparent'}`}>
                        {day.hasData
                          ? selectedMetrics.length === 0 ? '' : selectedMetrics.length === 1 ? formatChartMetric(primaryMetric, day.displayValues[primaryMetric] || 0) : `${selectedMetrics.length}x`
                          : ''}
                      </div>

                      <div className="w-full relative flex items-end gap-1 h-full max-h-full">
                        <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden w-48 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-[10px] font-mono uppercase shadow-xl group-hover:block pointer-events-none">
                          <div className="text-white/60">{day.displayLabel} {day.subLabel}</div>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                            {selectedMetrics.map(metric => {
                              const config = metricConfigByKey[metric];
                              return (
                                <div key={metric} className="contents">
                                  <div style={{ color: config.color }}>{config.name}</div>
                                  <div className="text-right text-white">{formatChartMetric(metric, day.displayValues[metric] || 0)} {config.unit}</div>
                                </div>
                              );
                            })}
                            <div className="text-white/40">Sessions</div>
                            <div className="text-right text-white">{day.sessions}</div>
                            <div className="text-white/40">Distance</div>
                            <div className="text-right text-white">{day.distance.toFixed(1)} km</div>
                            <div className="text-white/40">Duration</div>
                            <div className="text-right text-white">{day.duration} min</div>
                            <div className="text-white/40">Calories</div>
                            <div className="text-right text-white">{day.calories} kcal</div>
                            <div className="text-white/40">Cadence</div>
                            <div className="text-right text-white">{day.cadence} rpm</div>
                          </div>
                        </div>
                        {selectedMetrics.map(metric => {
                          const config = metricConfigByKey[metric];
                          const pct = (day.scaledValues[metric] || 0) / 100;
                          return (
                            <div key={metric} className="flex-1 relative h-full min-w-0">
                              <div className="absolute bottom-0 w-full" style={{ height: `${pct * 100}%`, minHeight: day.hasData ? '4px' : '2px' }}>
                                {day.hasData ? (
                                  <div
                                    className="w-full h-full rounded-t-md transition-all duration-500 group-hover:opacity-90"
                                    style={{
                                      background: day.isHighlight ? config.color : `rgba(${config.colorRgba},0.42)`,
                                      borderTop: `1px solid rgba(${config.colorRgba},0.3)`,
                                      borderLeft: `1px solid rgba(${config.colorRgba},0.3)`,
                                      borderRight: `1px solid rgba(${config.colorRgba},0.3)`,
                                      boxShadow: day.isHighlight && metric === primaryMetric ? `0 0 12px rgba(${config.colorRgba},0.5)` : 'none',
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full rounded-t-sm"
                                    style={{
                                      background: 'rgba(255,255,255,0.04)',
                                      borderTop: '1px solid rgba(255,255,255,0.06)',
                                      borderLeft: '1px solid rgba(255,255,255,0.06)',
                                      borderRight: '1px solid rgba(255,255,255,0.06)'
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

                      <div className={`text-[9px] font-mono font-bold uppercase tracking-wider mt-0.5 ${day.isHighlight ? 'text-white' : day.hasData ? 'text-white/50' : 'text-white/20'
                        }`} style={day.isHighlight ? { color: metricColor } : {}}>
                        {day.showMainLabel ? day.displayLabel : ''}
                      </div>

                      <div className={`text-[8px] font-mono ${day.hasData ? 'text-white/25' : 'text-white/10'}`}>
                        {day.showSubLabel ? day.subLabel : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        <div className="hardware-card border-hw-muted/20 p-5 flex flex-col bg-black/25">
          <div className="flex items-center justify-between gap-3 mb-4 border-b border-white/5 pb-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Summary Insights</div>
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">
                {comparisonSummary?.headline ?? 'Contextual stats for the selected range'}
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
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">Range Comparison</div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">{comparisonSummary.label}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { key: 'distance', label: 'Distance', unit: 'km' },
                    { key: 'sessions', label: 'Sessions', unit: '' },
                    { key: 'duration', label: 'Duration', unit: 'min' },
                    { key: 'calories', label: 'Calories', unit: 'kcal' },
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
                        <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-hw-muted">{item.label}</div>
                        <div className="mt-1 text-sm font-bold font-mono text-white">
                          {item.key === 'distance' ? metric.toFixed(1) : Math.round(metric)}
                          {item.unit && <span className="ml-1 text-[9px] text-white/35">{item.unit}</span>}
                        </div>
                        <div className={`mt-1 text-[9px] font-mono uppercase tracking-[0.12em] ${deltaColor}`}>
                          {delta.hasBaseline
                            ? `${delta.direction === 'up' ? '+' : delta.direction === 'down' ? '' : ''}${delta.value}%`
                            : metric > 0
                              ? 'new'
                              : 'none'}
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
                  <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Avg / Session</div>
                  <div className="mt-1 text-base font-bold font-mono text-white">{summaryInsights.avgDistancePerSession} <span className="text-[9px] text-hw-muted">KM</span></div>
                  <div className="text-[9px] font-mono text-white/45 mt-1">{summaryInsights.avgDurationPerSession}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                  <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Best Period</div>
                  <div className="mt-1 text-base font-bold font-mono" style={{ color: metricColor }}>{summaryInsights.bestPeriodDistance} <span className="text-[9px] text-white/40">KM</span></div>
                  <div className="text-[9px] font-mono text-white/45 mt-1">{summaryInsights.bestPeriodLabel}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                  <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Last Workout</div>
                  <div className="mt-1 text-base font-bold font-mono text-white">{summaryInsights.lastWorkoutLabel}</div>
                  <div className="text-[9px] font-mono text-white/45 mt-1">Latest in range</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                  <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Current Streak</div>
                  <div className="mt-1 text-base font-bold font-mono text-white">{summaryInsights.currentStreakLabel}</div>
                  <div className="text-[9px] font-mono text-white/45 mt-1">{summaryInsights.activeDaysLabel} active</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                  <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Longest Streak</div>
                  <div className="mt-1 text-base font-bold font-mono text-white">{summaryInsights.longestStreakLabel}</div>
                  <div className="text-[9px] font-mono text-white/45 mt-1">Best run in this range</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                  <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Active Span</div>
                  <div className="mt-1 text-base font-bold font-mono text-white">{summaryInsights.activeSpanLabel}</div>
                  <div className="text-[9px] font-mono text-white/45 mt-1">First to latest</div>
                </div>
              </div>
            )}
          </div>

          {summaryPeriod === 'daily' && weeklyDailyData.length > 0 && (
            <div className="mt-2 rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
              {(() => {
                const extendedHeatmap = summaryRange === '30d' || summaryRange === '90d' || summaryRange === 'all';

                // Align days correctly for the heatmap grid
                const firstDayDate = weeklyDailyData.length > 0 ? new Date(weeklyDailyData[0].date) : null;
                const offset = firstDayDate ? firstDayDate.getDay() : 0;
                const paddedData = firstDayDate
                  ? [...Array(offset).fill(null), ...weeklyDailyData]
                  : weeklyDailyData;

                const groupedWeeks = paddedData.reduce<Array<any[]>>((weeks, day, index) => {
                  const weekIndex = Math.floor(index / 7);
                  if (!weeks[weekIndex]) weeks[weekIndex] = [];
                  weeks[weekIndex].push(day);
                  return weeks;
                }, []);

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">Consistency Map</div>
                        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/40 mt-1">daily activity pattern</div>
                      </div>
                      <div className="flex items-center gap-2 text-[8px] font-mono uppercase tracking-[0.12em] text-white/35">
                        <span>low</span>
                        {[0.12, 0.28, 0.48, 0.72].map(opacity => (
                          <span
                            key={opacity}
                            className="h-3 w-3 rounded-[4px] border"
                            style={{
                              background: `rgba(${metricColorRgba},${opacity})`,
                              borderColor: `rgba(${metricColorRgba},${Math.min(0.8, opacity + 0.12)})`
                            }}
                          />
                        ))}
                        <span>high</span>
                      </div>
                    </div>
                    {extendedHeatmap ? (
                      <div className="flex flex-col gap-2">
                        {groupedWeeks.map((week, weekIndex) => (
                          <div key={`week-${weekIndex}`} className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] items-center gap-2">
                            <div className="text-[8px] font-mono uppercase text-white/30">
                              W{weekIndex + 1}
                            </div>
                            {Array.from({ length: 7 }).map((_, dayIndex) => {
                              const day = week[dayIndex];
                              if (!day) {
                                return <div key={`empty-${weekIndex}-${dayIndex}`} className="h-6 rounded-md bg-white/2" />;
                              }

                              const intensity = Math.max(
                                day.sessions,
                                weeklyMetric === 'distance' ? day.distance : weeklyMetric === 'calories' ? day.calories / 100 : weeklyMetric === 'duration' ? day.durationSeconds / 900 : 0
                              );
                              const opacity = day.hasData ? Math.min(0.95, 0.2 + intensity * 0.12) : 0.08;
                              const tooltipValue = weeklyMetric === 'distance'
                                ? `${day.distance.toFixed(1)} km`
                                : weeklyMetric === 'calories'
                                  ? `${day.calories} kcal`
                                  : weeklyMetric === 'duration'
                                    ? `${Math.round(day.durationSeconds / 60)} min`
                                    : `${day.sessions} sessions`;

                              return (
                                <div key={day.date} className="group relative flex flex-col items-center gap-1">
                                  <div
                                    className="h-6 w-full rounded-md border transition-all"
                                    style={{
                                      background: day.hasData
                                        ? `rgba(${metricColorRgba},${opacity})`
                                        : 'rgba(255,255,255,0.04)',
                                      borderColor: day.isToday
                                        ? `rgba(${metricColorRgba},0.75)`
                                        : day.hasData
                                          ? `rgba(${metricColorRgba},0.28)`
                                          : 'rgba(255,255,255,0.06)',
                                      boxShadow: day.isToday ? `0 0 0 1px rgba(${metricColorRgba},0.35)` : 'none'
                                    }}
                                    title={`${day.label} ${day.shortDate} - ${day.sessions} sessions`}
                                  />
                                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-32 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111] px-2.5 py-2 text-[9px] font-mono uppercase shadow-xl group-hover:block">
                                    <div className="text-white/55">{day.label} {day.shortDate}</div>
                                    <div className="mt-1 text-white">{day.sessions} sessions</div>
                                    <div className="mt-1" style={{ color: metricColor }}>{tooltipValue}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                        <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-2">
                          <div />
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-[8px] font-mono uppercase text-white/25">{day}</div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 md:grid-cols-7 gap-2">
                        {weeklyDailyData.map(day => {
                          const intensity = Math.max(
                            day.sessions,
                            weeklyMetric === 'distance' ? day.distance : weeklyMetric === 'calories' ? day.calories / 100 : weeklyMetric === 'duration' ? day.durationSeconds / 900 : 0
                          );
                          const opacity = day.hasData ? Math.min(0.95, 0.2 + intensity * 0.12) : 0.08;
                          const tooltipValue = weeklyMetric === 'distance'
                            ? `${day.distance.toFixed(1)} km`
                            : weeklyMetric === 'calories'
                              ? `${day.calories} kcal`
                              : weeklyMetric === 'duration'
                                ? `${Math.round(day.durationSeconds / 60)} min`
                                : `${day.sessions} sessions`;

                          return (
                            <div key={day.date} className="group relative flex flex-col items-center gap-1.5">
                              <div className="text-[8px] font-mono uppercase text-white/35">{day.label.slice(0, 3)}</div>
                              <div
                                className="h-9 w-full rounded-lg border transition-all"
                                style={{
                                  background: day.hasData
                                    ? `rgba(${metricColorRgba},${opacity})`
                                    : 'rgba(255,255,255,0.04)',
                                  borderColor: day.isToday
                                    ? `rgba(${metricColorRgba},0.75)`
                                    : day.hasData
                                      ? `rgba(${metricColorRgba},0.28)`
                                      : 'rgba(255,255,255,0.06)',
                                  boxShadow: day.isToday ? `0 0 0 1px rgba(${metricColorRgba},0.35)` : 'none'
                                }}
                                title={`${day.label} ${day.shortDate} - ${day.sessions} sessions`}
                              />
                              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-32 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111] px-2.5 py-2 text-[9px] font-mono uppercase shadow-xl group-hover:block">
                                <div className="text-white/55">{day.label} {day.shortDate}</div>
                                <div className="mt-1 text-white">{day.sessions} sessions</div>
                                <div className="mt-1" style={{ color: metricColor }}>{tooltipValue}</div>
                              </div>
                              <div className="text-[8px] font-mono text-white/25">{day.shortDate}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
