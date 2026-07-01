import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, User, X } from 'lucide-react';
import { AppConfig } from '@/lib/config-helper';
import { resetSupabaseClientCache } from '@/lib/supabase';
import { DEFAULT_PROFILE } from '@/lib/constants';
import { validateGoogleConfig, validateSupabaseConfig } from '@/lib/config-validator';

// Components
import { ProfileTab } from './settings/ProfileTab';
import { SystemTab } from './settings/SystemTab';
import { MasterLock } from './settings/MasterLock';
import { IconButton, SegmentedControl } from './ui';
import { useI18n } from '@/i18n';

interface UserProfile {
  age: number;
  maxHr: number;
  ftp: number;
  weight: number;
}

interface SettingsModalProps {
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

export const SettingsModal = ({ onClose, onSave }: SettingsModalProps) => {
  const { locale, setLocale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'profile' | 'system'>('profile');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [sysConfig, setSysConfig] = useState<Partial<AppConfig>>({
    APP_URL: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    MASTER_PASSWORD: ''
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [googleValidating, setGoogleValidating] = useState(false);
  const [googleValidStatus, setGoogleValidStatus] = useState<{valid: boolean, msg: string} | null>(null);

  const [supabaseValidating, setSupabaseValidating] = useState(false);
  const [supabaseValidStatus, setSupabaseValidStatus] = useState<{valid: boolean, msg: string} | null>(null);

  useEffect(() => {
    // Load profile from server
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setProfile({
            age: data.age ?? DEFAULT_PROFILE.age,
            maxHr: data.maxHr ?? data.max_hr ?? DEFAULT_PROFILE.maxHr,
            ftp: data.ftp ?? DEFAULT_PROFILE.ftp,
            weight: data.weight ?? DEFAULT_PROFILE.weight,
          });
        }
      })
      .catch(err => console.error('Failed to load profile:', err));

    // Fetch masked sys config
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setSysConfig(data))
      .catch(err => console.error('Failed to load system config:', err));
  }, []);

  const handleSaveProfile = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      
      if (res.ok) {
        setSaveStatus('success');
        onSave(profile);
        setTimeout(() => {
          setSaveStatus('idle');
          onClose();
        }, 1000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleSaveSystem = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sysConfig, password })
      });
      
      if (res.ok) {
        resetSupabaseClientCache();
        setSaveStatus('success');
        
        // If master password was changed, update local password state so validation/saving continues to work
        if (sysConfig.MASTER_PASSWORD && sysConfig.MASTER_PASSWORD !== '●●●●●●●●●') {
          setPassword(sysConfig.MASTER_PASSWORD);
          setSysConfig(prev => ({
            ...prev,
            MASTER_PASSWORD: '●●●●●●●●●'
          }));
        }

        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        const data = await res.json();
        setUnlockError(data.error || 'Failed to save');
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleExport = async (encryptionPassword: string): Promise<string> => {
    const res = await fetch('/api/config/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'export',
        password, // current master password to authorize
        encryptionPassword
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to export configuration');
    }
    return data.token;
  };

  const handleImport = async (token: string, decryptionPassword: string): Promise<boolean> => {
    const res = await fetch('/api/config/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'import',
        token,
        decryptionPassword
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to import configuration');
    }
    return data.success || false;
  };

  const handleUnlock = async () => {
    if (!password) {
      setUnlockError('Password required');
      return;
    }
    setIsUnlocking(true);
    setUnlockError('');
    try {
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
        setUnlockError(data.error || 'Incorrect master password');
      }
    } catch {
      setUnlockError('Could not verify password. Check connection.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleValidateGoogle = async () => {
    setGoogleValidating(true);
    setGoogleValidStatus(null);
    const result = await validateGoogleConfig(password, sysConfig.GOOGLE_CLIENT_ID, sysConfig.GOOGLE_CLIENT_SECRET);
    setGoogleValidStatus(result);
    setGoogleValidating(false);
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
                saveStatus={saveStatus}
              />
            ) : !isUnlocked ? (
              <MasterLock 
                password={password}
                setPassword={setPassword}
                onUnlock={handleUnlock}
                error={unlockError}
                isUnlocking={isUnlocking}
              />
            ) : (
              <SystemTab 
                sysConfig={sysConfig}
                setSysConfig={setSysConfig}
                onSave={handleSaveSystem}
                saveStatus={saveStatus}
                onValidateGoogle={handleValidateGoogle}
                googleValidating={googleValidating}
                googleValidStatus={googleValidStatus}
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
