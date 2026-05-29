import { Calendar, Clock, Zap, Heart, Route, Flame } from 'lucide-react';
import { formatDate, formatDuration } from '../../utils/formatters';
import { getSessionOutcome, getWorkoutQuality } from '../../lib/workout-analysis';

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
  const groupedSessions = sessions.reduce<Array<{
    key: string;
    label: string;
    sessions: any[];
    totalDistance: number;
    totalDuration: number;
  }>>((groups, session) => {
    const date = new Date(session.date);
    const key = Number.isNaN(date.getTime())
      ? 'unknown'
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = Number.isNaN(date.getTime())
      ? 'Unknown Date'
      : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const outcome = getSessionOutcome(session);
    const existing = groups.find(group => group.key === key);

    if (existing) {
      existing.sessions.push(session);
      existing.totalDistance += outcome.distanceKm;
      existing.totalDuration += outcome.duration;
    } else {
      groups.push({
        key,
        label,
        sessions: [session],
        totalDistance: outcome.distanceKm,
        totalDuration: outcome.duration,
      });
    }

    return groups;
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 text-hw-muted font-mono text-xs uppercase tracking-widest border border-dashed border-hw-muted/20 rounded-lg">
        No matching sessions
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groupedSessions.map(group => (
        <section key={group.key} className="flex flex-col gap-4">
          <div className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-hw-border bg-hw-bg/90 px-4 py-3 backdrop-blur-xl">
            <div>
              <div className="text-sm font-bold font-mono uppercase tracking-[0.16em] text-white">{group.label}</div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">
                {group.sessions.length} sessions
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
              <span className="rounded border border-blue-400/20 bg-blue-400/5 px-2 py-1 text-blue-300">
                {group.totalDistance.toFixed(1)} KM
              </span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-white/60">
                {formatDuration(group.totalDuration)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.sessions.map((session) => {
              const isSelected = selectedSessionIds.includes(session.id);
              const outcome = getSessionOutcome(session);
              const quality = getWorkoutQuality(session, maxHr);

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
                    <div className="flex items-center gap-2 text-hw-accent min-w-0">
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
                      <span className="text-xs font-bold font-mono uppercase truncate">
                        {formatDate(session.date)}
                      </span>
                    </div>
                    <div className={`shrink-0 rounded border px-2 py-1 text-[8px] font-mono uppercase tracking-widest ${quality.bg} ${quality.color}`}>
                      {quality.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
                    <div className="flex flex-col bg-black/20 p-2 rounded">
                      <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Distance</span>
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold text-base tabular-nums">
                        <Route size={12} /> {outcome.distanceKm.toFixed(2)}<span className="text-[10px] font-normal opacity-50">KM</span>
                      </div>
                    </div>
                    <div className="flex flex-col bg-black/20 p-2 rounded">
                      <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Duration</span>
                      <div className="flex items-center gap-1.5 text-white font-bold text-base tabular-nums">
                        <Clock size={12} /> {formatDuration(outcome.duration)}
                      </div>
                    </div>
                    <div className="flex flex-col bg-black/20 p-2 rounded">
                      <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Calories</span>
                      <div className="flex items-center gap-1.5 text-pink-400 font-bold text-base tabular-nums">
                        <Flame size={12} /> {outcome.calories}<span className="text-[10px] font-normal opacity-50">KCAL</span>
                      </div>
                    </div>
                    <div className="flex flex-col bg-black/20 p-2 rounded">
                      <span className="text-[9px] text-hw-muted uppercase font-mono mb-1">Avg Power</span>
                      <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-base tabular-nums">
                        <Zap size={12} /> {outcome.avgPower}<span className="text-[10px] font-normal opacity-50">W</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 flex items-center justify-between rounded bg-black/20 px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest text-hw-muted">
                    <span className="flex items-center gap-1.5">
                      <Heart size={10} className="text-red-500" />
                      Avg HR <span className="text-white">{outcome.avgHr}</span> BPM
                    </span>
                    <span>{session.stats.avgCadence || 0} RPM</span>
                  </div>

                  <div className="mt-auto flex justify-between items-center pt-3 border-t border-white/5">
                    <span className="text-[9px] text-hw-accent uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      {isSelectionMode ? (isSelected ? 'Deselect' : 'Select') : 'View Details ->'}
                    </span>
                    {session.synced_to_google ? (
                      <div className="flex text-[9px] text-green-500 font-mono uppercase tracking-widest items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded">
                        Google Fit
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
