import { describe, expect, it } from 'vitest';
import {
  computeSessionBestEfforts,
  getSessionBestEfforts,
  summarizeBestEfforts,
  type BestEffortPoint,
  type BestEffortSession,
} from './best-efforts';

const START_TS = Date.parse('2026-05-01T08:00:00.000Z');

/** 1 Hz series (default) from a per-sample power list. */
const powerSeries = (powers: number[], stepSeconds = 1): BestEffortPoint[] =>
  powers.map((power, index) => ({
    power,
    distance: 0,
    ts: START_TS + index * stepSeconds * 1000,
  }));

const flat = (value: number, samples: number): BestEffortPoint[] =>
  powerSeries(Array.from({ length: samples }, () => value));

/** Constant-speed series: distance grows by `metersPerSecond` per sample. */
const distanceSeries = (
  samples: number,
  metersPerSecond: number,
  options: { stepSeconds?: number; startMeters?: number } = {}
): BestEffortPoint[] => {
  const step = options.stepSeconds ?? 1;
  const startMeters = options.startMeters ?? 0;
  return Array.from({ length: samples }, (_, index) => ({
    power: 0,
    speed: metersPerSecond * 3.6,
    distance: startMeters + index * metersPerSecond * step,
    ts: START_TS + index * step * 1000,
  }));
};

const session = (overrides: Partial<BestEffortSession> = {}): BestEffortSession => ({
  id: 'session-1',
  date: '2026-05-01T08:00:00.000Z',
  duration: 1200,
  stats: { maxSpeed: 40 },
  history: [],
  ...overrides,
});

describe('power best efforts', () => {
  it('reports the best sustained window, not the session average', () => {
    // 5 min at 100 W, 5 min at 300 W, 5 min at 100 W: best 5 min = 300,
    // best 10 min straddles the effort = 200, best 20 min = 150.
    const history = powerSeries([
      ...Array.from({ length: 600 }, () => 100),
      ...Array.from({ length: 300 }, () => 300),
      ...Array.from({ length: 300 }, () => 100),
    ]);

    const efforts = computeSessionBestEfforts(session({ history, duration: 1200 }));

    expect(efforts.power).toEqual([
      { target: 300, label: '5 min', value: 300 },
      { target: 600, label: '10 min', value: 200 },
      { target: 1200, label: '20 min', value: 150 },
    ]);
    // Nothing lasts an hour.
    expect(efforts.power.find(effort => effort.target === 3600)).toBeUndefined();
  });

  it('produces no power entry for a session without power', () => {
    const coasting = computeSessionBestEfforts(session({ history: flat(0, 600), duration: 600 }));
    expect(coasting.power).toEqual([]);

    const silent = powerSeries(Array.from({ length: 600 }, () => 0))
      .map(point => ({ ...point, stalePower: true }));
    expect(computeSessionBestEfforts(session({ history: silent, duration: 600 })).power).toEqual([]);
  });

  it('keeps genuine 0 W samples inside the window instead of dropping them', () => {
    // 5 min at 200 W then 5 min coasting at a real 0 W (meter alive).
    const history = powerSeries([
      ...Array.from({ length: 300 }, () => 200),
      ...Array.from({ length: 300 }, () => 0),
    ]);

    const efforts = computeSessionBestEfforts(session({ history, duration: 600 }));

    expect(efforts.power.find(effort => effort.target === 300)?.value).toBe(200);
    // Dropping the coasting samples would have reported 200 W for ten minutes.
    expect(efforts.power.find(effort => effort.target === 600)?.value).toBe(100);
  });

  it('breaks the window at a watchdog-zeroed sample', () => {
    const clean = computeSessionBestEfforts(session({ history: flat(200, 3600), duration: 3600 }));
    expect(clean.power.find(effort => effort.target === 3600)?.value).toBe(200);

    const holed = flat(200, 3600);
    holed[1800] = { ...holed[1800], stalePower: true, power: 0 };
    const efforts = computeSessionBestEfforts(session({ history: holed, duration: 3600 }));

    // Neither side of the hole is an hour long, so there is no 60-minute best.
    expect(efforts.power.find(effort => effort.target === 3600)).toBeUndefined();
    expect(efforts.power.find(effort => effort.target === 1200)?.value).toBe(200);
  });

  it('breaks the window at a timestamp gap but tolerates a small one', () => {
    const withGap = (gapSeconds: number) =>
      flat(200, 3600).map((point, index) =>
        index > 1800 ? { ...point, ts: (point.ts ?? 0) + gapSeconds * 1000 } : point
      );

    // 4 s is inside DELTA_MAX_SECONDS (the calorie/recovery bound) → same ride.
    expect(
      computeSessionBestEfforts(session({ history: withGap(4), duration: 3600 }))
        .power.find(effort => effort.target === 3600)?.value
    ).toBe(200);

    // 30 s of dead time in the middle is a hole: no window may span it.
    expect(
      computeSessionBestEfforts(session({ history: withGap(30), duration: 3600 }))
        .power.find(effort => effort.target === 3600)
    ).toBeUndefined();
  });

  it('breaks the window when a sample carries no timestamp', () => {
    const history = flat(200, 3600);
    history[900] = { ...history[900], power: 200, ts: undefined };

    const efforts = computeSessionBestEfforts(session({ history, duration: 3600 }));

    expect(efforts.power.find(effort => effort.target === 3600)).toBeUndefined();
    // The 20-minute windows on either side of the hole survive.
    expect(efforts.power.find(effort => effort.target === 1200)?.value).toBe(200);
  });

  it('falls back to the nominal grid when a session has no timestamps (imported TCX)', () => {
    const history = Array.from({ length: 10 }, () => ({ power: 150, distance: 0 }));

    const efforts = computeSessionBestEfforts(session({ history, duration: 600 }));

    // 600 s over 10 points = 60 s per sample.
    expect(efforts.power).toEqual([
      { target: 300, label: '5 min', value: 150 },
      { target: 600, label: '10 min', value: 150 },
    ]);
  });

  it('reports nothing when neither timestamps nor a duration exist', () => {
    const history = Array.from({ length: 300 }, () => ({ power: 200, distance: 0 }));
    expect(computeSessionBestEfforts(session({ history, duration: 0 })).power).toEqual([]);
  });
});

describe('distance best efforts', () => {
  it('finds the fastest split per target in order', () => {
    // 10 m/s (36 km/h) for 600 s → 6 km.
    const history = distanceSeries(600, 10);

    const efforts = computeSessionBestEfforts(session({ history, duration: 600 }));

    expect(efforts.distance).toEqual([
      { target: 1000, label: '1 km', value: 100 },
      { target: 5000, label: '5 km', value: 500 },
    ]);
    expect(efforts.power).toEqual([]);
  });

  it('rejects a split whose implied speed beats anything the session recorded', () => {
    // 1 km in one second is a counter artefact, not a 3600 km/h ride.
    const history: BestEffortPoint[] = [
      { distance: 0, speed: 0, ts: START_TS },
      { distance: 1000, speed: 0, ts: START_TS + 1000 },
    ];

    expect(
      computeSessionBestEfforts(session({ history, duration: 1, stats: { maxSpeed: 40 } })).distance
    ).toEqual([]);
  });

  it('drops distance efforts when the session recorded no speed at all', () => {
    // Same stance as the personal records: without a speed reference there is
    // nothing to sanity-check a split against.
    const history = distanceSeries(600, 10).map(point => ({ ...point, speed: 0 }));

    expect(
      computeSessionBestEfforts(session({ history, duration: 600, stats: {} })).distance
    ).toEqual([]);
  });

  it('does not let a distance reset shorten the best split', () => {
    // 1 km in 100 s, then the counter resets and the same kilometre takes 200 s.
    const fast = distanceSeries(101, 10);
    const afterReset = distanceSeries(201, 5);
    const history = [...fast, ...afterReset];

    const efforts = computeSessionBestEfforts(session({ history, duration: 302 }));

    // Merging the two runs would have produced 301 s for the kilometre; the
    // honest split comes from the run that actually rode it.
    expect(efforts.distance.find(effort => effort.target === 1000)?.value).toBe(100);
  });

  it('ignores a session too short for the target', () => {
    const history = distanceSeries(90, 9);
    expect(computeSessionBestEfforts(session({ history, duration: 90 })).distance).toEqual([]);
  });
});

describe('summarizeBestEfforts', () => {
  const at = (id: string, date: string, history: BestEffortPoint[], duration: number) =>
    session({ id, date, history, duration });

  it('keeps the strongest effort per target across sessions', () => {
    const summary = summarizeBestEfforts([
      at('slow', '2026-04-01T00:00:00.000Z', flat(150, 300), 300),
      at('strong', '2026-03-01T00:00:00.000Z', flat(250, 300), 300),
    ]);

    expect(summary.power).toEqual([
      {
        target: 300,
        label: '5 min',
        value: 250,
        sessionId: 'strong',
        date: '2026-03-01T00:00:00.000Z',
      },
    ]);
  });

  it('keeps the fastest split, where lower is better', () => {
    const summary = summarizeBestEfforts([
      at('quick', '2026-04-01T00:00:00.000Z', distanceSeries(101, 10), 101),
      at('slow', '2026-05-01T00:00:00.000Z', distanceSeries(201, 5), 201),
    ]);

    expect(summary.distance).toHaveLength(1);
    expect(summary.distance[0].value).toBe(100);
    expect(summary.distance[0].sessionId).toBe('quick');
  });

  it('gives a tied effort to the most recent session', () => {
    const summary = summarizeBestEfforts([
      at('older', '2026-03-01T00:00:00.000Z', flat(200, 300), 300),
      at('newer', '2026-05-01T00:00:00.000Z', flat(200, 300), 300),
    ]);

    expect(summary.power).toHaveLength(1);
    expect(summary.power[0].sessionId).toBe('newer');
  });

  it('returns empty lists for an empty scope', () => {
    expect(summarizeBestEfforts([])).toEqual({ power: [], distance: [] });
  });

  it('caches the per-session result by session identity', () => {
    const target = session({ history: flat(200, 300), duration: 300 });

    expect(getSessionBestEfforts(target)).toBe(getSessionBestEfforts(target));
  });
});
