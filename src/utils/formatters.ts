export const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Formats a session distance for the ride cockpit. Sub-kilometer values are
 * readable from the start of the ride: below 100 m it shows whole meters
 * ("75 M" instead of a misleading "0.00"), from 0.10 km onward it switches to
 * kilometers with two decimals ("0.10 KM", "12.34 KM"). Returns null when
 * there is no distance yet (no signal / session just started).
 */
export const formatDistanceMeters = (meters: number): { value: string; unit: 'M' | 'KM' } | null => {
  if (!meters || meters <= 0) return null;
  if (meters < 100) return { value: `${Math.round(meters)}`, unit: 'M' };
  return { value: (meters / 1000).toFixed(2), unit: 'KM' };
};
