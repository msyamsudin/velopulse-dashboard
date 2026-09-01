import { motion } from 'motion/react';

interface CadenceGaugeProps {
  value: number;
  max: number;
  targetMax?: number;
}

export const CadenceGauge = ({ value, max, targetMax = 120 }: CadenceGaugeProps) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;

  // Constrain value and max for display
  const displayValue = Math.min(value, targetMax);
  const displayMax = Math.min(max, targetMax);

  const progress = (displayValue / targetMax) * circumference;
  const maxProgress = (displayMax / targetMax) * 360; // In degrees for rotation

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* SVG Gauge */}
        <svg className="w-full h-full transform -rotate-90">
          {/* Background Track */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="3"
            className="text-hw-muted/10"
          />

          {/* Progress Arc */}
          <motion.circle
            cx="24"
            cy="24"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
            className="text-hw-accent drop-shadow-[0_0_3px_rgba(0,255,10,0.5)]"
            strokeLinecap="round"
          />
        </svg>

        {/* Ghost Max Marker */}
        {max > 0 && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ rotate: 0 }}
            animate={{ rotate: maxProgress }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white] z-20 border border-hw-accent"
              style={{ marginTop: '2px' }}
            />
          </motion.div>
        )}

        {/* RPM Label in center */}
        <div className="absolute flex flex-col items-center justify-center leading-none">
          <span className="text-sm font-black text-white">{value}</span>
          <span className="text-[8px] font-mono text-hw-muted uppercase opacity-50">RPM</span>
        </div>
      </div>

      {/* Range Indicators */}
      <div className="flex-1 ml-4 flex flex-col justify-center gap-1.5">
        <div className="flex justify-between items-center text-[11px] font-mono text-hw-muted/70 uppercase tracking-[0.16em]">
          <span>Target</span>
          <span className="text-hw-accent">70-100</span>
        </div>
        <div className="h-1 w-full bg-hw-muted/10 rounded-full overflow-hidden relative">
          {/* Sweet spot indicator */}
          <div
            className="absolute h-full bg-hw-accent/20"
            style={{ left: '58%', width: '25%' }} // 70-100 RPM range relative to 120 max
          />
          {/* Current position dot */}
          <motion.div
            className="absolute top-0 w-1 h-full bg-hw-accent shadow-[0_0_5px_#00ff0a]"
            animate={{ left: `${(displayValue / targetMax) * 100}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono text-hw-muted/45">
          <span>0</span>
          <span>{targetMax}</span>
        </div>
      </div>
    </div>
  );
};
