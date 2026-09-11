import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Trophy, Timer, Route, Flame, Zap, Gauge, Activity, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { getPersonalRecords, type PersonalRecord } from '@/lib/workout-analysis';
import { formatDuration } from '@/utils/formatters';
import type { WorkoutSession } from '@/store/useWorkoutStore';
import { RANGE_OPTIONS, RECORD_RANGE_DAYS, type SummaryRange } from './summary/constants';
import { MilestoneProgressBanner } from './MilestoneProgressBanner';

interface RecordsOverviewProps {
  sessions: WorkoutSession[];
  onSelectSession?: (id: string) => void;
}

const RECORD_META: Record<string, { icon: ReactNode; color: string; chip: string }> = {
  'Longest Ride': {
    icon: <Timer size={14} />,
    color: 'text-amber-300',
    chip: 'bg-amber-400/10 border-amber-400/20',
  },
  'Best Distance': {
    icon: <Route size={14} />,
    color: 'text-cyan-300',
    chip: 'bg-cyan-400/10 border-cyan-400/20',
  },
  'Top Calories': {
    icon: <Flame size={14} />,
    color: 'text-pink-400',
    chip: 'bg-pink-400/10 border-pink-400/20',
  },
  'Best Avg Power': {
    icon: <Zap size={14} />,
    color: 'text-yellow-300',
    chip: 'bg-yellow-400/10 border-yellow-400/20',
  },
  'Peak Power': {
    icon: <Gauge size={14} />,
    color: 'text-purple-400',
    chip: 'bg-purple-400/10 border-purple-400/20',
  },
  'Fastest Avg Speed': {
    icon: <Activity size={14} />,
    color: 'text-blue-400',
    chip: 'bg-blue-400/10 border-blue-400/20',
  },
};

const getRecordMeta = (title: string) =>
  RECORD_META[title] ?? { icon: <Trophy size={14} />, color: 'text-hw-accent', chip: 'bg-white/10 border-white/10' };

const formatUnit = (unit: string) => {
  const map: Record<string, string> = { min: 'MIN', km: 'KM', kcal: 'KCAL', w: 'W', 'km/h': 'KM/H' };
  return map[unit] ?? unit.toUpperCase();
};

export const RecordsOverview = ({ sessions, onSelectSession }: RecordsOverviewProps) => {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<SummaryRange>('all');

  const rangeLabel = t(range === '7d'
    ? '7 days'
    : range === '30d'
      ? '30 days'
      : range === '90d'
        ? '90 days'
        : range === '1y'
          ? '1 year'
          : 'all time');

  const recordSessions = useMemo(() => {
    const days = RECORD_RANGE_DAYS[range];
    if (days === null) return sessions;

    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    return sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return !Number.isNaN(sessionDate.getTime()) && sessionDate >= start;
    });
  }, [sessions, range]);

  const personalRecords = useMemo<PersonalRecord[]>(
    () => getPersonalRecords(recordSessions, locale),
    [recordSessions, locale]
  );

  return (
    <div className="pb-8 flex flex-col gap-4">
      <MilestoneProgressBanner sessions={sessions} />

      {/* Header: title + period selector */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300">
            <Trophy size={16} />
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-accent">
              {t('Records')}
            </div>
            <div className="mt-0.5 text-[11px] text-white/50">
              {range === 'all'
                ? t('All-time best efforts — tap a card to open that session')
                : t('Best efforts from the selected period')}
            </div>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-white/10 bg-black/20">
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`px-2.5 py-2 text-[9px] font-mono font-bold uppercase tracking-widest transition-colors ${range === option.value ? 'bg-white/10 text-white' : 'text-hw-muted hover:text-white'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {personalRecords.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {personalRecords.map(record => {
            const meta = getRecordMeta(record.title);
            // Longest Ride carries the exact duration in seconds; show it with
            // second precision instead of the rounded display minutes.
            const showDuration = record.title === 'Longest Ride' && typeof record.seconds === 'number';
            const valueText = showDuration ? formatDuration(record.seconds ?? 0) : record.value;
            const unitText = showDuration ? null : formatUnit(record.unit);
            return (
              <button
                key={record.title}
                type="button"
                onClick={() => onSelectSession?.(record.sessionId)}
                className="group rounded-xl border border-white/8 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-4 text-left transition-all hover:border-hw-accent/40 hover:bg-white/[0.06]"
                title={t('Open the session behind this record')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[8px] font-mono uppercase tracking-[0.16em] ${meta.chip} ${meta.color}`}>
                    {meta.icon}
                    <span>{t(record.title)}</span>
                  </div>
                  <ChevronRight size={13} className="shrink-0 text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-hw-accent" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                    {valueText}
                  </span>
                  {unitText && (
                    <span className="text-[10px] font-mono font-bold tracking-widest text-white/35">
                      {unitText}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-[9px] font-mono uppercase tracking-[0.12em] text-hw-accent/70">
                  {t(record.dateLabel)}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
          <Trophy size={20} className="mx-auto mb-2 text-white/25" />
          <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">
            {t('No records in this period')}
          </div>
          <div className="mt-1 text-[10px] text-white/35">
            {range === 'all' ? t('Record a workout to set your first personal record') : t('Try the all-time range')}
          </div>
        </div>
      )}

      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-white/35">
        {t('{count} sessions in record scope', { count: recordSessions.length })} · {t('Range')}: {rangeLabel}
      </div>
    </div>
  );
};
