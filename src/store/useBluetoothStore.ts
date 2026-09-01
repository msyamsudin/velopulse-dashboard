import { create } from 'zustand';
import { computeRmssd, parseHeartRateMeasurement, recordHrvReading, type ReadinessLevel } from '@/lib/hrv';

export interface BluetoothData {
  heartRate?: number;
  cadence?: number;
  power?: number;
  speed?: number;
  distance?: number;
  calories?: number;
  resistance?: number;
}

export interface CscTracker {
  lastWheelRevs: number;
  lastWheelEventTime: number;
  lastCrankRevs: number;
  lastCrankEventTime: number;
}

/** Minimal state slice consumed by the pure packet parsers (unit-testable). */
export type BluetoothParseState = Pick<
  BluetoothState,
  | 'lastUpdate'
  | 'cumulativeDistance'
  | 'cumulativeCalories'
  | 'lastRawDistance'
  | 'lastRawCalories'
  | 'distanceFromDevice'
  | 'csc'
  | 'wheelCircumferenceM'
>;

interface BluetoothState {
  hrConnected: boolean;
  bikeConnected: boolean;
  data: BluetoothData;
  error: string | null;
  rawLogs: string[];
  
  // Internal refs
  hrDevice: BluetoothDevice | null;
  bikeDevice: BluetoothDevice | null;
  lastUpdate: { [key: string]: number };
  
  // Cumulative trackers
  cumulativeDistance: number;
  cumulativeCalories: number;
  lastRawDistance: number;
  lastRawCalories: number;
  /** True once the bike's FTMS Total Distance field has been seen; locks the
   *  device counter as the distance source (disables the speed-derived fallback). */
  distanceFromDevice: boolean;

  // CSC (Cycling Speed & Cadence) tracking
  csc: CscTracker;
  // Wheel circumference in meters; 0 disables CSC speed estimation (needs profile setting)
  wheelCircumferenceM: number;

  // HRV (from RR-intervals in the Heart Rate Measurement characteristic)
  rrIntervals: number[];
  hrvRmssd: number | null;
  hrvReadiness: ReadinessLevel | null;

  // Actions
  addLog: (message: string) => void;
  setError: (error: string | null) => void;
  connectHeartRate: () => Promise<void>;
  connectBike: () => Promise<void>;
  disconnect: () => void;
  clearStaleData: () => void;
}

export type BluetoothSetState = (
  partial: Partial<BluetoothState> | ((state: BluetoothState) => Partial<BluetoothState> | BluetoothState)
) => void;

const getCharacteristicValue = (event: Event): DataView | null =>
  (event.target as BluetoothRemoteGATTCharacteristic).value;

/** RR-intervals kept for the live RMSSD window (~1 min at 1 interval/s). */
const HRV_WINDOW_SIZE = 60;

/**
 * Shared handler for Heart Rate Measurement notifications: parses HR +
 * RR-intervals, updates the rolling RMSSD window and the daily readiness
 * classification.
 */
const handleHeartRateValue = (value: DataView, set: BluetoothSetState, get: () => BluetoothState) => {
  const { heartRate, rrIntervalsMs } = parseHeartRateMeasurement(value);
  if (!heartRate || heartRate <= 0) return;

  const now = Date.now();
  const prev = get();

  const patch: Partial<BluetoothState> = {
    data: { ...prev.data, heartRate },
    lastUpdate: { ...prev.lastUpdate, heartRate: now },
  };

  if (rrIntervalsMs.length > 0) {
    const rrIntervals = [...prev.rrIntervals, ...rrIntervalsMs].slice(-HRV_WINDOW_SIZE);
    patch.rrIntervals = rrIntervals;

    const rmssd = computeRmssd(rrIntervals);
    if (rmssd !== null) {
      patch.hrvRmssd = Math.round(rmssd);
      patch.hrvReadiness = recordHrvReading(rmssd, now);
    }
  }

  set(patch);
};

export const parseFtmsIndoorBikeData = (
  value: DataView,
  state: BluetoothParseState,
  now: number
) => {
  const flags = value.getUint16(0, true);
  let offset = 2;
  const updates: Partial<BluetoothData> = {};
  const lastUpdate = { ...state.lastUpdate };
  const trackerUpdates: Partial<Pick<BluetoothState, 'cumulativeDistance' | 'cumulativeCalories' | 'lastRawDistance' | 'lastRawCalories' | 'distanceFromDevice'>> = {};

  if (!(flags & 0x0001)) {
    updates.speed = value.getUint16(offset, true) / 100;
    lastUpdate.speed = now;
    offset += 2;
  }
  if (flags & 0x0002) offset += 2;
  if (flags & 0x0004) {
    updates.cadence = value.getUint16(offset, true) / 2;
    lastUpdate.cadence = now;
    offset += 2;
  }
  if (flags & 0x0008) offset += 2;
  if (flags & 0x0010) {
    const d1 = value.getUint8(offset);
    const d2 = value.getUint8(offset + 1);
    const d3 = value.getUint8(offset + 2);
    const rawDistance = d1 + (d2 << 8) + (d3 << 16);

    if (!state.distanceFromDevice) {
      // First real Total Distance: the device's own counter is authoritative.
      // Rebase so any speed-derived estimate accumulated before this packet is
      // dropped instead of double-counted.
      trackerUpdates.distanceFromDevice = true;
      trackerUpdates.cumulativeDistance = rawDistance;
      trackerUpdates.lastRawDistance = rawDistance;
      updates.distance = rawDistance;
    } else {
      const delta = (state.lastRawDistance > 0 && rawDistance < state.lastRawDistance)
        ? rawDistance
        : Math.max(0, rawDistance - state.lastRawDistance);

      const newCumulative = state.cumulativeDistance + delta;

      updates.distance = newCumulative;
      trackerUpdates.cumulativeDistance = newCumulative;
      trackerUpdates.lastRawDistance = rawDistance;
    }

    offset += 3;
  }
  if (flags & 0x0020) {
    updates.resistance = value.getInt16(offset, true);
    offset += 2;
  }
  if (flags & 0x0040) {
    updates.power = value.getInt16(offset, true);
    lastUpdate.power = now;
    offset += 2;
  }
  if (flags & 0x0080) offset += 2;
  if (flags & 0x0100) {
    const rawCalories = value.getUint16(offset, true);

    const delta = (state.lastRawCalories > 0 && rawCalories < state.lastRawCalories)
      ? rawCalories
      : Math.max(0, rawCalories - state.lastRawCalories);

    const newCumulative = state.cumulativeCalories + delta;

    updates.calories = newCumulative;
    trackerUpdates.cumulativeCalories = newCumulative;
    trackerUpdates.lastRawCalories = rawCalories;

    // Total Energy is uint16 (2 bytes), NOT 5 — the extra bytes belong to
    // Energy Per Hour / Energy Per Minute / Heart Rate below.
    offset += 2;
  }
  // Energy Per Hour (uint16)
  if (flags & 0x0200) offset += 2;
  // Energy Per Minute (uint8)
  if (flags & 0x0400) offset += 1;
  // Heart Rate (uint8)
  if (flags & 0x0800) {
    updates.heartRate = value.getUint8(offset);
    lastUpdate.heartRate = now;
    offset += 1;
  }
  // Metabolic Equivalent (uint8)
  if (flags & 0x1000) offset += 1;
  // Elapsed Time (uint16)
  if (flags & 0x2000) offset += 2;
  // Remaining Time (uint16)
  if (flags & 0x4000) offset += 2;

  // Fallback: many indoor bikes never report Total Distance. While no distance
  // packet has ever been seen, integrate speed over the inter-packet interval
  // (bike-computer style) so the ride still accumulates distance. Once the
  // device sends a real Total Distance, that counter becomes authoritative and
  // this fallback is disabled. Δt is clamped so a long dropout cannot inject a
  // huge single interval.
  if (updates.distance === undefined && updates.speed !== undefined && !state.distanceFromDevice) {
    const prevSpeedTs = state.lastUpdate.speed;
    if (prevSpeedTs !== undefined && now > prevSpeedTs) {
      const dt = Math.min((now - prevSpeedTs) / 1000, 5);
      const meters = (updates.speed / 3.6) * dt;
      const newCumulative = state.cumulativeDistance + meters;
      updates.distance = newCumulative;
      trackerUpdates.cumulativeDistance = newCumulative;
    }
  }

  return { updates, lastUpdate, trackerUpdates };
};

export const handleFtmsIndoorBikeNotification = (value: DataView, now: number, setState: BluetoothSetState) => {
  setState((state) => {
    const { updates, lastUpdate, trackerUpdates } = parseFtmsIndoorBikeData(value, state, now);

    // The dedicated HR strap is the ONLY heart-rate source. The bike's FTMS
    // Heart Rate field is never used — its console emits garbage (or an
    // unrelated byte) in that field and it must not overwrite or interfere
    // with the strap's stream.
    if (updates.heartRate !== undefined) {
      delete updates.heartRate;
      // Restore the previous heart-rate timestamp instead of deleting it:
      // clearStaleData relies on it to judge staleness, and a missing
      // timestamp makes the display go "Waiting" even while the strap is
      // streaming normally (the bike sends packets more often than the
      // strap, so each dropped packet used to wipe the strap's timestamp
      // right before the watchdog ran).
      lastUpdate.heartRate = state.lastUpdate.heartRate;
    }

    if (Object.keys(updates).length === 0 && Object.keys(trackerUpdates).length === 0) {
      return state;
    }

    return {
      ...trackerUpdates,
      lastUpdate,
      data: Object.keys(updates).length > 0
        ? { ...state.data, ...updates }
        : state.data
    };
  });
};

/**
 * Parse a CSC (Cycling Speed & Cadence) Measurement notification.
 *
 * CSC reports CUMULATIVE crank/wheel revolutions plus an event time in
 * units of 1/1024 s. Cadence is derived from the delta between successive
 * notifications: (revsDelta / timeDelta) * 60. Both counters wrap (uint16),
 * so deltas must account for rollover.
 */
export const parseCscMeasurement = (
  value: DataView,
  state: BluetoothParseState
): { updates: Partial<BluetoothData>; lastUpdate: Record<string, number>; csc: CscTracker } => {
  const flags = value.getUint8(0);
  let offset = 1;
  const now = Date.now();
  const updates: Partial<BluetoothData> = {};
  const lastUpdate = { ...state.lastUpdate };
  const csc = { ...state.csc };

  // Wheel Revolution Data Present
  if (flags & 0x01) {
    const wheelRevs = value.getUint32(offset, true);
    const wheelEventTime = value.getUint16(offset + 4, true);
    offset += 6;

    if (csc.lastWheelRevs >= 0) {
      let revDelta = wheelRevs - csc.lastWheelRevs;
      if (revDelta < 0) revDelta += 0x100000000;
      let timeDelta = wheelEventTime - csc.lastWheelEventTime;
      if (timeDelta < 0) timeDelta += 0x10000;
      const timeSeconds = timeDelta / 1024;
      if (revDelta > 0 && timeSeconds > 0 && state.wheelCircumferenceM > 0) {
        const speedMps = (revDelta * state.wheelCircumferenceM) / timeSeconds;
        updates.speed = Math.round(speedMps * 3.6 * 10) / 10;
        lastUpdate.speed = now;
      }
    }
    csc.lastWheelRevs = wheelRevs;
    csc.lastWheelEventTime = wheelEventTime;
  }

  // Crank Revolution Data Present
  if (flags & 0x02) {
    const crankRevs = value.getUint16(offset, true);
    const crankEventTime = value.getUint16(offset + 2, true);
    offset += 4;

    if (csc.lastCrankRevs >= 0) {
      let revDelta = crankRevs - csc.lastCrankRevs;
      if (revDelta < 0) revDelta += 0x10000;
      let timeDelta = crankEventTime - csc.lastCrankEventTime;
      if (timeDelta < 0) timeDelta += 0x10000;
      const timeSeconds = timeDelta / 1024;
      if (revDelta > 0 && timeSeconds > 0) {
        updates.cadence = Math.round((revDelta / timeSeconds) * 60);
        lastUpdate.cadence = now;
      }
    }
    csc.lastCrankRevs = crankRevs;
    csc.lastCrankEventTime = crankEventTime;
  }

  return { updates, lastUpdate, csc };
};

const handleCscMeasurement = (value: DataView, setState: BluetoothSetState) => {
  setState((state) => {
    const { updates, lastUpdate, csc } = parseCscMeasurement(value, state);

    const cscUnchanged =
      csc.lastWheelRevs === state.csc.lastWheelRevs &&
      csc.lastWheelEventTime === state.csc.lastWheelEventTime &&
      csc.lastCrankRevs === state.csc.lastCrankRevs &&
      csc.lastCrankEventTime === state.csc.lastCrankEventTime;

    if (Object.keys(updates).length === 0 && cscUnchanged) {
      return state;
    }

    return {
      csc,
      lastUpdate,
      data: Object.keys(updates).length > 0
        ? { ...state.data, ...updates }
        : state.data
    };
  });
};

/**
 * Connect + subscribe to Heart Rate Measurement. Throws on any missing step so
 * a connect can never "succeed" while silently delivering no data.
 */
const establishHr = async (device: BluetoothDevice, set: BluetoothSetState, get: () => BluetoothState) => {
  const { addLog } = get();
  const server = await device.gatt?.connect();
  if (!server) throw new Error('GATT server unavailable');
  const service = await server.getPrimaryService('heart_rate');
  const characteristic = await service.getCharacteristic('heart_rate_measurement');
  await characteristic.startNotifications();
  addLog('Notifications started for Heart Rate');

  characteristic.addEventListener('characteristicvaluechanged', (event) => {
    const value = getCharacteristicValue(event);
    if (!value) return;
    handleHeartRateValue(value, set, get);
  });

  // Surface unexpected drops (battery died, walked away, etc.) so the UI can
  // flip the strap to offline and offer a reconnect — a session keeps running.
  device.addEventListener('gattserverdisconnected', () => {
    set({ hrConnected: false, hrDevice: null });
    addLog('Heart rate device disconnected');
  });
};

/** Same as establishHr, for the bike: FTMS Indoor Bike Data with CSC fallback. */
const establishBike = async (device: BluetoothDevice, set: BluetoothSetState, get: () => BluetoothState) => {
  const { addLog } = get();
  const server = await device.gatt?.connect();
  if (!server) throw new Error('GATT server unavailable');

  try {
    const service = await server.getPrimaryService('fitness_machine');
    const characteristic = await service.getCharacteristic('indoor_bike_data');
    await characteristic.startNotifications();
    addLog('Notifications started for FTMS Indoor Bike Data');

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const value = getCharacteristicValue(event);
      if (!value) return;
      handleFtmsIndoorBikeNotification(value, Date.now(), set);
    });
  } catch {
    addLog('FTMS not found, trying CSC service...');
    const service = await server.getPrimaryService('cycling_speed_and_cadence');
    const characteristic = await service.getCharacteristic('csc_measurement');
    await characteristic.startNotifications();
    addLog('Notifications started for CSC Measurement');

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const value = getCharacteristicValue(event);
      if (!value) return;
      handleCscMeasurement(value, set);
    });
  }

  // Surface unexpected drops (dead battery, cable pull, etc.) so the UI can
  // flip the bike to offline and offer a reconnect without stopping the ride.
  device.addEventListener('gattserverdisconnected', () => {
    set({ bikeConnected: false, bikeDevice: null });
    addLog('Bike device disconnected');
  });
};

/**
 * Full connection + notification setup for a heart-rate device. Shared by the
 * manual pairing flow.
 */
export const attachHrDevice = async (device: BluetoothDevice, set: BluetoothSetState, get: () => BluetoothState) => {
  const { addLog } = get();
  addLog(`Connecting to ${device.name || 'heart rate device'}...`);

  await establishHr(device, set, get);

  set({ hrDevice: device, hrConnected: true, error: null });
};

/** Same as attachHrDevice, for the bike: FTMS Indoor Bike Data with CSC fallback. */
export const attachBikeDevice = async (device: BluetoothDevice, set: BluetoothSetState, get: () => BluetoothState) => {
  const { addLog } = get();
  addLog(`Connecting to ${device.name || 'bike device'}...`);

  await establishBike(device, set, get);

  set({ bikeDevice: device, bikeConnected: true, error: null });
};

export const useBluetoothStore = create<BluetoothState>((set, get) => ({
  hrConnected: false,
  bikeConnected: false,
  rrIntervals: [],
  hrvRmssd: null,
  hrvReadiness: null,
  data: {},
  error: null,
  rawLogs: [],
  hrDevice: null,
  bikeDevice: null,
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
    lastCrankEventTime: -1
  },
  wheelCircumferenceM: 0,

  addLog: (message: string) => {
    console.log(`[BLE DEBUG] ${message}`);
    set((state) => ({
      rawLogs: [message, ...state.rawLogs].slice(0, 50),
    }));
  },

  setError: (error) => set({ error }),

  connectHeartRate: async () => {
    const { addLog } = get();
    try {
      addLog("Requesting Heart Rate device...");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });
      await attachHrDevice(device, set, get);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`HR Error: ${message}`);
      set({ error: message });
    }
  },

  connectBike: async () => {
    const { addLog } = get();
    try {
      addLog("Requesting Fitness Machine device...");
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['fitness_machine'] },
          { services: ['cycling_speed_and_cadence'] }
        ],
      });
      await attachBikeDevice(device, set, get);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Bike Error: ${message}`);
      set({ error: message });
    }
  },

  disconnect: () => {
    const { hrDevice, bikeDevice, addLog } = get();
    set({ hrDevice: null, bikeDevice: null });
    hrDevice?.gatt?.disconnect();
    bikeDevice?.gatt?.disconnect();
    set({ 
      hrConnected: false, 
      bikeConnected: false, 
      data: {},
      rrIntervals: [],
      hrvRmssd: null,
      hrvReadiness: null,
      cumulativeDistance: 0,
      cumulativeCalories: 0,
      lastRawDistance: 0,
      lastRawCalories: 0,
      distanceFromDevice: false,
      csc: {
        lastWheelRevs: -1,
        lastWheelEventTime: -1,
        lastCrankRevs: -1,
        lastCrankEventTime: -1
      }
    });
    addLog("Disconnected all devices");
  },

  clearStaleData: () => {
    const now = Date.now();
    const timeout = 3000;
    const { lastUpdate, data } = get();
    
    let changed = false;
    const nextData = { ...data };
    
    const keysToWatch = ['heartRate', 'cadence', 'power', 'speed'];
    keysToWatch.forEach(key => {
      if (nextData[key as keyof BluetoothData] !== undefined && 
          nextData[key as keyof BluetoothData] !== 0 && 
          now - (lastUpdate[key] || 0) > timeout) {
        nextData[key as keyof BluetoothData] = 0;
        changed = true;
      }
    });
    
    if (changed) {
      set({ data: nextData });
    }
  }
}));
