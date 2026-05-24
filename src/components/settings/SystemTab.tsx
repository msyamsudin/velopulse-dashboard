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
        <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
              <Globe size={12} /> App URL
            </label>
            <input 
              type="text" 
              value={sysConfig.APP_URL || ''}
              onChange={(e) => setSysConfig({...sysConfig, APP_URL: e.target.value})}
              placeholder="http://localhost:3000"
              className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono text-xs focus:border-hw-accent/50 outline-none transition-colors"
            />
          </div>

          <div className="p-3 bg-hw-accent/5 border border-hw-accent/20 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-mono text-hw-accent uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={10} /> Authorized Redirect URI
              </label>
              <button 
                onClick={() => {
                  const uri = `${sysConfig.APP_URL || 'http://localhost:3000'}/api/auth/callback`;
                  navigator.clipboard.writeText(uri);
                }}
                className="text-[9px] font-mono bg-hw-accent/10 hover:bg-hw-accent/20 text-hw-accent px-2 py-1 rounded transition-colors"
              >
                COPY URI
              </button>
            </div>
            <code className="block text-[10px] text-white/70 font-mono break-all bg-black/20 p-2 rounded border border-white/5">
              {`${sysConfig.APP_URL || 'http://localhost:3000'}/api/auth/callback`}
            </code>
            <p className="text-[8px] text-hw-muted uppercase font-mono leading-tight">
              Pastikan URI ini terdaftar di Google Cloud Console {'>'} Credentials {'>'} Authorized redirect URIs.
            </p>
          </div>
        
          <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
                <Key size={12} /> Google Client ID
              </label>
              <input 
                type="text" 
                value={sysConfig.GOOGLE_CLIENT_ID || ''}
                onChange={(e) => setSysConfig({...sysConfig, GOOGLE_CLIENT_ID: e.target.value})}
                className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono text-[10px] focus:border-hw-accent/50 outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
                <Lock size={12} /> Google Client Secret
              </label>
              <input 
                type="password" 
                value={sysConfig.GOOGLE_CLIENT_SECRET || ''}
                onChange={(e) => setSysConfig({...sysConfig, GOOGLE_CLIENT_SECRET: e.target.value})}
                className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono text-[10px] focus:border-hw-accent/50 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onValidateGoogle}
              disabled={googleValidating}
              className="py-2 px-4 bg-white/5 hover:bg-white/10 text-hw-muted hover:text-white rounded-lg flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {googleValidating ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
              Validasi Google
            </button>
            {googleValidStatus && (
              <span className={`text-[10px] font-mono flex items-center gap-1 ${googleValidStatus.valid ? 'text-green-400' : 'text-red-400'}`}>
                {googleValidStatus.valid ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {googleValidStatus.msg}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
                <Server size={12} /> Supabase URL
              </label>
              <input 
                type="text" 
                value={sysConfig.NEXT_PUBLIC_SUPABASE_URL || ''}
                onChange={(e) => setSysConfig({...sysConfig, NEXT_PUBLIC_SUPABASE_URL: e.target.value})}
                className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono text-[10px] focus:border-hw-accent/50 outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-hw-muted uppercase tracking-widest flex items-center gap-2">
                <Lock size={12} /> Supabase Anon Key
              </label>
              <input 
                type="password" 
                value={sysConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}
                onChange={(e) => setSysConfig({...sysConfig, NEXT_PUBLIC_SUPABASE_ANON_KEY: e.target.value})}
                className="w-full bg-hw-muted/5 border border-hw-muted/20 rounded-lg p-3 text-white font-mono text-[10px] focus:border-hw-accent/50 outline-none transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onValidateSupabase}
              disabled={supabaseValidating}
              className="py-2 px-4 bg-white/5 hover:bg-white/10 text-hw-muted hover:text-white rounded-lg flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {supabaseValidating ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
              Validasi Supabase
            </button>
            {supabaseValidStatus && (
              <span className={`text-[10px] font-mono flex items-center gap-1 ${supabaseValidStatus.valid ? 'text-green-400' : 'text-red-400'}`}>
                {supabaseValidStatus.valid ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {supabaseValidStatus.msg}
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className="w-full py-4 bg-hw-accent text-hw-bg font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all mt-4"
        >
          {saveStatus === 'saving' ? 'SAVING...' : saveStatus === 'success' ? 'SYSTEM UPDATED!' : 'APPLY CONFIGURATION'}
        </button>
      </div>
    </motion.div>
  );
};
