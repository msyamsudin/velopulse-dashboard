import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ProfileTab } from './ProfileTab';

// Pin the locale so the assertions below do not depend on the machine language.
beforeEach(() => {
  try {
    window.localStorage.setItem('velopulse-locale', 'en');
  } catch {
    // storage unavailable — the provider falls back to the browser language
  }
});

const renderTab = (profile: { age: number; maxHr: number; ftp: number; weight: number }, onSave = vi.fn()) => {
  render(
    <I18nProvider>
      <ProfileTab
        profile={profile}
        setProfile={() => {}}
        onSave={onSave}
        saveStatus="idle"
      />
    </I18nProvider>
  );
  return onSave;
};

describe('ProfileTab metric gate', () => {
  it('invites the rider to fill FTP and weight without disabling save', () => {
    const onSave = renderTab({ age: 40, maxHr: 178, ftp: 0, weight: 0 });

    expect(screen.getByText('Profile incomplete')).toBeInTheDocument();
    expect(screen.getAllByText(/Add your FTP to unlock the power-zone block\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Add your weight to unlock W\/kg and kcal\/kg\/h\./).length).toBeGreaterThan(0);
    expect(screen.getByText(/Training is never blocked/)).toBeInTheDocument();

    // Regression guard: the gate is about metrics, so the form must stay usable
    // and saving must keep working with an incomplete profile.
    const save = screen.getByRole('button');
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('lists only the value that is actually missing', () => {
    renderTab({ age: 40, maxHr: 178, ftp: 0, weight: 80 });

    expect(screen.getByText('Profile incomplete')).toBeInTheDocument();
    expect(screen.getAllByText(/Add your FTP to unlock/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Add your weight to unlock/)).toHaveLength(0);
  });

  it('hides the notice once both metric inputs are filled', () => {
    renderTab({ age: 40, maxHr: 178, ftp: 220, weight: 74 });

    expect(screen.queryByText('Profile incomplete')).not.toBeInTheDocument();
    expect(screen.queryAllByText(/Add your FTP to unlock/)).toHaveLength(0);
    expect(screen.queryAllByText(/Add your weight to unlock/)).toHaveLength(0);
  });
});
