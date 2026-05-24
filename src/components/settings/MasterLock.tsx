import { Lock } from 'lucide-react';

interface MasterLockProps {
  password: string;
  setPassword: (val: string) => void;
  onUnlock: () => void;
  error?: string;
}

export const MasterLock = ({ password, setPassword, onUnlock, error }: MasterLockProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
      <div className="p-4 bg-hw-accent/10 rounded-full text-hw-accent">
        <Lock size={32} />
      </div>
      <div>
        <h3 className="text-lg font-bold uppercase">Restricted Access</h3>
        <p className="text-hw-muted text-xs mt-1">Enter Master Password to modify system settings.</p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <input 
          type="password" 
          placeholder="Enter Master Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onUnlock()}
          className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono focus:border-hw-accent/50 outline-none transition-colors"
        />
        {error && <p className="text-red-500 text-[10px] uppercase font-mono">{error}</p>}
        <button 
          onClick={onUnlock}
          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors text-xs uppercase tracking-widest"
        >
          Unlock
        </button>
      </div>
    </div>
  );
};
