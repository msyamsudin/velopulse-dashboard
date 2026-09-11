import { buildSeriesBand, createTrendProjection } from '@/lib/chart-utils';

const CTL_COLOR = '#35f0bd';
const ATL_COLOR = '#f5c542';
const FRESH_FILL = 'rgba(53, 240, 189, 0.18)';
const FATIGUED_FILL = 'rgba(245, 197, 66, 0.18)';

interface LoadTrendChartProps {
  /** Fitness: 42-day exponentially weighted average of daily TRIMP. */
  ctlSeries: number[];
  /** Fatigue: 7-day exponentially weighted average of daily TRIMP. */
  atlSeries: number[];
  /** Accessible description; the caller translates it. */
  label: string;
  width?: number;
  height?: number;
}

/**
 * Fitness/fatigue chart (L2 panel): CTL and ATL lines over the whole model
 * window, with the area between them shaded by the sign of TSB.
 *
 * The band *is* TSB — CTL−ATL — so shading the space between the two lines
 * says "fitness above fatigue: fresh" (emerald) or "fatigue above fitness:
 * loaded" (amber) without plotting a third series on a scale that would make
 * the two readings impossible to compare.
 *
 * Hand-rolled SVG rather than the chart library: the panel is collapsed by
 * default, and a responsive container measures zero height inside a closed
 * `<details>` — this renders the same shape before and after opening.
 */
export const LoadTrendChart = ({
  ctlSeries,
  atlSeries,
  label,
  width = 320,
  height = 96,
}: LoadTrendChartProps) => {
  const pointCount = Math.min(ctlSeries.length, atlSeries.length);
  if (pointCount < 2) return null;

  const projection = createTrendProjection([ctlSeries, atlSeries], width, height);
  const segments = buildSeriesBand(ctlSeries, atlSeries, projection.x, projection.y);
  const linePath = (values: number[]) =>
    values
      .map((value, index) => `${index === 0 ? 'M' : 'L'} ${projection.x(index).toFixed(2)} ${projection.y(value).toFixed(2)}`)
      .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-24 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {segments.map((segment, index) => (
        <path
          key={index}
          d={segment.path}
          fill={segment.above ? FRESH_FILL : FATIGUED_FILL}
          stroke="none"
        />
      ))}
      <path d={linePath(ctlSeries)} fill="none" stroke={CTL_COLOR} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d={linePath(atlSeries)} fill="none" stroke={ATL_COLOR} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};
