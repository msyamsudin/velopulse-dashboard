import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatDuration } from '../../utils/formatters';
import type { HistoryData } from '@/store/useWorkoutStore';

interface StackedWorkoutChartProps {
  data: Array<HistoryData & { relativeTime?: string }>;
  stats: {
    avgHr: number;
    maxHr: number;
    avgPower: number;
    maxPower: number;
    avgCadence: number;
    maxCadence: number;
    avgSpeed: number;
    maxSpeed: number;
    avgResistance: number;
    maxResistance: number;
  };
}


export const StackedWorkoutChart = ({ data, stats }: StackedWorkoutChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleMouseMove = (e: { activeTooltipIndex?: number | string }) => {
    if (e && e.activeTooltipIndex !== undefined) {
      setActiveIndex(Number(e.activeTooltipIndex));
    }
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };


  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    // Attempt to parse the first time point or just use index if it's 1Hz
    // Assuming data points are roughly 1 second apart as per incrementElapsed/addHistoryPoint logic
    return data.map((p, index) => ({
      ...p,
      relativeTime: p.relativeTime || formatDuration(index), // formatDuration(seconds) -> "00:00"
    }));
  }, [data]);


  const tracks = [
    {
      id: 'speed',
      name: 'Speed',
      dataKey: 'speed',
      color: '#38bdf8',
      unit: 'km/h',
      avg: stats.avgSpeed,
      max: stats.maxSpeed,
    },
    {
      id: 'power',
      name: 'Power',
      dataKey: 'power',
      color: '#8b5cf6',
      unit: 'w',
      avg: stats.avgPower,
      max: stats.maxPower,
    },
    {
      id: 'hr',
      name: 'Heart Rate',
      dataKey: 'hr',
      color: '#ef4444',
      unit: 'bpm',
      avg: stats.avgHr,
      max: stats.maxHr,
    },
    {
      id: 'cadence',
      name: 'Cadence',
      dataKey: 'cadence',
      color: '#ec4899',
      unit: 'rpm',
      avg: stats.avgCadence,
      max: stats.maxCadence,
    },
    {
      id: 'resistance',
      name: 'Resistance',
      dataKey: 'resistance',
      color: '#fb923c',
      unit: 'lvl',
      avg: stats.avgResistance,
      max: stats.maxResistance,
    },

  ];

  const trackRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number }> = {};

    for (const track of tracks) {
      ranges[track.dataKey] = { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
    }

    for (const point of chartData) {
      for (const track of tracks) {
        const value = point[track.dataKey] || 0;
        const current = ranges[track.dataKey];
        current.min = Math.min(current.min, value);
        current.max = Math.max(current.max, value);
      }
    }

    for (const track of tracks) {
      const current = ranges[track.dataKey];
      if (!Number.isFinite(current.min) || !Number.isFinite(current.max)) {
        ranges[track.dataKey] = { min: 0, max: 0 };
      }
    }

    return ranges;
  }, [chartData]);

  return (
    <div 
      className="flex flex-col w-full overflow-hidden rounded-2xl border border-hw-border backdrop-blur-xl"
      style={{ backgroundColor: 'var(--color-hw-card)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)' }}
      onMouseLeave={handleMouseLeave}
    >

      {/* Top Header / Time Axis */}
      <div className="flex items-stretch border-b border-hw-border bg-hw-muted/5">
        <div className="w-[180px] flex flex-col justify-center px-8 py-2 border-r border-hw-border">
          <div className="text-[10px] text-hw-muted font-mono uppercase tracking-widest opacity-60">Time</div>
          <div className="text-sm font-bold text-hw-accent font-mono tabular-nums">
            {activeIndex !== null ? chartData[activeIndex]?.relativeTime : chartData[chartData.length - 1]?.relativeTime}
          </div>
        </div>


        <div className="flex-1 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }} 
              syncId="workoutSync"
              onMouseMove={handleMouseMove}
            >

              <XAxis
                dataKey="relativeTime"
                axisLine={false}
                tickLine={true}
                stroke="rgba(74,92,86,0.5)"
                fontSize={10}
                tick={{ fill: '#8e9299', fontWeight: 500 }}
                interval="preserveStartEnd"
                orientation="top"
                height={48}
                padding={{ left: 0, right: 0 }}
              />
              <Tooltip
                content={() => null}
                cursor={{ stroke: '#ffffff20', strokeWidth: 1.5 }}
              />
            </LineChart>
          </ResponsiveContainer>

        </div>
        <div className="w-[120px] border-l border-hw-border" />
      </div>

      {/* Tracks */}
      <div className="flex flex-col">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className={`flex items-stretch min-h-[140px] ${index !== tracks.length - 1 ? 'border-b border-hw-border' : ''}`}
          >
            {/* Left Sidebar: Labels */}
            <div className="w-[180px] flex flex-col justify-center px-8 py-4 border-r border-hw-border bg-hw-muted/5">
              <div className="text-sm font-bold text-white mb-1 uppercase tracking-tight">{track.name}</div>
              <div className="text-[10px] text-hw-muted font-mono uppercase tracking-widest opacity-60">Max {track.max}</div>
              <div className="text-[10px] text-hw-muted font-mono uppercase tracking-widest opacity-60">Avg {track.avg}</div>
            </div>

            {/* Main Chart Area */}
            <div className="flex-1 relative group bg-black/10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 0, left: 0, bottom: 20 }}
                  syncId="workoutSync"
                  onMouseMove={handleMouseMove}
                >

                  <CartesianGrid strokeDasharray="0" stroke="rgba(0,255,170,0.04)" vertical={true} horizontal={false} />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    content={() => null}
                    cursor={{ stroke: '#ffffff20', strokeWidth: 1.5 }}
                  />


                  {/* Average Reference Line */}
                  <ReferenceLine
                    y={track.avg}
                    stroke={track.color}
                    strokeDasharray="3 3"
                    strokeOpacity={0.3}
                  />

                  <Line
                    type="monotone"
                    dataKey={track.dataKey}
                    stroke={track.color}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: track.color }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Optional: Track-specific Y-axis labels floating in the chart */}
              <div className="absolute top-2 left-2 text-[8px] font-mono text-hw-muted/40 pointer-events-none">
                {(trackRanges[track.dataKey]?.max || 0).toFixed(1)}
              </div>
              <div className="absolute bottom-2 left-2 text-[8px] font-mono text-hw-muted/40 pointer-events-none">
                {(trackRanges[track.dataKey]?.min || 0).toFixed(1)}
              </div>
            </div>

            <div className="w-[120px] flex flex-col items-center justify-center border-l border-hw-border bg-hw-muted/5">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-white tabular-nums leading-none">
                  {(() => {
                    const activeData = activeIndex !== null ? chartData[activeIndex] : chartData[chartData.length - 1];
                    return (activeData?.[track.dataKey] || 0).toFixed(1);
                  })()}
                </span>
                <span className="text-[9px] text-hw-muted font-mono uppercase mt-1 tracking-widest">{track.unit}</span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
