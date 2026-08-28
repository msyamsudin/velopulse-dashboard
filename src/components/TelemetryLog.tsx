import { motion } from 'motion/react';
import { SaveAnimationTest } from './SaveAnimationTest';

interface TelemetryLogProps {
  rawLogs: string[];
  copyLogs: () => void;
  copyStatus: 'idle' | 'copied';
}

export const TelemetryLog = ({ rawLogs, copyLogs, copyStatus }: TelemetryLogProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="hardware-card bg-black border-yellow-500/30 overflow-hidden mb-6"
    >
      <div className="stat-label text-yellow-500 mb-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span>Raw Bluetooth Telemetry</span>
          <span className="opacity-50 text-[8px] font-normal">{'// Last 50 packets'}</span>
        </div>
        <div className="flex items-center gap-2">
          <SaveAnimationTest />
          <button 
            onClick={copyLogs}
            className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors text-[9px] flex items-center gap-1"
          >
            {copyStatus === 'copied' ? 'COPIED!' : 'COPY LOGS'}
          </button>
        </div>
      </div>
      <div className="font-mono text-[10px] h-48 overflow-y-auto space-y-1 text-yellow-500/80">
        {rawLogs.length === 0 ? (
          <div className="opacity-50 italic">Waiting for device connection...</div>
        ) : (
          rawLogs.map((log, i) => (
            <div key={i} className="border-b border-yellow-500/10 pb-1">
              <span className="opacity-40 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};
