'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useI18n } from '@/i18n';

interface AuthScreenProps {
  onContinueLocal: () => void;
}

export const AuthScreen = ({ onContinueLocal }: AuthScreenProps) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loading = useAuthStore(state => state.loading);
  const error = useAuthStore(state => state.error);
  const notice = useAuthStore(state => state.notice);
  const signIn = useAuthStore(state => state.signIn);
  const signUp = useAuthStore(state => state.signUp);
  const clearError = useAuthStore(state => state.clearError);

  const switchMode = (next: 'signin' | 'signup') => {
    clearError();
    setMode(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password || loading) return;
    clearError();
    if (mode === 'signin') {
      await signIn(email.trim(), password);
    } else {
      await signUp(email.trim(), password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-hw-bg overflow-hidden relative">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="hardware-card border-hw-accent/20 bg-hw-bg/40 backdrop-blur-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-hw-accent/60" />

          <div className="mb-6 flex items-center gap-3 text-hw-accent">
            <Activity size={20} className="animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.35em] font-bold">VELOPULSE</span>
          </div>

          <h1 className="text-3xl font-black tracking-tighter leading-tight">
            {mode === 'signin' ? t('Sign in') : t('Create account')}
          </h1>
          <p className="mt-2 text-xs text-hw-muted leading-relaxed">
            {t('Sign in to sync your workouts')}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase tracking-widest text-hw-muted">
                {t('Email')}
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-hw-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('Enter your email')}
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-hw-text outline-none transition-colors placeholder:text-hw-muted/60 focus:border-hw-accent/40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase tracking-widest text-hw-muted">
                {t('Password')}
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-hw-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('Enter your password')}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-12 text-sm text-hw-text outline-none transition-colors placeholder:text-hw-muted/60 focus:border-hw-accent/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('Hide password') : t('Show password')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-hw-muted transition-colors hover:text-hw-text"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-hw-danger/40 bg-hw-danger/10 px-3.5 py-3">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-hw-danger" />
                <p className="text-[11px] leading-relaxed text-hw-text/85">{error}</p>
              </div>
            )}

            {notice && (
              <div className="flex items-start gap-2.5 rounded-xl border border-hw-accent/30 bg-hw-accent/10 px-3.5 py-3">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-hw-accent" />
                <p className="text-[11px] leading-relaxed text-hw-text/85">{notice}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-hw-accent px-6 py-3.5 text-xs font-black uppercase tracking-widest text-hw-bg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              )}
              {loading
                ? (mode === 'signin' ? t('Signing in...') : t('Creating account...'))
                : (mode === 'signin' ? t('Sign in') : t('Create account'))}
            </button>
          </form>

          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="mt-4 w-full text-center text-[10px] font-mono uppercase tracking-widest text-hw-accent/70 transition-colors hover:text-hw-accent"
          >
            {mode === 'signin' ? t('No account? Create one') : t('Already have an account? Sign in')}
          </button>
        </div>

        <button
          type="button"
          onClick={onContinueLocal}
          className="mt-5 block w-full text-center text-[10px] font-mono uppercase tracking-widest text-hw-muted/60 transition-colors hover:text-hw-muted"
        >
          {t('Continue without account')}
        </button>
      </motion.div>
    </div>
  );
};
