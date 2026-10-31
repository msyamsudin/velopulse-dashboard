import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, User, X } from 'lucide-react';
import { AppConfig } from '@/lib/config-helper';
import { resetSupabaseClientCache } from '@/lib/supabase';
import { readBodyHistory, writeBodyHistory } from '@/lib/body-history';
import { validateSupabaseConfig } from '@/lib/config-validator';
import type { UserProfile } from '@/lib/profile';
import { fetchProfileApi } from '@/lib/profile-api';

// Components
import { ProfileTab } from './settings/ProfileTab';
import { SystemTab } from './settings/SystemTab';
import { MasterLock } from './settings/MasterLock';
import { IconButton, SegmentedControl } from './ui';
import { useI18n } from '@/i18n';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
  /** Profil yang sudah dimuat induk. Modal tidak mengambil ulang sendiri. */
  profile: UserProfile;
  profileStatus: 'loading' | 'ready' | 'new' | 'error';
  initialTab?: 'profile' | 'system';
  profileError?: { userMessage: string } | null;
  onRetryProfile?: () => void;
  /** Membuka tes FTP dari tab Profil; App menutup Settings lebih dulu. */
  onStartFtpTest?: () => void;
}

type SaveState = { status: 'idle' | 'saving' | 'success' | 'error'; message: string };

const IDLE_SAVE: SaveState = { status: 'idle', message: '' };

export const SettingsModal = ({
  onClose,
  onSave,
  profile: loadedProfile,
  profileStatus,
  initialTab = 'profile',
  profileError,
  onRetryProfile,
  onStartFtpTest,
}: SettingsModalProps) => {
  const { locale, setLocale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'profile' | 'system'>(initialTab);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  
  // Draf hanya ada setelah pengguna menyunting. Selama `null`, formulir membaca
  // langsung profil yang dimuat induk, sehingga profil yang tiba belakangan
  // (retry berhasil) langsung terpakai tanpa efek sinkronisasi.
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const profile = draft ?? loadedProfile;
  const setProfile = (next: UserProfile) => setDraft(next);
  const [sysConfig, setSysConfig] = useState<Partial<AppConfig>>({
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    MASTER_PASSWORD: ''
  });
  const [setupRequired, setSetupRequired] = useState(false);

  const [profileSave, setProfileSave] = useState<SaveState>(IDLE_SAVE);
  const [systemSave, setSystemSave] = useState<SaveState>(IDLE_SAVE);

  const [supabaseValidating, setSupabaseValidating] = useState(false);
  const [supabaseValidStatus, setSupabaseValidStatus] = useState<{valid: boolean, msg: string} | null>(null);

  useEffect(() => {
    // Fetch masked sys config
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setSysConfig(data);
        setSetupRequired(Boolean(data.setupRequired));
      })
      .catch(err => console.error('Failed to load system config:', err));
  }, []);

  // Sebuah profil hanya boleh disimpan bila nilainya diketahui. `error` berarti
  // pemuatan gagal dan isi formulir hanyalah nilai default, jadi menyimpannya
  // akan menimpa profil sebenarnya dengan nol.
  const profileEditable = profileStatus === 'ready' || profileStatus === 'new';

  const handleSaveProfile = async () => {
    if (!profileEditable || profileSave.status === 'saving') return;
    setProfileSave({ status: 'saving', message: '' });
    try {
      const res = await fetchProfileApi('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      
      if (res.ok) {
        setProfileSave({ status: 'success', message: '' });
        onSave(profile);
        setDraft(null);
        setTimeout(() => {
          setProfileSave(IDLE_SAVE);
          onClose();
        }, 1000);
      } else {
        let errorMsg = t('Failed to save profile');
        try {
          const data = await res.json();
          errorMsg = data.userMessage || data.error || errorMsg;
        } catch {
          errorMsg = t('Failed to save profile (HTTP {status})', { status: res.status });
        }
        setProfileSave({ status: 'error', message: errorMsg });
      }
    } catch {
      setProfileSave({ status: 'error', message: t('Could not reach the server. Check your internet connection.') });
    }
  };

  const handleSaveSystem = async () => {
    setSystemSave({ status: 'saving', message: '' });
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sysConfig, password })
      });
      
      if (res.ok) {
        resetSupabaseClientCache();
        setSystemSave({ status: 'success', message: '' });

        if (sysConfig.NEXT_PUBLIC_SUPABASE_URL && sysConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          window.setTimeout(() => {
            window.location.reload();
          }, 900);
        }
        
        // If master password was changed, update local password state so validation/saving continues to work
        if (sysConfig.MASTER_PASSWORD && sysConfig.MASTER_PASSWORD !== '●●●●●●●●●') {
          setPassword(sysConfig.MASTER_PASSWORD);
          setSysConfig(prev => ({
            ...prev,
            MASTER_PASSWORD: '●●●●●●●●●'
          }));
        }

        setTimeout(() => setSystemSave(IDLE_SAVE), 2000);
      } else {
        const data = await res.json();
        setUnlockError(data.error || t('Failed to save configuration'));
        setSystemSave({ status: 'error', message: '' });
      }
    } catch {
      setSystemSave({ status: 'error', message: '' });
    }
  };

  const handleExport = async (encryptionPassword: string): Promise<string> => {
    const res = await fetch('/api/config/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'export',
        password, // current master password to authorize
        encryptionPassword,
        // Riwayat tubuh hanya ada di perangkat ini, jadi klien yang mengirimnya.
        bodyHistory: readBodyHistory(),
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || t('Failed to export configuration'));
    }
    return data.token;
  };

  const handleImport = async (token: string, decryptionPassword: string, masterPassword: string): Promise<boolean> => {
    const res = await fetch('/api/config/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'import',
        token,
        decryptionPassword,
        masterPassword
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || t('Failed to import configuration'));
    }
    if (data.bodyHistory) writeBodyHistory(data.bodyHistory);
    return data.success || false;
  };

  const handleUnlock = async () => {
    if (!password) {
      setUnlockError(t('Password required'));
      return;
    }
    setIsUnlocking(true);
    setUnlockError('');
    try {
      if (setupRequired) {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ MASTER_PASSWORD: password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setUnlockError(data.error || t('Could not set master password'));
          return;
        }
        setSetupRequired(false);
        setIsUnlocked(true);
        return;
      }
      const res = await fetch('/api/config/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify({ type: 'master' })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setIsUnlocked(true);
        setUnlockError('');
      } else {
        setUnlockError(data.error || t('Incorrect master password'));
      }
    } catch {
      setUnlockError(t('Could not verify password. Check connection.'));
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleValidateSupabase = async () => {
    setSupabaseValidating(true);
    setSupabaseValidStatus(null);
    const result = await validateSupabaseConfig(password, sysConfig.NEXT_PUBLIC_SUPABASE_URL, sysConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    setSupabaseValidStatus(result);
    setSupabaseValidating(false);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-vp-bg/85 p-4 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="vp-panel-raised relative max-h-[92dvh] w-full max-w-2xl overflow-hidden p-0 shadow-2xl"
      >
        <IconButton
          onClick={onClose}
          className="absolute right-4 top-4 z-10"
          label={t('Close settings')}
          icon={<X size={17} />}
        />

        <div className="border-b border-vp-border p-5 pr-16">
          <div className="vp-label">{t('Settings')}</div>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-normal text-vp-text">{t('Configuration')}</h2>
              <p className="mt-1 text-sm text-vp-muted">{t('Profile calibration and integration settings.')}</p>
            </div>
            <SegmentedControl
              ariaLabel={t('Settings tab')}
              value={activeTab}
              options={[
                { label: <span className="inline-flex items-center gap-2"><User size={13} /> {t('Profile')}</span>, value: 'profile' },
                { label: <span className="inline-flex items-center gap-2"><Settings size={13} /> {t('System')}</span>, value: 'system' },
              ]}
              onChange={(value) => setActiveTab(value as 'profile' | 'system')}
            />
          </div>
        </div>

        <div className="max-h-[calc(92dvh-132px)] overflow-y-auto p-5 custom-scrollbar md:p-7">
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-vp-border bg-white/[0.025] p-3">
            <label htmlFor="app-language" className="vp-label">{t('Language')}</label>
            <select
              id="app-language"
              value={locale}
              onChange={(event) => setLocale(event.target.value as 'en' | 'id')}
              className="vp-focus-ring rounded-md border border-vp-border bg-vp-bg px-3 py-2 text-xs text-vp-text outline-none"
            >
              <option value="en">{t('English')}</option>
              <option value="id">{t('Indonesian')}</option>
            </select>
          </div>
          <AnimatePresence mode="wait">
            {activeTab === 'profile' ? (
              <ProfileTab 
                profile={profile}
                setProfile={setProfile}
                onSave={handleSaveProfile}
                saveStatus={profileSave.status}
                saveError={profileSave.message}
                canSave={profileEditable}
                loadStatus={profileStatus}
                loadError={profileError?.userMessage ?? null}
                onRetryLoad={onRetryProfile}
                onMeasureFtp={profileStatus === 'ready' ? onStartFtpTest : undefined}
              />
            ) : !isUnlocked ? (
              <MasterLock 
                password={password}
                setPassword={setPassword}
                onUnlock={handleUnlock}
                error={unlockError}
                isUnlocking={isUnlocking}
                setupRequired={setupRequired}
              />
            ) : (
              <SystemTab 
                sysConfig={sysConfig}
                setSysConfig={setSysConfig}
                onSave={handleSaveSystem}
                saveStatus={systemSave.status}
                onValidateSupabase={handleValidateSupabase}
                supabaseValidating={supabaseValidating}
                supabaseValidStatus={supabaseValidStatus}
                onExport={handleExport}
                onImport={handleImport}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
