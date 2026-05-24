import { motion } from 'motion/react';

interface ResistanceVisualProps {
  resistance: number;
}

export const ResistanceVisual = ({ resistance }: ResistanceVisualProps) => {
  // Assume a max resistance of 100 for scaling purposes. 
  // If the bike uses 1-24 or similar, it will just appear as a shallower max slope.
  const maxAssumed = 100;
  const safeResistance = Math.min(Math.max(resistance || 0, 0), maxAssumed);
  
  // Calculate the height of the right side of the slope based on resistance.
  // 0 resistance = 40 (flat at the bottom)
  // 100 resistance = 5 (near the top)
  const rightY = 40 - (safeResistance / maxAssumed) * 35;
  
  // Color shifting: Green (easy) -> Yellow (medium) -> Red (hard)
  const isHard = safeResistance > 70;
  const isMedium = safeResistance > 30;
  const loadLabel = isHard ? 'Climb' : isMedium ? 'Rolling' : safeResistance > 0 ? 'Flat Push' : 'Open';
  const loadPct = Math.round((safeResistance / maxAssumed) * 100);
  
  const accentColor = isHard ? '#ef4444' : isMedium ? '#facc15' : '#4ade80';

  return (
    <div className="flex flex-col w-full h-full justify-end gap-3 pb-1 mt-2">
      <div className="flex justify-between items-end px-1 gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-hw-muted/80 uppercase tracking-[0.18em]">Load Profile</span>
          <span className="text-[16px] leading-none font-bold font-mono" style={{ color: accentColor }}>{loadLabel}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-hw-muted/80 uppercase tracking-[0.16em]">Load</span>
          <span className="text-[16px] leading-none font-bold font-mono text-white">{loadPct}%</span>
        </div>
      </div>

      <div className="relative w-full h-8 bg-hw-muted/5 border border-hw-muted/10 rounded-sm overflow-hidden">
        {/* Slope SVG */}
        <svg viewBox="0 0 100 40" className="absolute inset-0 w-full h-full preserve-3d" preserveAspectRatio="none">
          {/* Fill */}
          <motion.path 
            initial={{ d: `M0,40 L100,40 L100,40 Z` }}
            animate={{ d: `M0,40 L100,${rightY} L100,40 Z` }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
            fill={accentColor}
            fillOpacity="0.18"
          />
          
          {/* Top Line (Road) */}
          <motion.path 
            initial={{ d: `M0,40 L100,40` }}
            animate={{ d: `M0,40 L100,${rightY}` }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
            stroke={accentColor}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            className="drop-shadow-[0_0_5px_currentColor]"
          />
        </svg>

        {/* Dynamic Glow Overlay for High Resistance */}
        {isHard && (
          <motion.div 
            className="absolute inset-0 bg-red-500/10 pointer-events-none"
            animate={{ opacity: [0, 0.2, 0] }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
          />
        )}
      </div>

      <div className="flex justify-between text-[8px] font-mono text-hw-muted/35 px-0.5 uppercase">
        <span>Flat</span>
        <span>Rolling</span>
        <span>Steep</span>
      </div>
    </div>
  );
};
