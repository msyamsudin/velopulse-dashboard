import { motion } from 'motion/react';
import { useMemo } from 'react';

interface DistanceVisualProps {
  distanceMeters: number;
  currentSpeedKmh: number;
}

export const DistanceVisual = ({ distanceMeters, currentSpeedKmh }: DistanceVisualProps) => {
  const currentKm = distanceMeters / 1000;

  // 1. Calculate Pace (Minutes per KM)
  const paceStr = useMemo(() => {
    if (!currentSpeedKmh || currentSpeedKmh <= 0.1) return '--:--';
    const paceMinutesDecimal = 60 / currentSpeedKmh;
    const mins = Math.floor(paceMinutesDecimal);
    const secs = Math.floor((paceMinutesDecimal - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [currentSpeedKmh]);

  // 2. Determine Next Milestone
  const { targetKm, startKm } = useMemo(() => {
    if (currentKm < 1) return { targetKm: 1, startKm: 0 };
    if (currentKm < 5) return { targetKm: 5, startKm: 1 };
    if (currentKm < 10) return { targetKm: 10, startKm: 5 };
    if (currentKm < 20) return { targetKm: 20, startKm: 10 };
    if (currentKm < 50) return { targetKm: 50, startKm: 20 };
    
    // Beyond 50km, milestones every 50km
    const target = Math.floor(currentKm / 50) * 50 + 50;
    return { targetKm: target, startKm: target - 50 };
  }, [currentKm]);

  // 3. Calculate Progress & ETA
  const progressPct = Math.min(100, Math.max(0, ((currentKm - startKm) / (targetKm - startKm)) * 100));
  const remainingKm = targetKm - currentKm;

  const etaStr = useMemo(() => {
    if (!currentSpeedKmh || currentSpeedKmh <= 0.1 || remainingKm <= 0) return '--m';
    const etaMinutesDecimal = remainingKm * (60 / currentSpeedKmh);
    
    if (etaMinutesDecimal < 1) {
      const secs = Math.round(etaMinutesDecimal * 60);
      return `${secs}s`;
    }
    
    const h = Math.floor(etaMinutesDecimal / 60);
    const m = Math.floor(etaMinutesDecimal % 60);
    
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }, [currentSpeedKmh, remainingKm]);

  return (
    <div className="flex flex-col w-full h-full justify-end gap-3 pb-1 mt-1">
      <div className="flex justify-between items-end px-1 gap-3">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-hw-muted/80 uppercase tracking-[0.14em]">ETA to {targetKm}KM</span>
          <span className="text-[16px] leading-none font-bold font-mono text-white">
            {etaStr}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-hw-muted/80 uppercase tracking-[0.14em]">Progress</span>
          <span className="text-[14px] leading-none font-bold font-mono text-purple-300">
            {Math.round(progressPct)}%
          </span>
        </div>
      </div>

      <div className="relative w-full h-2.5 bg-hw-muted/10 rounded-full overflow-hidden border border-white/5">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-linear-to-r from-purple-600/60 to-fuchsia-400 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.55)]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: "spring", stiffness: 30, damping: 15 }}
        >
          {/* Shine effect */}
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-linear-to-r from-transparent to-white/30 rounded-r-full" />
        </motion.div>
      </div>

      <div className="flex justify-between text-[9px] font-mono text-hw-muted/55 px-0.5 uppercase">
        <span>{startKm}KM</span>
        <span>{targetKm}KM</span>
      </div>
    </div>
  );
};
