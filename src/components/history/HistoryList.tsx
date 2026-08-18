import { Calendar, Clock, Zap, Route, Flame, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate, formatDuration } from '../../utils/formatters';
import { getSessionOutcome, getWorkoutQuality } from '../../lib/workout-analysis';
import { EmptyState, StatusPill } from '../ui';
import { useI18n } from '@/i18n';
import type { WorkoutSession } from '@/store/useWorkoutStore';

interface HistoryListProps {
  sessions: WorkoutSession[];
  maxHr: number;
  onSelectSession: (id: string) => void;
  isSelectionMode?: boolean;
  selectedSessionIds?: string[];
  onToggleSelectSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
}

const MetricCell = ({ label, icon, colorClass, value }: { label: string; icon: ReactNode; colorClass: string; value: ReactNode }) => (
  <div className="flex flex-col rounded border border-vp-border bg-vp-bg/40 p-2">
    <span className="mb-1 text-[9px] text-vp-muted uppercase font-mono">{label}</span>
    <div className={`flex items-center gap-1.5 font-bold text-base tabular-nums ${colorClass}`}>
      {icon} {value}
    </div>
  </div>
);

export const HistoryList = ({
  sessions,
  maxHr,
  onSelectSession,
  isSelectionMode = false,
  selectedSessionIds = [],
  onToggleSelectSession,
  onDeleteSession
}: HistoryListProps) => {
  const { t } = useI18n();
  const groupedSessions = sessions.reduce<Array<{
    key: string;
    label: string;
    sessions: WorkoutSession[];
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
    <div className="flex flex-col gap-5">
      {groupedSessions.map(group => (
        <section key={group.key} className="flex flex-col gap-3">
          <div className="sticky top-0 z-10 flex flex-col justify-between gap-2 rounded-lg border border-vp-border bg-vp-bg/90 px-4 py-2.5 backdrop-blur-xl sm:flex-row sm:items-center">
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
                    <MetricCell label="Distance" colorClass="text-vp-distance" icon={<Route size={12} />} value={<>{outcome.distanceKm.toFixed(2)}<span className="text-[10px] font-normal opacity-50">KM</span></>} />
                    <MetricCell label="Duration" colorClass="text-vp-text" icon={<Clock size={12} />} value={formatDuration(outcome.duration)} />
                    <MetricCell label="Calories" colorClass="text-vp-calories" icon={<Flame size={12} />} value={<>{outcome.calories}<span className="text-[10px] font-normal opacity-50">KCAL</span></>} />
                    <MetricCell label="Avg Power" colorClass="text-vp-power" icon={<Zap size={12} />} value={<>{outcome.avgPower}<span className="text-[10px] font-normal opacity-50">W</span></>} />
                  </div>

                  <div className="mt-auto flex justify-between items-center pt-3 border-t border-vp-border">
                    <span className="text-[9px] text-vp-accent uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      {isSelectionMode ? (isSelected ? 'Deselect' : 'Select') : 'View Details'}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!isSelectionMode && onDeleteSession && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          aria-label={t('Delete workout session')}
                          title={t('Delete workout session')}
                          className="vp-focus-ring flex h-6 w-6 items-center justify-center rounded border border-vp-danger/25 bg-vp-danger/5 text-vp-danger/70 transition-colors hover:border-vp-danger/60 hover:bg-vp-danger hover:text-white"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                      {session.synced_to_supabase ? (
                        <span
                          title={t('Supabase synced')}
                          className="h-2 w-2 rounded-full bg-emerald-400"
                        />
                      ) : (
                        <span
                          title={t('pending sync')}
                          className="h-2 w-2 rounded-full bg-yellow-300"
                        />
                      )}
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
