import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleFtmsIndoorBikeNotification,
  parseCscMeasurement,
  parseFtmsIndoorBikeData,
  useBluetoothStore,
  type BluetoothParseState,
} from './useBluetoothStore';

const makeState = (overrides: Partial<BluetoothParseState> = {}): BluetoothParseState => ({
  lastUpdate: {},
  cumulativeDistance: 0,
  cumulativeCalories: 0,
  lastRawDistance: 0,
  lastRawCalories: 0,
  distanceFromDevice: false,
  csc: {
    lastWheelRevs: -1,
    lastWheelEventTime: -1,
    lastCrankRevs: -1,
    lastCrankEventTime: -1,
  },
  wheelCircumferenceM: 0,
  ...overrides,
});

const makeView = (bytes: number[]) => {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new DataView(buffer);
  bytes.forEach((byte, index) => view.setUint8(index, byte));
  return view;
};

describe('parseFtmsIndoorBikeData', () => {
  it('parses speed, cadence and power from a minimal FTMS packet', () => {
    // flags: no more data (0x0000, so speed present), cadence (0x0004),
    //        power (0x0040) => 0x0044
    const packet = makeView([
      0x44, 0x00, // flags
      0xe2, 0x04, // speed = 1250 / 100 = 12.5 km/h
      0xaa, 0x00, // cadence = 170 / 2 = 85 rpm
      0xfa, 0x00, // power = 250 W (int16)
    ]);

    const { updates } = parseFtmsIndoorBikeData(packet, makeState(), 1000);

    expect(updates.speed).toBe(12.5);
    expect(updates.cadence).toBe(85);
    expect(updates.power).toBe(250);
  });

  it('parses total energy, heart rate and elapsed time from a full FTMS packet (regression: 5-byte offset bug)', () => {
    // flags: more data (0x0001, so no speed field), distance (0x0010),
    //        power (0x0040), totalEnergy (0x0100), energyPerHour (0x0200),
    //        energyPerMinute (0x0400), heartRate (0x0800), elapsedTime (0x2000)
    //        => 0x2F51
    const packet = makeView([
      0x51, 0x2f, // flags
      0xe8, 0x03, 0x00, // total distance = 1000 m
      0xc8, 0x00, // instantaneous power = 200 W
      0x32, 0x00, // total energy = 50 kcal
      0x58, 0x02, // energy per hour = 600 (skip)
      0x0a, // energy per minute = 10 (skip)
      0x91, // heart rate = 145
      0x2c, 0x01, // elapsed time = 300 s (skip)
    ]);

    const { updates, trackerUpdates } = parseFtmsIndoorBikeData(packet, makeState(), 1000);

    expect(updates.distance).toBe(1000);
    expect(updates.power).toBe(200);
    expect(updates.calories).toBe(50);
    expect(updates.heartRate).toBe(145);
    expect(trackerUpdates.cumulativeDistance).toBe(1000);
    expect(trackerUpdates.cumulativeCalories).toBe(50);
  });

  it('handles distance counter rollover without losing cumulative distance', () => {
    // flags 0x0011: more data set (no speed field) + total distance
    const first = makeView([0x11, 0x00, 0xe8, 0x03, 0x00]); // 1000 m
    const second = makeView([0x11, 0x00, 0x0a, 0x00, 0x00]); // device reset to 10 m

    const state = makeState();
    const firstResult = parseFtmsIndoorBikeData(first, state, 1000);
    const stateAfterFirst: BluetoothParseState = {
      ...state,
      cumulativeDistance: firstResult.trackerUpdates.cumulativeDistance ?? 0,
      lastRawDistance: firstResult.trackerUpdates.lastRawDistance ?? 0,
      distanceFromDevice: firstResult.trackerUpdates.distanceFromDevice ?? false,
    };
    const secondResult = parseFtmsIndoorBikeData(second, stateAfterFirst, 2000);

    expect(secondResult.updates.distance).toBe(1010);
  });

  it('handles total energy counter rollover', () => {
    // flags 0x0101: more data set (no speed field) + total energy
    const first = makeView([0x01, 0x01, 0x64, 0x00]); // energy = 100
    const second = makeView([0x01, 0x01, 0x05, 0x00]); // device reset to 5

    const state = makeState();
    const firstResult = parseFtmsIndoorBikeData(first, state, 1000);
    const stateAfterFirst: BluetoothParseState = {
      ...state,
      cumulativeCalories: firstResult.trackerUpdates.cumulativeCalories ?? 0,
      lastRawCalories: firstResult.trackerUpdates.lastRawCalories ?? 0,
    };
    const secondResult = parseFtmsIndoorBikeData(second, stateAfterFirst, 2000);

    expect(secondResult.updates.calories).toBe(105);
  });

  it('integrates speed into distance when the bike never reports Total Distance', () => {
    // flags 0x0000: speed only; speed = 900 / 100 = 9 km/h
    const packet = makeView([0x00, 0x00, 0x84, 0x03]);
    const state = makeState({ lastUpdate: { speed: 1000 } });

    // 1 s later: 9 km/h = 2.5 m/s × 1 s = 2.5 m
    const result = parseFtmsIndoorBikeData(packet, state, 2000);

    expect(result.updates.distance).toBeCloseTo(2.5, 1);
    expect(result.trackerUpdates.cumulativeDistance).toBeCloseTo(2.5, 1);
  });

  it('does not fall back to speed once the device reports Total Distance', () => {
    const packet = makeView([0x00, 0x00, 0x84, 0x03]); // speed 9 km/h only
    const state = makeState({ distanceFromDevice: true, lastUpdate: { speed: 1000 }, cumulativeDistance: 5000 });

    const result = parseFtmsIndoorBikeData(packet, state, 2000);

    expect(result.updates.distance).toBeUndefined();
  });

  it('rebases cumulative distance onto the device total when the first Total Distance arrives', () => {
    // flags 0x0010: speed (bit0 clear => present) + total distance.
    // speed = 500 / 100 = 5 km/h; distance = 1000 m.
    const packet = makeView([0x10, 0x00, 0xf4, 0x01, 0xe8, 0x03, 0x00]);
    const state = makeState({ cumulativeDistance: 42.5, lastUpdate: { speed: 1000 } }); // speed-fallback period

    const result = parseFtmsIndoorBikeData(packet, state, 3000);

    expect(result.updates.distance).toBe(1000); // device total wins over the 42.5 m estimate
    expect(result.trackerUpdates.cumulativeDistance).toBe(1000);
    expect(result.trackerUpdates.distanceFromDevice).toBe(true);
  });
});

describe('bike FTMS heart-rate is never used (strap is the only HR source)', () => {
  beforeEach(() => {
    // Reset the singleton store so tests don't leak state into each other.
    useBluetoothStore.setState({
      hrConnected: false,
      bikeConnected: false,
      data: {},
      lastUpdate: {},
    });
  });

  it('keeps the strap heart rate when the bike sends its own HR', () => {
    useBluetoothStore.setState({
      hrConnected: true,
      data: { heartRate: 76 },
      lastUpdate: { heartRate: 1000 },
    });

    // FTMS flags 0x0801 (more data + heart rate present), value 6.
    handleFtmsIndoorBikeNotification(makeView([0x01, 0x08, 0x06]), 2000, useBluetoothStore.setState);

    expect(useBluetoothStore.getState().data.heartRate).toBe(76);
  });

  it('never uses the bike heart rate, even without a strap (fallback removed)', () => {
    useBluetoothStore.setState({ data: { heartRate: 76 } });

    // Bike sends a *plausible* HR (145) with speed — must still be ignored.
    handleFtmsIndoorBikeNotification(makeView([0x00, 0x08, 0xe2, 0x04, 0x91]), 2000, useBluetoothStore.setState);

    const { data } = useBluetoothStore.getState();
    expect(data.heartRate).toBe(76); // strap value untouched, no bike fallback
    expect(data.speed).toBe(12.5);   // other bike metrics still apply
  });

  it('still applies other bike metrics when its heart rate is dropped', () => {
    // flags 0x0800: speed (0x0000 cleared => present) + heart rate; speed 1250 => 12.5 km/h
    useBluetoothStore.setState({ hrConnected: true, data: { heartRate: 76 } });

    handleFtmsIndoorBikeNotification(makeView([0x00, 0x08, 0xe2, 0x04, 0x06]), 2000, useBluetoothStore.setState);

    const { data } = useBluetoothStore.getState();
    expect(data.heartRate).toBe(76);
    expect(data.speed).toBe(12.5);
  });

  it('preserves the strap heart-rate timestamp when the bike HR is dropped (regression: Waiting flicker)', () => {
    useBluetoothStore.setState({
      hrConnected: true,
      data: { heartRate: 76 },
      lastUpdate: { heartRate: 1000 },
    });

    // Real-world bike packet: flags 0x0800 => speed (no more-data) + HR.
    // Speed 1250 => 12.5 km/h, HR = garbage 6. If the packet only carried HR
    // the handler would early-return before persisting anything, so the
    // timestamp bug only shows with other metrics present — like Yesoul sends.
    handleFtmsIndoorBikeNotification(makeView([0x00, 0x08, 0xe2, 0x04, 0x06]), 2000, useBluetoothStore.setState);

    const { data, lastUpdate } = useBluetoothStore.getState();
    expect(data.heartRate).toBe(76);
    expect(data.speed).toBe(12.5);
    // The strap's timestamp must survive the dropped packet — deleting it
    // makes clearStaleData think the strap is stale and zero the display.
    expect(lastUpdate.heartRate).toBe(1000);
  });

  it('keeps the HR display live when the bike interleaves HR packets while the strap streams', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      useBluetoothStore.setState({
        hrConnected: true,
        data: { heartRate: 76 },
        lastUpdate: { heartRate: 0 },
      });

      for (let s = 1; s <= 5; s++) {
        // Strap notification at the top of each second.
        vi.setSystemTime(s * 1000);
        useBluetoothStore.setState((state) => ({
          data: { ...state.data, heartRate: 76 },
          lastUpdate: { ...state.lastUpdate, heartRate: s * 1000 },
        }));

      // Bike HR packet mid-second (dropped by policy, never used). Carries
      // speed too — like the real Yesoul packets — so the handler persists
      // its lastUpdate instead of early-returning.
        vi.setSystemTime(s * 1000 + 400);
        handleFtmsIndoorBikeNotification(makeView([0x00, 0x08, 0xe2, 0x04, 0x06]), s * 1000 + 400, useBluetoothStore.setState);

        // The app's 1s stale-data watchdog.
        vi.setSystemTime(s * 1000 + 800);
        useBluetoothStore.getState().clearStaleData();
      }

      const { data, lastUpdate } = useBluetoothStore.getState();
      // Without the fix, each dropped bike packet wipes lastUpdate.heartRate
      // and the watchdog zeroes the HR by ~3.8s — the Waiting flicker.
      expect(data.heartRate).toBe(76);
      expect(lastUpdate.heartRate).toBe(5000);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('parseCscMeasurement', () => {
  it('computes cadence from crank revolution deltas', () => {
    const first = makeView([0x02, 0x64, 0x00, 0x00, 0x28]); // crank 100, time 10240
    const second = makeView([0x02, 0x69, 0x00, 0x00, 0x2c]); // crank 105, time 11264

    const state = makeState();
    const firstResult = parseCscMeasurement(first, state);
    // First packet only seeds the tracker; no cadence yet.
    expect(firstResult.updates.cadence).toBeUndefined();

    // 5 revs over 1 s => 300 rpm
    const secondResult = parseCscMeasurement(second, { ...state, csc: firstResult.csc });
    expect(secondResult.updates.cadence).toBe(300);
  });

  it('handles crank event time rollover (uint16)', () => {
    const first = makeView([0x02, 0x64, 0x00, 0x60, 0xea]); // crank 100, time 60000
    const second = makeView([0x02, 0x68, 0x00, 0x00, 0x04]); // crank 104, time 1024 (wrapped)

    const state = makeState();
    const firstResult = parseCscMeasurement(first, state);
    const secondResult = parseCscMeasurement(second, { ...state, csc: firstResult.csc });

    // timeDelta = (65536 - 60000) + 1024 = 6560 ticks = 6.40625 s; 4 revs => 37.46 rpm
    expect(secondResult.updates.cadence).toBe(37);
  });

  it('handles crank revolution counter rollover (uint16)', () => {
    const first = makeView([0x02, 0xfa, 0xff, 0x00, 0x50]); // crank 65530, time 20480
    const second = makeView([0x02, 0x64, 0x00, 0x00, 0x78]); // crank 100 (wrapped), time 30720

    const state = makeState();
    const firstResult = parseCscMeasurement(first, state);
    const secondResult = parseCscMeasurement(second, { ...state, csc: firstResult.csc });

    // revDelta = 106, timeDelta = 10240 ticks = 10 s => 636 rpm
    expect(secondResult.updates.cadence).toBe(636);
  });

  it('computes speed from wheel revolution deltas when circumference is configured', () => {
    const state = makeState({ wheelCircumferenceM: 2.105 });
    const first = makeView([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // wheel 0, time 0
    const second = makeView([0x01, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x08]); // wheel 10, time 2048

    const firstResult = parseCscMeasurement(first, state);
    expect(firstResult.updates.speed).toBeUndefined();

    // 10 revs * 2.105 m / 2 s = 10.525 m/s => 37.89 km/h
    const secondResult = parseCscMeasurement(second, { ...state, csc: firstResult.csc });
    expect(secondResult.updates.speed).toBe(37.9);
  });

  it('does not emit speed when wheel circumference is not configured', () => {
    const state = makeState(); // wheelCircumferenceM = 0
    const first = makeView([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const second = makeView([0x01, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x08]);

    const firstResult = parseCscMeasurement(first, state);
    const secondResult = parseCscMeasurement(second, { ...state, csc: firstResult.csc });

    expect(secondResult.updates.speed).toBeUndefined();
  });
});
