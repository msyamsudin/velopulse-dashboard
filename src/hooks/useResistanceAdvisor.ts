import { useEffect, useRef } from 'react';
import { useResistancePlanStore } from '@/store/useResistancePlanStore';

const TOLERANCE = 5;
const CHANGE_THRESHOLD = 2;

export function useResistanceAdvisor(distanceMeters: number, currentResistance: number) {
  const { enabled, variations } = useResistancePlanStore();
  const prevKmRef = useRef(-1);
  const baselineRef = useRef<number | null>(null);

  const distanceKm = distanceMeters / 1000;
  const currentKmSegment = Math.floor(distanceKm);
  const variationIndex = Math.min(currentKmSegment, variations.length - 1);
  const suggestedResistance = enabled && variationIndex >= 0 && currentKmSegment < variations.length
    ? variations[variationIndex]
    : null;

  const hasMore = enabled && currentKmSegment < variations.length - 1;
  const kmJustCrossed = prevKmRef.current >= 0 && currentKmSegment > prevKmRef.current;
  const matched = suggestedResistance !== null && Math.abs(currentResistance - suggestedResistance) <= TOLERANCE;

  const userChanged = baselineRef.current !== null
    && Math.abs(currentResistance - baselineRef.current) > CHANGE_THRESHOLD;

  useEffect(() => {
    if (!enabled) {
      baselineRef.current = null;
      prevKmRef.current = -1;
      return;
    }

    const prev = prevKmRef.current;
    prevKmRef.current = currentKmSegment;

    if (prev !== currentKmSegment || baselineRef.current === null) {
      baselineRef.current = currentResistance;
    }
  });

  return { suggestedResistance, matched, kmJustCrossed, userChanged, enabled, currentKmSegment, hasMore };
}
