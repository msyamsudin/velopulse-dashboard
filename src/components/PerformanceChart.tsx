import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { downsample } from '../lib/chart-utils';
import { HR_ZONES, POWER_ZONES, getSafeMaxHr } from '@/lib/constants';

interface PerformanceChartProps {
  data: any[];
  title?: string;
  height?: number | string;
  mode?: 'live' | 'history';
  hrZone?: { label: string; color: string; bg: string };
  userFtp?: number;
  userMaxHr?: number;
  onExit?: () => void;
}

// FTP Power Zones (Coggan) — chart overlay hex colors with alpha
const POWER_ZONE_CHART_COLORS = ['#8e929933', '#3b82f633', '#22c55e33', '#facc1533', '#f9731633', '#ef444433', '#a855f733'];

const getPowerZones = (ftp: number) =>
  POWER_ZONES.map((z, i) => ({
    label: z.label,
    min: ftp * z.minPct,
    max: ftp * z.maxPct,
    color: POWER_ZONE_CHART_COLORS[i],
  }));

// Preserve original chart colors mapped by zone index
const HR_ZONE_CHART_COLORS = ['#8e929918', '#22c55e18', '#facc1518', '#f9731618', '#ef444418'];

// HR Zones — as absolute BPM ranges
const getHrZones = (maxHr: number) => {
  const safe = getSafeMaxHr(maxHr);
  return HR_ZONES.map((z, i) => ({
    label: z.label,
    min: safe * z.minPct,
    max: safe * z.maxPct,
    color: HR_ZONE_CHART_COLORS[i],
  }));
};

export const PerformanceChart = ({
  data,
  title = 'Performance Telemetry',
  height = 300,
  mode = 'live',
  hrZone,
  userFtp = 200,
  userMaxHr = 185,
  onExit,
}: PerformanceChartProps) => {
  // Sliding window options (in seconds)
  const WINDOW_OPTIONS = [
    { label: '15s', value: 15 },
    { label: '30s', value: 30 },
    { label: '1m',  value: 60 },
    { label: '2m',  value: 120 },
    { label: '5m',  value: 300 },
  ];
  const [windowSeconds, setWindowSeconds] = useState(30);

  // Mode Live: last N seconds (sliding window @ 1Hz)
  // Mode History: show all points (removed downsampling to 100 points as per user request)
  const chartData = useMemo(() => {
    const raw = mode === 'history' ? data : data.slice(-windowSeconds);
    return raw.map(p => ({
      ...p,
      distance: p.distance ? Number((p.distance / 1000).toFixed(3)) : 0,
    }));
  }, [data, mode, windowSeconds]);

  // Toggle line visibility
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    hr: true,
    cadence: true,
    power: true,
    speed: false,
    distance: false,
    resistance: false,
    calories: false,
  });

  // Toggle zone band overlays
  const [showPowerZones, setShowPowerZones] = useState(true);
  const [showHrZones, setShowHrZones] = useState(false);

  const toggleLine = (key: string) => {
    setVisibleLines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Metric definitions — left axis: hr, cadence; right axis: power, speed, etc.
  const metrics = [
    { key: 'hr',         name: 'HR',   color: '#ef4444', unit: 'BPM',  yAxisId: 'left' },
    { key: 'cadence',    name: 'CAD',  color: '#00ff00', unit: 'RPM',  yAxisId: 'left' },
    { key: 'power',      name: 'PWR',  color: '#facc15', unit: 'W',    yAxisId: 'right' },
    { key: 'speed',      name: 'SPD',  color: '#60a5fa', unit: 'KM/H', yAxisId: 'right' },
    { key: 'distance',   name: 'DIST', color: '#a78bfa', unit: 'KM',   yAxisId: 'right' },
    { key: 'resistance', name: 'RES',  color: '#fb923c', unit: '',     yAxisId: 'right' },
    { key: 'calories',   name: 'CAL',  color: '#f472b6', unit: 'KCAL', yAxisId: 'right' },
  ];

  const powerZones = useMemo(() => getPowerZones(userFtp), [userFtp]);
  const hrZones    = useMemo(() => getHrZones(userMaxHr),  [userMaxHr]);

  return (
    <div className="hardware-card h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1.5 rounded-md bg-white/5 border border-white/10 text-hw-muted hover:text-white hover:bg-white/10 transition-all mr-2"
              title="Exit Fullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v5H3M21 8h-5V3M3 16h5v5M16 21v-5h5"/></svg>
            </button>
          )}
          <div className="stat-label">{title}</div>
          {hrZone && (
            <div className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest ${hrZone.bg} ${hrZone.color}`}>
              ZONE: {hrZone.label}
            </div>
          )}
          {mode === 'live' && (
            <div className="flex items-center gap-1 bg-hw-muted/5 border border-hw-muted/15 rounded p-0.5">
              {WINDOW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWindowSeconds(opt.value)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all duration-150 ${
                    windowSeconds === opt.value
                      ? 'bg-hw-accent/20 text-hw-accent border border-hw-accent/30'
                      : 'text-hw-muted hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Metric toggles */}
        <div className="flex flex-wrap gap-2">
          {metrics.map(m => (
            <button
              key={m.key}
              id={`toggle-${m.key}`}
              onClick={() => toggleLine(m.key)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all duration-200 ${
                visibleLines[m.key]
                  ? 'bg-white/10 border-white/20'
                  : 'opacity-30 border-transparent grayscale hover:opacity-50'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color, boxShadow: `0 0 6px ${m.color}` }} />
              <span className="text-[9px] font-mono text-white uppercase tracking-wider">{m.name}</span>
              <span className="text-[7px] font-mono opacity-40">{m.yAxisId === 'left' ? 'L' : 'R'}</span>
            </button>
          ))}

          {/* Zone band toggles */}
          <div className="w-px bg-white/10 mx-1" />
          <button
            onClick={() => setShowPowerZones(v => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all duration-200 ${
              showPowerZones ? 'bg-yellow-400/10 border-yellow-400/20' : 'opacity-30 border-transparent'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-sm bg-yellow-400/60" />
            <span className="text-[9px] font-mono text-yellow-400 uppercase tracking-wider">FTP</span>
          </button>
          <button
            onClick={() => setShowHrZones(v => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all duration-200 ${
              showHrZones ? 'bg-red-400/10 border-red-400/20' : 'opacity-30 border-transparent'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-sm bg-red-400/60" />
            <span className="text-[9px] font-mono text-red-400 uppercase tracking-wider">HR</span>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }} className="w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={1}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />

              <XAxis
                dataKey="time"
                stroke="#8e9299"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                hide={chartData.length < 2}
              />

              {/* Left Y-axis: HR & Cadence */}
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#8e9299"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                width={32}
              />

              {/* Right Y-axis: Power, Speed, etc. */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#8e9299"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                width={36}
              />

              {/* FTP Power Zone Bands (right axis) */}
              {showPowerZones && powerZones.map(zone => (
                <ReferenceArea
                  key={`ftp-${zone.label}`}
                  yAxisId="right"
                  y1={zone.min}
                  y2={zone.max}
                  fill={zone.color}
                  strokeOpacity={0}
                  label={{
                    value: zone.label,
                    position: 'insideRight',
                    fontSize: 7,
                    fill: '#ffffff30',
                    fontFamily: 'monospace',
                  }}
                />
              ))}

              {/* HR Zone Bands (left axis) */}
              {showHrZones && hrZones.map(zone => (
                <ReferenceArea
                  key={`hr-${zone.label}`}
                  yAxisId="left"
                  y1={zone.min}
                  y2={zone.max}
                  fill={zone.color}
                  strokeOpacity={0}
                />
              ))}

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-hw-bg/95 backdrop-blur-xl border border-white/10 p-3 rounded-lg shadow-2xl font-mono text-[10px]">
                        <div className="text-hw-muted mb-2 border-b border-white/5 pb-1 uppercase tracking-widest">{label}</div>
                        <div className="space-y-1.5">
                          {payload.map((item: any) => {
                            const metricDef = metrics.find(m => m.name === item.name);
                            return (
                              <div key={item.name} className="flex items-center justify-between gap-6">
                                <span className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="uppercase text-white/80">{item.name}</span>
                                </span>
                                <span className="font-bold tabular-nums" style={{ color: item.color }}>
                                  {item.value}
                                  <span className="text-[8px] opacity-60 ml-1">{metricDef?.unit}</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Data Lines */}
              {metrics.map(m => visibleLines[m.key] && (
                <Line
                  key={m.key}
                  yAxisId={m.yAxisId}
                  type="monotone"
                  dataKey={m.key}
                  name={m.name}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: m.color }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center border border-white/5 rounded-lg bg-white/2">
            <div className="text-[10px] font-mono text-hw-muted uppercase tracking-[0.2em] animate-pulse">
              Waiting for session telemetry...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
