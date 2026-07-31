import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ArrowRight, Settings, Activity, Globe, Zap, Server, User, Loader2, Eye, EyeOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';

export interface ConnectionError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
}

interface SetupLandingProps {
  onInitialize: () => void;
  missingFields: string[];
  isProfileMissing?: boolean;
  connectionError?: ConnectionError | null;
  onRetryConnection?: () => void;
}

const ERROR_TITLE: Record<string, string> = {
  SUPABASE_PAUSED: 'Supabase database paused',
  NETWORK_ERROR: 'Cloud database unreachable',
  INVALID_CREDENTIALS: 'Supabase credentials invalid',
  NOT_CONFIGURED: 'Supabase not configured',
  UNKNOWN: 'Cloud database error',
};

export const SetupLanding = ({ onInitialize, missingFields, isProfileMissing, connectionError, onRetryConnection }: SetupLandingProps) => {
  const { t } = useI18n();

  // Restore states
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [showDecryptionPassword, setShowDecryptionPassword] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleRestore = async () => {
    setIsRestoring(true);
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/config/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          token,
          decryptionPassword: password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore configuration');
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Restore failed');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-hw-bg overflow-hidden relative">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl w-full"
      >
        <div className="hardware-card border-hw-accent/20 bg-hw-bg/40 backdrop-blur-xl p-12 relative overflow-hidden">
          {/* Accent Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-hw-accent/60" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-hw-accent mb-2">
                  <Activity size={24} className="animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.4em] font-bold">{t('System Initialization Required')}</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter leading-[1.1]">
                  {t('WELCOME TO')} <br />
                  <span className="text-hw-accent">VELOPULSE</span> PRO
                </h1>
                <p className="text-hw-muted text-sm leading-relaxed max-w-md">
                  {t('Your advanced fitness telemetry hub is almost ready. We need to establish a secure connection with your external data providers and cloud infrastructure.')}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">{t('Connection Checklist:')}</h3>
                <div className="grid grid-cols-1 gap-3">
                  <CheckItem
                    label={t('Google Fit Integration')}
                    icon={<Globe size={14} />}
                    isMissing={missingFields.some(f => f.includes('GOOGLE'))}
                  />
                  <CheckItem
                    label={t('Supabase Cloud Database')}
                    icon={<Server size={14} />}
                    isMissing={missingFields.some(f => f.includes('SUPABASE'))}
                    isError={!!connectionError}
                  />
                  <CheckItem
                    label={t('Application URL Configuration')}
                    icon={<ShieldCheck size={14} />}
                    isMissing={missingFields.includes('APP_URL')}
                  />
                  <CheckItem
                    label={t('User Profile Setup (Age, Weight, FTP)')}
                    icon={<User size={14} />}
                    isMissing={!!isProfileMissing}
                  />
                </div>
              </div>

              {connectionError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-hw-danger/40 bg-hw-danger/10 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-hw-danger" />
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-hw-danger">
                        {t(ERROR_TITLE[connectionError.code] || 'Cloud database error')}
                      </p>
                      <p className="text-[11px] leading-relaxed text-hw-text/80">
                        {connectionError.userMessage}
                      </p>
                      {connectionError.retryable && onRetryConnection && (
                        <button
                          onClick={onRetryConnection}
                          className="inline-flex items-center gap-2 rounded-full border border-hw-danger/50 bg-hw-danger/10 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-hw-danger transition-colors hover:bg-hw-danger hover:text-white"
                        >
                          <RefreshCw size={12} />
                          {t('Retry Connection')}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-col gap-4">
                <button
                  onClick={onInitialize}
                  className="group relative flex items-center justify-center gap-4 px-8 py-4 bg-hw-accent text-hw-bg font-black uppercase tracking-widest text-xs rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 w-fit"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {t('Initialize System')} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </button>

                <div className="pt-4 border-t border-white/5 w-full">
                  <button
                    onClick={() => setIsRestoreOpen(!isRestoreOpen)}
                    className="text-[10px] font-mono uppercase tracking-widest text-hw-accent/60 hover:text-hw-accent transition-colors flex items-center gap-2 outline-none"
                  >
                    <Server size={12} />
                    {t('Or restore from a backup token')}
                  </button>

                  <AnimatePresence>
                    {isRestoreOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-3 mt-4"
                      >
                        <div className="space-y-2">
                          <label className="text-[9px] font-mono uppercase tracking-widest text-hw-muted">{t('Paste encrypted configuration token')}</label>
                          <textarea
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="Paste token here..."
                            rows={3}
                            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-[9px] text-hw-text outline-none resize-none focus:border-hw-accent/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-mono uppercase tracking-widest text-hw-muted">{t('Decryption Password')}</label>
                          <div className="relative">
                            <input
                              key={showDecryptionPassword ? 'dp-text' : 'dp-pass'}
                              type={showDecryptionPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder={t('Enter decryption password')}
                              autoComplete="new-password"
                              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 pr-12 font-mono text-[9px] text-hw-text outline-none focus:border-hw-accent/30"
                            />
                            <button
                              type="button"
                              onClick={() => setShowDecryptionPassword(!showDecryptionPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-hw-accent/60 hover:text-hw-accent transition-colors"
                            >
                              {showDecryptionPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={handleRestore}
                          disabled={!token || !password || isRestoring}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-mono uppercase tracking-widest text-[10px] rounded-xl transition-all disabled:opacity-50"
                        >
                          {isRestoring ? <Loader2 size={12} className="animate-spin" /> : <Server size={12} />}
                          {t('Restore Configuration')}
                        </button>

                        {error && (
                          <p className="text-[10px] font-mono text-red-400 mt-2">{error}</p>
                        )}
                        {success && (
                          <p className="text-[10px] font-mono text-hw-accent mt-2">Import success! Reloading...</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative aspect-square">
                <div className="absolute inset-0 border-2 border-hw-accent/20 rounded-full animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-8 border border-white/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-8 bg-hw-accent/10 rounded-full border border-hw-accent/30 shadow-[0_0_50px_rgba(0,255,102,0.1)]">
                    <Settings size={80} className="text-hw-accent animate-[spin_10s_linear_infinite]" />
                  </div>
                </div>

                {/* Floating Tags */}
                <FloatingTag icon={<Zap size={10} />} label={t('Telemetry')} pos="top-0 left-0" delay={0} />
                <FloatingTag icon={<Activity size={10} />} label={t('Biometrics')} pos="bottom-0 right-0" delay={2} />
                <FloatingTag icon={<ShieldCheck size={10} />} label={t('Secure')} pos="top-1/2 -right-8" delay={1} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-[9px] font-mono text-hw-muted uppercase tracking-[0.3em]">
          VeloPulse Core System v1.1.0 // {t('Waiting for Handshake')}
        </p>
      </motion.div>
    </div>
  );
};

const CheckItem = ({ label, icon, isMissing, isError = false }: { label: string; icon: React.ReactNode; isMissing: boolean; isError?: boolean }) => (
  <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isError ? 'bg-hw-danger/10 border-hw-danger/30 opacity-90' : isMissing ? 'bg-white/5 border-white/5 opacity-60' : 'bg-hw-accent/5 border-hw-accent/20'}`}>
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${isError ? 'bg-hw-danger/20 text-hw-danger' : isMissing ? 'bg-white/5 text-hw-muted' : 'bg-hw-accent/10 text-hw-accent'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-widest leading-none">{label}</span>
    </div>
    <div className={`w-1.5 h-1.5 rounded-full ${isError ? 'bg-hw-danger animate-pulse' : isMissing ? 'bg-hw-muted animate-pulse' : 'bg-hw-accent shadow-[0_0_10px_rgba(0,255,102,0.5)]'}`} />
  </div>
);

const FloatingTag = ({ icon, label, pos, delay }: { icon: React.ReactNode; label: string; pos: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.5 + delay, type: "spring" }}
    className={`absolute ${pos} px-3 py-1.5 bg-hw-bg/80 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-2 z-20 shadow-xl`}
  >
    <div className="text-hw-accent">{icon}</div>
    <span className="text-[8px] font-mono uppercase tracking-widest whitespace-nowrap">{label}</span>
  </motion.div>
);
