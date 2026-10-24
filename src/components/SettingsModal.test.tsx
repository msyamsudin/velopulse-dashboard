import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import type { UserProfile } from '@/lib/profile';
import { SettingsModal } from './SettingsModal';

const profile: UserProfile = {
  age: 40, maxHr: 178, maxHrSource: 'auto', ftp: 220, weight: 74, restingHr: 50,
};

beforeEach(() => {
  try {
    window.localStorage.setItem('velopulse-locale', 'en');
  } catch {
    // storage unavailable — the provider falls back to the browser language
  }
});

const renderModal = (profileStatus: 'loading' | 'ready' | 'error' | 'new') => {
  // Permintaan konfigurasi sistem dibiarkan menggantung: tes ini hanya peduli
  // pada jalur profil, dan state yang tidak selesai tidak memicu act warning.
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() => new Promise<Response>(() => {}));
  const onSave = vi.fn();
  const onRetryProfile = vi.fn();

  render(
    <I18nProvider>
      <SettingsModal
        profile={profile}
        profileStatus={profileStatus}
        profileError={{ userMessage: 'Database unreachable' }}
        onRetryProfile={onRetryProfile}
        onClose={vi.fn()}
        onSave={onSave}
      />
    </I18nProvider>
  );

  return { fetchSpy, onSave, onRetryProfile };
};

const clickSave = () => fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

describe('SettingsModal profile load guard', () => {
  it('refuses to save a profile that failed to load', () => {
    const { fetchSpy, onSave, onRetryProfile } = renderModal('error');

    expect(screen.getByText('Profile could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Database unreachable')).toBeInTheDocument();

    const save = screen.getByRole('button', { name: /Save Profile/i });
    expect(save).toBeDisabled();

    clickSave();
    expect(onSave).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalledWith('/api/profile', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryProfile).toHaveBeenCalledTimes(1);
  });

  it('keeps saving disabled while the profile is still loading', () => {
    const { fetchSpy } = renderModal('loading');

    expect(screen.getByText('Loading your profile...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Profile/i })).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalledWith('/api/profile', expect.anything());
  });

  it('allows saving a profile that is known', () => {
    renderModal('ready');

    expect(screen.queryByText('Profile could not be loaded')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Profile/i })).toBeEnabled();
  });

  it('allows the first save during onboarding', () => {
    renderModal('new');

    expect(screen.getByRole('button', { name: /Save Profile/i })).toBeEnabled();
  });
});
