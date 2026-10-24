import { motion } from 'motion/react';
import { Activity, AlertTriangle, Save, Target, User, Zap } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  calculateMaxHr,
  hasProfileErrors,
  validateProfile,
  type ProfileField,
  type UserProfile,
} from '@/lib/profile';
import { getProfileGate } from '@/lib/profile-gate';
import { useI18n } from '@/i18n';

interface ProfileTabProps {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  onSave: () => void;
  saveStatus: string;
  saveError?: string;
  /** False saat profil belum diketahui: menyimpan akan menulis nilai default. */
  canSave?: boolean;
  loadStatus?: 'loading' | 'ready' | 'new' | 'error';
  loadError?: string | null;
  onRetryLoad?: () => void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  icon: ReactNode;
  readOnly?: boolean;
  suffix?: string;
  errorMessage?: string | null;
  onChange?: (value: number) => void;
}

const NumberField = ({
  label,
  value,
  icon,
  readOnly = false,
  suffix,
  errorMessage,
  onChange,
}: NumberFieldProps) => (
  <div className="space-y-2">
    <label className="vp-label flex items-center gap-2">
      {icon}
      {label}
    </label>
    <div className="relative">
      <input
        type="number"
        value={value ?? ''}
        readOnly={readOnly}
        aria-invalid={Boolean(errorMessage)}
        onChange={(e) => onChange?.(parseInt(e.target.value) || 0)}
        className={`vp-focus-ring w-full rounded-lg border bg-white/[0.035] p-3 pr-16 font-mono text-vp-text outline-none transition-colors focus:border-vp-accent/50 ${readOnly ? 'opacity-70' : ''} ${errorMessage ? 'border-vp-danger/50' : 'border-vp-border'}`}
      />
      {suffix && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-vp-bg px-1.5 text-[8px] font-mono uppercase tracking-[0.12em] text-vp-muted">
          {suffix}
        </div>
      )}
    </div>
    {errorMessage && (
      <p role="alert" className="text-[10px] leading-4 text-vp-danger">{errorMessage}</p>
    )}
  </div>
);

export const ProfileTab = ({
  profile,
  setProfile,
  onSave,
  saveStatus,
  saveError,
  canSave = true,
  loadStatus = 'ready',
  loadError,
  onRetryLoad,
}: ProfileTabProps) => {
  const { t } = useI18n();
  // FTP and weight gate *metrics*, not riding: the notice explains what stays
  // hidden, it never disables anything in this form or on the cockpit.
  const gate = getProfileGate(profile);
  const errors = validateProfile(profile);
  // Kesalahan baru ditampilkan setelah pengguna mencoba menyimpan, supaya
  // formulir onboarding tidak langsung merah sebelum diisi.
  const [showErrors, setShowErrors] = useState(false);
  const errorFor = (field: ProfileField): string | null => {
    if (!showErrors || !errors[field]) return null;
    const messages: Record<ProfileField, string> = {
      age: t('Age must be a whole number between 10 and 100.'),
      maxHr: t('Max HR must be a whole number between 100 and 230.'),
      ftp: t('FTP must be a whole number between 0 and 2000.'),
      weight: t('Weight must be between 20 and 300 kg, with at most one decimal.'),
      restingHr: t('Resting HR must be between 25 and 120 bpm and below max HR.'),
    };
    return messages[field];
  };
  const handleSave = () => {
    if (hasProfileErrors(errors)) {
      setShowErrors(true);
      return;
    }
    onSave();
  };
  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-6"
    >
      <div>
        <div className="vp-label">{t('Rider profile')}</div>
        <p className="mt-2 text-sm leading-6 text-vp-muted">
          {t('These values calibrate heart-rate zones, power context, and ride summaries.')}
        </p>
      </div>

      {loadStatus === 'loading' && (
        <div className="rounded-lg border border-vp-border bg-white/[0.025] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-vp-muted">
          {t('Loading your profile...')}
        </div>
      )}

      {loadStatus === 'error' && (
        <div className="rounded-lg border border-vp-danger/30 bg-vp-danger/10 px-3 py-3">
          <div className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-vp-danger">
            {t('Profile could not be loaded')}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-vp-muted">
            {loadError || t('Saving is disabled until the stored profile is readable.')}
          </p>
          {onRetryLoad && (
            <button
              type="button"
              onClick={onRetryLoad}
              className="vp-focus-ring mt-2 rounded border border-vp-danger/40 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-vp-danger"
            >
              {t('Retry')}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label={t('Age')}
          value={profile.age}
          icon={<User size={12} className="text-vp-accent" />}
          suffix={t('Years')}
          errorMessage={errorFor('age')}
          onChange={(age) => setProfile({ ...profile, age, maxHr: calculateMaxHr(age) })}
        />
        <NumberField
          label={t('Max Heart Rate')}
          value={profile.maxHr}
          icon={<Target size={12} className="text-vp-hr" />}
          suffix={t('Auto')}
          errorMessage={errorFor('maxHr')}
          readOnly
        />
        <NumberField
          label="FTP"
          value={profile.ftp}
          icon={<Zap size={12} className="text-vp-power" />}
          suffix={t('Watts')}
          errorMessage={errorFor('ftp')}
          onChange={(ftp) => setProfile({ ...profile, ftp })}
        />
        <NumberField
          label={t('Weight')}
          value={profile.weight}
          icon={<User size={12} className="text-vp-speed" />}
          suffix="KG"
          errorMessage={errorFor('weight')}
          onChange={(weight) => setProfile({ ...profile, weight })}
        />
        <NumberField
          label={t('Resting HR')}
          value={profile.restingHr}
          icon={<Activity size={12} className="text-vp-hr" />}
          suffix="BPM"
          errorMessage={errorFor('restingHr')}
          onChange={(restingHr) => setProfile({ ...profile, restingHr })}
        />
      </div>

      <div className="rounded-lg border border-vp-border bg-white/[0.025] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-vp-muted">
        {t('Max HR uses the Robergs and Landwehr formula: 205.8 - 0.685 x age.')}
      </div>

      <div className="rounded-lg border border-vp-border bg-white/[0.025] px-3 py-2 text-[10px] leading-5 text-vp-muted">
        {t('Weight and resting HR are stored as a dated history on this device, so past sessions keep the weight they were ridden at.')}
      </div>

      {!gate.complete && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-3">
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-amber-300">
            <AlertTriangle size={12} />
            {t('Profile incomplete')}
          </div>
          <ul className="mt-2 space-y-1 text-[11px] leading-5 text-vp-muted">
            {!gate.hasFtp && <li>· {t('Add your FTP to unlock the power-zone block.')}</li>}
            {!gate.hasWeight && <li>· {t('Add your weight to unlock W/kg and kcal/kg/h.')}</li>}
          </ul>
          <p className="mt-1 text-[10px] leading-4 text-vp-muted">
            {t('Training is never blocked; these values only gate power and body-mass metrics.')}
          </p>
        </div>
      )}

      {saveError && saveStatus === 'error' && (
        <div className="rounded-lg border border-vp-danger/30 bg-vp-danger/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-vp-danger">
          {saveError}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!canSave || saveStatus === 'saving'}
        className="vp-focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-vp-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-vp-bg transition-colors hover:bg-vp-accent/90 disabled:pointer-events-none disabled:opacity-50"
      >
        <Save size={18} />
        {t(saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved' : 'Save Profile')}
      </button>
    </motion.div>
  );
};
