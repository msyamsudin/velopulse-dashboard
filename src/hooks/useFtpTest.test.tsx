import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFtpTest } from './useFtpTest';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import type { SaveTestSessionInput, WorkoutSession } from '@/store/useWorkoutStore';
import { useWorkoutStore } from '@/store/useWorkoutStore';

const originalSaveTestSession = useWorkoutStore.getState().saveTestSession;

type SaveTestSession = (input: SaveTestSessionInput) => Promise<WorkoutSession | null>;

const connectBike = (power = 200) => {
  useBluetoothStore.setState({
    bikeConnected: true,
    data: { power, heartRate: 120, cadence: 85, speed: 30 },
    lastUpdate: { power: Date.now(), heartRate: Date.now(), cadence: Date.now(), speed: Date.now() },
  });
};

describe('useFtpTest', () => {
  let saveSpy: ReturnType<typeof vi.fn<SaveTestSession>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T08:00:00Z'));
    saveSpy = vi.fn<SaveTestSession>(async () => null);
    useWorkoutStore.setState({ saveTestSession: saveSpy, sessionHistory: [] });
    useBluetoothStore.setState({
      bikeConnected: false,
      bikeDevice: null,
      data: {},
      lastUpdate: {},
    });
  });

  afterEach(() => {
    // Lepas hook dulu: mengembalikan aksi store setelah unmount mencegah
    // pembaruan state di luar act().
    cleanup();
    useWorkoutStore.setState({ saveTestSession: originalSaveTestSession });
    vi.useRealTimers();
  });

  it('runs warm-up and effort, then reports 95% of the average power', async () => {
    connectBike(200);
    const { result } = renderHook(() => useFtpTest());

    act(() => result.current.open());
    expect(result.current.status).toBe('intro');

    act(() => result.current.start());
    expect(result.current.status).toBe('warmup');

    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(result.current.status).toBe('effort');

    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('result');
    expect(result.current.result?.valid).toBe(true);
    expect(result.current.result?.avgPower).toBe(200);
    expect(result.current.result?.ftp).toBe(190);
    expect(result.current.saveState).toBe('saved');
    expect(saveSpy).toHaveBeenCalledTimes(1);

    const saved = saveSpy.mock.calls[0][0];
    expect(saved.testType).toBe('ftp');
    expect(saved.ftpWatts).toBe(190);
  });

  it('skips the warm-up without losing the first second of effort', async () => {
    connectBike(250);
    const { result } = renderHook(() => useFtpTest());

    act(() => result.current.open());
    act(() => result.current.start());
    act(() => result.current.skipWarmup());
    expect(result.current.status).toBe('effort');
    expect(result.current.effortRemaining).toBe(20 * 60);

    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.result?.valid).toBe(true);
    expect(result.current.result?.coverageSeconds).toBeGreaterThanOrEqual(1199);
    expect(result.current.result?.ftp).toBe(238);
  });

  it('refuses to start without a bike', () => {
    const { result } = renderHook(() => useFtpTest());

    act(() => result.current.open());
    act(() => result.current.start());

    expect(result.current.status).toBe('intro');
    expect(result.current.abortReason).toBe('bike');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('cancels mid-effort without saving a session', () => {
    connectBike(200);
    const { result } = renderHook(() => useFtpTest());

    act(() => result.current.open());
    act(() => result.current.start());
    act(() => result.current.skipWarmup());
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    act(() => result.current.cancel());

    expect(result.current.status).toBe('intro');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('stops the test when the bike disconnects mid-effort', () => {
    connectBike(200);
    const { result } = renderHook(() => useFtpTest());

    act(() => result.current.open());
    act(() => result.current.start());
    act(() => result.current.skipWarmup());
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    act(() => {
      useBluetoothStore.setState({ bikeConnected: false });
    });

    expect(result.current.status).toBe('intro');
    expect(result.current.abortReason).toBe('bike');
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
