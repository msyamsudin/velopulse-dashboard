import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Download, Share2, Copy, Check, Sparkles, X, Heart, Activity, TrendingUp } from 'lucide-react';
import type { WorkoutSession } from '@/store/useWorkoutStore';
import {
  type ShareCardAspect,
  type ShareCardTheme,
  renderShareCardToCanvas,
  downloadShareCardPNG,
  shareViaWebShareApi,
  copyShareCardToClipboard,
} from '@/lib/share-card-canvas';
import { detectSessionAchievements } from '@/lib/milestone-records';
import { useI18n } from '@/i18n';

interface ShareWorkoutCardModalProps {
  session: WorkoutSession;
  allSessions?: WorkoutSession[];
  previousSession?: WorkoutSession;
  maxHr?: number;
  onClose: () => void;
}

export const ShareWorkoutCardModal = ({
  session,
  allSessions = [],
  previousSession,
  maxHr = 190,
  onClose,
}: ShareWorkoutCardModalProps) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [aspect, setAspect] = useState<ShareCardAspect>('square');
  const [theme, setTheme] = useState<ShareCardTheme>('neon');
  const [showHr, setShowHr] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [showComparison, setShowComparison] = useState(true);
  const [customNote, setCustomNote] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Compute achievements
  const achievements = useMemo(() => {
    return detectSessionAchievements(session, allSessions.length > 0 ? allSessions : [session]);
  }, [session, allSessions]);

  // Set default theme to Gold if session is a milestone or Centurion
  useEffect(() => {
    if (achievements.isCenturion || achievements.milestones.length > 0) {
      setTheme('gold');
    }
  }, [achievements]);

  // Re-render canvas whenever options change
  useEffect(() => {
    if (!canvasRef.current) return;
    renderShareCardToCanvas(canvasRef.current, {
      session,
      allSessions,
      previousSession,
      aspect,
      theme,
      milestones: achievements.milestones,
      personalRecords: achievements.personalRecords,
      showHr,
      showChart,
      showComparison,
      customNote,
      maxHr,
    });
  }, [session, allSessions, previousSession, aspect, theme, showHr, showChart, showComparison, customNote, maxHr, achievements]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const filename = `velopulse-workout-${session.id.slice(0, 8)}-${aspect}.png`;
      await downloadShareCardPNG({
        session,
        allSessions,
        previousSession,
        aspect,
        theme,
        milestones: achievements.milestones,
        personalRecords: achievements.personalRecords,
        showHr,
        showChart,
        showComparison,
        customNote,
        maxHr,
      }, filename);
      setNotice(t('Image downloaded successfully!'));
      setTimeout(() => setNotice(null), 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const shared = await shareViaWebShareApi({
        session,
        allSessions,
        previousSession,
        aspect,
        theme,
        milestones: achievements.milestones,
        personalRecords: achievements.personalRecords,
        showHr,
        showChart,
        showComparison,
        customNote,
        maxHr,
      });

      if (!shared) {
        // Fallback: Copy to clipboard
        const copied = await copyShareCardToClipboard({
          session,
          allSessions,
          previousSession,
          aspect,
          theme,
          milestones: achievements.milestones,
          personalRecords: achievements.personalRecords,
          showHr,
          showChart,
          showComparison,
          customNote,
          maxHr,
        });

        if (copied) {
          setIsCopied(true);
          setNotice(t('Image copied to clipboard! Ready to paste in chat or social media.'));
          setTimeout(() => {
            setIsCopied(false);
            setNotice(null);
          }, 3500);
        } else {
          setNotice(t('Share not supported on this browser. Use Download instead.'));
          setTimeout(() => setNotice(null), 3500);
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    const success = await copyShareCardToClipboard({
      session,
      allSessions,
      previousSession,
      aspect,
      theme,
      milestones: achievements.milestones,
      personalRecords: achievements.personalRecords,
      showHr,
      showChart,
      showComparison,
      customNote,
      maxHr,
    });

    if (success) {
      setIsCopied(true);
      setNotice(t('Image copied to clipboard!'));
      setTimeout(() => {
        setIsCopied(false);
        setNotice(null);
      }, 3000);
    } else {
      setNotice(t('Clipboard copy not supported. Please use Download PNG.'));
      setTimeout(() => setNotice(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-5xl max-h-[90vh] bg-hw-bg border border-white/10 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Left Side: Live Canvas Preview */}
        <div className="flex-1 bg-black/40 p-6 flex flex-col items-center justify-center overflow-auto min-h-[360px] md:min-h-[500px]">
          <div className={`relative flex items-center justify-center transition-all duration-300 ${aspect === 'story' ? 'max-h-[560px] aspect-[9/16]' : 'max-h-[460px] aspect-square'}`}>
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain rounded-xl shadow-2xl border border-white/10"
            />
          </div>

          <div className="mt-3 text-[10px] font-mono text-hw-muted uppercase tracking-widest text-center">
            {aspect === 'square' ? '1080 x 1080 px (Square Post)' : '1080 x 1920 px (Story / Reel)'}
          </div>
        </div>

        {/* Right Side: Controls & Export */}
        <div className="w-full md:w-96 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 bg-hw-bg/95 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-hw-accent">
                <Sparkles size={14} />
                {t('Social Media Card')}
              </div>
              <h3 className="text-lg font-bold uppercase tracking-tight text-white mt-1">
                {t('Share Workout')}
              </h3>
              <p className="text-xs text-white/50 mt-1">
                {t('Generate and share high-resolution visual infographics of your workout achievements.')}
              </p>
            </div>

            {/* Achievements Callout (if any) */}
            {achievements.hasAchievements && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <div className="text-[10px] font-mono uppercase tracking-widest font-bold flex items-center gap-1.5">
                  🏆 {t('Achievements In This Workout')}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[...achievements.milestones, ...achievements.personalRecords].map(b => (
                    <span key={b.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-amber-500/20 text-white">
                      {b.icon} {b.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Format Selection */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-hw-muted block mb-2">
                {t('Aspect Ratio')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAspect('square')}
                  className={`px-3 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all ${aspect === 'square' ? 'border-hw-accent bg-hw-accent/15 text-white font-bold' : 'border-white/10 text-white/60 hover:border-white/20'}`}
                >
                  📐 1:1 Square
                </button>
                <button
                  onClick={() => setAspect('story')}
                  className={`px-3 py-2 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all ${aspect === 'story' ? 'border-hw-accent bg-hw-accent/15 text-white font-bold' : 'border-white/10 text-white/60 hover:border-white/20'}`}
                >
                  📱 9:16 Story
                </button>
              </div>
            </div>

            {/* Theme Selection */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-hw-muted block mb-2">
                {t('Visual Theme')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme('neon')}
                  className={`px-2 py-2 rounded-lg border text-[11px] font-mono uppercase tracking-wider text-center transition-all ${theme === 'neon' ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 font-bold' : 'border-white/10 text-white/60 hover:border-white/20'}`}
                >
                  ⚡ Cyber
                </button>
                <button
                  onClick={() => setTheme('gold')}
                  className={`px-2 py-2 rounded-lg border text-[11px] font-mono uppercase tracking-wider text-center transition-all ${theme === 'gold' ? 'border-amber-400 bg-amber-400/20 text-amber-300 font-bold' : 'border-white/10 text-white/60 hover:border-white/20'}`}
                >
                  🏆 Gold
                </button>
                <button
                  onClick={() => setTheme('stealth')}
                  className={`px-2 py-2 rounded-lg border text-[11px] font-mono uppercase tracking-wider text-center transition-all ${theme === 'stealth' ? 'border-white bg-white/20 text-white font-bold' : 'border-white/10 text-white/60 hover:border-white/20'}`}
                >
                  🖤 Stealth
                </button>
              </div>
            </div>

            {/* Toggles */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-hw-muted block mb-2">
                {t('Card Elements')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-mono text-white/80 cursor-pointer p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10">
                  <span className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-400" /> {t('Compare vs Ride Average')}
                  </span>
                  <input
                    type="checkbox"
                    checked={showComparison}
                    onChange={e => setShowComparison(e.target.checked)}
                    className="accent-hw-accent"
                  />
                </label>

                <label className="flex items-center justify-between text-xs font-mono text-white/80 cursor-pointer p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10">
                  <span className="flex items-center gap-2">
                    <Activity size={14} className="text-hw-accent" /> {t('Power & Effort Waveform')}
                  </span>
                  <input
                    type="checkbox"
                    checked={showChart}
                    onChange={e => setShowChart(e.target.checked)}
                    className="accent-hw-accent"
                  />
                </label>

                <label className="flex items-center justify-between text-xs font-mono text-white/80 cursor-pointer p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10">
                  <span className="flex items-center gap-2">
                    <Heart size={14} className="text-red-400" /> {t('Heart Rate Metrics')}
                  </span>
                  <input
                    type="checkbox"
                    checked={showHr}
                    onChange={e => setShowHr(e.target.checked)}
                    className="accent-hw-accent"
                  />
                </label>
              </div>
            </div>

            {/* Custom Quote / Note */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-hw-muted block mb-1">
                {t('Caption / Rider Note (Optional)')}
              </label>
              <input
                type="text"
                maxLength={60}
                placeholder={t('e.g. Smashed the evening intervals!')}
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs font-mono text-white placeholder:text-white/25 focus:border-hw-accent outline-none"
              />
            </div>
          </div>

          {/* Action Buttons & Notice */}
          <div className="mt-6 pt-4 border-t border-white/10 space-y-2.5">
            {notice && (
              <div className="p-2 rounded-lg bg-hw-accent/15 border border-hw-accent/30 text-hw-accent text-xs font-mono text-center animate-fade-in">
                {notice}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-hw-accent text-black font-mono font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-lg"
              >
                <Download size={14} />
                {isDownloading ? t('Saving...') : t('Download PNG')}
              </button>

              <button
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 text-white font-mono font-bold text-xs uppercase tracking-wider hover:bg-white/15 transition-all"
              >
                <Share2 size={14} />
                {isSharing ? t('Sharing...') : t('Share / Post')}
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors"
            >
              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {isCopied ? t('Copied to Clipboard!') : t('Copy Image to Clipboard')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
