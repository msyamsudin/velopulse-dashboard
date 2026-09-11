/**
 * Profile validation gate.
 *
 * FTP and weight are *metric* gates, never ride gates. A rider without them can
 * still start and record a workout — heart-rate zones only need `maxHr`, which
 * the age field derives automatically through `calculateMaxHr`. What a missing
 * FTP or weight really costs is the *interpretation*: every power sample would
 * fall into Z1 and W/kg would be meaningless, which is worse than showing
 * nothing.
 *
 * Every surface that renders a metric depending on FTP or weight (power-zone
 * block, W/kg, kcal/kg/h, the "profile incomplete" badge) asks this module
 * instead of testing the raw numbers, so "what counts as a complete profile"
 * has exactly one definition.
 */

export interface ProfileLike {
  ftp?: number | null;
  weight?: number | null;
}

/** Metric inputs that can be missing without blocking a ride. */
export type ProfileMetricField = 'ftp' | 'weight';

export interface ProfileGate {
  /** FTP is usable: power zones and %FTP can be rendered. */
  hasFtp: boolean;
  /** Weight is usable: W/kg and kcal/kg/h can be rendered. */
  hasWeight: boolean;
  /** Both metric inputs are present. */
  complete: boolean;
  /** Fields that still need a value, in the order they should be offered. */
  missing: ProfileMetricField[];
}

const isUsable = (value: number | null | undefined): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const getProfileGate = (profile: ProfileLike = {}): ProfileGate => {
  const hasFtp = isUsable(profile.ftp);
  const hasWeight = isUsable(profile.weight);
  const missing: ProfileMetricField[] = [];
  if (!hasFtp) missing.push('ftp');
  if (!hasWeight) missing.push('weight');

  return { hasFtp, hasWeight, complete: hasFtp && hasWeight, missing };
};
