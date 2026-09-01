interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}

/**
 * Minimal dependency-free sparkline for short metric trends (e.g. the last
 * 30 s of HR or power in the ride cockpit). Renders an SVG polyline that
 * stretches to the container width; the stroke keeps a constant thickness
 * via non-scaling-stroke.
 */
export const Sparkline = ({ data, color = '#35f0bd', height = 24, className = '' }: SparklineProps) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const vbWidth = 100;
  const step = vbWidth / (data.length - 1);
  const pad = 1.5;
  const points = data
    .map((value, i) => {
      const x = (i * step).toFixed(2);
      const y = (height - pad - ((value - min) / range) * (height - pad * 2)).toFixed(2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${vbWidth} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
