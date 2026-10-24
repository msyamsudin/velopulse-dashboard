import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { SetupLanding } from './SetupLanding';

beforeEach(() => {
  try {
    window.localStorage.setItem('velopulse-locale', 'en');
  } catch {
    // storage unavailable — the provider falls back to the browser language
  }
});

const renderLanding = (orphanProfileAvailable: boolean, onClaim = vi.fn(async () => true)) => {
  render(
    <I18nProvider>
      <SetupLanding
        onInitialize={vi.fn()}
        missingFields={[]}
        isProfileMissing
        orphanProfileAvailable={orphanProfileAvailable}
        onClaimOrphanProfile={onClaim}
      />
    </I18nProvider>
  );
  return onClaim;
};

describe('SetupLanding orphan profile offer', () => {
  it('offers to link an older profile only when one exists', () => {
    renderLanding(true);

    expect(screen.getByText('A profile from before sign-in is available')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Link the earlier profile/i }));
  });

  it('claims nothing by itself', () => {
    const onClaim = renderLanding(false);

    expect(screen.queryByText('A profile from before sign-in is available')).not.toBeInTheDocument();
    expect(onClaim).not.toHaveBeenCalled();
  });

  it('claims only after the rider presses the button', () => {
    const onClaim = renderLanding(true);

    expect(onClaim).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Link the earlier profile/i }));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });
});
