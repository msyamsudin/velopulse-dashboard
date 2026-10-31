import { beforeEach, describe, expect, it } from 'vitest';
import { useBluetoothStore } from '../useBluetoothStore';
import { useWorkoutStore, type HistoryData } from '../useWorkoutStore';

const point = (index: number, power = 200): HistoryData => ({
  time: `8:00:0${index}`,
  ts: 1_000_000 + index * 1000,
  hr: 120,
  cadence: 85,
  power,
  speed: 30,
  distance: 0,
  resistance: 0,
  calories: 0,
});

describe('saveTestSession', () => {
  beforeEach(() => {
    useWorkoutStore.setState({ sessionHistory: [] });
    useBluetoothStore.setState({ isSimulating: false });
  });

  it('stores an FTP test as a regular session with its measured watts', async () => {
    const history = [point(0), point(1), point(2)];

    const session = await useWorkoutStore.getState().saveTestSession({
      history,
      testType: 'ftp',
      ftpWatts: 190,
      deviceName: 'Kettler Racer',
    });

    expect(session).not.toBeNull();
    expect(session?.stats.testType).toBe('ftp');
    expect(session?.stats.ftpTestWatts).toBe(190);
    expect(session?.stats.ftpTestDevice).toBe('Kettler Racer');
    expect(session?.stats.avgPower).toBe(200);
    expect(session?.duration).toBe(2);
    expect(useWorkoutStore.getState().sessionHistory[0]?.id).toBe(session?.id);
  });

  it('keeps the session but drops an invalid result', async () => {
    const history = [point(0), point(1), point(2)];

    const session = await useWorkoutStore.getState().saveTestSession({
      history,
      testType: 'ftp',
      ftpWatts: null,
    });

    expect(session?.stats.testType).toBe('ftp');
    expect(session?.stats.ftpTestWatts).toBeUndefined();
  });

  it('refuses to persist a session with a single sample', async () => {
    const session = await useWorkoutStore.getState().saveTestSession({
      history: [point(0)],
      testType: 'ftp',
      ftpWatts: 190,
    });

    expect(session).toBeNull();
    expect(useWorkoutStore.getState().sessionHistory).toHaveLength(0);
  });

  it('marks a simulated test session so it never reaches the cloud', async () => {
    useBluetoothStore.setState({ isSimulating: true });

    const session = await useWorkoutStore.getState().saveTestSession({
      history: [point(0), point(1), point(2)],
      testType: 'ftp',
      ftpWatts: 190,
    });

    expect(session?.simulated).toBe(true);
    expect(session?.synced_to_supabase).toBe(false);
  });
});
