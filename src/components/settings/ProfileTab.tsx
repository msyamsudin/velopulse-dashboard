import { motion } from 'motion/react';
import { User, Target, Zap, Save } from 'lucide-react';
import { DEFAULT_PROFILE, calculateMaxHr } from '@/lib/constants';

interface UserProfile {
  age: number;
  maxHr: number;
  ftp: number;
  weight: number;
}

interface ProfileTabProps {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  onSave: () => void;
  saveStatus: string;
}

export const ProfileTab = ({ profile, setProfile, onSave, saveStatus }: ProfileTabProps) => {
  return (
    <motion.div 
      key="profile"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-6"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
              <User size={12} className="text-hw-accent" /> Age
            </label>
            <input 
              type="number" 
              value={profile.age ?? ''}
              onChange={(e) => {
                const age = parseInt(e.target.value) || 0;
                setProfile({...profile, age, maxHr: calculateMaxHr(age)});
              }}
              className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono focus:border-hw-accent/50 outline-none transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
              <Target size={12} className="text-red-500" /> Max Heart Rate (BPM)
            </label>
            <div className="relative">
              <input 
                type="number" 
                value={profile.maxHr ?? ''}
                readOnly
                className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono focus:border-hw-accent/50 outline-none transition-colors opacity-70"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-mono text-hw-muted uppercase bg-hw-bg px-1">
                Auto-Calc
              </div>
            </div>
          </div>
        </div>
        <p className="text-[8px] font-mono text-hw-muted uppercase tracking-wider -mt-2">
          Max HR calculated using Robergs & Landwehr formula (205.8 - 0.685 × age).
        </p>
        <div className="space-y-2">
          <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
            <Zap size={12} className="text-yellow-400" /> FTP (Watts)
          </label>
          <input 
            type="number" 
            value={profile.ftp ?? ''}
            onChange={(e) => setProfile({...profile, ftp: parseInt(e.target.value) || 0})}
            className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono focus:border-hw-accent/50 outline-none transition-colors"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
            <User size={12} className="text-blue-400" /> Weight (KG)
          </label>
          <input 
            type="number" 
            value={profile.weight ?? ''}
            onChange={(e) => setProfile({...profile, weight: parseInt(e.target.value) || 0})}
            className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono focus:border-hw-accent/50 outline-none transition-colors"
          />
        </div>
      </div>
      <button 
        onClick={onSave}
        disabled={saveStatus === 'saving'}
        className="w-full py-4 bg-hw-accent text-hw-bg font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all"
      >
        <Save size={20} /> {saveStatus === 'saving' ? 'SAVING...' : 'SAVE PROFILE'}
      </button>
    </motion.div>
  );
};
