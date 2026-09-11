/**
 * Power-zone aggregation (Z1–Z7 from `POWER_ZONES`).
 *
 * The gate lives here, not in the UI: with `ftp <= 0` every sample would land
 * in Z1, and a chart where the whole ride is "Recovery" is worse than no chart
 * at all. So an unusable FTP returns an empty summary (`zones: []`) and the
 * caller renders a prompt instead of numbers.
 *
 * Samples with no power (coasting, no power meter, watchdog-zeroed dropouts)
 * belong to no zone. They are reported as `belowZoneSeconds` rather than being
 * folded into Z1, which keeps the zone shares honest about how much of the ride
 * the distribution actually covers.
 */
import { POWER_ZONES } from './constants';
import { formatDuration } from '@/utils/formatters';

/** Minimal structural input so this module needs no store dependency. */
export interface PowerSample {
  power?: number;
}

export interface PowerZoneSession {
  history: PowerSample[];
  duration: number;
}

export interface PowerZoneShare {
  /** Zone label from POWER_ZONES, e.g. "Z3". */
  label: string;
  /** Zone name from POWER_ZONES, e.g. "Tempo". */
  name: string;
  /** Tailwind background class from POWER_ZONES. */
  color: string;
  /** Absolute watt range for the rider's FTP, e.g. "150-180". */
  range: string;
  seconds: number;
  /** Share of the counted power time (Z1–Z7), rounded. */
  percent: number;
  /** Zone seconds formatted as mm:ss / h:mm:ss. */
  time: string;
}

export interface PowerZoneSummary {
  /** Empty when the FTP gate is closed — never a fake all-Z1 distribution. */
  zones: PowerZoneShare[];
  /** Seconds attributed to a zone (samples with power > 0 only). */
  countedSeconds: number;
  /** Recorded seconds with no usable power sample (coasting or no power source). */
  belowZoneSeconds: number;
}

/**
 * Zone index for a power sample, or -1 when it cannot be attributed.
 *
 * Zones are walked top-down so a value exactly on a boundary belongs to the
 * harder zone, exactly like the heart-rate lookup; Z7 is the catch-all above
 * 150% FTP.
 */
export const getPowerZoneIndex = (power: number, ftp: number): number => {
  if (!Number.isFinite(power) || !Number.isFinite(ftp) || ftp <= 0 || power <= 0) return -1;

  const ratio = power / ftp;
  for (let i = POWER_ZONES.length - 1; i >= 0; i--) {
    if (ratio >= POWER_ZONES[i].minPct) return i;
  }
  return -1;
};

/** Absolute watt range for one zone, following the heart-rate legend style. */
export const getPowerZoneRangeLabel = (ftp: number, index: number): string => {
  const zone = POWER_ZONES[index];
  if (!zone) return '';

  const min = Math.round(ftp * zone.minPct);
  const max = Math.round(ftp * zone.maxPct);
  if (index === 0) return `<${max}`;
  if (index === POWER_ZONES.length - 1) return `>${min}`;
  return `${min}-${max}`;
};

export const summarizePowerZones = (
  sessions: PowerZoneSession[] = [],
  ftp = 0
): PowerZoneSummary => {
  if (!Number.isFinite(ftp) || ftp <= 0) {
    return { zones: [], countedSeconds: 0, belowZoneSeconds: 0 };
  }

  const zoneSeconds = POWER_ZONES.map(() => 0);
  let recordedSeconds = 0;

  sessions.forEach(session => {
    const history = session.history || [];
    const duration = Math.max(0, session.duration || 0);
    recordedSeconds += duration;
    if (history.length === 0) return;

    // Session duration is distributed evenly across its samples (the same
    // convention as the HR zones and Edwards TRIMP) so an imported or
    // downsampled workout is not over-weighted.
    const secondsPerSample = duration / history.length;

    history.forEach(sample => {
      const index = getPowerZoneIndex(Number(sample.power || 0), ftp);
      if (index < 0) return;
      zoneSeconds[index] += secondsPerSample;
    });
  });

  const roundedSeconds = zoneSeconds.map(value => Math.round(value));
  // Rounding error goes to the largest zone; the catch-all Z7 must never absorb
  // leftovers it did not earn.
  const roundingDelta = Math.round(zoneSeconds.reduce((total, value) => total + value, 0))
    - roundedSeconds.reduce((total, value) => total + value, 0);
  if (roundingDelta !== 0) {
    const largestZone = zoneSeconds.indexOf(Math.max(...zoneSeconds));
    roundedSeconds[largestZone] = Math.max(0, roundedSeconds[largestZone] + roundingDelta);
  }

  const countedSeconds = roundedSeconds.reduce((total, value) => total + value, 0);

  const zones: PowerZoneShare[] = roundedSeconds.map((seconds, index) => ({
    label: POWER_ZONES[index].label,
    name: POWER_ZONES[index].name,
    color: POWER_ZONES[index].color,
    range: getPowerZoneRangeLabel(ftp, index),
    seconds,
    percent: countedSeconds > 0 ? Math.round((seconds / countedSeconds) * 100) : 0,
    time: formatDuration(seconds),
  }));

  return {
    zones,
    countedSeconds,
    belowZoneSeconds: Math.max(0, Math.round(recordedSeconds) - countedSeconds),
  };
};
