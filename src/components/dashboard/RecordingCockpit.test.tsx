import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import { RecordingCockpit } from './RecordingCockpit';

const renderCockpit = () =>
  render(
    <I18nProvider>
      <RecordingCockpit
        currentData={{ hr: 120, cadence: 85, power: 150, speed: 30, distance: 1000, resistance: 6, calories: 30 }}
        liveStats={{
          avgHr: 118,
          maxHr: 130,
          avgPower: 150,
          maxPower: 180,
          avgCadence: 84,
          maxCadence: 88,
          avgSpeed: 29.5,
          maxSpeed: 31,
          hrrScore: null,
          hrrClassification: null,
        }}
        userProfile={{ age: 30, maxHr: 190, ftp: 200, weight: 75, restingHr: 55 }}
        workout={{ history: [], elapsed: 60, formatTime: (seconds: number) => `${seconds}s` }}
        hrConnected
        bikeConnected
        onStopSession={vi.fn()}
      />
    </I18nProvider>
  );

describe('RecordingCockpit demo badge', () => {
  beforeEach(() => {
    useBluetoothStore.setState({ isSimulating: false });
  });

  it('does not label a real session as a demo', () => {
    renderCockpit();

    expect(screen.queryByText('Demo')).not.toBeInTheDocument();
  });

  it('marks the ride as simulated telemetry so fake data is never mistaken for a real device', () => {
    useBluetoothStore.setState({ isSimulating: true });

    renderCockpit();

    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByTitle('Simulated telemetry — not a real device')).toBeInTheDocument();
  });
});
