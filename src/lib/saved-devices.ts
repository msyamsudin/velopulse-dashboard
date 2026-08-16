/**
 * Persistence for the last-paired BLE devices. Chrome keeps an origin-level
 * whitelist of devices the user has paired to; storing their ids lets us
 * reconnect via navigator.bluetooth.getDevices() without a re-pair dialog.
 */

export type SavedDeviceKind = 'hr' | 'bike';

export interface SavedDevice {
  id: string;
  name: string;
}

const KEYS: Record<SavedDeviceKind, string> = {
  hr: 'velopulse-hr-device',
  bike: 'velopulse-bike-device',
};

export const loadSavedDevice = (kind: SavedDeviceKind): SavedDevice | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEYS[kind]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedDevice>;
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id) return null;
    return { id: parsed.id, name: typeof parsed.name === 'string' ? parsed.name : '' };
  } catch {
    return null;
  }
};

export const saveSavedDevice = (kind: SavedDeviceKind, device: SavedDevice): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS[kind], JSON.stringify(device));
  } catch {
    // persistence is best-effort
  }
};

export const clearSavedDevice = (kind: SavedDeviceKind): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEYS[kind]);
  } catch {
    // ignore
  }
};
