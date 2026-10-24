import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import type { UserProfile } from '@/lib/profile';
import { ProfileTab } from './ProfileTab';

// Pin the locale so the assertions below do not depend on the machine language.
beforeEach(() => {
  try {
    window.localStorage.setItem('velopulse-locale', 'en');
  } catch {
    // storage unavailable — the provider falls back to the browser language
  }
});

const renderTab = (
  profile: Partial<UserProfile> & Pick<UserProfile, 'age' | 'maxHr' | 'ftp' | 'weight'>,
  onSave = vi.fn()
) => {
  render(
    <I18nProvider>
      <ProfileTab
        profile={{ restingHr: 0, maxHrSource: 'auto', ...profile }}
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

  it('blocks saving and explains why when a value is out of range', () => {
    const onSave = renderTab({ age: 0, maxHr: 190, ftp: 220, weight: 74 });

    fireEvent.click(screen.getByRole('button'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Age must be a whole number between 10 and 100.'
    );
  });

  it('keeps the typed text, accepts decimals and lets the rider clear a field', () => {
    const Stateful = () => {
      const [profile, setProfile] = useState<UserProfile>({
        age: 40, maxHr: 178, maxHrSource: 'auto', ftp: 220, weight: 74, restingHr: 52,
      });
      return (
        <ProfileTab
          profile={profile}
          setProfile={setProfile}
          onSave={() => {}}
          saveStatus="idle"
        />
      );
    };

    render(
      <I18nProvider>
        <Stateful />
      </I18nProvider>
    );

    const weight = screen.getByLabelText('Weight');
    fireEvent.change(weight, { target: { value: '72.5' } });
    expect(weight).toHaveValue('72.5');

    fireEvent.change(weight, { target: { value: '72.55' } });
    expect(weight).toHaveValue('72.55');

    // Mengosongkan field berarti "belum diisi" (0), bukan dipaksa tampil 0.
    const age = screen.getByLabelText('Age');
    fireEvent.change(age, { target: { value: '' } });
    expect(age).toHaveValue('');

    // Karakter selain angka dibuang sebelum menjadi nilai.
    fireEvent.change(age, { target: { value: '4a0' } });
    expect(age).toHaveValue('40');
  });

  it('keeps a measured max HR across age edits and re-derives it on Auto', () => {
    const Stateful = () => {
      const [profile, setProfile] = useState<UserProfile>({
        age: 40, maxHr: 178, maxHrSource: 'auto', ftp: 220, weight: 74, restingHr: 52,
      });
      return (
        <ProfileTab
          profile={profile}
          setProfile={setProfile}
          onSave={() => {}}
          saveStatus="idle"
        />
      );
    };

    render(
      <I18nProvider>
        <Stateful />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Manual' }));
    const maxHr = screen.getByLabelText('Max Heart Rate');
    expect(maxHr).not.toHaveAttribute('readonly');

    fireEvent.change(maxHr, { target: { value: '184' } });
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '50' } });

    expect(maxHr).toHaveValue('184');

    // Kembali ke Auto memakai rumus dari usia saat ini.
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(maxHr).toHaveValue('172');
    expect(maxHr).toHaveAttribute('readonly');
  });

  it('offers a resting-HR field and says where the body history lives', () => {
    renderTab({ age: 40, maxHr: 178, ftp: 220, weight: 74, restingHr: 52 });

    expect(screen.getByText('Resting HR')).toBeInTheDocument();
    expect(screen.getByText(/stored as a dated history on this device/)).toBeInTheDocument();
  });
});
