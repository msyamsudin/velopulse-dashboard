import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import type { FtpResult } from '@/lib/ftp-test';
import { FtpTestModal } from './FtpTestModal';

const VALID_RESULT: FtpResult = {
  valid: true,
  reason: null,
  ftp: 190,
  avgPower: 200,
  coverageSeconds: 1199,
  gapCount: 0,
};

const INVALID_RESULT: FtpResult = {
  valid: false,
  reason: 'short-coverage',
  ftp: null,
  avgPower: 200,
  coverageSeconds: 900,
  gapCount: 1,
};

const baseProps: Parameters<typeof FtpTestModal>[0] = {
  status: 'intro',
  warmupRemaining: 300,
  effortRemaining: 1200,
  effortElapsed: 0,
  avgPower: 0,
  currentPower: 0,
  currentHr: 0,
  bikeConnected: true,
  deviceName: 'Kettler Racer',
  currentFtp: 0,
  result: null,
  saveState: 'idle',
  abortReason: null,
  onStart: vi.fn(),
  onSkipWarmup: vi.fn(),
  onCancel: vi.fn(),
  onClose: vi.fn(),
  onApply: vi.fn().mockResolvedValue(undefined),
};

const renderModal = (overrides: Partial<Parameters<typeof FtpTestModal>[0]> = {}) => {
  const props = { ...baseProps, ...overrides };
  render(
    <I18nProvider>
      <FtpTestModal {...props} />
    </I18nProvider>
  );
  return props;
};

describe('FtpTestModal', () => {
  it('explains the protocol before the test starts', () => {
    renderModal();

    expect(screen.getByText('Measure your FTP')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
  });

  it('blocks the start button until the bike streams power', () => {
    renderModal({ bikeConnected: false });

    expect(screen.getByRole('button', { name: 'Start test' })).toBeDisabled();
    expect(screen.getByText('Connect the bike to start the test.')).toBeInTheDocument();
  });

  it('starts the test when the bike is ready', () => {
    const { onStart } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Start test' }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('shows the warm-up countdown and lets the rider skip it', () => {
    const { onSkipWarmup } = renderModal({ status: 'warmup', warmupRemaining: 240 });

    expect(screen.getByText('4:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip warm-up' }));

    expect(onSkipWarmup).toHaveBeenCalledTimes(1);
  });

  it('shows the effort countdown without any FTP percentage', () => {
    renderModal({ status: 'effort', effortRemaining: 900, effortElapsed: 300, avgPower: 210, currentPower: 230 });

    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(screen.getByText('210 W')).toBeInTheDocument();
    expect(screen.getByText('230 W')).toBeInTheDocument();
    expect(screen.queryByText(/% FTP/)).not.toBeInTheDocument();
  });

  it('presents the measured FTP and applies it only on request', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    renderModal({ status: 'result', result: VALID_RESULT, saveState: 'saved', onApply });

    expect(screen.getByText('190')).toBeInTheDocument();
    expect(screen.getByText(/95% of your 20-minute average power \(200 W\)/)).toBeInTheDocument();
    expect(screen.getByText('Saved to History as an FTP test.')).toBeInTheDocument();
    expect(screen.getByText('This is a measurement only. Your profile gains no FTP unless you apply it.')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use this FTP (optional)' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(190));
    await waitFor(() => expect(screen.getByRole('button', { name: 'FTP applied' })).toBeDisabled());
  });

  it('keeps the current profile FTP unless the rider applies the result', () => {
    renderModal({ status: 'result', result: VALID_RESULT, saveState: 'saved', currentFtp: 200 });

    expect(screen.getByText('Your profile FTP stays at 200 W. Applying this result is optional.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this FTP (optional)' })).toBeInTheDocument();
  });

  it('explains why a short effort produced no FTP', () => {
    renderModal({ status: 'result', result: INVALID_RESULT, saveState: 'saved' });

    expect(screen.getByText('FTP not measured')).toBeInTheDocument();
    expect(screen.getByText(/Only 15:00 of the required 18 minutes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this FTP' })).not.toBeInTheDocument();
  });
});
