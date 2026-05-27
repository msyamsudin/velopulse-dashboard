import { Calendar, Clock, Zap, Heart, Bike, Timer } from 'lucide-react';
import { formatDate, formatDuration } from '../../utils/formatters';

interface HistoryListProps {
  sessions: any[];
  maxHr: number;
  onSelectSession: (id: string) => void;
  isSelectionMode?: boolean;
  selectedSessionIds?: string[];
  onToggleSelectSession?: (id: string) => void;
}

export const HistoryList = ({ 
  sessions, 
  maxHr, 
  onSelectSession, 
  isSelectionMode = false, 
  selectedSessionIds = [], 
  onToggleSelectSession 
}: HistoryListProps) => {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 text-hw-muted font-mono text-xs uppercase tracking-widest border border-dashed border-hw-muted/20 rounded-lg">
        No sessions recorded yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sessions.map((session) => {
        const isSelected = selectedSessionIds.includes(session.id);
        
        return (
          <div
            key={session.id}
            onClick={() => {
              if (isSelectionMode && onToggleSelectSession) {
                onToggleSelectSession(session.id);
              } else {
                onSelectSession(session.id);
              }
            }}
            className={`p-5 rounded-lg transition-all group cursor-pointer flex flex-col h-full ${
              isSelected 
                ? 'bg-hw-accent/10 border-2 border-hw-accent shadow-[0_0_15px_rgba(var(--hw-accent-rgb,0,255,255),0.15)]' 
                : 'bg-hw-muted/5 border border-hw-muted/10 hover:border-hw-accent/30'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-hw-accent">
                {isSelectionMode && (
                  <div className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all border ${
                    isSelected 
                      ? 'bg-hw-accent border-hw-accent text-hw-bg' 
                      : 'border-hw-muted/40 bg-black/30 group-hover:border-hw-accent/50'
                  }`}>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                )}
                <Calendar size={14} />
                <span className="text-xs font-bold font-mono uppercase">
                  {formatDate(session.date)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-hw-muted">
                <Clock size={12} />
                <span className="text-[10px] font-mono">{formatDuration(session.duration)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
              <div className="flex flex-col bg-black/20 p-2 rounded">
                <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Avg Power</span>
                <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-base tabular-nums">
                  <Zap size={12} /> {session.stats.avgPower}<span className="text-[10px] font-normal opacity-50">W</span>
                </div>
              </div>
              <div className="flex flex-col bg-black/20 p-2 rounded">
                <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Avg HR</span>
                <div className="flex items-center gap-1.5 text-red-500 font-bold text-base tabular-nums">
                  <Heart size={12} /> {session.stats.avgHr}<span className="text-[10px] font-normal opacity-50">BPM</span>
                </div>
              </div>
              <div className="flex flex-col bg-black/20 p-2 rounded">
                <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Avg Cadence</span>
                <div className="flex items-center gap-1.5 text-hw-accent font-bold text-base tabular-nums">
                  <Bike size={12} /> {session.stats.avgCadence}<span className="text-[10px] font-normal opacity-50">RPM</span>
                </div>
              </div>
              <div className="flex flex-col bg-black/20 p-2 rounded">
                <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Move Mins</span>
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-base tabular-nums">
                  <Timer size={12} /> {Math.floor(((session.history?.filter((h: any) => h.hr >= (maxHr * 0.5)).length || 0) / Math.max(1, session.history?.length || 1)) * session.duration / 60)}<span className="text-[10px] font-normal opacity-50">MIN</span>
                </div>
              </div>
            </div>

            <div className="mt-auto flex justify-between items-center pt-3 border-t border-white/5">
              <span className="text-[9px] text-hw-accent uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                {isSelectionMode ? (isSelected ? 'Deselect' : 'Select') : 'View Details →'}
              </span>
              {session.synced_to_google ? (
                <div className="flex text-[9px] text-green-500 font-mono uppercase tracking-widest items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded">
                  ✓ Google Fit
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
