import { describe, expect, it } from 'vitest';
import {
  advanceSimulation,
  createSimulationState,
  resolveSimulationProfile,
  SIMULATION_PLAN,
  type SimulationState,
} from './telemetry-simulator';

const PROFILE = { ftp: 200, maxHr: 190, restingHr: 60 };

const run = (ticks: number, profile = PROFILE) => {
  let state = createSimulationState(profile);
  const telemetry: ReturnType<typeof advanceSimulation>['telemetry'][] = [];
  for (let i = 0; i < ticks; i += 1) {
    const step = advanceSimulation(state, profile);
    state = step.state;
    telemetry.push(step.telemetry);
  }
  return { state, telemetry };
};

describe('resolveSimulationProfile', () => {
  it('keeps a usable profile untouched', () => {
    expect(resolveSimulationProfile(PROFILE)).toEqual(PROFILE);
  });

  it('falls back to sane values when the profile is empty', () => {
    const resolved = resolveSimulationProfile({ ftp: 0, maxHr: 0, restingHr: 0 });

    expect(resolved.ftp).toBe(150);
    expect(resolved.maxHr).toBe(185);
    expect(resolved.restingHr).toBeGreaterThan(0);
    expect(resolved.restingHr).toBeLessThan(resolved.maxHr);
  });

  it('ignores a resting HR that is not below max HR', () => {
    const resolved = resolveSimulationProfile({ ftp: 200, maxHr: 180, restingHr: 200 });

    expect(resolved.restingHr).toBeLessThan(180);
  });
});

describe('advanceSimulation', () => {
  it('starts from rest and builds up power, cadence and speed within a minute', () => {
    const { state } = run(60);

    expect(state.power).toBeGreaterThan(50);
    expect(state.cadence).toBeGreaterThan(60);
    expect(state.speedKmh).toBeGreaterThan(15);
  });

  it('is deterministic: the same input always yields the same output', () => {
    const first = run(30);
    const second = run(30);

    expect(second).toEqual(first);
  });

  it('accumulates distance and calories monotonically', () => {
    const { telemetry } = run(120);

    for (let i = 1; i < telemetry.length; i += 1) {
      expect(telemetry[i].distance).toBeGreaterThanOrEqual(telemetry[i - 1].distance);
      expect(telemetry[i].calories).toBeGreaterThanOrEqual(telemetry[i - 1].calories);
    }
    // Dua menit mengayuh harus menghasilkan jarak dan kalori yang terlihat.
    expect(telemetry[telemetry.length - 1].distance).toBeGreaterThan(200);
    expect(telemetry[telemetry.length - 1].calories).toBeGreaterThan(10);
  });

  it('keeps heart rate inside the physiological range and above rest', () => {
    const { telemetry } = run(600);

    for (const sample of telemetry) {
      expect(sample.heartRate).toBeGreaterThanOrEqual(PROFILE.restingHr);
      expect(sample.heartRate).toBeLessThanOrEqual(PROFILE.maxHr);
    }
    // Setelah beberapa menit, HR harus sudah naik dari nilai istirahat.
    expect(telemetry[telemetry.length - 1].heartRate).toBeGreaterThan(PROFILE.restingHr + 30);
  });

  it('raises heart rate more during threshold than during warm-up', () => {
    const warmup = run(60).telemetry[59];
    // Tick ke-300 sudah masuk interval tempo/threshold (60 detik warm-up tidak
    // cukup; warm-up sekarang 90 detik), jadi ambil sampel setelah 5 menit.
    const hard = run(300).telemetry[299];

    expect(hard.power).toBeGreaterThan(warmup.power);
    expect(hard.heartRate).toBeGreaterThan(warmup.heartRate);
  });

  it('derives resistance from the current interval intensity', () => {
    // 90 detik warm-up + 180 detik endurance = 270; tick ke-300 sudah di tempo,
    // dan interval threshold mulai pada detik ke-420.
    const telemetry = run(SIMULATION_PLAN[0].durationSeconds + SIMULATION_PLAN[1].durationSeconds + SIMULATION_PLAN[2].durationSeconds + 50).telemetry;

    for (const sample of telemetry) {
      expect(sample.resistance).toBeGreaterThanOrEqual(1);
      expect(sample.resistance).toBeLessThanOrEqual(12);
    }

    const warmup = telemetry[10].resistance;
    const threshold = telemetry[telemetry.length - 1].resistance;
    expect(threshold).toBeGreaterThan(warmup);
  });

  it('cycles back to the first interval after the plan completes', () => {
    const totalDuration = SIMULATION_PLAN.reduce((sum, phase) => sum + phase.durationSeconds, 0);
    const { state } = run(totalDuration + 1);

    expect(state.phaseIndex).toBe(0);
    expect(state.phaseElapsedSeconds).toBe(1);
  });

  it('does not integrate anything for a zero-length tick', () => {
    const start: SimulationState = createSimulationState(PROFILE);
    const { state } = advanceSimulation(start, PROFILE, 0);

    expect(state.distanceMeters).toBe(0);
    expect(state.calories).toBe(0);
    expect(state.power).toBe(0);
  });
});
