/**
 * Body history: dated weight and resting-HR entries.
 *
 * The profile holds one static weight, so W/kg could only ever be computed
 * against today's body — a session from three months ago was divided by a
 * weight the rider may not have had. Every profile save now appends a dated
 * entry here, which lets each session use the weight recorded at its own date
 * and gives W/kg and kcal/kg a trend across months.
 *
 * Entries are kept on this device (localStorage): the `profiles` table in
 * Supabase has no history column, and writing an unknown field would break the
 * profile upsert. Nothing here is ever sent to the cloud.
 */
import { todayKey } from './hrv';

export interface BodyHistoryEntry {
  /** Local date key (YYYY-MM-DD); one entry per day, the latest value wins. */
  date: string;
  weight?: number;
  restingHr?: number;
}

export type BodyMetricKey = 'weight' | 'restingHr';

export interface BodyMetricPoint {
  date: string;
  value: number;
}

export interface BodyMetricTrend {
  first: BodyMetricPoint;
  last: BodyMetricPoint;
  /** last − first, 0 when only one entry carries the metric. */
  delta: number;
  /** Entries carrying this metric. */
  count: number;
}

export interface BodyTrend {
  weight: BodyMetricTrend | null;
  restingHr: BodyMetricTrend | null;
}

export const BODY_HISTORY_STORAGE_KEY = 'velopulse-body-history';

/** Roughly a decade of weekly entries; the oldest are dropped first. */
export const BODY_HISTORY_MAX_ENTRIES = 500;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Adds an entry to the history, pure.
 *
 * Same-day saves merge into the existing entry (a rider who corrects their
 * weight twice in an afternoon gets one point, not two), values that are not
 * positive numbers are ignored, and the list stays sorted oldest-first and
 * capped.
 */
export const appendBodyEntry = (
  entries: BodyHistoryEntry[],
  entry: BodyHistoryEntry
): BodyHistoryEntry[] => {
  if (!DATE_PATTERN.test(entry.date)) return entries;

  const weight = isPositiveNumber(entry.weight) ? entry.weight : undefined;
  const restingHr = isPositiveNumber(entry.restingHr) ? entry.restingHr : undefined;
  if (weight === undefined && restingHr === undefined) return entries;

  const merged: BodyHistoryEntry[] = [];
  let replaced = false;

  entries.forEach(existing => {
    if (!existing || !DATE_PATTERN.test(existing.date)) return;
    if (existing.date !== entry.date) {
      merged.push(existing);
      return;
    }
    replaced = true;
    merged.push({
      date: entry.date,
      // Fields not supplied today keep yesterday's value: saving only the
      // weight must not erase a resting HR recorded that morning.
      weight: weight ?? existing.weight,
      restingHr: restingHr ?? existing.restingHr,
    });
  });

  if (!replaced) merged.push({ date: entry.date, weight, restingHr });

  return merged
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-BODY_HISTORY_MAX_ENTRIES);
};

/**
 * Value of a metric at a point in time: the latest entry at or before the date.
 *
 * When the date predates every entry (the history only starts when the rider
 * first saves a profile), the earliest known value is used — the closest thing
 * to the truth we have — and null when nothing was ever recorded.
 */
export const resolveBodyMetric = (
  entries: BodyHistoryEntry[],
  isoDate: string,
  key: BodyMetricKey
): number | null => {
  const timestamp = Date.parse(isoDate);
  const dateKey = Number.isFinite(timestamp) ? todayKey(new Date(timestamp)) : null;

  const dated = entries
    .filter(entry => DATE_PATTERN.test(entry?.date ?? '') && isPositiveNumber(entry?.[key]))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (dated.length === 0) return null;
  if (dateKey === null) return dated[dated.length - 1][key] ?? null;

  const atOrBefore = dated.filter(entry => entry.date <= dateKey);
  const chosen = atOrBefore.length > 0 ? atOrBefore[atOrBefore.length - 1] : dated[0];

  return chosen[key] ?? null;
};

const buildTrend = (entries: BodyHistoryEntry[], key: BodyMetricKey): BodyMetricTrend | null => {
  const dated = entries
    .filter(entry => DATE_PATTERN.test(entry?.date ?? '') && isPositiveNumber(entry?.[key]))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (dated.length === 0) return null;

  const first = { date: dated[0].date, value: dated[0][key] as number };
  const last = { date: dated[dated.length - 1].date, value: dated[dated.length - 1][key] as number };

  return { first, last, delta: last.value - first.value, count: dated.length };
};

/** First/last/delta for both body metrics, or null per metric when never recorded. */
export const summarizeBodyTrend = (entries: BodyHistoryEntry[] = []): BodyTrend => ({
  weight: buildTrend(entries, 'weight'),
  restingHr: buildTrend(entries, 'restingHr'),
});

/** Reads the stored history. Never throws: a corrupt entry is dropped. */
export const readBodyHistory = (): BodyHistoryEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BODY_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is BodyHistoryEntry => Boolean(entry) && typeof entry.date === 'string')
      .filter(entry => DATE_PATTERN.test(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-BODY_HISTORY_MAX_ENTRIES);
  } catch {
    return [];
  }
};

/** Appends today's entry and persists it, returning the new history. */
export const recordBodyEntry = (entry: Omit<BodyHistoryEntry, 'date'> & { date?: string }): BodyHistoryEntry[] => {
  const next = appendBodyEntry(readBodyHistory(), { ...entry, date: entry.date ?? todayKey() });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BODY_HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full or unavailable: the in-memory list is still returned so the
      // session being viewed keeps its weight.
    }
  }
  return next;
};

/**
 * Latest resting HR recorded on this device, or null.
 *
 * Used to restore the field after a profile load: the cloud profile has no
 * resting-HR column, so the local history is the only place it survives.
 */
export const getLatestRestingHr = (): number | null =>
  resolveBodyMetric(readBodyHistory(), new Date().toISOString(), 'restingHr');
