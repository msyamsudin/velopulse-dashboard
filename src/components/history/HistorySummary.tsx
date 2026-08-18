import { useMemo } from 'react';
import { Activity, Trophy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { generateSummaryInsights, getInsightToneClasses, getPersonalRecords } from '../../lib/workout-analysis';
import type { TrainingLoadMetrics } from '../../lib/training-load';
import type { ComparisonSummary, DailySummaryDay, GlobalSummary, HistoryChartPoint, MetricKey, SummaryInsights, WorkoutSession } from '../../lib/history-types';
import { useI18n } from '../../i18n';

interface HistorySummaryProps {
  sessions: WorkoutSession[];
  onSelectSession?: (id: string) => void;
  globalSummary: GlobalSummary | null;
  summaryPeriod: string;
  setSummaryPeriod: (period: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
  summaryRange: '7d' | '30d' | '90d' | '1y' | 'all';
  setSummaryRange: (range: '7d' | '30d' | '90d' | '1y' | 'all') => void;
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
  trainingLoadMetrics
}: HistorySummaryProps) => {
  const { locale, t } = useI18n();

  const rangeOptions = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'ALL' },
  ] as const;

  const denseData = normalizedChartData.length > 45;
  const compactLabels = normalizedChartData.length > 14;
  const ultraDense = normalizedChartData.length > 45;
  const labelInterval = normalizedChartData.length > 60
    ? 14
    : normalizedChartData.length > 45
      ? 7
      : normalizedChartData.length > 30
        ? 5
        : normalizedChartData.length > 20
          ? 3
          : 1;
  const metricOptions = [
    { value: 'distance', label: 'KM', name: 'Distance', unit: 'km', color: '#00d2ff', colorRgba: '0,210,255' },
    { value: 'calories', label: 'KCAL', name: 'Calories', unit: 'kcal', color: '#f472b6', colorRgba: '244,114,182' },
    { value: 'duration', label: 'MIN', name: 'Duration', unit: 'min', color: '#fbbf24', colorRgba: '251,191,36' },
    { value: 'cadence', label: 'RPM', name: 'Cadence', unit: 'rpm', color: '#00ffaa', colorRgba: '0,255,170' },
    { value: 'trimp', label: 'TRIMP', name: 'Training Load', unit: 'pts', color: '#c084fc', colorRgba: '192,132,252' },
  ] as const;
  const metricConfigByKey = metricOptions.reduce((acc, option) => {
    acc[option.value] = option;
    return acc;
  }, {} as Record<MetricKey, typeof metricOptions[number]>);
  const primaryMetric = weeklyMetric;
  const selectedMetrics = [weeklyMetric];
  const formatChartMetric = (metric: MetricKey, value: number) => metric === 'distance' ? value.toFixed(1) : `${Math.round(value)}`;
  const formatDailyMetric = (day: DailySummaryDay) => {
    if (weeklyMetric === 'distance') return `${day.distance.toFixed(1)} km`;
    if (weeklyMetric === 'calories') return `${day.calories} kcal`;
    if (weeklyMetric === 'duration') return `${Math.round(day.durationSeconds / 60)} min`;
    if (weeklyMetric === 'trimp') return `${day.trimp.toFixed(1)} pts`;
    return `${day.sessions} sessions`;
  };

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

      metricOptions.forEach(metric => {
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
      peakPoint: typeof chartData[number] | undefined;
    });
  }, [chartData, primaryMetric]);
  const unit = metricConfigByKey[primaryMetric].unit;
  const metricColor = metricConfigByKey[primaryMetric].color;
  const effectiveChartType = denseData ? 'line' : 'bar';
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
  const periodOptions = ['daily', 'weekly', 'monthly', 'yearly'] as const;
  const autoInsights = useMemo(() => generateSummaryInsights({
    comparisonSummary,
    summaryInsights,
    globalSummary,
    weeklyDailyData,
    rangeLabel,
    translate: t,
  }), [comparisonSummary, summaryInsights, globalSummary, weeklyDailyData, rangeLabel, t]);
  const recordRange: '30d' | '90d' | 'all' = summaryRange === '90d' ? '90d' : summaryRange === '1y' || summaryRange === 'all' ? 'all' : '30d';
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
  const personalRecords = useMemo(() => getPersonalRecords(recordSessions, locale), [recordSessions, locale]);
  const trainingLoadDelta = comparisonSummary?.deltas.trimp;
  const trainingLoadChange = trainingLoadDelta?.hasBaseline
    ? `${trainingLoadDelta.direction === 'up' ? '+' : ''}${trainingLoadDelta.value}%`
    : (globalSummary?.totalTrainingLoad ?? 0) > 0 ? t('New baseline') : t('No load');
  const baselineDelta = trainingLoadMetrics.chronicLoad > 0
    ? Math.round(((trainingLoadMetrics.acuteLoad - trainingLoadMetrics.chronicLoad) / trainingLoadMetrics.chronicLoad) * 100)
    : null;
  const baselineDeltaLabel = baselineDelta === null
    ? '--'
    : `${baselineDelta > 0 ? '+' : ''}${baselineDelta}%`;
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
  const loadRatioChartData = weeklyDailyData.slice(-7);
  const loadRatioChartMax = Math.max(
    ...loadRatioChartData.map(day => day.trimp),
    trainingLoadMetrics.chronicLoad,
    1
  );
  const loadRatioDotCount = 37;
  const loadRatioActiveDot = Math.round((loadRatioNeedle / 100) * (loadRatioDotCount - 1));
  const loadRatioDots = Array.from({ length: loadRatioDotCount }, (_, index) => {
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
    ? t('Keep adding easy sessions so the app can build a reliable 28-day baseline.')
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

  // Guard placed after all hooks so hook order stays stable across renders.
  if (!globalSummary) return null;

  return (
    <div className="pb-8 flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-accent">
            {t('Summary')}
          </div>
          <div className="mt-1 text-[11px] text-white/50">
            {t('Overview, trends, and training load')}
          </div>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-white/10 bg-black/20">
          {rangeOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSummaryRange(option.value)}
              className={`px-2.5 py-2 text-[9px] font-mono font-bold uppercase tracking-widest transition-colors ${summaryRange === option.value ? 'bg-white/10 text-white' : 'text-hw-muted hover:text-white'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

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

      {autoInsights.length > 0 && (
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
      )}

      <div className="hardware-card border-hw-muted/20 p-4 bg-black/20">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted flex items-center gap-2">
              <Trophy size={12} className="text-yellow-300" />
              {t('Personal Records')}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">{t('Best efforts from the selected period')}</div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">{rangeLabel}</div>
        </div>
        {personalRecords.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {personalRecords.map(record => (
              <button
                key={record.title}
                onClick={() => onSelectSession?.(record.sessionId)}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-hw-accent/40 hover:bg-hw-accent/5"
              >
                <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-hw-muted">{t(record.title)}</div>
                <div className="mt-1 text-lg font-bold font-mono text-white tabular-nums">
                  {record.value} <span className="text-[10px] font-normal text-white/35">{record.unit}</span>
                </div>
                <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-hw-accent/70">{t(record.dateLabel)}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
            <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">{t('No records in this period')}</div>
          </div>
        )}
        <div className="mt-3 text-[9px] font-mono uppercase tracking-[0.16em] text-white/35">
          {t('{count} sessions in record scope', { count: recordSessions.length })}
        </div>
      </div>

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
                  {periodOptions.map(p => (
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
                  {metricOptions.map(option => (
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
          <div className="mt-2 min-h-[260px] h-[clamp(260px,40vh,420px)] w-full">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-4 py-2.5">
              <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.16em] text-white/60">
                <span>{activePeriods} active periods</span>
                <span>{effectiveChartType} view</span>
                <span>{metricConfigByKey[primaryMetric].name}</span>
              </div>
              {peakPoint && (
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
                  {t('Peak')}: <span style={{ color: metricColor }} className="font-bold">{formatChartMetric(primaryMetric, Number(peakPoint[primaryMetric]) || 0)}</span> {unit} on {peakPoint.displayLabel} {peakPoint.subLabel}
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
                  interval={compactLabels ? labelInterval - 1 : 0}
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
                                    {formatChartMetric(metric, Number(point[metric]) || 0)} <span className="text-[8px] opacity-40">{config.unit}</span>
                                  </div>
                                </div>
                              );
                            })}
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
                {averageLine && (
                  <ReferenceLine
                    y={averageLine.pct}
                    stroke={averageLine.config.color}
                    strokeDasharray="5 5"
                    strokeOpacity={0.72}
                    ifOverflow="extendDomain"
                    label={{
                      value: `AVG ${averageLine.config.label} ${averageLine.label}`,
                      position: 'insideTopRight',
                      fill: averageLine.config.color,
                      fontSize: 10,
                      fontFamily: 'monospace'
                    }}
                  />
                )}
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
                <span>{metricConfigByKey[primaryMetric].name}</span>
              </div>
              {peakPoint && (
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
                  {t('Peak')}: <span style={{ color: metricColor }} className="font-bold">{formatChartMetric(primaryMetric, Number(peakPoint[primaryMetric]) || 0)}</span> {unit} on {peakPoint.displayLabel} {peakPoint.subLabel}
                </div>
              )}
            </div>
            <div className={`relative flex items-end min-h-[260px] h-[clamp(260px,40vh,420px)] w-full pb-2 ${ultraDense ? 'gap-px' : compactLabels ? 'gap-[2px]' : 'gap-1.5'}`}>
              {averageLine && (
                <div
                  className="pointer-events-none absolute left-0 right-2 z-10 border-t border-dashed"
                  style={{
                    bottom: `${averageLine.pct}%`,
                    borderColor: averageLine.config.color,
                    opacity: 0.76,
                  }}
                >
                  <div
                    className="absolute -top-5 right-0 rounded-md border border-white/10 bg-black/75 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em]"
                    style={{ color: averageLine.config.color }}
                  >
                    AVG {averageLine.config.label} {averageLine.label}
                  </div>
                </div>
              )}
              {chartData.map((day) => {
                return (
                  <div key={day.date} className="flex flex-col items-center group" style={{ minWidth: 0, flex: '1 1 0', height: '100%' }}>

                    <div className="w-full flex-1 min-h-0 relative flex items-end">
                      <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden w-48 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-[10px] font-mono uppercase shadow-xl group-hover:block pointer-events-none">
                        <div className="text-white/60">{day.displayLabel} {day.subLabel}</div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                          {selectedMetrics.map(metric => {
                            const config = metricConfigByKey[metric];
                            return (
                              <div key={metric} className="contents">
                                <div style={{ color: config.color }}>{config.name}</div>
                                <div className="text-right text-white">{formatChartMetric(metric, Number(day[metric]) || 0)} {config.unit}</div>
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

                      <div className="w-full h-full relative flex items-end gap-px">
                        {selectedMetrics.map(metric => {
                          const config = metricConfigByKey[metric];
                          const pct = (day.scaledValues[metric] || 0) / 100;
                          return (
                            <div key={metric} className="flex-1 h-full relative min-w-0">
                              <div
                                className="absolute bottom-0 w-full"
                                style={{ height: `${pct * 100}%`, minHeight: day.hasData ? '3px' : '0px' }}
                              >
                                {day.hasData ? (
                                  <div
                                    className="w-full h-full rounded-t-sm transition-all duration-500 group-hover:opacity-90"
                                    style={{
                                      background: day.isHighlight ? config.color : `rgba(${config.colorRgba},0.42)`,
                                      borderTop: `1px solid rgba(${config.colorRgba},0.3)`,
                                      borderLeft: `1px solid rgba(${config.colorRgba},0.3)`,
                                      borderRight: `1px solid rgba(${config.colorRgba},0.3)`,
                                      boxShadow: day.isHighlight && metric === primaryMetric ? `0 0 12px rgba(${config.colorRgba},0.5)` : 'none',
                                    }}
                                  />
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="w-full h-px shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

                    <div
                      className={`shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider mt-0.5 ${
                        day.isHighlight ? 'text-white' : day.hasData ? 'text-white/50' : 'text-white/20'
                      }`}
                      style={day.isHighlight ? { color: metricColor } : {}}
                    >
                      {day.showMainLabel ? day.displayLabel : '\u00a0'}
                    </div>

                    <div className={`shrink-0 text-[8px] font-mono leading-none ${day.hasData ? 'text-white/25' : 'text-white/10'}`}>
                      {day.showSubLabel ? day.subLabel : '\u00a0'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="hardware-card border-purple-400/20 bg-purple-400/5 p-4">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-purple-400/10 pb-3">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-purple-300">
              <Activity size={12} />
              {t('Training Load')}
            </div>
            <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-white/45">
              {t('Edwards TRIMP from heart-rate zones')}
            </div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">{rangeLabel}</div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('Period Load'), value: globalSummary.totalTrainingLoad, detail: `${globalSummary.totalSessions} ${t('sessions')}` },
            { label: t('Avg / Session'), value: globalSummary.averageTrainingLoad, detail: t('TRIMP points') },
            { label: t('7-Day Load'), value: globalSummary.sevenDayTrainingLoad, detail: t('Latest 7 days') },
            { label: t('Vs Previous'), value: trainingLoadChange, detail: comparisonSummary?.label ?? t('No comparison') },
          ].map(metric => (
            <div key={metric.label} className="rounded-xl border border-purple-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{metric.label}</div>
              <div className="mt-1 text-2xl font-bold font-mono text-purple-200 tabular-nums">{metric.value}</div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">{metric.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hardware-card border-blue-400/20 bg-blue-400/5 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-blue-400/10 pb-3">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-blue-300">
              <Activity size={12} />
              {t('Load Guidance')}
            </div>
            <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-white/45">
              {t('7-day load compared with a 28-day baseline')}
            </div>
          </div>
          <div className={`rounded border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] ${
            trainingLoadMetrics.recommendation === 'Recovery'
              ? 'border-orange-400/30 bg-orange-400/10 text-orange-300'
              : trainingLoadMetrics.recommendation === 'Build'
                ? 'border-blue-400/30 bg-blue-400/10 text-blue-300'
                : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
          }`}>
            {t(trainingLoadMetrics.recommendation)}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('This week'), value: trainingLoadMetrics.acuteLoad, detail: t('Total load in the last 7 days') },
            { label: t('Usual week'), value: trainingLoadMetrics.chronicLoad, detail: t('Your 28-day weekly baseline') },
            { label: t('Load Ratio'), value: trainingLoadMetrics.acuteChronicRatio?.toFixed(2) ?? '--', detail: t('This week / usual week') },
            { label: t('Recommendation'), value: t(trainingLoadMetrics.recommendation), detail: t('Suggested next training focus') },
          ].map(metric => (
            <div key={metric.label} className="rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{metric.label}</div>
              <div className="mt-1 text-2xl font-bold font-mono text-blue-200 tabular-nums">{metric.value}</div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">{metric.detail}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Week vs baseline')}</div>
                <div className="mt-1 text-[10px] text-white/40">{t('Compare your last 7 days with your normal training week')}</div>
              </div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-white/35">TRIMP</div>
            </div>
            <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-vp-muted">{t('Interpretation')}</div>
                <div className="font-mono text-lg font-bold text-vp-text tabular-nums">{loadRatio?.toFixed(2) ?? '--'}x</div>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/55">
                {t('A ratio near 1.0 means this week is close to your usual load. Above 1.3 means the week is ramping up.')}
              </p>
            </div>
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-blue-400/15 bg-blue-400/8 px-3 py-2">
                  <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-blue-200">{t('This week')}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg font-bold text-white tabular-nums">{trainingLoadMetrics.acuteLoad}</span>
                    <span className="text-[9px] font-mono uppercase text-white/40">TRIMP</span>
                  </div>
                </div>
                <div className="rounded-md border border-purple-400/15 bg-purple-400/8 px-3 py-2">
                  <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-purple-200">{t('Usual week')}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg font-bold text-white tabular-nums">{trainingLoadMetrics.chronicLoad}</span>
                    <span className="text-[9px] font-mono uppercase text-white/40">TRIMP</span>
                  </div>
                </div>
                <div className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-2">
                  <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-white/45">{t('Difference')}</div>
                  <span className={`font-mono text-lg font-bold tabular-nums ${
                    baselineDelta === null
                      ? 'text-white/55'
                      : baselineDelta > 30
                        ? 'text-red-200'
                        : baselineDelta > 0
                          ? 'text-yellow-200'
                          : 'text-blue-200'
                  }`}>{baselineDeltaLabel}</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/50">
                {t('This comparison only shows volume. Use Load Ratio for the training-status view.')}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-blue-400/15 bg-black/20">
            <div className="border-b border-blue-400/10 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Load Ratio')}</div>
                  <div className="mt-1 text-[10px] text-white/40">{t('Balanced zone is 0.8 to 1.3')}</div>
                </div>
                <div className="rounded-md border border-blue-400/20 bg-blue-400/8 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-blue-100">
                  {loadRatioStatus}
                </div>
              </div>

              <div className="mx-auto mt-5 max-w-[520px]">
                <div className="text-center">
                  <div className="font-mono text-4xl font-bold leading-none tabular-nums text-vp-text drop-shadow">
                    {loadRatio?.toFixed(2) ?? '--'}
                  </div>
                  <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-vp-muted">
                    {loadRatioDelta} {t('load change')}
                  </div>
                </div>

                <div className="relative mt-5 px-1" role="img" aria-label={`${t('Current load ratio')} ${loadRatio?.toFixed(2) ?? '--'}`}>
                  <div className="grid grid-cols-[repeat(37,minmax(0,1fr))] items-center gap-1.5">
                    {loadRatioDots.map((dot, index) => (
                      <div key={index} className="flex h-5 items-center justify-center">
                        <span
                          className="block rounded-full transition-all duration-300"
                          style={{
                            width: dot.isCurrent ? 14 : dot.isPast ? 9 : 7,
                            height: dot.isCurrent ? 14 : dot.isPast ? 9 : 7,
                            backgroundColor: dot.isPast ? dot.color : 'rgba(255,255,255,0.13)',
                            border: dot.isCurrent ? '2px solid #f4f7f8' : '0 solid transparent',
                            boxShadow: dot.isCurrent ? '0 0 0 6px rgba(244,247,248,0.08)' : 'none',
                            opacity: dot.isCurrent ? 1 : dot.isPast ? 0.95 : 0.75,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] font-mono text-white/45">
                    <span>0</span>
                    <span>0.8</span>
                    <span>1.3</span>
                    <span>1.5</span>
                    <span>2+</span>
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] font-mono uppercase tracking-wider text-vp-muted">
                    <span>{t('Low')}</span>
                    <span>{t('Balanced')}</span>
                    <span>{t('High')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em] text-white/45">
                <span>{t('7-day load chart')}</span>
                <span>{t('TRIMP')}</span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={loadRatioChartData} margin={{ top: 8, right: 6, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, loadRatioChartMax]} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeDasharray: '3 3' }}
                      contentStyle={{ background: '#1f2022', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff' }}
                      formatter={(value: number) => [value.toFixed(1), t('Training Load')]}
                    />
                    <ReferenceLine y={trainingLoadMetrics.chronicLoad} stroke="#a98cff" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="trimp" stroke="#5da8ff" strokeWidth={2.5} dot={{ r: 3, fill: '#35f0bd', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f4f7f8', stroke: '#5da8ff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-mono text-white/65">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vp-info" /> {t('Acute load')} <b className="float-right text-white">{trainingLoadMetrics.acuteLoad}</b>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-mono text-white/65">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vp-distance" /> {t('Chronic baseline')} <b className="float-right text-white">{trainingLoadMetrics.chronicLoad}</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Load analysis')}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.12em] text-white/38">{t('Plain-language readout')}</div>
            </div>
            <div className={`rounded border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.14em] ${
              loadRatio === null
                ? 'border-white/12 bg-white/5 text-white/55'
                : loadRatio < 0.8
                  ? 'border-blue-400/25 bg-blue-400/10 text-blue-200'
                  : loadRatio <= 1.3
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                    : loadRatio <= 1.5
                      ? 'border-yellow-400/25 bg-yellow-400/10 text-yellow-200'
                      : 'border-red-400/25 bg-red-400/10 text-red-200'
            }`}>
              {loadRatioStatus}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-vp-text">
            {loadAnalysisText} <span className="text-white/70">{loadAnalysisSummary}</span>
          </p>
          <p className="mt-2 border-t border-white/6 pt-2 text-xs leading-5 text-white/50">
            {loadAnalysisDetail}
          </p>
        </div>

        <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
          <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Practical recommendation')}</div>
          <p className="mt-2 text-sm leading-6 text-white/70">{t(trainingLoadMetrics.recommendationDetail)}</p>
          <p className="mt-2 border-t border-white/6 pt-2 text-[10px] leading-5 text-white/40">
            {t('Guidance is based only on recorded heart-rate load. Check your actual fatigue, sleep, soreness, illness, pain, and recovery before deciding how to train.')}
          </p>
        </div>

        <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
          <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Advanced load signals')}</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/50">{t('Repetition risk')}</div>
                <div className="font-mono text-xl font-bold text-white tabular-nums">{trainingLoadMetrics.monotony.toFixed(2)}</div>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/50">{t('Higher means your daily training load is very similar, with less easy/hard variation.')}</p>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/50">{t('Overall strain')}</div>
                <div className="font-mono text-xl font-bold text-white tabular-nums">{trainingLoadMetrics.strain}</div>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/50">{t('Combines weekly load and repetition risk; useful when deciding whether to back off.')}</p>
            </div>
          </div>
        </div>
      </div>

      {globalSummary.hrrSessions > 0 && (
        <div className="hardware-card border-emerald-400/20 bg-emerald-400/5 p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-emerald-400/10 pb-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300 flex items-center gap-2">
                <Activity size={12} />
                {t('Heart Rate Recovery')}
              </div>
              <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">
                {t('Recovery scores from workouts in the selected range')}
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">
              {globalSummary.hrrSessions}/{globalSummary.totalSessions} {t('sessions')}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Avg HRR')}</div>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-300 tabular-nums">
                {globalSummary.avgHrr} <span className="text-[10px] font-normal text-white/40">BPM</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Best HRR')}</div>
              <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                {globalSummary.bestHrr} <span className="text-[10px] font-normal text-white/40">BPM</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/15 bg-black/20 px-4 py-3">
              <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{t('Coverage')}</div>
              <div className="mt-1 text-2xl font-bold font-mono text-white tabular-nums">
                {Math.round((globalSummary.hrrSessions / Math.max(1, globalSummary.totalSessions)) * 100)}
                <span className="text-[10px] font-normal text-white/40">%</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
                          ? `${delta.direction === 'up' ? '+' : delta.direction === 'down' ? '' : ''}${delta.value}%`
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
            {(() => {
              const parseLocalDate = (date: string) => new Date(`${date}T00:00:00`);
              const activeDays = weeklyDailyData.filter(day => day.hasData).length;
              const totalSessions = weeklyDailyData.reduce((total, day) => total + day.sessions, 0);
              const consistency = Math.round((activeDays / weeklyDailyData.length) * 100);
              const peakSessions = Math.max(...weeklyDailyData.map(day => day.sessions), 1);
              const isCompactMode = weeklyDailyData.length > 28;
              const sessionOpacity = (sessions: number) => {
                if (sessions >= 4) return 0.95;
                if (sessions === 3) return 0.75;
                if (sessions === 2) return 0.52;
                return 0.3;
              };

              return (
                <>
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Consistency Map')}</div>
                      <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">
                        {t('Daily activity pattern for the selected range')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {[
                        { label: t('Active days'), value: `${activeDays}` },
                        { label: t('Sessions'), value: `${totalSessions}` },
                        { label: t('Consistency'), value: `${consistency}%` },
                      ].map(item => (
                        <div key={item.label} className="min-w-[60px] rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-center">
                          <div className="whitespace-nowrap text-[7px] font-mono uppercase tracking-[0.12em] text-white/35">{item.label}</div>
                          <div className="mt-1 font-mono text-base font-bold text-white tabular-nums">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isCompactMode ? (
                    <div className="overflow-x-auto pb-1">
                      <div
                        className="grid gap-1"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(weeklyDailyData.length, 52)}, minmax(18px, 1fr))`,
                          minWidth: `${weeklyDailyData.length * 22}px`,
                        }}
                      >
                        {weeklyDailyData.map(day => {
                          const date = parseLocalDate(day.date);
                          const tooltipValue = formatDailyMetric(day);
                          const opacity = sessionOpacity(day.sessions);
                          return (
                            <div
                              key={day.date}
                              className={`group relative aspect-square rounded-sm transition-all ${
                                day.isToday
                                  ? 'ring-1 ring-vp-accent'
                                  : ''
                              }`}
                              style={{
                                backgroundColor: day.hasData
                                  ? `color-mix(in srgb, var(--color-vp-accent) ${Math.round(opacity * 100)}%, transparent)`
                                  : 'rgba(255,255,255,0.04)',
                              }}
                              title={`${date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })} — ${day.sessions} sessions`}
                            >
                              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-vp-surface-raised px-2.5 py-1.5 text-[9px] font-mono shadow-xl group-hover:block">
                                <div className="text-white/55">{date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                <div className="mt-0.5 text-white">{day.sessions} {t('sessions')}</div>
                                <div className="mt-0.5" style={{ color: metricColor }}>{tooltipValue}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 flex gap-1 overflow-x-hidden text-[7px] font-mono text-white/25">
                        {weeklyDailyData.reduce<{ label: string; idx: number }[]>((acc, day, idx) => {
                          const d = parseLocalDate(day.date);
                          if (idx === 0 || d.getDate() === 1) {
                            acc.push({ label: d.toLocaleDateString(locale, { month: 'short' }), idx });
                          }
                          return acc;
                        }, []).map(({ label, idx }) => (
                          <span key={`${label}-${idx}`} style={{ marginLeft: idx === 0 ? 0 : `${(22 * (idx)) - (label.length * 4)}px` }}>{label}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}
                    >
                      {weeklyDailyData.map(day => {
                        const date = parseLocalDate(day.date);
                        const tooltipValue = formatDailyMetric(day);
                        const opacity = sessionOpacity(day.sessions);
                        const heightPct = day.hasData ? Math.max(18, (day.sessions / peakSessions) * 100) : 0;

                        return (
                          <div
                            key={day.date}
                            className={`group relative flex min-h-[88px] flex-col rounded-xl border px-2.5 py-2.5 transition-colors ${
                              day.isToday
                                ? 'border-vp-accent/70 bg-vp-accent/8'
                                : day.hasData
                                  ? 'border-vp-accent/20 bg-vp-accent/7 hover:border-vp-accent/35'
                                  : 'border-white/7 bg-white/[0.025] hover:border-white/14'
                            }`}
                            title={`${day.label} ${day.shortDate} - ${day.sessions} sessions`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <div className="truncate text-[8px] font-mono uppercase tracking-[0.08em] text-white/35">
                                  {date.toLocaleDateString(locale, { weekday: 'short' })}
                                </div>
                                <div className="mt-0.5 font-mono text-sm font-bold leading-none text-white/80 tabular-nums">
                                  {date.getDate()}
                                </div>
                              </div>
                              {day.isToday && (
                                <div className="shrink-0 rounded border border-vp-accent/40 px-1 py-0.5 text-[6px] font-mono uppercase tracking-wider text-vp-accent">
                                  {t('Today')}
                                </div>
                              )}
                            </div>

                            <div className="mt-auto pt-2">
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
                                <div
                                  className="h-full rounded-full bg-vp-accent transition-[width] duration-500"
                                  style={{ width: `${heightPct}%`, opacity: day.hasData ? opacity : 0 }}
                                />
                              </div>
                              <div className="mt-1.5 flex items-center justify-between">
                                <span className="text-[7px] font-mono uppercase text-white/30">{t('ses.')}</span>
                                <span className={`font-mono text-xs font-bold tabular-nums ${
                                  day.hasData ? 'text-vp-accent' : 'text-white/20'
                                }`}>
                                  {day.sessions}
                                </span>
                              </div>
                            </div>

                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-40 -translate-x-1/2 rounded-lg border border-white/10 bg-vp-surface-raised px-2.5 py-2 text-[9px] font-mono shadow-xl group-hover:block">
                              <div className="text-white/55">{day.label} · {day.shortDate}</div>
                              <div className="mt-1 text-white">{day.sessions} {t('sessions')}</div>
                              <div className="mt-1" style={{ color: metricColor }}>{tooltipValue}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] font-mono uppercase tracking-[0.12em] text-white/30">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-[3px] border border-vp-accent bg-vp-accent/15" />
                      <span>{t('Today')}</span>
                    </div>
                    <span className="text-white/15">·</span>
                    <span>{t('Bar length and color show session count')}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
