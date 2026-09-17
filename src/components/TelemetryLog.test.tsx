import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import { TelemetryLog } from './TelemetryLog';

const RIDER = { ftp: 200, maxHr: 190, restingHr: 55 };

const renderPanel = (rawLogs: string[] = []) =>
  render(
    <I18nProvider>
      <TelemetryLog
        rawLogs={rawLogs}
        copyLogs={vi.fn()}
        copyStatus="idle"
        riderProfile={RIDER}
      />
    </I18nProvider>
  );

describe('TelemetryLog demo mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useBluetoothStore.setState({
      isSimulating: false,
      hrConnected: false,
      bikeConnected: false,
      data: {},
      lastUpdate: {},
      rawLogs: [],
    });
  });

  afterEach(() => {
    // Membersihkan timer simulasi menyentuh store, jadi harus lewat act().
    act(() => {
      useBluetoothStore.getState().stopSimulation();
    });
    vi.useRealTimers();
  });

  it('still renders the packet log of the debug panel', () => {
    renderPanel(['Notifications started for Heart Rate']);

    expect(screen.getByText('Raw Bluetooth Telemetry')).toBeInTheDocument();
    expect(screen.getByText(/Notifications started for Heart Rate/)).toBeInTheDocument();
  });

  it('opens a demo session from the debug panel without any hardware', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Start demo telemetry' }));

    const store = useBluetoothStore.getState();
    expect(store.isSimulating).toBe(true);
    expect(store.hrConnected).toBe(true);
    expect(store.bikeConnected).toBe(true);

    // Panel menampilkan status simulasi, bukan lagi tawaran memulai demo.
    expect(screen.getByText('Simulated devices online')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop demo telemetry' })).toBeInTheDocument();
  });

  it('turns the simulation off again from the same panel', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Start demo telemetry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop demo telemetry' }));

    const store = useBluetoothStore.getState();
    expect(store.isSimulating).toBe(false);
    expect(store.hrConnected).toBe(false);
    expect(store.bikeConnected).toBe(false);
    expect(screen.getByText('Simulation inactive')).toBeInTheDocument();
  });
});
