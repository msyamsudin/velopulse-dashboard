import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface MasterLockProps {
  password: string;
  setPassword: (val: string) => void;
  onUnlock: () => void;
  error?: string;
  isUnlocking?: boolean;
}

export const MasterLock = ({ password, setPassword, onUnlock, error, isUnlocking }: MasterLockProps) => {
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center space-y-5 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-vp-accent/25 bg-vp-accent/10 text-vp-accent">
        <Lock size={28} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-vp-text">{t('Restricted access')}</h3>
        <p className="mt-1 text-sm text-vp-muted">{t('Enter the master password to modify system settings.')}</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <div className="relative">
          <input
            key={showPassword ? 'text' : 'password'}
            type={showPassword ? 'text' : 'password'}
            placeholder={t('Master password')}
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onUnlock()}
            className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 pr-11 text-center font-mono text-vp-text outline-none transition-colors placeholder:text-vp-dim focus:border-vp-accent/50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-vp-muted hover:text-vp-text transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {error && <p className="text-[10px] uppercase font-mono text-vp-danger">{error}</p>}
        <button
          onClick={onUnlock}
          disabled={isUnlocking}
          className="vp-button vp-focus-ring min-h-11 w-full"
        >
          {isUnlocking ? <Loader2 size={13} className="animate-spin" /> : null}
          {isUnlocking ? 'Verifying...' : t('Unlock')}
        </button>
      </div>
    </div>
  );
};
