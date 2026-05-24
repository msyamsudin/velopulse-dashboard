import { ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area } from 'recharts';

interface HistorySummaryProps {
  globalSummary: any;
  showTotals: boolean;
  setShowTotals: (show: boolean) => void;
  summaryPeriod: string;
  setSummaryPeriod: (period: any) => void;
  summaryRange: '7d' | '30d' | '90d' | '1y' | 'all';
  setSummaryRange: (range: '7d' | '30d' | '90d' | '1y' | 'all') => void;
  chartType: 'bar' | 'line';
  setChartType: (type: 'bar' | 'line') => void;
  weeklyMetric: 'distance' | 'calories' | 'duration' | 'cadence';
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
  if (!globalSummary) return null;

  const rangeOptions = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'ALL' },
  ] as const;

  const values = normalizedChartData.map(d => d[weeklyMetric] as number);
  const maxVal = Math.max(...values, 0.001);
  const unit = weeklyMetric === 'distance' ? 'km' : weeklyMetric === 'calories' ? 'kcal' : weeklyMetric === 'duration' ? 'min' : 'rpm';
  const metricColor = weeklyMetric === 'distance' ? '#00d2ff' : weeklyMetric === 'calories' ? '#f472b6' : weeklyMetric === 'duration' ? '#fbbf24' : '#00ffaa';
  const metricColorRgba = weeklyMetric === 'distance' ? '0,210,255' : weeklyMetric === 'calories' ? '244,114,182' : weeklyMetric === 'duration' ? '251,191,36' : '0,255,170';
  const denseData = normalizedChartData.length > 45;
  const barScrollable = normalizedChartData.length > 14;
  const effectiveChartType = denseData && chartType === 'bar' ? 'line' : chartType;
  const compactLabels = normalizedChartData.length > 20;
  const activePeriods = normalizedChartData.filter(d => d.hasData).length;
  const peakPoint = normalizedChartData.reduce((best, current) =>
    (current[weeklyMetric] as number) > (best?.[weeklyMetric] as number ?? -1) ? current : best
    , normalizedChartData[0]);
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

  return (
    <div className="pb-8 flex flex-col gap-4">
      {showTotals && (
        <div className="hardware-card border-hw-muted/20 px-4 py-3 flex items-center justify-between bg-black/40 backdrop-blur-md">
          <div className="flex flex-col items-center flex-1">
            <span className="text-[9px] text-hw-muted uppercase font-mono tracking-wider mb-0.5">Sessions</span>
            <span className="text-sm font-bold text-hw-accent tabular-nums">{globalSummary.totalSessions}</span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex flex-col items-center flex-1">
            <span className="text-[9px] text-hw-muted uppercase font-mono tracking-wider mb-0.5">Distance</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "#00d2ff" }}>{globalSummary.totalDistance} <span className="text-[8px] font-normal opacity-60">KM</span></span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex flex-col items-center flex-1">
            <span className="text-[9px] text-hw-muted uppercase font-mono tracking-wider mb-0.5">Calories</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "#f472b6" }}>{globalSummary.totalCalories} <span className="text-[8px] font-normal opacity-60">KCAL</span></span>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex flex-col items-center flex-1">
            <span className="text-[9px] text-hw-muted uppercase font-mono tracking-wider mb-0.5">Time</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "#fbbf24" }}>{globalSummary.totalDuration}</span>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-4">
        <div className="hardware-card border-hw-muted/20 p-6 flex flex-col bg-black/30">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 border-b border-white/5 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,255,170,0.15)', border: '1px solid rgba(0,255,170,0.3)' }}>
                <Activity size={14} style={{ color: '#00ffaa' }} />
              </div>
              <div>
                <div className="text-[9px] text-hw-muted uppercase font-mono tracking-[0.2em] flex items-center gap-2">
                  Training Progress
                  <button
                    onClick={() => setShowTotals(!showTotals)}
                    className="text-[8px] bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors text-white border border-white/10"
                  >
                    {showTotals ? 'Hide Totals' : 'Show Totals'}
                  </button>
                </div>
                <div className="text-white font-bold text-sm font-mono mt-0.5">
                  {periodLabel}
                  <span className="ml-2 text-[10px] font-normal" style={{ color: 'rgba(0,255,170,0.8)' }}>
                    {normalizedChartData.filter(d => d.hasData).length} active periods in {rangeLabel}
                  </span>
                  {summaryRange !== 'all' && (
                    <div className="flex items-center gap-1 ml-4 bg-white/5 p-0.5 rounded-lg border border-white/10">
                      <button
                        onClick={() => {
                          const shift = summaryRange === '7d' ? 7 : summaryRange === '30d' ? 30 : summaryRange === '90d' ? 90 : summaryRange === '1y' ? 365 : 0;
                          setOffsetDays(offsetDays + shift);
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors text-white/60 hover:text-white"
                        title="Previous Period"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <div className="px-2 text-[8px] font-mono uppercase text-white/40 tracking-widest border-x border-white/5">
                        {offsetDays === 0 ? 'Current' : `${offsetDays}d back`}
                      </div>
                      <button
                        onClick={() => {
                          const shift = summaryRange === '7d' ? 7 : summaryRange === '30d' ? 30 : summaryRange === '90d' ? 90 : summaryRange === '1y' ? 365 : 0;
                          setOffsetDays(Math.max(0, offsetDays - shift));
                        }}
                        disabled={offsetDays === 0}
                        className={`p-1 rounded transition-colors ${offsetDays === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
                        title="Next Period"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {denseData && (
                  <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.16em] text-hw-muted">
                    Dense timeline detected. Showing line view for readability.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
              <div className="flex rounded-lg overflow-hidden border border-white/8 flex-wrap" style={{ background: 'rgba(0,0,0,0.3)' }}>
                {['daily', 'weekly', 'monthly', 'yearly'].map(p => (
                  <button
                    key={p}
                    onClick={() => setSummaryPeriod(p as any)}
                    style={summaryPeriod === p ? { background: '#262626', color: '#fff' } : {}}
                    className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${summaryPeriod === p ? '' : 'text-hw-muted hover:text-white'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex rounded-lg overflow-hidden border border-white/8 flex-wrap" style={{ background: 'rgba(0,0,0,0.3)' }}>
                {rangeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSummaryRange(option.value)}
                    style={summaryRange === option.value ? { background: '#262626', color: '#fff' } : {}}
                    className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${summaryRange === option.value ? '' : 'text-hw-muted hover:text-white'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-white/8" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <button
                    onClick={() => setChartType('bar')}
                    style={chartType === 'bar' ? { background: '#00ffaa', color: '#0a0a0a' } : {}}
                    className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${chartType === 'bar' ? '' : 'text-hw-muted hover:text-white'
                      }`}
                    title={denseData ? 'Dense ranges are displayed as line view automatically' : undefined}
                  >
                    BAR
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    style={chartType === 'line' ? { background: '#00ffaa', color: '#0a0a0a' } : {}}
                    className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${chartType === 'line' ? '' : 'text-hw-muted hover:text-white'
                      }`}
                  >
                    LINE
                  </button>
                </div>

                <div className="flex rounded-lg overflow-hidden border border-white/8" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  {(['distance', 'calories', 'duration', 'cadence'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setWeeklyMetric(m)}
                      style={weeklyMetric === m ? { background: '#00ffaa', color: '#0a0a0a' } : {}}
                      className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest font-bold transition-all ${weeklyMetric === m ? '' : 'text-hw-muted hover:text-white'
                        }`}
                    >
                      {m === 'distance' ? 'KM' : m === 'calories' ? 'KCAL' : m === 'duration' ? 'MIN' : 'RPM'}
                    </button>
                  ))}
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
                  <span>{weeklyMetric}</span>
                </div>
                {peakPoint && (
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
                    Peak: <span style={{ color: metricColor }} className="font-bold">{weeklyMetric === 'distance' ? peakPoint.distance.toFixed(1) : peakPoint[weeklyMetric]}</span> {unit} on {peakPoint.displayLabel} {peakPoint.subLabel}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={1}>
                <LineChart data={normalizedChartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />
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
                            <div style={{ color: metricColor }} className="font-bold text-xl">{payload[0].value} <span className="text-xs text-hw-muted font-normal">{unit}</span></div>
                            <div className="text-[10px] uppercase font-mono text-hw-muted mt-1">{point.displayLabel} {point.subLabel}</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-[10px] font-mono uppercase">
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
                  <Line
                    type="monotone"
                    dataKey={weeklyMetric}
                    stroke={metricColor}
                    strokeWidth={3}
                    dot={denseData ? false : { r: 4, strokeWidth: 2, fill: '#1a1a1a', stroke: metricColor }}
                    activeDot={{ r: 6, fill: metricColor, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-4 py-2.5">
                <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.16em] text-white/60">
                  <span>{activePeriods} active periods</span>
                  <span>{effectiveChartType} view</span>
                  <span>{weeklyMetric}</span>
                </div>
                {peakPoint && (
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
                    Peak: <span style={{ color: metricColor }} className="font-bold">{weeklyMetric === 'distance' ? peakPoint.distance.toFixed(1) : peakPoint[weeklyMetric]}</span> {unit} on {peakPoint.displayLabel} {peakPoint.subLabel}
                  </div>
                )}
              </div>
              <div className="flex items-end gap-2 min-h-[260px] h-[clamp(260px,40vh,420px)] w-full overflow-x-auto custom-scrollbar pb-2 pr-2">
                {normalizedChartData.map((day) => {
                  const pct = maxVal > 0 ? (day[weeklyMetric] as number) / maxVal : 0;
                  const showSubLabel = !compactLabels || day.hasData || day.isHighlight;
                  const showMainLabel = !compactLabels || day.hasData || day.isHighlight || normalizedChartData.indexOf(day) % 3 === 0;
                  return (
                    <div key={day.date} className="flex flex-col items-center justify-end gap-1.5 group h-full snap-end" style={{ minWidth: barScrollable ? '46px' : '0', flex: barScrollable ? '0 0 46px' : '1 1 0' }}>
                      <div className={`text-[9px] font-mono tabular-nums transition-all duration-200 ${day.hasData ? 'text-white/70 group-hover:text-white' : 'text-transparent'}`}>
                        {day.hasData
                          ? weeklyMetric === 'distance'
                            ? `${(day[weeklyMetric] as number).toFixed(1)}`
                            : `${day[weeklyMetric]}`
                          : ''}
                      </div>

                      <div className="w-full flex items-end gap-0.5 h-full max-h-full">
                    <div className="flex-1 relative h-full">
                      <div className="absolute bottom-0 w-full" style={{ height: `${pct * 100}%`, minHeight: day.hasData ? '4px' : '2px' }}>
                        <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden w-44 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-[10px] font-mono uppercase shadow-xl group-hover:block pointer-events-none">
                          <div className="text-white/60">{day.displayLabel} {day.subLabel}</div>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
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
                        {day.isHighlight ? (
                          <div
                            className="w-full h-full rounded-t-md transition-all duration-500"
                            style={{
                              background: metricColor,
                              boxShadow: `0 0 12px rgba(${metricColorRgba},0.5)`,
                            }}
                          />
                        ) : day.hasData ? (
                          <div
                            className="w-full h-full rounded-t-md transition-all duration-500 group-hover:opacity-90"
                            style={{
                              background: `rgba(${metricColorRgba},0.42)`,
                              borderTop: `1px solid rgba(${metricColorRgba},0.3)`,
                              borderLeft: `1px solid rgba(${metricColorRgba},0.3)`,
                              borderRight: `1px solid rgba(${metricColorRgba},0.3)`,
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
                  </div>

                      <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

                      <div className={`text-[9px] font-mono font-bold uppercase tracking-wider mt-0.5 ${day.isHighlight ? 'text-white' : day.hasData ? 'text-white/50' : 'text-white/20'
                        }`} style={day.isHighlight ? { color: metricColor } : {}}>
                        {showMainLabel ? day.displayLabel : ''}
                      </div>

                      <div className={`text-[8px] font-mono ${day.hasData ? 'text-white/25' : 'text-white/10'}`}>
                        {showSubLabel ? day.subLabel : ''}
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
