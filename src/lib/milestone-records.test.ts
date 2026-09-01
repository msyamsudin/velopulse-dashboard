import { describe, it, expect } from 'vitest';
import { detectSessionAchievements, getUpcomingMilestones, sortSessionsAscending } from './milestone-records';
import type { WorkoutSession } from '@/store/useWorkoutStore';

const mockSession = (id: string, startTime: number, distance: number, duration: number, calories: number, avgPower = 150, maxPower = 250, avgHr = 140, hrrScore?: number): WorkoutSession => ({
  id,
  sessionStartTime: startTime,
  date: new Date(startTime).toISOString(),
  duration,
  stats: {
    avgHr,
    maxHr: 180,
    avgPower,
    maxPower,
    avgCadence: 85,
    maxCadence: 105,
    ...(hrrScore ? { hrrScore, hrrClassification: 'Good' } : {}),
  },
  history: [
    { time: '0:00', distance: 0, calories: 0, hr: avgHr, cadence: 85, power: avgPower, speed: 25, resistance: 10 },
    { time: '10:00', distance, calories, hr: avgHr, cadence: 85, power: avgPower, speed: 25, resistance: 10 },
  ],
});

describe('milestone-records', () => {
  it('sorts sessions chronologically', () => {
    const s1 = mockSession('s1', 1000, 5000, 600, 100);
    const s2 = mockSession('s2', 2000, 5000, 600, 100);
    const s3 = mockSession('s3', 3000, 5000, 600, 100);

    const sorted = sortSessionsAscending([s3, s1, s2]);
    expect(sorted.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('detects 1st ride milestone for first session', () => {
    const s1 = mockSession('s1', 1000, 10000, 1200, 200);
    const result = detectSessionAchievements(s1, [s1]);

    expect(result.sessionIndex).toBe(1);
    expect(result.milestones.some(m => m.id === 'session_count_1')).toBe(true);
  });

  it('detects 100th Centurion milestone', () => {
    const sessions: WorkoutSession[] = [];
    for (let i = 1; i <= 100; i++) {
      sessions.push(mockSession(`s${i}`, i * 100000, 5000, 600, 100));
    }

    const centurion = sessions[99]; // 100th session
    const result = detectSessionAchievements(centurion, sessions);

    expect(result.sessionIndex).toBe(100);
    expect(result.isCenturion).toBe(true);
    expect(result.milestones.some(m => m.id === 'session_count_100')).toBe(true);
  });

  it('detects cumulative distance milestone', () => {
    // 4 sessions of 15km each = 60km total. Milestone is 50km
    const s1 = mockSession('s1', 1000, 15000, 1800, 300);
    const s2 = mockSession('s2', 2000, 15000, 1800, 300);
    const s3 = mockSession('s3', 3000, 15000, 1800, 300);
    const s4 = mockSession('s4', 4000, 15000, 1800, 300); // Crosses 50km (reaches 60km)

    const all = [s1, s2, s3, s4];
    const res4 = detectSessionAchievements(s4, all);

    expect(res4.milestones.some(m => m.id === 'cumulative_distance_50')).toBe(true);
  });

  it('detects PR for higher power and distance', () => {
    const s1 = mockSession('s1', 1000, 10000, 1200, 200, 150, 250);
    const s2 = mockSession('s2', 2000, 20000, 2400, 400, 210, 380); // Higher power & distance

    const all = [s1, s2];
    const res2 = detectSessionAchievements(s2, all);

    expect(res2.personalRecords.some(pr => pr.id === 'pr_distance')).toBe(true);
    expect(res2.personalRecords.some(pr => pr.id === 'pr_peak_power')).toBe(true);
    expect(res2.personalRecords.some(pr => pr.id === 'pr_avg_power')).toBe(true);
  });

  it('calculates upcoming milestones accurately', () => {
    const s1 = mockSession('s1', 1000, 10000, 1200, 200);
    const upcoming = getUpcomingMilestones([s1]);

    const sessionCount = upcoming.find(u => u.type === 'session_count');
    expect(sessionCount?.target).toBe(10);
    expect(sessionCount?.remaining).toBe(9);

    const dist = upcoming.find(u => u.type === 'distance');
    expect(dist?.target).toBe(50);
    expect(dist?.remaining).toBe(40);
  });
});
