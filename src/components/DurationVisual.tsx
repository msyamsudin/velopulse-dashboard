import { motion } from 'motion/react';

interface DurationVisualProps {
  elapsed: number;
  isRecording: boolean;
}

export const DurationVisual = ({ elapsed, isRecording }: DurationVisualProps) => {
  const minute = Math.floor(elapsed / 60);
  const second = elapsed % 60;
  const progressToNextMinute = (second / 60) * 100;
  const nextMinuteMark = minute + 1;

  const phaseLabel =
    elapsed < 60 ? 'Warmup' :
    elapsed < 20 * 60 ? 'Building' :
    elapsed < 45 * 60 ? 'Steady' :
    'Long Haul';

  const statusLabel = isRecording ? 'Live Session' : 'Paused';
  const statusColor = isRecording ? 'text-blue-300' : 'text-hw-muted';

  return (
    <div className="flex flex-col w-full h-full justify-end gap-3 pb-1 mt-1">
      <div className="flex justify-between items-end px-1 gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-hw-muted/80 uppercase tracking-[0.16em]">Session Phase</span>
          <span className={`text-[16px] leading-none font-bold font-mono ${statusColor}`}>{phaseLabel}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-mono text-hw-muted/80 uppercase tracking-[0.16em]">Next Minute</span>
          <span className="text-[16px] leading-none font-bold font-mono text-white">
            {String(nextMinuteMark).padStart(2, '0')}:00
          </span>
        </div>
      </div>

      <div className="relative w-full h-2.5 bg-hw-muted/10 rounded-full overflow-hidden border border-white/5">
        <motion.div
          className="absolute top-0 left-0 h-full bg-linear-to-r from-blue-600/60 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.55)]"
          initial={{ width: 0 }}
          animate={{ width: `${progressToNextMinute}%` }}
          transition={{ type: 'spring', stiffness: 40, damping: 16 }}
        >
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-linear-to-r from-transparent to-white/30 rounded-r-full" />
        </motion.div>
      </div>

      <div className="flex justify-between text-[9px] font-mono text-hw-muted/55 px-0.5 uppercase">
        <span>{statusLabel}</span>
        <span>{String(second).padStart(2, '0')}s</span>
      </div>
    </div>
  );
};
