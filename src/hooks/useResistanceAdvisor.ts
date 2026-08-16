import { useEffect, useState } from 'react';
import { useResistancePlanStore } from '@/store/useResistancePlanStore';

const TOLERANCE = 5;
const CHANGE_THRESHOLD = 2;

export function useResistanceAdvisor(distanceMeters: number, currentResistance: number) {
  const { enabled, variations } = useResistancePlanStore();
  // Tracked in state (not refs) so derived values stay readable during render.
  const [prevKm, setPrevKm] = useState(-1);
  const [baseline, setBaseline] = useState<number | null>(null);

  const distanceKm = distanceMeters / 1000;
  const currentKmSegment = Math.floor(distanceKm);
  const variationIndex = Math.min(currentKmSegment, variations.length - 1);
  const suggestedResistance = enabled && variationIndex >= 0 && currentKmSegment < variations.length
    ? variations[variationIndex]
    : null;

  const hasMore = enabled && currentKmSegment < variations.length - 1;
  const kmJustCrossed = prevKm >= 0 && currentKmSegment > prevKm;
  const matched = suggestedResistance !== null && Math.abs(currentResistance - suggestedResistance) <= TOLERANCE;

  const userChanged = baseline !== null
    && Math.abs(currentResistance - baseline) > CHANGE_THRESHOLD;

  // Runs after every render; same cadence as the previous ref-based version.
  // setPrevKm with an identical value bails out, so no extra re-render loop.
  useEffect(() => {
    if (!enabled) {
      setBaseline(null);
      setPrevKm(-1);
      return;
    }

    setPrevKm(currentKmSegment);

    if (prevKm !== currentKmSegment || baseline === null) {
      setBaseline(currentResistance);
    }
  });

  return { suggestedResistance, matched, kmJustCrossed, userChanged, enabled, currentKmSegment, hasMore };
}
