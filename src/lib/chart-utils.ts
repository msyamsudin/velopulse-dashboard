/**
 * Downsamples an array of data points to a maximum specified number of points.
 * This ensures charts remain readable and performant during long sessions.
 * 
 * @param data The array of data points to downsample.
 * @param maxPoints The maximum number of points to return.
 * @returns A downsampled version of the data.
 */
export const downsample = <T>(data: T[], maxPoints: number): T[] => {
  if (!data || data.length <= maxPoints) return data || [];
  
  const factor = data.length / maxPoints;
  const result: T[] = [];
  
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.floor(i * factor);
    result.push(data[index]);
  }
  
  // Always ensure the latest point is included to show current telemetry
  const lastPoint = data[data.length - 1];
  if (result[result.length - 1] !== lastPoint) {
    result[result.length - 1] = lastPoint;
  }
  
  return result;
};

/**
 * Maps series indices/values onto an SVG box.
 *
 * `x` is linear in the index (callers may pass a fractional index to place a
 * point between two samples, e.g. where two series cross).
 */
export interface TrendProjection {
  x: (index: number) => number;
  y: (value: number) => number;
  min: number;
  max: number;
}

export const createTrendProjection = (
  series: number[][],
  width: number,
  height: number,
  padding = 4
): TrendProjection => {
  const values = series.flat().filter(value => Number.isFinite(value));
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  // A flat series still needs a real span, or the y mapping divides by zero.
  const span = max - min || 1;
  const pointCount = Math.max(2, ...series.map(entry => entry.length));
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);

  return {
    min,
    max,
    x: (index) => padding + (index / (pointCount - 1)) * usableWidth,
    y: (value) => padding + (1 - (value - min) / span) * usableHeight,
  };
};

export interface SeriesBandSegment {
  /** Closed SVG path filling the area between the two series. */
  path: string;
  /** True while the upper series was on top (the band's sign). */
  above: boolean;
}

/**
 * Builds the shaded band between two series, split at every crossing so each
 * segment can be coloured by its sign.
 *
 * This is what makes a fitness/fatigue chart readable: the band is CTL−ATL, so
 * where fitness sits above fatigue the area is drawn as one colour and where
 * fatigue takes over as another, instead of one neutral blob.
 */
export const buildSeriesBand = (
  upper: number[],
  lower: number[],
  projectX: (index: number) => number,
  projectY: (value: number) => number
): SeriesBandSegment[] => {
  const count = Math.min(upper.length, lower.length);
  if (count < 2) return [];

  const segments: SeriesBandSegment[] = [];
  let current: { x: number; upperY: number; lowerY: number }[] = [];
  let currentAbove: boolean | null = null;

  const flush = () => {
    if (currentAbove === null || current.length < 2) {
      current = [];
      currentAbove = null;
      return;
    }

    const path = [
      ...current.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.upperY.toFixed(2)}`),
      ...current.slice().reverse().map(point => `L ${point.x.toFixed(2)} ${point.lowerY.toFixed(2)}`),
      'Z',
    ].join(' ');

    segments.push({ path, above: currentAbove });
    current = [];
    currentAbove = null;
  };

  for (let index = 0; index < count; index++) {
    const upperValue = upper[index];
    const lowerValue = lower[index];
    const above = upperValue >= lowerValue;
    const point = { x: projectX(index), upperY: projectY(upperValue), lowerY: projectY(lowerValue) };

    if (currentAbove === null) {
      currentAbove = above;
      current = [point];
      continue;
    }

    if (above === currentAbove) {
      current.push(point);
      continue;
    }

    // The two series cross between the previous sample and this one: split the
    // band at the interpolated crossing so neither segment spans both signs.
    const previousIndex = index - 1;
    const previousDifference = upper[previousIndex] - lower[previousIndex];
    const difference = upperValue - lowerValue;
    const t = previousDifference === difference ? 0 : previousDifference / (previousDifference - difference);
    const crossingValue = upper[previousIndex] + t * (upperValue - upper[previousIndex]);
    const crossing = {
      x: projectX(previousIndex + t),
      upperY: projectY(crossingValue),
      lowerY: projectY(crossingValue),
    };

    current.push(crossing);
    flush();
    currentAbove = above;
    current = [crossing, point];
  }

  flush();
  return segments;
};
