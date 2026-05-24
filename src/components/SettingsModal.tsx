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
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="hardware-card border-hw-accent/20 bg-hw-bg max-w-xl w-full shadow-2xl relative p-0 overflow-hidden"
      >
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 z-10 text-hw-muted hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-4 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-hw-accent/10 text-hw-accent border-b-2 border-hw-accent' : 'text-hw-muted hover:text-white'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <User size={14} /> User Profile
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-4 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'system' ? 'bg-hw-accent/10 text-hw-accent border-b-2 border-hw-accent' : 'text-hw-muted hover:text-white'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <Settings size={14} /> System Config
            </div>
          </button>
        </div>

        <div className="p-8">
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
