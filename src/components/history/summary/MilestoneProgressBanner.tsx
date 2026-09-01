import { Trophy, ChevronRight, Award, Target } from 'lucide-react';
import type { WorkoutSession } from '@/store/useWorkoutStore';
import { getUpcomingMilestones } from '@/lib/milestone-records';
import { useI18n } from '@/i18n';

interface MilestoneProgressBannerProps {
  sessions: WorkoutSession[];
}

export const MilestoneProgressBanner = ({ sessions }: MilestoneProgressBannerProps) => {
  const { t } = useI18n();
  const upcoming = getUpcomingMilestones(sessions);

  if (upcoming.length === 0) return null;

  return (
    <div className="hardware-card border-hw-muted/20 p-4 bg-gradient-to-r from-black/40 via-black/20 to-black/40">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-300">
            <Trophy size={14} />
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted flex items-center gap-2">
              {t('Upcoming Milestones')}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/50">
              {t('Targets on your cycling journey')}
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-hw-accent flex items-center gap-1">
          <Award size={12} /> {t('{count} Sessions Total', { count: sessions.length })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {upcoming.map(m => (
          <div
            key={m.type}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex flex-col justify-between relative overflow-hidden"
          >
            {/* Ambient Background Gradient for high progress */}
            {m.progressPercent >= 75 && (
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full blur-xl pointer-events-none" />
            )}

            <div>
              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-hw-muted mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm">{m.icon}</span> {t(m.title)}
                </span>
                <span className="text-white font-bold">{m.progressPercent}%</span>
              </div>

              <div className="mt-2 text-base font-bold font-mono text-white tabular-nums">
                {m.current.toLocaleString()}{' '}
                <span className="text-xs font-normal text-white/40">/ {m.target.toLocaleString()} {m.unit}</span>
              </div>
            </div>

            <div className="mt-3">
              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    m.progressPercent >= 80
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'bg-gradient-to-r from-hw-accent to-cyan-300'
                  }`}
                  style={{ width: `${Math.max(m.progressPercent, 4)}%` }}
                />
              </div>

              <div className="mt-1.5 text-[9px] font-mono text-white/40 flex items-center justify-between">
                <span>{t('{remaining} {unit} remaining', { remaining: m.remaining.toLocaleString(), unit: m.unit })}</span>
                {m.progressPercent >= 90 && (
                  <span className="text-amber-300 font-bold animate-pulse">{t('Almost there!')}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
