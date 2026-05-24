import { motion } from 'motion/react';

interface SpeedVisualProps {
  currentSpeed: number;
  avgSpeed: number;
  maxSpeed: number;
}

export const SpeedVisual = ({ currentSpeed, avgSpeed, maxSpeed }: SpeedVisualProps) => {
  // Constants for scale
  const limit = Math.max(40, maxSpeed + 10);
  const avgPos = (avgSpeed / limit) * 100;
  const currentPos = (currentSpeed / limit) * 100;

  return (
    <div className="flex flex-col w-full h-full justify-end gap-3 pb-1">
      {/* Metrics Row */}
      <div className="flex justify-between items-center px-1 gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-hw-muted uppercase tracking-[0.18em]">Average</span>
          <span className="text-[16px] leading-none font-bold font-mono text-blue-400">{avgSpeed} <span className="text-[10px] font-normal opacity-60">KM/H</span></span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-hw-muted uppercase tracking-[0.18em]">Peak</span>
          <span className="text-[16px] leading-none font-bold font-mono text-white">{maxSpeed} <span className="text-[10px] font-normal opacity-60">KM/H</span></span>
        </div>
      </div>

      {/* Ribbon Track */}
      <div className="h-6 w-full bg-hw-muted/5 border border-hw-muted/10 rounded-sm overflow-hidden relative group">
        {/* Moving Background Pattern (Ribbon Effect) */}
        <motion.div 
          className="absolute inset-0 flex"
          animate={{ x: [0, -40] }}
          transition={{ 
            repeat: Infinity, 
            duration: currentSpeed > 0 ? Math.max(0.2, 5 / (currentSpeed / 5)) : 0, 
            ease: "linear" 
          }}
          style={{ width: '200%' }}
        >
          <div className="w-full h-full opacity-10" style={{ 
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
            backgroundSize: '20px 20px'
          }} />
          <div className="w-full h-full opacity-10" style={{ 
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
            backgroundSize: '20px 20px'
          }} />
        </motion.div>

        {/* Speed Gradient Overlay */}
        <motion.div 
          className="absolute inset-y-0 left-0 bg-linear-to-r from-blue-600/40 to-blue-400/60 shadow-[0_0_15px_rgba(59,130,246,0.5)] border-r border-blue-400/50 z-10"
          initial={{ width: 0 }}
          animate={{ width: `${currentPos}%` }}
          transition={{ type: "spring", stiffness: 40, damping: 15 }}
        />

        {/* Average Marker */}
        {avgSpeed > 0 && (
          <motion.div 
            className="absolute inset-y-0 w-0.5 bg-white/80 z-20 shadow-[0_0_8px_white]"
            animate={{ left: `${avgPos}%` }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 bg-white rotate-45 border border-blue-500" />
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[6px] font-bold text-white bg-blue-500 px-1 rounded-xs">AVG</div>
          </motion.div>
        )}

        {/* Speed Value Marker (Floating) */}
        <motion.div 
          className="absolute top-0 h-full flex flex-col items-center justify-center z-30 pointer-events-none"
          animate={{ left: `${currentPos}%` }}
        >
          <div className="bg-hw-bg/80 backdrop-blur-md border border-blue-400/30 px-1.5 py-0.5 rounded-sm -translate-y-1">
             <span className="text-[9px] font-black text-white">{currentSpeed}</span>
          </div>
        </motion.div>
      </div>

      {/* Axis Labels */}
      <div className="flex justify-between text-[8px] font-mono text-hw-muted/35 px-0.5 uppercase">
        <span>Static</span>
        <span>Cruising</span>
        <span>Sprint</span>
        <span>Max</span>
      </div>
    </div>
  );
};
