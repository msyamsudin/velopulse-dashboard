/**
 * Best-effort curve: the power a rider can actually hold for 5/10/20/60 minutes
 * and the fastest 1/5/10 km splits, read straight from a session's per-second
 * series.
 *
 * A single number per metric ("best average power", "fastest average speed")
 * says nothing about what was sustained, and the shape of the power-duration
 * curve is where the information is. Two properties matter more than precision:
 *
 * 1. **A hole never creates a record.** Watchdog-zeroed samples (`stalePower`),
 *    missing timestamps, clock jumps and distance resets all break the run they
 *    fall into, so no window ever spans data the app did not record. Because a
 *    window can only ever cover *more* than its target (never less), sparse or
 *    damaged series can overstate the elapsed time but cannot invent a fast
 *    effort.
 * 2. **A session without power contributes no power entry.** Coasting samples
 *    keep their real 0 W inside a window — they are genuine data and dropping
 *    them would flatter the rider — but a series that never produced watts is
 *    skipped instead of reporting "0 W for 20 minutes".
 */
import { DELTA_MAX_SECONDS } from './physics';

export interface BestEffortPoint {
  power?: number;
  distance?: number;
  speed?: number;
  ts?: number;
  stalePower?: boolean;
}

export interface BestEffortSession {
  id: string;
  date: string;
  /** Session duration in seconds; the fallback grid when no timestamps exist. */
  duration: number;
  stats?: { maxSpeed?: number };
  history?: BestEffortPoint[];
}

/** One target of one session, before aggregation. */
export interface SessionEffort {
  /** Power: window length in seconds. Distance: target distance in meters. */
  target: number;
  /** English label the UI translates ("5 min" / "1 km"). */
  label: string;
  /** Power: best average watts. Distance: fastest elapsed seconds. */
  value: number;
}

export interface BestEffort extends SessionEffort {
  /** Session that holds the record, for drill-down. */
  sessionId: string;
  /** ISO date of the session, i.e. when the record was set. */
  date: string;
}

export interface SessionBestEfforts {
  power: SessionEffort[];
  distance: SessionEffort[];
}

export interface BestEffortsSummary {
  power: BestEffort[];
  distance: BestEffort[];
}

/** Sustained-power windows, in display order. */
export const POWER_EFFORT_WINDOWS = [
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
  { seconds: 1200, label: '20 min' },
  { seconds: 3600, label: '60 min' },
] as const;

/** Split targets, in display order. */
export const DISTANCE_EFFORT_TARGETS = [
  { meters: 1000, label: '1 km' },
  { meters: 5000, label: '5 km' },
  { meters: 10000, label: '10 km' },
] as const;

interface TimeGrid {
  /** Seconds credited to one sample. */
  stepSeconds: number;
  /** True when real timestamps drive the timeline; false uses the nominal grid. */
  usesTimestamps: boolean;
}

/** One sample after the time grid is resolved. */
interface TimelineSample {
  power: number;
  /** Elapsed seconds from the first sample of the session. */
  seconds: number;
  distance: number;
  /** Watchdog-zeroed power: the sample exists but carries no measurement. */
  stalePower: boolean;
  /** True when a data hole sits between this sample and the previous one. */
  breakBefore: boolean;
}

/**
 * Resolves the sample spacing.
 *
 * Recorded sessions carry a wall-clock `ts` per point; imported TCX sessions do
 * not, and neither do some legacy/downsampled rows. The median timestamp delta
 * is used when it is plausible (≤ DELTA_MAX_SECONDS, the same bound the calorie
 * and recovery integrations use); otherwise the duration is spread evenly over
 * the points, exactly like the zone and TRIMP maths already do.
 */
const resolveTimeGrid = (history: BestEffortPoint[], duration: number): TimeGrid | null => {
  const deltas: number[] = [];
  let previous: number | undefined;

  history.forEach(point => {
    const ts = Number(point.ts);
    const hasTimestamp = Number.isFinite(ts) && ts > 0;
    if (hasTimestamp && previous !== undefined) {
      const delta = (ts - previous) / 1000;
      if (delta > 0 && delta <= DELTA_MAX_SECONDS) deltas.push(delta);
    }
    if (hasTimestamp) previous = ts;
  });

  if (deltas.length > 0) {
    deltas.sort((a, b) => a - b);
    return { stepSeconds: deltas[Math.floor(deltas.length / 2)], usesTimestamps: true };
  }

  if (duration > 0 && history.length > 0) {
    return { stepSeconds: duration / history.length, usesTimestamps: false };
  }

  return null;
};

const buildTimeline = (history: BestEffortPoint[], grid: TimeGrid): TimelineSample[] => {
  let previousTimestamp: number | undefined;
  let firstTimestamp: number | undefined;
  let lastSeconds = 0;

  return history.map((point, index) => {
    const ts = Number(point.ts);
    const hasTimestamp = Number.isFinite(ts) && ts > 0;

    // A hole is anything the app cannot vouch for: a sample with no clock while
    // the session runs on a real grid, a backwards/jumped clock, or the
    // watchdog zeroing the power stream.
    let breakBefore = false;
    if (grid.usesTimestamps && previousTimestamp !== undefined) {
      if (!hasTimestamp) {
        breakBefore = true;
      } else {
        const delta = (ts - previousTimestamp) / 1000;
        breakBefore = delta < 0 || delta > DELTA_MAX_SECONDS;
      }
    }
    if (hasTimestamp) {
      if (firstTimestamp === undefined) firstTimestamp = ts;
      previousTimestamp = ts;
    }

    const sampledSeconds = hasTimestamp && firstTimestamp !== undefined
      ? (ts - firstTimestamp) / 1000
      : lastSeconds;
    const seconds = grid.usesTimestamps
      ? (Number.isFinite(sampledSeconds) ? Math.max(lastSeconds, sampledSeconds) : lastSeconds)
      : index * grid.stepSeconds;
    lastSeconds = seconds;

    const power = Number(point.power ?? 0);
    const distance = Number(point.distance ?? 0);

    return {
      power: Number.isFinite(power) ? power : 0,
      seconds,
      distance: Number.isFinite(distance) ? distance : 0,
      stalePower: point.stalePower === true,
      breakBefore,
    };
  });
};

/**
 * Power runs: broken by holes only. A genuine 0 W sample (coasting with the
 * power meter alive) stays inside the run — dropping it would report a power
 * the rider never held for that whole window.
 */
const splitPowerRuns = (samples: TimelineSample[]): number[][] => {
  const runs: number[][] = [];
  let current: number[] = [];

  samples.forEach(sample => {
    if (sample.breakBefore || sample.stalePower) {
      if (current.length > 0) runs.push(current);
      current = [];
      return;
    }
    current.push(sample.power);
  });

  if (current.length > 0) runs.push(current);
  return runs;
};

/**
 * Distance runs: broken by holes and by a distance stream that goes backwards
 * (a counter offset or a re-paired bike). The reset case is defensive — a
 * decrease can never shorten a split, because a window's coverage is measured
 * as a distance *difference*.
 */
const splitDistanceRuns = (samples: TimelineSample[]): TimelineSample[][] => {
  const runs: TimelineSample[][] = [];
  let current: TimelineSample[] = [];

  samples.forEach(sample => {
    const previous = current[current.length - 1];
    const reset = previous !== undefined && sample.distance < previous.distance;
    if (sample.breakBefore || reset) {
      if (current.length > 0) runs.push(current);
      current = [];
    }
    current.push(sample);
  });

  if (current.length > 0) runs.push(current);
  return runs;
};

/** Fastest speed the session can plausibly have reached, in km/h. */
const getMaxPlausibleSpeedKmh = (session: BestEffortSession): number => {
  const recorded = Number(session.stats?.maxSpeed ?? 0);
  const fromHistory = (session.history || []).reduce(
    (max, point) => Math.max(max, Number(point.speed ?? 0)),
    0
  );
  return Number.isFinite(recorded) && Number.isFinite(fromHistory)
    ? Math.max(recorded, fromHistory)
    : 0;
};

const computePowerEfforts = (samples: TimelineSample[], grid: TimeGrid): SessionEffort[] => {
  const runs = splitPowerRuns(samples);
  const efforts: SessionEffort[] = [];

  POWER_EFFORT_WINDOWS.forEach(window => {
    // On a sparse or downsampled series the window rounds to at least one
    // sample: the effort then covers *more* than the window, which is the safe
    // direction (it can never flatter the rider).
    const windowSamples = Math.max(1, Math.round(window.seconds / grid.stepSeconds));
    let best = 0;

    runs.forEach(run => {
      if (run.length < windowSamples) return;

      let sum = 0;
      for (let i = 0; i < windowSamples; i++) sum += run[i];
      best = Math.max(best, sum / windowSamples);

      for (let i = windowSamples; i < run.length; i++) {
        sum += run[i] - run[i - windowSamples];
        best = Math.max(best, sum / windowSamples);
      }
    });

    const value = Math.round(best);
    if (value > 0) efforts.push({ target: window.seconds, label: window.label, value });
  });

  return efforts;
};

const computeDistanceEfforts = (
  samples: TimelineSample[],
  maxPlausibleSpeedKmh: number
): SessionEffort[] => {
  // Without a speed reference there is nothing to sanity-check a split against,
  // so a corrupt distance stream could crown itself. The personal records take
  // the same stance (see getPersonalRecords).
  if (!(maxPlausibleSpeedKmh > 0)) return [];

  const runs = splitDistanceRuns(samples);
  const efforts: SessionEffort[] = [];

  DISTANCE_EFFORT_TARGETS.forEach(target => {
    let best = Number.POSITIVE_INFINITY;

    runs.forEach(run => {
      let start = 0;
      for (let end = 1; end < run.length; end++) {
        // Shrink from the left for as long as the window still covers the
        // target: the tightest window is the fastest split that reaches it.
        while (start + 1 < end && run[end].distance - run[start + 1].distance >= target.meters) {
          start += 1;
        }
        if (run[end].distance - run[start].distance < target.meters) continue;

        const elapsed = run[end].seconds - run[start].seconds;
        if (elapsed <= 0) continue;

        // The same physical-consistency guard the personal records use: a split
        // whose implied average speed beats the fastest speed the session ever
        // recorded is a counter artefact, not a ride.
        const impliedSpeedKmh = (target.meters / elapsed) * 3.6;
        if (maxPlausibleSpeedKmh > 0 && impliedSpeedKmh > maxPlausibleSpeedKmh * 1.05 + 0.5) continue;

        best = Math.min(best, elapsed);
      }
    });

    if (Number.isFinite(best) && best > 0) {
      efforts.push({ target: target.meters, label: target.label, value: Math.round(best) });
    }
  });

  return efforts;
};

/** Uncached per-session computation. Prefer `getSessionBestEfforts`. */
export const computeSessionBestEfforts = (session: BestEffortSession): SessionBestEfforts => {
  const history = session.history || [];
  if (history.length === 0) return { power: [], distance: [] };

  const grid = resolveTimeGrid(history, session.duration || 0);
  if (!grid || !(grid.stepSeconds > 0)) return { power: [], distance: [] };

  const samples = buildTimeline(history, grid);

  return {
    power: computePowerEfforts(samples, grid),
    distance: computeDistanceEfforts(samples, getMaxPlausibleSpeedKmh(session)),
  };
};

/**
 * Session-keyed memo, the same pattern as the `fullStatsCache` in
 * `useWorkoutHistoryData`: the Records tab re-renders on every range/metadata
 * change, and a per-second series must not be rescanned each time.
 */
const bestEffortsCache = new WeakMap<object, SessionBestEfforts>();

export const getSessionBestEfforts = (session: BestEffortSession): SessionBestEfforts => {
  const cached = bestEffortsCache.get(session);
  if (cached) return cached;

  const computed = computeSessionBestEfforts(session);
  bestEffortsCache.set(session, computed);
  return computed;
};

/** True when the candidate should replace the current record holder. */
const beats = (
  current: BestEffort | undefined,
  candidate: BestEffort,
  higherIsBetter: boolean
): boolean => {
  if (!current) return true;
  if (candidate.value !== current.value) {
    return higherIsBetter ? candidate.value > current.value : candidate.value < current.value;
  }
  // Equal effort: the record answers "when did I last do this", so the most
  // recent session keeps it.
  return Date.parse(candidate.date) > Date.parse(current.date);
};

/**
 * Best effort per target across the given sessions, in declared window order
 * (5→60 min, 1→10 km). Sessions are expected in any order.
 */
export const summarizeBestEfforts = (sessions: BestEffortSession[] = []): BestEffortsSummary => {
  const power = new Map<number, BestEffort>();
  const distance = new Map<number, BestEffort>();

  sessions.forEach(session => {
    const efforts = getSessionBestEfforts(session);

    efforts.power.forEach(effort => {
      const record: BestEffort = { ...effort, sessionId: session.id, date: session.date };
      if (beats(power.get(effort.target), record, true)) power.set(effort.target, record);
    });

    efforts.distance.forEach(effort => {
      const record: BestEffort = { ...effort, sessionId: session.id, date: session.date };
      if (beats(distance.get(effort.target), record, false)) distance.set(effort.target, record);
    });
  });

  return {
    power: POWER_EFFORT_WINDOWS
      .map(window => power.get(window.seconds))
      .filter((record): record is BestEffort => Boolean(record)),
    distance: DISTANCE_EFFORT_TARGETS
      .map(target => distance.get(target.meters))
      .filter((record): record is BestEffort => Boolean(record)),
  };
};
