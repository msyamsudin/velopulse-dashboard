import { create } from 'zustand';

export interface BluetoothData {
  heartRate?: number;
  cadence?: number;
  power?: number;
  speed?: number;
  distance?: number;
  calories?: number;
  resistance?: number;
}

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

  // Actions
  addLog: (message: string) => void;
  setError: (error: string | null) => void;
  connectHeartRate: () => Promise<void>;
  connectBike: () => Promise<void>;
  disconnect: () => void;
  clearStaleData: () => void;
}

export const useBluetoothStore = create<BluetoothState>((set, get) => ({
  hrConnected: false,
  bikeConnected: false,
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
      
      addLog(`Connecting to ${device.name}...`);
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService('heart_rate');
      const characteristic = await service?.getCharacteristic('heart_rate_measurement');
      
      await characteristic?.startNotifications();
      addLog("Notifications started for Heart Rate");

      characteristic?.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const flags = value.getUint8(0);
        const rate = flags & 0x01 ? value.getUint16(1, true) : value.getUint8(1);
        
        get().lastUpdate.heartRate = Date.now();
        set((state) => ({
          data: { ...state.data, heartRate: rate }
        }));
      });

      set({ hrDevice: device, hrConnected: true, error: null });
    } catch (err: any) {
      addLog(`HR Error: ${err.message}`);
      set({ error: err.message });
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
      
      addLog(`Connecting to ${device.name}...`);
      const server = await device.gatt?.connect();
      
      try {
        const service = await server?.getPrimaryService('fitness_machine');
        const characteristic = await service?.getCharacteristic('indoor_bike_data');
        await characteristic?.startNotifications();
        addLog("Notifications started for FTMS Indoor Bike Data");

        characteristic?.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value;
          const flags = value.getUint16(0, true);
          let offset = 2;
          const updates: Partial<BluetoothData> = {};
          const now = Date.now();
          const state = get();
          
          if (!(flags & 0x0001)) {
            updates.speed = value.getUint16(offset, true) / 100;
            get().lastUpdate.speed = now;
            offset += 2;
          }
          if (flags & 0x0002) offset += 2;
          if (flags & 0x0004) {
            updates.cadence = value.getUint16(offset, true) / 2;
            get().lastUpdate.cadence = now;
            offset += 2;
          }
          if (flags & 0x0008) offset += 2;
          if (flags & 0x0010) {
            const d1 = value.getUint8(offset);
            const d2 = value.getUint8(offset + 1);
            const d3 = value.getUint8(offset + 2);
            const rawDistance = d1 + (d2 << 8) + (d3 << 16);
            
            // Handle reset: if raw < last, then it reset. 
            // Also handle initial state (lastRawDistance === 0)
            const delta = (state.lastRawDistance > 0 && rawDistance < state.lastRawDistance) 
              ? rawDistance 
              : Math.max(0, rawDistance - state.lastRawDistance);
            
            const newCumulative = state.cumulativeDistance + delta;
            
            updates.distance = newCumulative;
            set({ 
              cumulativeDistance: newCumulative, 
              lastRawDistance: rawDistance 
            });
            
            offset += 3;
          }
          if (flags & 0x0020) {
            updates.resistance = value.getInt16(offset, true);
            offset += 2;
          }
          if (flags & 0x0040) {
            updates.power = value.getInt16(offset, true);
            get().lastUpdate.power = now;
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
            set({
              cumulativeCalories: newCumulative,
              lastRawCalories: rawCalories
            });
            
            offset += 5;
          }

          if (Object.keys(updates).length > 0) {
            set((state) => ({ data: { ...state.data, ...updates } }));
          }
        });
      } catch (e) {
        addLog("FTMS not found, trying CSC service...");
        const service = await server?.getPrimaryService('cycling_speed_and_cadence');
        const characteristic = await service?.getCharacteristic('csc_measurement');
        await characteristic?.startNotifications();
        characteristic?.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value;
          const flags = value.getUint8(0);
          let offset = 1;
          const now = Date.now();
          if (flags & 0x01) offset += 6;
          if (flags & 0x02) {
             const crankRevs = value.getUint16(offset, true);
             get().lastUpdate.cadence = now;
             set((state) => ({ 
               data: { ...state.data, cadence: crankRevs % 200 } 
             })); 
          }
        });
      }

      set({ bikeDevice: device, bikeConnected: true, error: null });
    } catch (err: any) {
      addLog(`Bike Error: ${err.message}`);
      set({ error: err.message });
    }
  },

  disconnect: () => {
    const { hrDevice, bikeDevice, addLog } = get();
    hrDevice?.gatt?.disconnect();
    bikeDevice?.gatt?.disconnect();
    set({ 
      hrDevice: null, 
      bikeDevice: null, 
      hrConnected: false, 
      bikeConnected: false, 
      data: {},
      cumulativeDistance: 0,
      cumulativeCalories: 0,
      lastRawDistance: 0,
      lastRawCalories: 0
    });
    addLog("Disconnected all devices");
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
        (nextData as any)[key] = 0;
        changed = true;
      }
    });
    
    if (changed) {
      set({ data: nextData });
    }
  }
}));
