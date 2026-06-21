export interface JourneyTelemetry {
  heartRate: number;
  cadence: number;
  power: number;
  speed: number;
  resistance: number;
}

export interface JourneyVisualState {
  velocity: number;
  intensity: number;
  hrZone: number;
  grade: number;
  hasBikeSignal: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const getJourneyVisualState = (
  telemetry: JourneyTelemetry,
  maxHeartRate: number,
  bikeConnected: boolean
): JourneyVisualState => {
  const safeMaxHeartRate = maxHeartRate > 0 ? maxHeartRate : 190;
  const hrRatio = telemetry.heartRate / safeMaxHeartRate;
  const hrZone = telemetry.heartRate <= 0
    ? -1
    : clamp(Math.floor((hrRatio - 0.5) / 0.1), 0, 4);
  const effort = Math.max(telemetry.cadence / 95, telemetry.power / 260, telemetry.speed / 32);

  return {
    velocity: bikeConnected
      ? clamp(3 + telemetry.cadence * 0.075 + telemetry.power * 0.012 + telemetry.speed * 0.08, 3, 22)
      : 2.4,
    intensity: clamp(effort, 0, 1.35),
    hrZone,
    grade: clamp(telemetry.resistance / 100, 0, 1),
    hasBikeSignal: bikeConnected && (
      telemetry.cadence > 0 || telemetry.power > 0 || telemetry.speed > 0
    )
  };
};
