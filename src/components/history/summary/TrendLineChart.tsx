import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import type { MetricKey } from '@/lib/history-types';
import { metricConfigByKey } from './constants';
import { formatChartMetric } from './format';
import type { AverageLine, HistoryChartDataPoint } from './useHistorySummary';

interface TrendLineChartProps {
  chartData: HistoryChartDataPoint[];
  activePeriods: number;
  peakPoint?: HistoryChartDataPoint;
  averageLine: AverageLine | null;
  unit: string;
  metricColor: string;
  primaryMetric: MetricKey;
  selectedMetrics: MetricKey[];
  denseData: boolean;
  compactLabels: boolean;
  labelInterval: number;
}

export const TrendLineChart = ({
  chartData,
  activePeriods,
  peakPoint,
  averageLine,
  unit,
  metricColor,
  primaryMetric,
  selectedMetrics,
  denseData,
  compactLabels,
  labelInterval,
}: TrendLineChartProps) => {
  return (
    <div className="mt-2 min-h-[260px] h-[clamp(260px,40vh,420px)] w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/20 px-4 py-2.5">
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.16em] text-white/60">
          <span>{activePeriods} active periods</span>
          <span>line view</span>
          <span>{metricConfigByKey[primaryMetric].name}</span>
        </div>
        {peakPoint && (
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
            Peak: <span style={{ color: metricColor }} className="font-bold">{formatChartMetric(primaryMetric, Number(peakPoint[primaryMetric]) || 0)}</span> {unit} on {peakPoint.displayLabel} {peakPoint.subLabel}
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
  );
};
