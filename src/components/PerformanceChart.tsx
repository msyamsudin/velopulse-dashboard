import { useMemo, useState } from 'react';
import { Activity, Minimize2 } from 'lucide-react';
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
import { IconButton, SegmentedControl, StatusPill } from './ui';

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
const MAX_HISTORY_CHART_POINTS = 600;

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
    { label: '15s', value: '15' },
    { label: '30s', value: '30' },
    { label: '1m',  value: '60' },
    { label: '2m',  value: '120' },
    { label: '5m',  value: '300' },
  ];
  const [windowSeconds, setWindowSeconds] = useState(30);

  // Mode Live: last N seconds (sliding window @ 1Hz)
  // Mode History: cap rendered points so long workouts do not overload Recharts.
  const chartData = useMemo(() => {
    const raw = mode === 'history'
      ? downsample(data, MAX_HISTORY_CHART_POINTS)
      : data.slice(-windowSeconds);
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
  const handleWindowChange = (value: string) => {
    setWindowSeconds(Number(value));
  };

  // Metric definitions — left axis: hr, cadence; right axis: power, speed, etc.
  const metrics = [
    { key: 'hr',         name: 'HR',   color: '#ef4444', unit: 'BPM',  yAxisId: 'left' },
    { key: 'cadence',    name: 'CAD',  color: '#35f0bd', unit: 'RPM',  yAxisId: 'left' },
    { key: 'power',      name: 'PWR',  color: '#facc15', unit: 'W',    yAxisId: 'right' },
    { key: 'speed',      name: 'SPD',  color: '#60a5fa', unit: 'KM/H', yAxisId: 'right' },
    { key: 'distance',   name: 'DIST', color: '#a78bfa', unit: 'KM',   yAxisId: 'right' },
    { key: 'resistance', name: 'RES',  color: '#fb923c', unit: '',     yAxisId: 'right' },
    { key: 'calories',   name: 'CAL',  color: '#f472b6', unit: 'KCAL', yAxisId: 'right' },
  ];

  const powerZones = useMemo(() => getPowerZones(userFtp), [userFtp]);
  const hrZones    = useMemo(() => getHrZones(userMaxHr),  [userMaxHr]);

  return (
    <div className="vp-panel-raised h-full flex flex-col">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 border-b border-vp-border pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
          {onExit && (
            <IconButton
              onClick={onExit}
              label="Exit telemetry view"
              icon={<Minimize2 size={15} />}
            />
          )}
            <div className="min-w-0">
              <div className="vp-label flex items-center gap-2">
                <Activity size={13} className="text-vp-accent" />
                {title}
              </div>
              <div className="mt-1 text-xs text-vp-muted">
                {mode === 'live' ? `Last ${windowSeconds}s telemetry window` : `${chartData.length} rendered points`}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {hrZone && (
              <StatusPill label={`Zone ${hrZone.label}`} tone="ready" />
            )}
            {mode === 'live' && (
              <SegmentedControl
                ariaLabel="Telemetry time window"
                value={String(windowSeconds)}
                options={WINDOW_OPTIONS}
                onChange={handleWindowChange}
              />
            )}
            <div className="flex items-center gap-1 rounded-lg border border-vp-border bg-white/[0.03] p-1">
              <button
                onClick={() => setShowPowerZones(v => !v)}
                className={`vp-focus-ring rounded-md px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] transition-colors ${
                  showPowerZones ? 'bg-vp-power/15 text-vp-power' : 'text-vp-muted hover:text-vp-text'
                }`}
              >
                FTP
              </button>
              <button
                onClick={() => setShowHrZones(v => !v)}
                className={`vp-focus-ring rounded-md px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] transition-colors ${
                  showHrZones ? 'bg-vp-hr/15 text-vp-hr' : 'text-vp-muted hover:text-vp-text'
                }`}
              >
                HR
              </button>
            </div>
          </div>
        </div>

        {/* Metric toggles */}
        <div className="flex flex-wrap gap-2">
          {metrics.map(m => (
            <button
              key={m.key}
              id={`toggle-${m.key}`}
              onClick={() => toggleLine(m.key)}
              className={`vp-focus-ring flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-colors ${
                visibleLines[m.key]
                  ? 'border-vp-border-strong bg-white/[0.08]'
                  : 'border-transparent opacity-40 grayscale hover:bg-white/[0.04] hover:opacity-70'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color, boxShadow: `0 0 6px ${m.color}` }} />
              <span className="text-[9px] font-mono text-vp-text uppercase tracking-wider">{m.name}</span>
              <span className="text-[7px] font-mono opacity-40">{m.yAxisId === 'left' ? 'L' : 'R'}</span>
            </button>
          ))}
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
                      <div className="rounded-lg border border-vp-border bg-vp-bg/95 p-3 font-mono text-[10px] shadow-2xl backdrop-blur-xl">
                        <div className="mb-2 border-b border-vp-border pb-1 uppercase tracking-widest text-vp-muted">{label}</div>
                        <div className="space-y-1.5">
                          {payload.map((item: any) => {
                            const metricDef = metrics.find(m => m.name === item.name);
                            return (
                              <div key={item.name} className="flex items-center justify-between gap-6">
                                <span className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="uppercase text-vp-text/80">{item.name}</span>
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
          <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-vp-border bg-white/[0.02]">
            <div className="text-center">
              <Activity size={20} className="mx-auto mb-3 text-vp-muted" />
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-vp-muted">
                Waiting for session telemetry
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
