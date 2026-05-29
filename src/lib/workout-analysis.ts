import { getSafeMaxHr } from './constants';

export const getSessionOutcome = (session: any) => {
  const history = session?.history || [];
  const lastPoint = history[history.length - 1] || {};

  return {
    distanceKm: Number(((lastPoint.distance || 0) / 1000).toFixed(2)),
    calories: Math.round(lastPoint.calories || 0),
    duration: session?.duration || 0,
    avgPower: session?.stats?.avgPower || 0,
    avgHr: session?.stats?.avgHr || 0,
  };
};

export const getWorkoutQuality = (session: any, maxHr: number) => {
  const safeMax = getSafeMaxHr(maxHr);
  const avgHr = session?.stats?.avgHr || 0;
  const ratio = avgHr > 0 ? avgHr / safeMax : 0;
  const avgPower = session?.stats?.avgPower || 0;

  if (ratio >= 0.9) return { label: 'Peak', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25' };
  if (ratio >= 0.8) return { label: 'Hard', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' };
  if (ratio >= 0.7 || avgPower >= 180) return { label: 'Tempo', color: 'text-yellow-300', bg: 'bg-yellow-400/10 border-yellow-400/25' };
  if (ratio >= 0.6 || avgPower >= 100) return { label: 'Endurance', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/25' };
  return { label: 'Easy', color: 'text-blue-300', bg: 'bg-blue-400/10 border-blue-400/25' };
};

export const getZoneInsight = (zones: any[] = []) => {
  if (zones.length === 0) return 'No heart-rate zone data';

  const dominant = zones.reduce((best, zone) => zone.percent > best.percent ? zone : best, zones[0]);
  const highZoneMinutes = zones
    .filter(zone => ['Anaerobic', 'Peak'].includes(zone.label))
    .reduce((total, zone) => total + (Number(zone.seconds) || 0) / 60, 0);

  if (highZoneMinutes >= 10) return `${Math.round(highZoneMinutes)} min above Z3`;
  if (dominant.label === 'Aerobic') return 'Mostly aerobic';
  if (dominant.label === 'Fat Burn') return 'Steady endurance';
  if (dominant.label === 'Warm Up') return 'Low-intensity session';
  return `${dominant.label} dominant`;
};

export const getMetricDelta = (current: number, previous?: number) => {
  if (previous === undefined || previous === null || previous <= 0) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.01) return { delta: 0, direction: 'flat' as const };
  return { delta, direction: delta > 0 ? 'up' as const : 'down' as const };
};
