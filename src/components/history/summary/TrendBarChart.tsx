import type { MetricKey } from '@/lib/history-types';
import { metricConfigByKey } from './constants';
import { formatChartMetric } from './format';
import type { AverageLine, HistoryChartDataPoint } from './useHistorySummary';

interface TrendBarChartProps {
  chartData: HistoryChartDataPoint[];
  denseData: boolean;
  compactLabels: boolean;
  activePeriods: number;
  peakPoint?: HistoryChartDataPoint;
  averageLine: AverageLine | null;
  unit: string;
  metricColor: string;
  primaryMetric: MetricKey;
  selectedMetrics: MetricKey[];
}

export const TrendBarChart = ({
  chartData,
  denseData,
  compactLabels,
  activePeriods,
  peakPoint,
  averageLine,
  unit,
  metricColor,
  primaryMetric,
  selectedMetrics,
}: TrendBarChartProps) => {
  return (
    <div className="mt-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-4 py-2.5">
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.16em] text-white/60">
          <span>{activePeriods} active periods</span>
          <span>bar view</span>
          <span>{metricConfigByKey[primaryMetric].name}</span>
        </div>
        {peakPoint && (
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
            Peak: <span style={{ color: metricColor }} className="font-bold">{formatChartMetric(primaryMetric, Number(peakPoint[primaryMetric]) || 0)}</span> {unit} on {peakPoint.displayLabel} {peakPoint.subLabel}
          </div>
        )}
      </div>
      <div className={`relative flex items-end min-h-[260px] h-[clamp(260px,40vh,420px)] w-full pb-2 ${denseData ? 'gap-px' : compactLabels ? 'gap-[2px]' : 'gap-1.5'}`}>
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
  );
};
