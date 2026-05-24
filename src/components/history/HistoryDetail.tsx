import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, Timer, Zap, Heart, Bike, Activity, ChevronRight, Settings } from 'lucide-react';
import { PerformanceChart } from '../PerformanceChart';
import { StackedWorkoutChart } from './StackedWorkoutChart';
import { formatDate, formatDuration } from '../../utils/formatters';
import { downloadTCX } from '../../lib/export-service';
import { Download } from 'lucide-react';

interface HistoryDetailProps {
  session: any;
  fullStats: any;
  isGoogleConnected?: boolean;
  onSyncSession?: (session: any) => void;
  onBack: () => void;
  onClose: () => void;
}

export const HistoryDetail = ({
  session,
  fullStats,
  isGoogleConnected,
  onSyncSession,
  onBack,
  onClose
}: HistoryDetailProps) => {
  const [isDetailReady, setIsDetailReady] = useState(false);
  const [showZoneBpm, setShowZoneBpm] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsDetailReady(true), 350);
    return () => clearTimeout(timer);
  }, []);

  if (!session || !fullStats) return null;

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-100 bg-hw-bg/95 backdrop-blur-xl p-4 md:p-8 flex flex-col overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-full bg-hw-muted/10 border border-white/10 hover:bg-hw-accent hover:text-hw-bg transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight uppercase font-mono">
              Workout <span className="text-hw-accent">Report</span>
            </h2>
            <div className="flex items-center gap-3 text-hw-muted text-xs font-mono uppercase tracking-widest mt-1">
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(session.date)}</span>
              <span className="w-1 h-1 rounded-full bg-hw-muted/30" />
              <span className="flex items-center gap-1"><Timer size={12} /> {formatDuration(session.duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {isGoogleConnected && !session.synced_to_google && onSyncSession && (
            <button
              onClick={() => onSyncSession(session)}
              className="px-4 py-2 rounded border border-hw-accent text-hw-accent hover:bg-hw-accent hover:text-hw-bg font-mono text-[10px] uppercase tracking-widest transition-all"
            >
              Sync to Google Fit
            </button>
          )}
          <button
            onClick={() => downloadTCX(session)}
            className="px-4 py-2 rounded border border-hw-muted/30 text-hw-muted hover:border-hw-accent hover:text-hw-accent font-mono text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
            title="Export for Strava/Garmin manual upload"
          >
            <Download size={12} />
            Export TCX
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-hw-muted/30 text-hw-muted hover:border-hw-muted hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all"
          >
            Close Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="grid grid-cols-2 gap-4 lg:col-span-1">
          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <Zap size={10} className="text-yellow-400" /> Power
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{session.stats.avgPower} <span className="text-xs font-normal opacity-40">W</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Max: {session.stats.maxPower} W</div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <Heart size={10} className="text-red-500" /> Heart Rate
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{session.stats.avgHr} <span className="text-xs font-normal opacity-40">BPM</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Max: {session.stats.maxHr} BPM</div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <Bike size={10} className="text-hw-accent" /> Cadence
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{session.stats.avgCadence} <span className="text-xs font-normal opacity-40">RPM</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Max: {session.stats.maxCadence} RPM</div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <Settings size={10} className="text-orange-400" /> Resistance
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{fullStats.avgResistance} <span className="text-xs font-normal opacity-40">LVL</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Max: {fullStats.maxResistance}</div>
          </div>


          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <Activity size={10} className="text-blue-400" /> Speed
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{fullStats.avgSpeed} <span className="text-xs font-normal opacity-40">KM/H</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Max: {fullStats.maxSpeed} KM/H</div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <ChevronRight size={10} className="text-purple-400" /> Distance
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{fullStats.totalDistance} <span className="text-xs font-normal opacity-40">KM</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Session total</div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <Zap size={10} className="text-pink-400" /> Calories
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{fullStats.totalCalories} <span className="text-xs font-normal opacity-40">KCAL</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Cals Burned</div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-4">
            <div className="text-[10px] text-hw-muted uppercase font-mono mb-2 flex items-center gap-2">
              <Timer size={10} className="text-blue-400" /> Move Minutes
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{fullStats.moveMinutes} <span className="text-xs font-normal opacity-40">MIN</span></div>
            <div className="text-[9px] text-hw-muted mt-1 uppercase font-mono">Active Intensity</div>
          </div>

          <div className="hardware-card border-hw-muted/20 p-4 col-span-2">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
              <div className="text-[10px] text-hw-muted uppercase font-mono flex items-center gap-2">
                <Activity size={10} className="text-hw-accent" /> Heart Rate Zones
              </div>
              <button
                onClick={() => setShowZoneBpm(!showZoneBpm)}
                className="text-[8px] font-mono text-hw-accent hover:text-white transition-colors uppercase tracking-widest border border-hw-accent/30 px-2 py-1 rounded"
              >
                {showZoneBpm ? 'Hide BPM' : 'Show BPM'}
              </button>
            </div>
            <div className="space-y-3">
              {fullStats.zones.map((zone: any) => (
                <div key={zone.label} className="flex items-center justify-between text-[10px] font-mono">
                  <div className="flex flex-col w-32">
                    <span className={`uppercase ${zone.color}`}>{zone.label}</span>
                    {showZoneBpm && <span className="text-[8px] text-hw-muted mt-0.5">{zone.range} BPM</span>}
                  </div>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full mx-4 overflow-hidden">
                    <div
                      className={`h-full bg-current ${zone.color.replace('text-', 'bg-')}`}
                      style={{ width: `${zone.percent}%` }}
                    />
                  </div>
                  <span className="text-white w-12 text-right">{zone.time}</span>
                  <span className="text-hw-muted w-10 text-right opacity-50">{zone.percent}%</span>
                </div>
              ))}
            </div>
          </div>
          

        </div>


        <div className="lg:col-span-2 h-full min-h-[500px]">
          {isDetailReady ? (
            <StackedWorkoutChart 
              data={session.history} 
              stats={{
                avgHr: session.stats.avgHr,
                maxHr: session.stats.maxHr,
                avgPower: session.stats.avgPower,
                maxPower: session.stats.maxPower,
                avgCadence: session.stats.avgCadence,
                maxCadence: session.stats.maxCadence,
                avgSpeed: fullStats.avgSpeed,
                maxSpeed: fullStats.maxSpeed,
                avgResistance: fullStats.avgResistance,
                maxResistance: fullStats.maxResistance,
              }}

            />
          ) : (
            <div className="w-full h-full bg-black/20 rounded-xl flex items-center justify-center border border-white/5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-hw-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-mono text-hw-muted uppercase tracking-widest">Generating Telemetry...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
