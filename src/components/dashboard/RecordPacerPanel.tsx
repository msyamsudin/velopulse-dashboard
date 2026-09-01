import { useMemo, useState } from 'react';
import { Trophy, Target, TrendingUp, Zap, Route, Timer, Activity, X, ChevronDown, ChevronUp, Sparkles, CheckCircle2 } from 'lucide-react';
import type { TelemetrySnapshot, WorkoutView } from '@/lib/cockpit-types';
import type { LiveWorkoutStats, WorkoutSession } from '@/store/useWorkoutStore';
import { getPersonalRecords, getSessionOutcome } from '@/lib/workout-analysis';
import { formatDuration } from '@/utils/formatters';
import { useI18n } from '@/i18n';

export type TargetCategory = 'avg_power' | 'distance' | 'speed' | 'duration' | 'prev_workout';

interface RecordPacerPanelProps {
  currentData: TelemetrySnapshot;
  liveStats: LiveWorkoutStats;
  workout: WorkoutView;
  sessions: WorkoutSession[];
  onClose: () => void;
}

export const RecordPacerPanel = ({
  currentData,
  liveStats,
  workout,
  sessions,
  onClose,
}: RecordPacerPanelProps) => {
  const { t } = useI18n();
  const [selectedTarget, setSelectedTarget] = useState<TargetCategory>('avg_power');
  const [isMinimized, setIsMinimized] = useState(false);

  // Compute all-time personal records
  const personalRecords = useMemo(() => getPersonalRecords(sessions), [sessions]);

  // Compute last session outcome
  const lastSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const sorted = [...sessions].sort((a, b) => {
      const tA = a.sessionStartTime || new Date(a.date).getTime() || 0;
      const tB = b.sessionStartTime || new Date(b.date).getTime() || 0;
      return tA - tB;
    });
    return sorted[sorted.length - 1];
  }, [sessions]);

  const lastOutcome = useMemo(() => (lastSession ? getSessionOutcome(lastSession) : null), [lastSession]);

  // Extract PR targets
  const prAvgPower = useMemo(() => {
    const pr = personalRecords.find(r => r.title === 'Best Avg Power');
    return pr ? Number(pr.value) : 0;
  }, [personalRecords]);

  const prDistance = useMemo(() => {
    const pr = personalRecords.find(r => r.title === 'Best Distance');
    return pr ? Number(pr.value) : 0;
  }, [personalRecords]);

  const prSpeed = useMemo(() => {
    const pr = personalRecords.find(r => r.title === 'Fastest Avg Speed');
    return pr ? Number(pr.value) : 0;
  }, [personalRecords]);

  const prDurationSec = useMemo(() => {
    const pr = personalRecords.find(r => r.title === 'Longest Ride');
    return pr ? Number(pr.value) * 60 : 0;
  }, [personalRecords]);

  // Current session metrics
  const currentDistanceKm = Number((currentData.distance / 1000).toFixed(2));
  const currentAvgPower = Math.round(liveStats.avgPower || 0);
  const currentAvgSpeed = Number((liveStats.avgSpeed || 0).toFixed(1));
  const currentDurationSec = workout.elapsed;

  // Active target calculations
  const targetInfo = useMemo(() => {
    switch (selectedTarget) {
      case 'avg_power': {
        const target = prAvgPower > 0 ? prAvgPower : 150;
        const current = currentAvgPower;
        const delta = current - target;
        const isOnTrack = delta >= 0;
        const progressPercent = Math.min(Math.round((current / target) * 100), 150);
        return {
          title: t('Target: Best Avg Power PR'),
          targetLabel: `${target} W`,
          currentLabel: `${current} W`,
          deltaLabel: `${delta > 0 ? '+' : ''}${delta} W`,
          isOnTrack,
          isBeaten: delta > 0 && currentDurationSec >= 600,
          progressPercent,
          unit: 'W',
          guidance: isOnTrack
            ? t('You are currently averaging above your PR pace! Keep holding this power.')
            : t('Average power is {gap} W below PR. Increase steady effort to close the gap.', { gap: Math.abs(delta) }),
          icon: <Zap size={14} className="text-yellow-400" />,
        };
      }
      case 'distance': {
        const target = prDistance > 0 ? prDistance : 20.0;
        const current = currentDistanceKm;
        const remaining = Math.max(0, Number((target - current).toFixed(2)));
        const isBeaten = current > target;
        const progressPercent = Math.min(Math.round((current / target) * 100), 100);
        return {
          title: t('Target: Longest Distance PR'),
          targetLabel: `${target.toFixed(2)} km`,
          currentLabel: `${current.toFixed(2)} km`,
          deltaLabel: isBeaten ? `+${(current - target).toFixed(2)} km` : `${remaining.toFixed(2)} km left`,
          isOnTrack: isBeaten || progressPercent >= 50,
          isBeaten,
          progressPercent,
          unit: 'km',
          guidance: isBeaten
            ? t('New Distance Record achieved in this workout! Every extra km extends your PR.')
            : t('{remaining} km remaining to break your all-time distance record.', { remaining: remaining.toFixed(2) }),
          icon: <Route size={14} className="text-cyan-400" />,
        };
      }
      case 'speed': {
        const target = prSpeed > 0 ? prSpeed : 25.0;
        const current = currentAvgSpeed;
        const delta = Number((current - target).toFixed(1));
        const isOnTrack = delta >= 0;
        const progressPercent = Math.min(Math.round((current / target) * 100), 150);
        return {
          title: t('Target: Fastest Pace PR'),
          targetLabel: `${target.toFixed(1)} km/h`,
          currentLabel: `${current.toFixed(1)} km/h`,
          deltaLabel: `${delta > 0 ? '+' : ''}${delta.toFixed(1)} km/h`,
          isOnTrack,
          isBeaten: delta > 0 && currentDistanceKm >= 5,
          progressPercent,
          unit: 'km/h',
          guidance: isOnTrack
            ? t('Cruising above your record pace! Maintain smooth cadence and gear.')
            : t('Current average pace is {gap} km/h behind record speed.', { gap: Math.abs(delta).toFixed(1) }),
          icon: <Activity size={14} className="text-blue-400" />,
        };
      }
      case 'duration': {
        const target = prDurationSec > 0 ? prDurationSec : 3600;
        const current = currentDurationSec;
        const remaining = Math.max(0, target - current);
        const isBeaten = current > target;
        const progressPercent = Math.min(Math.round((current / target) * 100), 100);
        return {
          title: t('Target: Longest Ride PR'),
          targetLabel: formatDuration(target),
          currentLabel: formatDuration(current),
          deltaLabel: isBeaten ? `+${formatDuration(current - target)}` : `${formatDuration(remaining)} left`,
          isOnTrack: isBeaten || progressPercent >= 50,
          isBeaten,
          progressPercent,
          unit: 'min',
          guidance: isBeaten
            ? t('Endurance record surpassed! You are now setting a new duration high.')
            : t('{time} more in the saddle to break your longest endurance record.', { time: formatDuration(remaining) }),
          icon: <Timer size={14} className="text-amber-400" />,
        };
      }
      case 'prev_workout': {
        const targetPower = lastSession?.stats?.avgPower || 150;
        const current = currentAvgPower;
        const delta = current - targetPower;
        const isOnTrack = delta >= 0;
        const progressPercent = Math.min(Math.round((current / targetPower) * 100), 150);
        return {
          title: t('Target: Beat Last Workout Avg Power'),
          targetLabel: `${targetPower} W`,
          currentLabel: `${current} W`,
          deltaLabel: `${delta > 0 ? '+' : ''}${delta} W`,
          isOnTrack,
          isBeaten: delta > 0 && currentDurationSec >= 300,
          progressPercent,
          unit: 'W',
          guidance: isOnTrack
            ? t('Holding higher power (+{delta}W) than your previous workout! Great progression.', { delta })
            : t('Power is {gap}W below last session. Push a gear up to exceed previous ride.', { gap: Math.abs(delta) }),
          icon: <TrendingUp size={14} className="text-emerald-400" />,
        };
      }
    }
  }, [
    selectedTarget,
    prAvgPower,
    prDistance,
    prSpeed,
    prDurationSec,
    lastSession,
    currentAvgPower,
    currentDistanceKm,
    currentAvgSpeed,
    currentDurationSec,
    t,
  ]);

  if (isMinimized) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-black/80 p-2.5 backdrop-blur-md flex items-center justify-between shadow-lg animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300">
            <Trophy size={14} />
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-white font-bold">{targetInfo.title}</span>
            <span className="text-white/40">|</span>
            <span className="text-vp-muted">Live: <strong className="text-white">{targetInfo.currentLabel}</strong></span>
            <span className="text-white/40">/</span>
            <span className="text-vp-muted">Target: <strong className="text-amber-300">{targetInfo.targetLabel}</strong></span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${targetInfo.isOnTrack ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
              {targetInfo.deltaLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title={t('Expand PR Target Pacer')}
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-red-500/20 text-white/50 hover:text-red-300 transition-colors"
            title={t('Close PR Target Pacer')}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/35 bg-gradient-to-r from-amber-500/10 via-black/80 to-amber-500/5 p-4 shadow-xl backdrop-blur-lg animate-fade-in relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center">
            <Trophy size={16} />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles size={13} />
              {t('PR Target Pacer')}
            </div>
            <div className="text-[11px] font-mono text-white/50">
              {t('Live average pacer toward setting a new personal record')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title={t('Minimize to slim bar')}
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-red-400 hover:border-red-500/30 transition-colors"
            title={t('Close target pacer (Return to normal ride)')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Target Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3.5">
        <button
          type="button"
          onClick={() => setSelectedTarget('avg_power')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider font-bold transition-all ${
            selectedTarget === 'avg_power'
              ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 shadow-sm'
              : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20'
          }`}
        >
          <Zap size={12} />
          <span>{t('Avg Power')}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTarget('distance')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider font-bold transition-all ${
            selectedTarget === 'distance'
              ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-sm'
              : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20'
          }`}
        >
          <Route size={12} />
          <span>{t('Distance')}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTarget('speed')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider font-bold transition-all ${
            selectedTarget === 'speed'
              ? 'border-blue-400 bg-blue-400/20 text-blue-300 shadow-sm'
              : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20'
          }`}
        >
          <Activity size={12} />
          <span>{t('Avg Speed')}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTarget('duration')}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider font-bold transition-all ${
            selectedTarget === 'duration'
              ? 'border-amber-400 bg-amber-400/20 text-amber-300 shadow-sm'
              : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20'
          }`}
        >
          <Timer size={12} />
          <span>{t('Duration')}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTarget('prev_workout')}
          className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-wider font-bold transition-all ${
            selectedTarget === 'prev_workout'
              ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300 shadow-sm'
              : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20'
          }`}
        >
          <TrendingUp size={12} />
          <span>{t('Vs Last Ride')}</span>
        </button>
      </div>

      {/* Main Target Pacer Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-black/40 rounded-xl p-3 border border-white/8">
        {/* Left: Current Live vs Target */}
        <div className="flex items-center justify-around md:justify-start gap-6 border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0 md:pr-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">{t('Current Live Avg')}</div>
            <div className="text-2xl font-black font-mono text-white tabular-nums flex items-baseline gap-1 mt-0.5">
              {targetInfo.currentLabel}
            </div>
          </div>

          <div className="text-xl text-white/20 font-light">/</div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80">{t('PR Target')}</div>
            <div className="text-2xl font-black font-mono text-amber-300 tabular-nums flex items-baseline gap-1 mt-0.5">
              {targetInfo.targetLabel}
            </div>
          </div>
        </div>

        {/* Center: Live Pacer Progress Bar */}
        <div className="flex flex-col justify-center px-1">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-white/60 flex items-center gap-1.5">
              {targetInfo.icon}
              <span className="font-bold">{t('Pacer Status')}</span>
            </span>
            <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${targetInfo.isOnTrack ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-red-400/20 text-red-300 border border-red-400/30'}`}>
              {targetInfo.deltaLabel}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                targetInfo.isOnTrack
                  ? 'bg-gradient-to-r from-amber-400 to-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]'
                  : 'bg-gradient-to-r from-amber-400 to-yellow-300'
              }`}
              style={{ width: `${Math.min(targetInfo.progressPercent, 100)}%` }}
            />
          </div>

          <div className="mt-1 text-[9px] font-mono text-white/40 flex items-center justify-between">
            <span>{t('Pacing: {pct}% of target', { pct: targetInfo.progressPercent })}</span>
            {targetInfo.isBeaten && (
              <span className="text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 size={10} /> {t('Record Beaten!')}
              </span>
            )}
          </div>
        </div>

        {/* Right: Live Tactical Guidance */}
        <div className="border-t md:border-t-0 md:border-l border-white/10 pt-2.5 md:pt-0 md:pl-4 flex flex-col justify-center">
          <div className="text-[9px] font-mono uppercase tracking-widest text-hw-muted mb-1">{t('Pacer Coach')}</div>
          <p className="text-xs font-sans leading-snug text-white/80">
            {targetInfo.guidance}
          </p>
        </div>
      </div>
    </div>
  );
};
