import { motion } from 'motion/react';
import { Globe, CheckCircle, Key, Lock, Target, Loader2, AlertCircle, Server } from 'lucide-react';
import { AppConfig } from '@/lib/config-helper';

interface SystemTabProps {
  sysConfig: Partial<AppConfig>;
  setSysConfig: (config: Partial<AppConfig>) => void;
  onSave: () => void;
  saveStatus: string;
  onValidateGoogle: () => void;
  googleValidating: boolean;
  googleValidStatus: { valid: boolean; msg: string } | null;
  onValidateSupabase: () => void;
  supabaseValidating: boolean;
  supabaseValidStatus: { valid: boolean; msg: string } | null;
  password?: string;
}

export const SystemTab = ({
  sysConfig,
  setSysConfig,
  onSave,
  saveStatus,
  onValidateGoogle,
  googleValidating,
  googleValidStatus,
  onValidateSupabase,
  supabaseValidating,
  supabaseValidStatus
}: SystemTabProps) => {
  return (
    <motion.div 
      key="system"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-6"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="vp-label flex items-center gap-2">
              <Globe size={12} className="text-vp-info" /> App URL
            </label>
            <input 
              type="text" 
              value={sysConfig.APP_URL || ''}
              onChange={(e) => setSysConfig({...sysConfig, APP_URL: e.target.value})}
              placeholder="http://localhost:3000"
              className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 font-mono text-xs text-vp-text outline-none transition-colors placeholder:text-vp-dim focus:border-vp-accent/50"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-vp-accent/20 bg-vp-accent/5 p-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-vp-accent">
                <CheckCircle size={10} /> Authorized Redirect URI
              </label>
              <button 
                onClick={() => {
                  const uri = `${sysConfig.APP_URL || 'http://localhost:3000'}/api/auth/callback`;
                  navigator.clipboard.writeText(uri);
                }}
                className="rounded bg-vp-accent/10 px-2 py-1 text-[9px] font-mono text-vp-accent transition-colors hover:bg-vp-accent/20"
              >
                COPY URI
              </button>
            </div>
            <code className="block break-all rounded border border-vp-border bg-vp-bg/50 p-2 font-mono text-[10px] text-vp-text/70">
              {`${sysConfig.APP_URL || 'http://localhost:3000'}/api/auth/callback`}
            </code>
            <p className="text-[8px] text-vp-muted uppercase font-mono leading-tight">
              Pastikan URI ini terdaftar di Google Cloud Console {'>'} Credentials {'>'} Authorized redirect URIs.
            </p>
          </div>
        
          <div className="grid grid-cols-1 gap-4 border-t border-vp-border pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="vp-label flex items-center gap-2">
                <Key size={12} className="text-vp-warning" /> Google Client ID
              </label>
              <input 
                type="text" 
                value={sysConfig.GOOGLE_CLIENT_ID || ''}
                onChange={(e) => setSysConfig({...sysConfig, GOOGLE_CLIENT_ID: e.target.value})}
                className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 font-mono text-[10px] text-vp-text outline-none transition-colors focus:border-vp-accent/50"
              />
            </div>
            <div className="space-y-2">
              <label className="vp-label flex items-center gap-2">
                <Lock size={12} className="text-vp-warning" /> Google Client Secret
              </label>
              <input 
                type="password" 
                value={sysConfig.GOOGLE_CLIENT_SECRET || ''}
                onChange={(e) => setSysConfig({...sysConfig, GOOGLE_CLIENT_SECRET: e.target.value})}
                className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 font-mono text-[10px] text-vp-text outline-none transition-colors focus:border-vp-accent/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onValidateGoogle}
              disabled={googleValidating}
              className="vp-button vp-focus-ring"
            >
              {googleValidating ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
              Validasi Google
            </button>
            {googleValidStatus && (
              <span className={`text-[10px] font-mono flex items-center gap-1 ${googleValidStatus.valid ? 'text-vp-accent' : 'text-vp-danger'}`}>
                {googleValidStatus.valid ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {googleValidStatus.msg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-vp-border pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="vp-label flex items-center gap-2">
                <Server size={12} className="text-vp-info" /> Supabase URL
              </label>
              <input 
                type="text" 
                value={sysConfig.NEXT_PUBLIC_SUPABASE_URL || ''}
                onChange={(e) => setSysConfig({...sysConfig, NEXT_PUBLIC_SUPABASE_URL: e.target.value})}
                className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 font-mono text-[10px] text-vp-text outline-none transition-colors focus:border-vp-accent/50"
              />
            </div>
            <div className="space-y-2">
              <label className="vp-label flex items-center gap-2">
                <Lock size={12} className="text-vp-info" /> Supabase Anon Key
              </label>
              <input 
                type="password" 
                value={sysConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}
                onChange={(e) => setSysConfig({...sysConfig, NEXT_PUBLIC_SUPABASE_ANON_KEY: e.target.value})}
                className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 font-mono text-[10px] text-vp-text outline-none transition-colors focus:border-vp-accent/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onValidateSupabase}
              disabled={supabaseValidating}
              className="vp-button vp-focus-ring"
            >
              {supabaseValidating ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
              Validasi Supabase
            </button>
            {supabaseValidStatus && (
              <span className={`text-[10px] font-mono flex items-center gap-1 ${supabaseValidStatus.valid ? 'text-vp-accent' : 'text-vp-danger'}`}>
                {supabaseValidStatus.valid ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {supabaseValidStatus.msg}
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className="vp-focus-ring mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-vp-accent px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-vp-bg transition-colors hover:bg-vp-accent/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {saveStatus === 'saving' ? 'SAVING...' : saveStatus === 'success' ? 'SYSTEM UPDATED!' : 'APPLY CONFIGURATION'}
        </button>
      </div>
    </motion.div>
  );
};
