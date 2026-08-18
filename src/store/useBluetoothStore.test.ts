import { beforeEach, describe, expect, it } from 'vitest';
import {
  handleFtmsIndoorBikeNotification,
  isPlausibleHeartRate,
  parseCscMeasurement,
  parseFtmsIndoorBikeData,
  shouldUseBikeHeartRate,
  useBluetoothStore,
  type BluetoothParseState,
} from './useBluetoothStore';

const makeState = (overrides: Partial<BluetoothParseState> = {}): BluetoothParseState => ({
  lastUpdate: {},
  cumulativeDistance: 0,
  cumulativeCalories: 0,
  lastRawDistance: 0,
  lastRawCalories: 0,
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
});

describe('bike FTMS heart-rate priority', () => {
  beforeEach(() => {
    // Reset the singleton store so tests don't leak state into each other.
    useBluetoothStore.setState({
      hrConnected: false,
      bikeConnected: false,
      data: {},
      lastUpdate: {},
    });
  });

  it('uses the bike heart rate only when no dedicated strap is connected', () => {
    expect(shouldUseBikeHeartRate(false, 145)).toBe(true);
    expect(shouldUseBikeHeartRate(true, 145)).toBe(false);
  });

  it('rejects implausible bike heart-rate values (garbage bytes)', () => {
    // The exact symptom reported: strap reads 76/77 bpm, bike's FTMS HR field
    // alternates with 6/11 bpm and overwrites the correct reading.
    expect(shouldUseBikeHeartRate(false, 6)).toBe(false);
    expect(shouldUseBikeHeartRate(false, 11)).toBe(false);
    expect(shouldUseBikeHeartRate(false, 0)).toBe(false);
    expect(shouldUseBikeHeartRate(false, 255)).toBe(false);
    expect(shouldUseBikeHeartRate(false, 76)).toBe(true);
  });

  it('keeps the strap heart rate when the bike sends its own (garbage) HR', () => {
    useBluetoothStore.setState({
      hrConnected: true,
      data: { heartRate: 76 },
      lastUpdate: { heartRate: 1000 },
    });

    // FTMS flags 0x0801 (more data + heart rate present), value 6.
    handleFtmsIndoorBikeNotification(makeView([0x01, 0x08, 0x06]), 2000, useBluetoothStore.setState);

    expect(useBluetoothStore.getState().data.heartRate).toBe(76);
  });

  it('falls back to the bike FTMS heart rate when no strap is connected', () => {
    handleFtmsIndoorBikeNotification(makeView([0x01, 0x08, 0x91]), 2000, useBluetoothStore.setState);

    expect(useBluetoothStore.getState().data.heartRate).toBe(145);
  });

  it('ignores an implausible bike heart rate even without a strap', () => {
    useBluetoothStore.setState({ data: { heartRate: 76 } });

    handleFtmsIndoorBikeNotification(makeView([0x01, 0x08, 0x06]), 2000, useBluetoothStore.setState);

    expect(useBluetoothStore.getState().data.heartRate).toBe(76);
  });

  it('still applies other bike metrics when its heart rate is dropped', () => {
    // flags 0x0800: speed (0x0000 cleared => present) + heart rate; speed 1250 => 12.5 km/h
    useBluetoothStore.setState({ hrConnected: true, data: { heartRate: 76 } });

    handleFtmsIndoorBikeNotification(makeView([0x00, 0x08, 0xe2, 0x04, 0x06]), 2000, useBluetoothStore.setState);

    const { data } = useBluetoothStore.getState();
    expect(data.heartRate).toBe(76);
    expect(data.speed).toBe(12.5);
  });
});

describe('isPlausibleHeartRate', () => {
  it('accepts the plausible range and rejects the rest', () => {
    expect(isPlausibleHeartRate(20)).toBe(true);
    expect(isPlausibleHeartRate(250)).toBe(true);
    expect(isPlausibleHeartRate(19)).toBe(false);
    expect(isPlausibleHeartRate(251)).toBe(false);
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
