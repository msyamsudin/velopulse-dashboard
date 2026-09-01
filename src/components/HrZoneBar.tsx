import { motion } from 'motion/react';
import { getAbsoluteHrZones, getActiveHrZoneIndex, getSafeMaxHr } from '@/lib/constants';

const ZONE_STYLES = [
  { activeColor: 'bg-hw-muted', shadow: 'shadow-hw-muted/50' },
  { activeColor: 'bg-green-400', shadow: 'shadow-green-400/50' },
  { activeColor: 'bg-yellow-400', shadow: 'shadow-yellow-400/50' },
  { activeColor: 'bg-orange-500', shadow: 'shadow-orange-500/50' },
  { activeColor: 'bg-red-500', shadow: 'shadow-red-500/50' },
];

interface HrZoneBarProps {
  currentHr: number;
  maxHr: number;
  /** Minutes spent in each HR zone (index 0-4 = Z1..Z5). Renders a Time-in-Zone chart when provided. */
  zoneTimes?: number[];
}

export const HrZoneBar = ({ currentHr, maxHr, zoneTimes }: HrZoneBarProps) => {
  const absoluteZones = getAbsoluteHrZones(maxHr);
  const zones = absoluteZones.map((z, i) => ({
    ...z,
    ...ZONE_STYLES[i],
  }));

  const activeIndex = getActiveHrZoneIndex(currentHr, maxHr);

  const safeMaxHr = getSafeMaxHr(maxHr);
  const hrPercent = currentHr > 0 ? Math.round((currentHr / safeMaxHr) * 100) : 0;
  const currentZone = activeIndex >= 0 ? zones[activeIndex].label : 'IDLE';
  
  return (
    <div className="flex flex-col w-full h-full justify-end gap-3 pb-1">
      <div className="flex justify-between items-end px-1 gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-mono text-hw-muted/80 uppercase tracking-[0.16em]">Current Zone</span>
          <span className="text-xl leading-none font-bold font-mono text-red-300">{currentZone}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-mono text-hw-muted/80 uppercase tracking-[0.16em]">% Max HR</span>
          <span className="text-lg leading-none font-bold font-mono text-white">{hrPercent}%</span>
        </div>
      </div>

      <div className="flex justify-between w-full gap-1 h-7">
        {zones.map((zone, idx) => {
          const isActive = idx === activeIndex;
          const isReached = idx <= activeIndex;
          return (
            <motion.div 
              key={zone.label} 
              className={`flex-1 rounded-sm relative overflow-hidden flex items-center justify-center transition-colors duration-300 ${
                isActive
                  ? `${zone.activeColor} shadow-[0_0_8px_rgba(0,0,0,0)] ${zone.shadow.replace('shadow-', 'shadow-')}`
                  : isReached
                    ? `${zone.activeColor} opacity-35`
                    : 'bg-hw-muted/10'
              }`}
              style={isActive ? { boxShadow: `0 0 10px var(--tw-shadow-color)` } : {}}
              animate={{ opacity: isActive ? [0.7, 1, 0.7] : 1 }}
              transition={isActive ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : {}}
            >
              {isActive && (
                <div className="flex flex-col items-center justify-center leading-none relative z-10">
                  <span className="text-[9px] font-bold text-hw-bg uppercase tracking-tighter opacity-70">{zone.label}</span>
                  <span className="text-[11px] font-black text-hw-bg tracking-tight">{currentHr}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-hw-muted/55 px-0.5">
        {zones.map((zone, idx) => (
          <div key={idx} className="flex flex-col items-center flex-1">
            <span className="opacity-40">{zone.label}</span>
            <span className="font-bold">{Math.round(zone.min)}</span>
          </div>
        ))}
      </div>

      {zoneTimes && (() => {
        const totalTime = zoneTimes.reduce((sum, m) => sum + m, 0);
        return (
        <div className="mt-1.5">
          <div className="flex items-center justify-between px-0.5 mb-1">
            <span className="text-[10px] font-mono text-hw-muted/70 uppercase tracking-[0.16em]">Time in Zone</span>
            <span className="text-[11px] font-mono font-bold text-white">
              {Math.round(totalTime)} MIN
            </span>
          </div>
          <div className="flex w-full gap-1">
            {zones.map((zone, idx) => {
              const minutes = zoneTimes[idx] ?? 0;
              const pct = totalTime > 0 ? (minutes / totalTime) * 100 : 0;
              return (
                <div key={zone.label} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full h-7 bg-hw-muted/10 rounded-sm flex items-end overflow-hidden">
                    <div className={`w-full rounded-sm ${zone.activeColor}`} style={{ height: `${pct}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-hw-muted/70">{zone.label}</span>
                  <span className="text-[9px] font-mono text-white/80">
                    {minutes > 0 ? `${Math.round(minutes)}m` : '–'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}
    </div>
  );
};
