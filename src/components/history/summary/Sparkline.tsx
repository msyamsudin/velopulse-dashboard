interface SparklineSeries {
  values: number[];
  color: string;
}

interface SparklineProps {
  series: SparklineSeries[];
  label: string;
  width?: number;
  height?: number;
}

/**
 * Minimal hand-rolled sparkline (no chart library): these are per-card trend
 * hints of a few dozen points, not plots.
 *
 * All series share one vertical scale, so two lines can be compared against each
 * other — that is the whole point of showing fitness next to fatigue.
 */
export const Sparkline = ({ series, label, width = 96, height = 26 }: SparklineProps) => {
  const drawable = series.filter(entry => entry.values.length >= 2);
  if (drawable.length === 0) return null;

  const allValues = drawable.flatMap(entry => entry.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const pointCount = Math.max(...drawable.map(entry => entry.values.length));
  const x = (index: number) => (index / Math.max(1, pointCount - 1)) * (width - 4) + 2;
  const y = (value: number) => height - 3 - ((value - min) / span) * (height - 8);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${drawable.map(entry => entry.values.join(', ')).join(' / ')}`}
      className="shrink-0 overflow-visible"
    >
      {drawable.map(entry => {
        const last = entry.values[entry.values.length - 1];
        return (
          <g key={entry.color}>
            <polyline
              points={entry.values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={entry.color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={x(entry.values.length - 1).toFixed(1)} cy={y(last).toFixed(1)} r="2.5" fill={entry.color} />
          </g>
        );
      })}
    </svg>
  );
};
