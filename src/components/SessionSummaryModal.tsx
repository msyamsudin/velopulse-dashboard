import { motion } from 'motion/react';
import { Timer, Zap, Heart, Bike, ChevronRight, Save, Trash2, X, Download } from 'lucide-react';
import { downloadTCX } from '../lib/export-service';

interface SessionSummaryModalProps {
  stats: {
    avgHr: number;
    maxHr: number;
    avgPower: number;
    maxPower: number;
    avgCadence: number;
    maxCadence: number;
    avgSpeed: number;
    maxSpeed: number;
  };
  duration: string;
  calories: number;
  distance: number;
  history?: any[];
  sessionStartTime?: number;
  onSave: () => void;
  onDiscard: () => void;
}

export const SessionSummaryModal = ({
  stats,
  duration,
  calories,
  distance,
  history,
  sessionStartTime,
  onSave,
  onDiscard
}: SessionSummaryModalProps) => {
  const handleExport = () => {
    if (!history || !sessionStartTime) return;
    
    // Create a temporary session object for the exporter
    const tempSession = {
      id: 'temp',
      sessionStartTime,
      date: new Date(sessionStartTime).toISOString(),
      duration: parseInt(duration.split(':').reduce((acc, time) => (60 * acc) + +time, 0).toString()), // approximate
      stats: {
        avgHr: stats.avgHr,
        maxHr: stats.maxHr,
        avgPower: stats.avgPower,
        maxPower: stats.maxPower,
        avgCadence: stats.avgCadence,
        maxCadence: stats.maxCadence
      },
      history: history as any[]
    };
    
    downloadTCX(tempSession as any);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="hardware-card border-hw-accent/20 bg-hw-bg max-w-2xl w-full shadow-2xl p-0 overflow-hidden"
      >
        <div className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">WORKOUT COMPLETE</h2>
            <p className="text-hw-muted text-xs font-mono uppercase tracking-widest">Session Summary & Telemetry Data</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryItem icon={<Timer size={14}/>} label="Duration" value={duration} color="text-blue-400" />
            <SummaryItem icon={<ChevronRight size={14}/>} label="Distance" value={`${(distance / 1000).toFixed(2)} KM`} color="text-purple-400" />
            <SummaryItem icon={<Zap size={14}/>} label="Calories" value={`${calories} KCAL`} color="text-pink-400" />
            <SummaryItem icon={<Heart size={14}/>} label="Avg HR" value={`${stats.avgHr} BPM`} color="text-red-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-8">
            <DetailItem label="Avg Power" value={`${stats.avgPower} W`} subValue={`Max: ${stats.maxPower} W`} />
            <DetailItem label="Avg Cadence" value={`${stats.avgCadence} RPM`} subValue={`Max: ${stats.maxCadence} RPM`} />
            <DetailItem label="Avg Speed" value={`${stats.avgSpeed} KM/H`} subValue={`Max: ${stats.maxSpeed} KM/H`} />
          </div>

          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <button 
              onClick={onSave}
              className="flex-1 py-4 bg-hw-accent text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Save size={20} />
              SAVE SESSION
            </button>
            <button 
              onClick={handleExport}
              className="flex-1 py-4 bg-white/5 text-hw-accent font-bold rounded-xl border border-hw-accent/20 flex items-center justify-center gap-2 hover:bg-hw-accent/10 transition-all"
            >
              <Download size={20} />
              EXPORT TCX
            </button>
            <button 
              onClick={onDiscard}
              className="flex-1 py-4 bg-white/5 text-hw-muted font-bold rounded-xl border border-white/10 flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all"
            >
              <Trash2 size={20} />
              DISCARD
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SummaryItem = ({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) => (
  <div className="flex flex-col items-center text-center space-y-1">
    <div className={`p-2 rounded-full bg-white/5 ${color}`}>
      {icon}
    </div>
    <span className="text-[10px] text-hw-muted font-mono uppercase tracking-tighter">{label}</span>
    <span className="text-xl font-bold text-white">{value}</span>
  </div>
);

const DetailItem = ({ label, value, subValue }: { label: string, value: string, subValue: string }) => (
  <div className="hardware-card border-white/5 bg-white/5 p-4 text-center">
    <span className="text-[10px] text-hw-muted font-mono uppercase tracking-widest block mb-1">{label}</span>
    <span className="text-2xl font-bold text-white block">{value}</span>
    <span className="text-[10px] text-hw-muted font-mono uppercase block">{subValue}</span>
  </div>
);
