import { motion } from 'motion/react';
import { useMemo } from 'react';

interface CaloriesVisualProps {
  power: number;
  calories: number;
}

export const CaloriesVisual = ({ power, calories }: CaloriesVisualProps) => {
  // Calculate instantaneous burn rate (Kcal/Hr)
  // 1 Watt = 1 Joule/sec = 3.6 kJ/hr. Assuming ~24% human mechanical efficiency, 
  // 1 kJ of mechanical work requires ~1 kcal of metabolic energy.
  // So: Burn Rate (kcal/hr) ≈ Power (Watts) * 3.6
  const burnRate = Math.round(power * 3.6);

  // Determine core temperature/color based on burn rate
  const isHighBurn = burnRate > 600;
  const isMediumBurn = burnRate > 300;
  
  const activeColor = isHighBurn ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 
                      isMediumBurn ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 
                      burnRate > 50 ? 'bg-yellow-400 shadow-[0_0_5px_#facc15]' : 
                      'bg-hw-muted shadow-none';

  // Calculate lit dots for the Heat Grid (1 dot = 10 Kcal)
  // Grid size: 10 columns x 3 rows = 30 dots (300 Kcal per cycle)
  const TOTAL_DOTS = 30;
  const KCAL_PER_DOT = 10;
  
  const litDots = Math.floor(calories / KCAL_PER_DOT) % TOTAL_DOTS;
  const cycleCount = Math.floor(calories / (TOTAL_DOTS * KCAL_PER_DOT));

  // Generate grid dots
  const dots = useMemo(() => {
    return Array.from({ length: TOTAL_DOTS }).map((_, i) => i);
  }, []);

  return (
    <div className="flex flex-col w-full h-full justify-end gap-3 pb-1 mt-2">
      <div className="flex justify-between items-end px-1 gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-hw-muted uppercase tracking-[0.18em]">Burn Rate</span>
          <span className={`text-[16px] leading-none font-bold font-mono transition-colors ${isHighBurn ? 'text-red-500' : isMediumBurn ? 'text-orange-500' : 'text-yellow-400'}`}>
            {burnRate} <span className="text-[10px] font-normal opacity-60">KCAL/HR</span>
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-hw-muted uppercase tracking-[0.18em]">Core Cycles</span>
          <span className="text-[16px] leading-none font-bold font-mono text-white">
            x{cycleCount}
          </span>
        </div>
      </div>

      <div className="w-full h-8 bg-hw-muted/5 border border-hw-muted/10 rounded-sm p-1.5 flex flex-col justify-between relative overflow-hidden">
        {/* Burn Rate Pulse Background */}
        {(burnRate > 0) && (
          <motion.div 
            className={`absolute inset-0 opacity-10 ${isHighBurn ? 'bg-red-500' : isMediumBurn ? 'bg-orange-500' : 'bg-yellow-400'}`}
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ repeat: Infinity, duration: Math.max(0.3, 2000 / burnRate), ease: "easeInOut" }}
          />
        )}

        {/* 10x3 Grid */}
        <div className="grid grid-cols-10 grid-rows-3 gap-[2px] w-full h-full relative z-10">
          {dots.map((dotIndex) => {
            const isLit = dotIndex < litDots;
            return (
              <div 
                key={dotIndex} 
                className={`w-full h-full rounded-[1px] transition-all duration-500 ${isLit ? activeColor : 'bg-hw-muted/20'}`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-[8px] font-mono text-hw-muted/35 px-0.5 uppercase">
        <span>Idle</span>
        <span>Meltdown</span>
      </div>
    </div>
  );
};
