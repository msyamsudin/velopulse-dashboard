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
  const [activeTab, setActiveTab] = useState<'profile' | 'system'>('profile');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [sysConfig, setSysConfig] = useState<Partial<AppConfig>>({
    APP_URL: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    NEXT_PUBLIC_SUPABASE_URL: '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ''
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

  const handleUnlock = () => {
    if (!password) {
      setUnlockError('Password required');
      return;
    }
    setIsUnlocked(true);
    setUnlockError('');
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
          label="Close settings"
          icon={<X size={17} />}
        />

        <div className="border-b border-vp-border p-5 pr-16">
          <div className="vp-label">Settings</div>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-normal text-vp-text">Configuration</h2>
              <p className="mt-1 text-sm text-vp-muted">Profile calibration and integration settings.</p>
            </div>
            <SegmentedControl
              ariaLabel="Settings tab"
              value={activeTab}
              options={[
                { label: <span className="inline-flex items-center gap-2"><User size={13} /> Profile</span>, value: 'profile' },
                { label: <span className="inline-flex items-center gap-2"><Settings size={13} /> System</span>, value: 'system' },
              ]}
              onChange={(value) => setActiveTab(value as 'profile' | 'system')}
            />
          </div>
        </div>

        <div className="max-h-[calc(92dvh-132px)] overflow-y-auto p-5 custom-scrollbar md:p-7">
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
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
