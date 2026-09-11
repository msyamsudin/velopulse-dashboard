import { describe, expect, it } from 'vitest';
import { buildSeriesBand, createTrendProjection } from './chart-utils';

describe('createTrendProjection', () => {
  it('maps the data extremes onto the padded box', () => {
    const projection = createTrendProjection([[10, 30, 50]], 120, 60, 4);

    expect(projection.min).toBe(10);
    expect(projection.max).toBe(50);
    // Highest value at the top padding, lowest at the bottom padding.
    expect(projection.y(50)).toBeCloseTo(4);
    expect(projection.y(10)).toBeCloseTo(56);
    expect(projection.x(0)).toBeCloseTo(4);
    expect(projection.x(2)).toBeCloseTo(116);
  });

  it('scales every series against one shared range', () => {
    const projection = createTrendProjection([[0, 10], [40, 50]], 100, 40, 0);

    expect(projection.min).toBe(0);
    expect(projection.max).toBe(50);
    // Same scale for both series: 40 in the second series is not treated as a
    // second peak.
    expect(projection.y(40)).toBeLessThan(projection.y(10));
    expect(projection.y(0)).toBeCloseTo(40);
  });

  it('survives a flat or empty series without dividing by zero', () => {
    const flat = createTrendProjection([[25, 25, 25]], 100, 40, 0);
    expect(Number.isFinite(flat.y(25))).toBe(true);
    expect(flat.y(25)).toBeGreaterThanOrEqual(0);

    const empty = createTrendProjection([], 100, 40, 0);
    expect(empty.x(0)).toBe(0);
    expect(Number.isFinite(empty.y(0))).toBe(true);
  });

  it('places fractional indices linearly, for crossing points', () => {
    const projection = createTrendProjection([[0, 10, 20]], 100, 20, 0);
    expect(projection.x(0.5)).toBeCloseTo((projection.x(0) + projection.x(1)) / 2);
  });
});

describe('buildSeriesBand', () => {
  // Identity-ish projections keep the expected paths readable in the asserts.
  const projectX = (index: number) => index * 10;
  const projectY = (value: number) => value;

  it('returns one segment while the upper series stays on top', () => {
    const segments = buildSeriesBand([10, 10, 10], [0, 0, 0], projectX, projectY);

    expect(segments).toHaveLength(1);
    expect(segments[0].above).toBe(true);
    expect(segments[0].path.startsWith('M 0.00 10.00')).toBe(true);
    expect(segments[0].path.endsWith('Z')).toBe(true);
  });

  it('returns one segment while the lower series is on top', () => {
    const segments = buildSeriesBand([0, 0], [10, 10], projectX, projectY);

    expect(segments).toHaveLength(1);
    expect(segments[0].above).toBe(false);
  });

  it('splits at the crossing and interpolates its position', () => {
    // CTL 10→0 while ATL 0→10: they cross halfway between the two samples.
    const segments = buildSeriesBand([10, 0], [0, 10], projectX, projectY);

    expect(segments).toHaveLength(2);
    expect(segments[0].above).toBe(true);
    expect(segments[1].above).toBe(false);
    expect(segments[0].path).toContain('L 5.00 5.00');
    expect(segments[1].path.startsWith('M 5.00 5.00')).toBe(true);
  });

  it('handles repeated crossings across a longer series', () => {
    // above, crossing, below, crossing, above.
    const segments = buildSeriesBand([10, 10, 0, 0, 10], [0, 0, 10, 10, 0], projectX, projectY);

    expect(segments.map(segment => segment.above)).toEqual([true, false, true]);
  });

  it('needs at least two samples to draw anything', () => {
    expect(buildSeriesBand([10], [0], projectX, projectY)).toEqual([]);
    expect(buildSeriesBand([], [], projectX, projectY)).toEqual([]);
  });
});
