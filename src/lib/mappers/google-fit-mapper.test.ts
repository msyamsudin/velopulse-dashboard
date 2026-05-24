import { describe, it, expect } from 'vitest';
import { mapWorkoutToFitPoints } from './google-fit-mapper';
import { FIT_TYPES } from '../google-fit-service';

describe('Google Fit Mapper', () => {
  const startTime = 1625097600000; // Sample timestamp
  const endTime = startTime + 60000;
  const mockHistory = [
    { hr: 150, power: 200, cadence: 90, speed: 30, distance: 10, calories: 1 },
    { hr: 155, power: 210, cadence: 92, speed: 31, distance: 20, calories: 2 }
  ];
  const maxHr = 190;

  it('maps workout points to the correct Fit data types', () => {
    const metrics = mapWorkoutToFitPoints(startTime, endTime, mockHistory, maxHr);
    
    expect(metrics.hr.type).toBe(FIT_TYPES.HEART_RATE);
    expect(metrics.hr.points.length).toBeGreaterThan(0);
    expect(metrics.power.points.length).toBeGreaterThan(0);
  });

  it('correctly creates an activity segment', () => {
    const metrics = mapWorkoutToFitPoints(startTime, endTime, mockHistory, maxHr);
    expect(metrics.activity.points[0].value[0].intVal).toBe(17); // Indoor Cycling
  });

  it('calculates duration correctly for the activity segment', () => {
    const metrics = mapWorkoutToFitPoints(startTime, endTime, mockHistory, maxHr);
    const start = BigInt(metrics.activity.points[0].startTimeNanos);
    const end = BigInt(metrics.activity.points[0].endTimeNanos);
    const durationMs = Number((end - start) / BigInt(1000000));
    expect(durationMs).toBe(60000);
  });
});
