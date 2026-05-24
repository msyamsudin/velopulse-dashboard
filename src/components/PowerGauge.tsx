import { motion } from 'motion/react';
import { POWER_ZONES } from '../lib/constants';

interface PowerGaugeProps {
  power: number;
  ftp: number;
  weight: number;
}

export const PowerGauge = ({ power, ftp, weight }: PowerGaugeProps) => {
  const intensity = ftp > 0 ? power / ftp : 0;
  const wkg = weight > 0 ? (power / weight).toFixed(1) : '?.?';

  // Determine active zone index
  let activeIndex = -1;
  for (let i = POWER_ZONES.length - 1; i >= 0; i--) {
    if (intensity >= POWER_ZONES[i].minPct) {
      activeIndex = i;
      break;
    }
  }

  const isHighIntensity = activeIndex >= 4; // VO2 Max and above

  return (
    <div className="flex flex-col w-full h-full justify-end gap-3 pb-1">
      {/* W/kg Secondary Metric */}
      <div className="flex justify-between items-center px-1 mb-1">
        <span className="text-[10px] font-mono text-hw-muted uppercase tracking-[0.18em]">Intensity</span>
        <span className={`text-[16px] leading-none font-black font-mono ${isHighIntensity ? 'text-hw-accent' : 'text-hw-muted'}`}>
          {wkg} <span className="text-[10px] font-normal opacity-60">W/KG</span>
        </span>
      </div>

      {/* 7-Zone Bar */}
      <div className="flex justify-between w-full gap-0.5 h-4">
        {POWER_ZONES.map((zone, idx) => {
          const isActive = idx === activeIndex;
          const isOverThreshold = idx <= activeIndex;

          return (
            <motion.div 
              key={zone.label} 
              className={`flex-1 rounded-xs relative overflow-hidden transition-all duration-300 ${
                isActive 
                  ? `${zone.color} shadow-[0_0_10px_var(--tw-shadow-color)] ${zone.shadow.replace('shadow-', 'shadow-')}` 
                  : isOverThreshold 
                    ? `${zone.color} opacity-30` 
                    : 'bg-hw-muted/10'
              }`}
              style={isActive ? { boxShadow: `0 0 12px var(--tw-shadow-color)` } : {}}
              animate={isActive && isHighIntensity ? { 
                opacity: [0.7, 1, 0.7],
                scaleY: [1, 1.1, 1]
              } : {}}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[7px] font-black text-hw-bg uppercase">{zone.label}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* FTP Percentage Label */}
      <div className="flex justify-between text-[8px] font-mono text-hw-muted/45 px-0.5 uppercase tracking-tight">
        <span>Recov</span>
        <span>Endur</span>
        <span>Tempo</span>
        <span>Thres</span>
        <span>VO2</span>
        <span>AnAer</span>
        <span>Neuro</span>
      </div>
    </div>
  );
};
