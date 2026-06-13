import { Lock } from 'lucide-react';

interface MasterLockProps {
  password: string;
  setPassword: (val: string) => void;
  onUnlock: () => void;
  error?: string;
}

export const MasterLock = ({ password, setPassword, onUnlock, error }: MasterLockProps) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-5 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-vp-accent/25 bg-vp-accent/10 text-vp-accent">
        <Lock size={28} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-vp-text">Restricted access</h3>
        <p className="mt-1 text-sm text-vp-muted">Enter the master password to modify system settings.</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <input
          type="password"
          placeholder="Master password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onUnlock()}
          className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 text-center font-mono text-vp-text outline-none transition-colors placeholder:text-vp-dim focus:border-vp-accent/50"
        />
        {error && <p className="text-[10px] uppercase font-mono text-vp-danger">{error}</p>}
        <button
          onClick={onUnlock}
          className="vp-button vp-focus-ring min-h-11 w-full"
        >
          Unlock
        </button>
      </div>
    </div>
  );
};
