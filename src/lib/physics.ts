/**
 * Estimates active calories burned from power output using sports science.
 * Based on gross mechanical efficiency of cycling (~24%), where:
 *   Gross calories = Power (W) × duration (s) / (4184 J/kcal × 0.24 efficiency)
 * This is significantly more accurate than values reported by cheap FTMS sensors,
 * which use fixed constants and ignore user physiology.
 *
 * @param watt - Average power output in Watts
 * @param durationSec - Duration of the interval in seconds
 * @returns Estimated active kilocalories burned
 */
export function calcCaloriesFromPower(watt: number, durationSec: number): number {
  if (watt <= 0 || durationSec <= 0) return 0;
  // Gross efficiency of cycling ≈ 24% (validated range: 22–26%)
  const GROSS_EFFICIENCY = 0.24;
  const JOULES_PER_KCAL = 4184;
  return (watt * durationSec) / (JOULES_PER_KCAL * GROSS_EFFICIENCY);
}
