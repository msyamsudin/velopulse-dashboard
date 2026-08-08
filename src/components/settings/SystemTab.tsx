import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Lock, Target, Loader2, AlertCircle, Server, Copy, Eye, EyeOff } from 'lucide-react';
import { AppConfig } from '@/lib/config-helper';
import { useI18n } from '@/i18n';

interface SystemTabProps {
  sysConfig: Partial<AppConfig>;
  setSysConfig: (config: Partial<AppConfig>) => void;
  onSave: () => void;
  saveStatus: string;
  onValidateSupabase: () => void;
  supabaseValidating: boolean;
  supabaseValidStatus: { valid: boolean; msg: string } | null;
  password?: string;
  onExport: (encryptionPassword: string) => Promise<string>;
  onImport: (token: string, decryptionPassword: string) => Promise<boolean>;
}

export const SystemTab = ({
  sysConfig,
  setSysConfig,
  onSave,
  saveStatus,
  onValidateSupabase,
  supabaseValidating,
  supabaseValidStatus,
  onExport,
  onImport
}: SystemTabProps) => {
  const { t } = useI18n();

  // Password visibility states
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [localMasterPassword, setLocalMasterPassword] = useState('');

  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportedToken, setExportedToken] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [exportError, setExportError] = useState('');

  // Import state
  const [importToken, setImportToken] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');

  const handleExportClick = async () => {
    setIsExporting(true);
    setExportError('');
    setExportedToken('');
    setIsCopied(false);
    try {
      const token = await onExport(exportPassword);
      setExportedToken(token);
    } catch (err: any) {
      setExportError(err?.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToken = () => {
    if (!exportedToken) return;
    navigator.clipboard.writeText(exportedToken);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleImportClick = async () => {
    setIsImporting(true);
    setImportError('');
    setImportSuccess(false);
    try {
      const success = await onImport(importToken, importPassword);
      if (success) {
        setImportSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setImportError(err?.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

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
          <div className="grid grid-cols-1 gap-4 border-b border-vp-border pb-4 sm:grid-cols-2">
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
              className="vp-button vp-focus-ring"
              disabled={supabaseValidating}
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

          {/* Change Master Password */}
          <div className="space-y-2 border-t border-vp-border pt-4">
            <label className="vp-label flex items-center gap-2">
              <Lock size={12} className="text-vp-accent" /> {t('Change Master Password')}
            </label>
            <div className="relative">
              <input 
                key={showMasterPassword ? 'mp-text' : 'mp-pass'}
                type={showMasterPassword ? "text" : "password"} 
                value={localMasterPassword}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalMasterPassword(val);
                  setSysConfig({...sysConfig, MASTER_PASSWORD: val || '●●●●●●●●●'});
                }}
                placeholder={t('Enter new master password')}
                autoComplete="new-password"
                className="vp-focus-ring w-full rounded-lg border border-vp-border bg-white/[0.035] p-3 pr-10 font-mono text-[10px] text-vp-text outline-none transition-colors focus:border-vp-accent/50"
              />
              <button
                type="button"
                onClick={() => setShowMasterPassword(!showMasterPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-vp-muted hover:text-vp-text transition-colors"
              >
                {showMasterPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <p className="text-[8px] text-vp-muted uppercase font-mono leading-tight">
              {t('Used to unlock settings and protect configuration backups. Default is "admin".')}
            </p>
          </div>

          {/* Backup & Restore */}
          <div className="col-span-full space-y-4 border-t border-vp-border pt-4">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-vp-accent flex items-center gap-2 font-bold">
              <Server size={12} /> {t('Backup & Restore')}
            </h4>
            <p className="text-[9px] text-vp-muted uppercase font-mono leading-normal">
              {t('Export/Import configuration settings as an encrypted token to set up other devices quickly.')}
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Export */}
              <div className="space-y-3 rounded-lg border border-vp-border bg-white/[0.01] p-4 flex flex-col justify-between">
                <div>
                  <h5 className="text-[10px] font-mono uppercase tracking-wider text-vp-text/80 font-bold mb-3">{t('Export Configuration')}</h5>
                  <div className="space-y-2 mb-3">
                    <label className="vp-label text-[9px]">{t('Encryption Password')}</label>
                    <div className="relative">
                      <input 
                        key={showExportPassword ? 'ep-text' : 'ep-pass'}
                        type={showExportPassword ? "text" : "password"}
                        value={exportPassword}
                        onChange={(e) => setExportPassword(e.target.value)}
                        placeholder={t('Enter encryption password')}
                        autoComplete="new-password"
                        className="w-full rounded border border-vp-border bg-white/[0.02] p-2 pr-8 font-mono text-[9px] text-vp-text outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowExportPassword(!showExportPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vp-muted hover:text-vp-text transition-colors"
                      >
                        {showExportPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={handleExportClick}
                    disabled={!exportPassword || isExporting}
                    className="rounded bg-vp-accent/20 px-3 py-1.5 text-[10px] font-mono text-vp-accent transition-colors hover:bg-vp-accent/30 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isExporting ? <Loader2 size={10} className="animate-spin" /> : <Server size={10} />}
                    {t('Export')}
                  </button>
                </div>
                {exportedToken && (
                  <div className="space-y-2 pt-3 border-t border-vp-border/40 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono text-vp-muted uppercase">{t('Configuration backup token')}</span>
                      <button 
                        onClick={handleCopyToken}
                        className="rounded bg-vp-accent/10 px-2 py-0.5 text-[8px] font-mono text-vp-accent hover:bg-vp-accent/20 flex items-center gap-1"
                      >
                        <Copy size={8} />
                        {isCopied ? t('Token Copied!') : t('Copy Token')}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={exportedToken}
                      rows={3}
                      className="w-full rounded border border-vp-border bg-vp-bg p-2 font-mono text-[8px] text-vp-text/60 outline-none resize-none select-all"
                    />
                  </div>
                )}
                {exportError && (
                  <p className="text-[9px] text-vp-danger font-mono mt-2">{exportError}</p>
                )}
              </div>

              {/* Import */}
              <div className="space-y-3 rounded-lg border border-vp-border bg-white/[0.01] p-4">
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-vp-text/80 font-bold mb-3">{t('Import Configuration')}</h5>
                <div className="space-y-2">
                  <label className="vp-label text-[9px]">{t('Paste encrypted configuration token')}</label>
                  <textarea 
                    value={importToken}
                    onChange={(e) => setImportToken(e.target.value)}
                    placeholder="Paste token here..."
                    rows={2}
                    className="w-full rounded border border-vp-border bg-white/[0.02] p-2 font-mono text-[9px] text-vp-text outline-none resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="vp-label text-[9px]">{t('Decryption Password')}</label>
                  <div className="relative">
                    <input 
                      key={showImportPassword ? 'ip-text' : 'ip-pass'}
                      type={showImportPassword ? "text" : "password"}
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      placeholder={t('Enter decryption password')}
                      autoComplete="new-password"
                      className="w-full rounded border border-vp-border bg-white/[0.02] p-2 pr-8 font-mono text-[9px] text-vp-text outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImportPassword(!showImportPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vp-muted hover:text-vp-text transition-colors"
                    >
                      {showImportPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                </div>
                <button 
                  onClick={handleImportClick}
                  disabled={!importToken || !importPassword || isImporting}
                  className="rounded bg-vp-accent px-3 py-1.5 text-[10px] font-mono text-vp-bg font-bold transition-colors hover:bg-vp-accent/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImporting ? <Loader2 size={10} className="animate-spin" /> : <Server size={10} />}
                  {t('Import')}
                </button>
                {importError && (
                  <p className="text-[9px] text-vp-danger font-mono mt-2">{importError}</p>
                )}
                {importSuccess && (
                  <p className="text-[9px] text-vp-accent font-mono mt-2">Import success! Reloading...</p>
                )}
              </div>
            </div>
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

