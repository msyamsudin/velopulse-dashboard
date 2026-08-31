import { describe, expect, it } from 'vitest';
import { generateCombinedTCX, generateTCX } from './export-service';
import type { WorkoutSession } from './export-service';

const baseSession: WorkoutSession = {
  id: 's1',
  sessionStartTime: 1700000000000,
  date: '2023-11-14T22:13:20.000Z',
  duration: 120,
  stats: { avgHr: 140, maxHr: 165, avgPower: 200, maxPower: 300, avgCadence: 80, maxCadence: 95 },
  history: [],
};

describe('generateTCX', () => {
  it('writes lap-level HR summary elements', () => {
    const session: WorkoutSession = {
      ...baseSession,
      history: [
        { time: '00:00:01', ts: 1700000001000, hr: 130, cadence: 80, power: 190, speed: 25, distance: 10, resistance: 45, calories: 0.5 },
        { time: '00:00:02', ts: 1700000002000, hr: 150, cadence: 82, power: 210, speed: 26, distance: 20, resistance: 50, calories: 1 },
      ],
    };

    const tcx = generateTCX(session);

    expect(tcx).toContain('<MaximumHeartRateBpm><Value>165</Value></MaximumHeartRateBpm>');
    expect(tcx).toContain('<AverageHeartRateBpm><Value>140</Value></AverageHeartRateBpm>');
  });

  it('writes the resistance extension per trackpoint', () => {
    const session: WorkoutSession = {
      ...baseSession,
      history: [
        { time: '00:00:01', ts: 1700000001000, hr: 130, cadence: 80, power: 190, speed: 25, distance: 10, resistance: 45, calories: 0.5 },
        { time: '00:00:02', ts: 1700000002000, hr: 150, cadence: 82, power: 210, speed: 26, distance: 20, resistance: 50, calories: 1 },
      ],
    };

    const tcx = generateTCX(session);

    expect(tcx).toContain('xmlns:vp="https://velopulse.app/schemas/activity-extension/v1"');
    expect(tcx).toContain('<vp:Resistance>45</vp:Resistance>');
    expect(tcx).toContain('<vp:Resistance>50</vp:Resistance>');
    expect(tcx.match(/<vp:Resistance>/g)).toHaveLength(2);
  });

  it('omits the resistance extension when the point has no resistance data', () => {
    const session: WorkoutSession = {
      ...baseSession,
      history: [
        { time: '00:00:01', hr: 0, cadence: 0, power: 0, speed: 0, distance: 0, resistance: 0, calories: 45 },
      ],
    };

    const tcx = generateTCX(session);

    expect(tcx).not.toContain('<vp:Resistance>');
  });

  it('exports the accumulated calories for a power session', () => {
    const history = Array.from({ length: 120 }, (_, i) => ({
      time: `00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
      ts: 1700000000000 + i * 1000,
      hr: 140,
      cadence: 80,
      power: 200,
      speed: 25,
      distance: i * 10,
      resistance: 0,
      calories: ((i + 1) * 200) / (4184 * 0.24),
    }));
    const session: WorkoutSession = { ...baseSession, history };

    const tcx = generateTCX(session);

    expect(tcx).toContain(`<Calories>${Math.round((120 * 200) / (4184 * 0.24))}</Calories>`);
  });

  it('reintegrates power for legacy sessions whose calorie column flatlined', () => {
    const history = Array.from({ length: 60 }, (_, i) => ({
      time: `00:00:${String(i % 60).padStart(2, '0')}`,
      hr: 0,
      cadence: 0,
      power: 200,
      speed: 0,
      distance: 0,
      resistance: 0,
      calories: 0,
    }));
    const session: WorkoutSession = {
      ...baseSession,
      duration: 60,
      stats: { ...baseSession.stats, avgHr: 0, maxHr: 0 },
      history,
    };

    const tcx = generateTCX(session);

    expect(tcx).toContain(`<Calories>${Math.round((60 * 200) / (4184 * 0.24))}</Calories>`);
  });

  it('uses the stored sensor calories when the session has no power', () => {
    const session: WorkoutSession = {
      ...baseSession,
      history: [
        { time: '00:00:01', hr: 0, cadence: 0, power: 0, speed: 0, distance: 0, resistance: 0, calories: 45 },
      ],
    };

    const tcx = generateTCX(session);

    expect(tcx).toContain('<Calories>45</Calories>');
  });
});

describe('generateCombinedTCX', () => {
  it('includes lap HR summary for every activity', () => {
    const session: WorkoutSession = {
      ...baseSession,
      history: [
        { time: '00:00:01', ts: 1700000001000, hr: 130, cadence: 80, power: 190, speed: 25, distance: 10, resistance: 0, calories: 0.5 },
      ],
    };

    const tcx = generateCombinedTCX([session, session]);

    expect(tcx.match(/<MaximumHeartRateBpm>/g)).toHaveLength(2);
    expect(tcx.match(/<AverageHeartRateBpm>/g)).toHaveLength(2);
  });
});
