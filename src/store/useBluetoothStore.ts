import { create } from 'zustand';
import { computeRmssd, parseHeartRateMeasurement, recordHrvReading, type ReadinessLevel } from '@/lib/hrv';
import { clearSavedDevice, loadSavedDevice, saveSavedDevice } from '@/lib/saved-devices';

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
  reconnectSavedDevices: () => Promise<{ hr: boolean; bike: boolean }>;
  disconnect: () => void;
  clearStaleData: () => void;
}

type BluetoothSetState = (
  partial: Partial<BluetoothState> | ((state: BluetoothState) => Partial<BluetoothState> | BluetoothState)
) => void;

const getCharacteristicValue = (event: Event): DataView | null =>
  (event.target as BluetoothRemoteGATTCharacteristic).value;

/** RR-intervals kept for the live RMSSD window (~1 min at 1 interval/s). */
const HRV_WINDOW_SIZE = 60;

/**
 * Shared handler for Heart Rate Measurement notifications (both the initial
 * connect and the auto-reconnect path): parses HR + RR-intervals, updates the
 * rolling RMSSD window and the daily readiness classification.
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
  const trackerUpdates: Partial<Pick<BluetoothState, 'cumulativeDistance' | 'cumulativeCalories' | 'lastRawDistance' | 'lastRawCalories'>> = {};

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

    const delta = (state.lastRawDistance > 0 && rawDistance < state.lastRawDistance)
      ? rawDistance
      : Math.max(0, rawDistance - state.lastRawDistance);

    const newCumulative = state.cumulativeDistance + delta;

    updates.distance = newCumulative;
    trackerUpdates.cumulativeDistance = newCumulative;
    trackerUpdates.lastRawDistance = rawDistance;

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

  return { updates, lastUpdate, trackerUpdates };
};

const handleFtmsIndoorBikeNotification = (value: DataView, now: number, setState: BluetoothSetState) => {
  setState((state) => {
    const { updates, lastUpdate, trackerUpdates } = parseFtmsIndoorBikeData(value, state, now);

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

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

/**
 * Full connection + notification setup for a heart-rate device, including the
 * auto-reconnect-on-disconnect loop. Shared by the pairing flow and the
 * saved-device auto-reconnect.
 */
const attachHrDevice = async (device: BluetoothDevice, set: BluetoothSetState, get: () => BluetoothState) => {
  const { addLog } = get();

  const onHrDisconnect = async () => {
    addLog("HR device disconnected. Attempting to reconnect...");
    set({ hrConnected: false });

    let attempts = 0;
    const attemptReconnect = async () => {
      // Stop if the device object was cleared (manual disconnect)
      if (!get().hrDevice) {
        addLog("HR auto-reconnect aborted (manually disconnected).");
        return;
      }

      try {
        attempts++;
        addLog(`HR Reconnect attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS}...`);
        const server = await get().hrDevice?.gatt?.connect();
        const service = await server?.getPrimaryService('heart_rate');
        const characteristic = await service?.getCharacteristic('heart_rate_measurement');

        await characteristic?.startNotifications();
        addLog("Notifications started for Heart Rate");

        characteristic?.addEventListener('characteristicvaluechanged', (event) => {
          const value = getCharacteristicValue(event);
          if (!value) return;
          handleHeartRateValue(value, set, get);
        });

        addLog("HR reconnected successfully!");
        set({ hrConnected: true, error: null });
      } catch (err) {
        addLog(`HR Reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
        if (attempts < MAX_RECONNECT_ATTEMPTS && get().hrDevice) {
          setTimeout(attemptReconnect, RECONNECT_DELAY_MS + 1000);
        } else {
          set({ error: "HR connection lost. Please reconnect manually." });
        }
      }
    };

    setTimeout(attemptReconnect, RECONNECT_DELAY_MS);
  };

  addLog(`Connecting to ${device.name || 'heart rate device'}...`);
  const server = await device.gatt?.connect();
  const service = await server?.getPrimaryService('heart_rate');
  const characteristic = await service?.getCharacteristic('heart_rate_measurement');

  await characteristic?.startNotifications();
  addLog("Notifications started for Heart Rate");

  characteristic?.addEventListener('characteristicvaluechanged', (event) => {
    const value = getCharacteristicValue(event);
    if (!value) return;
    handleHeartRateValue(value, set, get);
  });

  device.addEventListener('gattserverdisconnected', onHrDisconnect);

  set({ hrDevice: device, hrConnected: true, error: null });
  saveSavedDevice('hr', { id: device.id, name: device.name ?? '' });
};

/** Same as attachHrDevice, for the bike: FTMS Indoor Bike Data with CSC fallback. */
const attachBikeDevice = async (device: BluetoothDevice, set: BluetoothSetState, get: () => BluetoothState) => {
  const { addLog } = get();

  const onBikeDisconnect = async () => {
    addLog("Bike device disconnected. Attempting to reconnect...");
    set({ bikeConnected: false });

    let attempts = 0;
    const attemptReconnect = async () => {
      if (!get().bikeDevice) {
        addLog("Bike auto-reconnect aborted (manually disconnected).");
        return;
      }

      try {
        attempts++;
        addLog(`Bike Reconnect attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS}...`);
        const server = await get().bikeDevice?.gatt?.connect();

        try {
          const service = await server?.getPrimaryService('fitness_machine');
          const characteristic = await service?.getCharacteristic('indoor_bike_data');
          await characteristic?.startNotifications();
          addLog("Notifications started for FTMS Indoor Bike Data");

          characteristic?.addEventListener('characteristicvaluechanged', (event) => {
            const value = getCharacteristicValue(event);
            if (!value) return;
            handleFtmsIndoorBikeNotification(value, Date.now(), set);
          });
        } catch {
          addLog("FTMS not found on reconnect, trying CSC service...");
          const service = await server?.getPrimaryService('cycling_speed_and_cadence');
          const characteristic = await service?.getCharacteristic('csc_measurement');
          await characteristic?.startNotifications();
          characteristic?.addEventListener('characteristicvaluechanged', (event) => {
            const value = getCharacteristicValue(event);
            if (!value) return;
            handleCscMeasurement(value, set);
          });
        }

        addLog("Bike reconnected successfully!");
        set({ bikeConnected: true, error: null });
      } catch (err) {
        addLog(`Bike Reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
        if (attempts < MAX_RECONNECT_ATTEMPTS && get().bikeDevice) {
          setTimeout(attemptReconnect, RECONNECT_DELAY_MS + 1000);
        } else {
          set({ error: "Bike connection lost. Please reconnect manually." });
        }
      }
    };

    setTimeout(attemptReconnect, RECONNECT_DELAY_MS);
  };

  addLog(`Connecting to ${device.name || 'bike device'}...`);
  const server = await device.gatt?.connect();

  try {
    const service = await server?.getPrimaryService('fitness_machine');
    const characteristic = await service?.getCharacteristic('indoor_bike_data');
    await characteristic?.startNotifications();
    addLog("Notifications started for FTMS Indoor Bike Data");

    characteristic?.addEventListener('characteristicvaluechanged', (event) => {
      const value = getCharacteristicValue(event);
      if (!value) return;
      handleFtmsIndoorBikeNotification(value, Date.now(), set);
    });
  } catch {
    addLog("FTMS not found, trying CSC service...");
    const service = await server?.getPrimaryService('cycling_speed_and_cadence');
    const characteristic = await service?.getCharacteristic('csc_measurement');
    await characteristic?.startNotifications();
    characteristic?.addEventListener('characteristicvaluechanged', (event) => {
      const value = getCharacteristicValue(event);
      if (!value) return;
      handleCscMeasurement(value, set);
    });
  }

  device.addEventListener('gattserverdisconnected', onBikeDisconnect);

  set({ bikeDevice: device, bikeConnected: true, error: null });
  saveSavedDevice('bike', { id: device.id, name: device.name ?? '' });
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

  reconnectSavedDevices: async () => {
    const { addLog } = get();
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return { hr: false, bike: false };
    }
    try {
      const devices = await navigator.bluetooth.getDevices();
      const hrSaved = loadSavedDevice('hr');
      const bikeSaved = loadSavedDevice('bike');
      let hr = false;
      let bike = false;

      if (hrSaved) {
        const device = devices.find((d) => d.id === hrSaved.id);
        if (device) {
          await attachHrDevice(device, set, get);
          hr = true;
        }
      }

      if (bikeSaved) {
        const device = devices.find((d) => d.id === bikeSaved.id);
        if (device) {
          await attachBikeDevice(device, set, get);
          bike = true;
        }
      }

      if (hr || bike) addLog("Reconnected to previously saved devices");
      return { hr, bike };
    } catch (err) {
      addLog(`Auto-reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
      return { hr: false, bike: false };
    }
  },

  disconnect: () => {
    const { hrDevice, bikeDevice, addLog } = get();
    hrDevice?.gatt?.disconnect();
    bikeDevice?.gatt?.disconnect();
    // Explicit disconnect also forgets the pairing, so the app does not
    // auto-reconnect to devices the user deliberately released.
    clearSavedDevice('hr');
    clearSavedDevice('bike');
    set({ 
      hrDevice: null, 
      bikeDevice: null, 
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
      csc: {
        lastWheelRevs: -1,
        lastWheelEventTime: -1,
        lastCrankRevs: -1,
        lastCrankEventTime: -1
      }
    });
    addLog("Disconnected all devices (saved pairing cleared)");
  },

  clearStaleData: () => {
    const now = Date.now();
    const timeout = 3000;
    const { lastUpdate, data } = get();
    
    let changed = false;
    const nextData = { ...data };
    
    const keysToWatch = ['cadence', 'power', 'speed'];
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
