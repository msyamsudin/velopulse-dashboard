import { Calendar, Clock, Zap, Heart, Route, Flame, Cloud, CloudOff } from 'lucide-react';
import { formatDate, formatDuration } from '../../utils/formatters';
import { getSessionOutcome, getWorkoutQuality } from '../../lib/workout-analysis';
import { EmptyState, StatusPill } from '../ui';

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
      <EmptyState
        title="No matching sessions"
        detail="Try a different search or import workouts"
        icon={<Calendar size={20} />}
        className="py-20"
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groupedSessions.map(group => (
        <section key={group.key} className="flex flex-col gap-4">
          <div className="sticky top-0 z-10 flex flex-col justify-between gap-2 rounded-lg border border-vp-border bg-vp-bg/90 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-bold font-mono uppercase tracking-[0.16em] text-vp-text">{group.label}</div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.2em] text-vp-muted">
                {group.sessions.length} sessions
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={`${group.totalDistance.toFixed(1)} KM`} tone="info" compact />
              <StatusPill label={formatDuration(group.totalDuration)} tone="neutral" compact />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {group.sessions.map((session) => {
              const isSelected = selectedSessionIds.includes(session.id);
              const outcome = getSessionOutcome(session);
              const quality = getWorkoutQuality(session, maxHr);
              const hrrScore = typeof session.stats?.hrrScore === 'number' ? session.stats.hrrScore : null;

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
                  className={`group flex h-full cursor-pointer flex-col rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? 'border-vp-accent bg-vp-accent/10 shadow-[0_0_18px_rgba(53,240,189,0.12)]'
                      : 'border-vp-border bg-white/[0.025] hover:border-vp-accent/35 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex min-w-0 items-center gap-2 text-vp-accent">
                      {isSelectionMode && (
                        <div className={`w-4.5 h-4.5 rounded flex items-center justify-center transition-all border ${
                          isSelected
                            ? 'bg-vp-accent border-vp-accent text-vp-bg'
                            : 'border-vp-muted/40 bg-black/30 group-hover:border-vp-accent/50'
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
                    <div className="flex flex-col rounded border border-vp-border bg-vp-bg/40 p-2">
                      <span className="mb-1 text-[9px] text-vp-muted uppercase font-mono">Distance</span>
                      <div className="flex items-center gap-1.5 text-vp-distance font-bold text-base tabular-nums">
                        <Route size={12} /> {outcome.distanceKm.toFixed(2)}<span className="text-[10px] font-normal opacity-50">KM</span>
                      </div>
                    </div>
                    <div className="flex flex-col rounded border border-vp-border bg-vp-bg/40 p-2">
                      <span className="mb-1 text-[9px] text-vp-muted uppercase font-mono">Duration</span>
                      <div className="flex items-center gap-1.5 text-vp-text font-bold text-base tabular-nums">
                        <Clock size={12} /> {formatDuration(outcome.duration)}
                      </div>
                    </div>
                    <div className="flex flex-col rounded border border-vp-border bg-vp-bg/40 p-2">
                      <span className="mb-1 text-[9px] text-vp-muted uppercase font-mono">Calories</span>
                      <div className="flex items-center gap-1.5 text-vp-calories font-bold text-base tabular-nums">
                        <Flame size={12} /> {outcome.calories}<span className="text-[10px] font-normal opacity-50">KCAL</span>
                      </div>
                    </div>
                    <div className="flex flex-col rounded border border-vp-border bg-vp-bg/40 p-2">
                      <span className="mb-1 text-[9px] text-vp-muted uppercase font-mono">Avg Power</span>
                      <div className="flex items-center gap-1.5 text-vp-power font-bold text-base tabular-nums">
                        <Zap size={12} /> {outcome.avgPower}<span className="text-[10px] font-normal opacity-50">W</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 flex items-center justify-between rounded border border-vp-border bg-vp-bg/40 px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest text-vp-muted">
                    <span className="flex items-center gap-1.5">
                      <Heart size={10} className="text-vp-hr" />
                      Avg HR <span className="text-vp-text">{outcome.avgHr}</span> BPM
                    </span>
                    <span>{session.stats.avgCadence || 0} RPM</span>
                  </div>

                  {hrrScore !== null && (
                    <div className="mb-3 flex items-center justify-between rounded border border-emerald-400/15 bg-emerald-400/5 px-2 py-1.5 text-[9px] font-mono uppercase tracking-widest">
                      <span className="flex items-center gap-1.5 text-emerald-300">
                        <Heart size={10} fill="currentColor" />
                        HRR
                      </span>
                      <span className="text-vp-text">
                        {hrrScore} BPM <span className="text-emerald-300/70">{session.stats.hrrClassification || ''}</span>
                      </span>
                    </div>
                  )}

                  <div className="mt-auto flex justify-between items-center pt-3 border-t border-vp-border">
                    <span className="text-[9px] text-vp-accent uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      {isSelectionMode ? (isSelected ? 'Deselect' : 'Select') : 'View Details'}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {session.synced_to_supabase ? (
                        <div className="flex text-[9px] text-emerald-400 font-mono uppercase tracking-widest items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded">
                          <Cloud size={9} />
                          Supabase
                        </div>
                      ) : (
                        <div className="flex text-[9px] text-yellow-300 font-mono uppercase tracking-widest items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded">
                          <CloudOff size={9} />
                          Pending
                        </div>
                      )}
                      {session.synced_to_google ? (
                        <div className="flex text-[9px] text-green-500 font-mono uppercase tracking-widest items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded">
                          Google Fit
                        </div>
                      ) : null}
                    </div>
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
