import type { ReactNode } from 'react';
import { Route, Zap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { formatDuration } from '@/utils/formatters';
import type { BestEffort, BestEffortsSummary } from '@/lib/best-efforts';

interface BestEffortsProps {
  bestEfforts: BestEffortsSummary;
  onSelectSession?: (id: string) => void;
}

interface EffortRow {
  effort: BestEffort;
  valueText: string;
  unit: string;
  /** Bar width (%), scaled per column — see `buildRows`. */
  percent: number;
}

const formatRecordDate = (iso: string, locale: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Best-efforts block of the Records tab: the sustained-power windows and the
 * fastest splits, each row carrying the session that holds it.
 *
 * The four power windows are categorical, so they are drawn as bars (the shape
 * of the power-duration curve: bars shorten as the window grows) rather than as
 * a chart with a fake continuous x-axis. Splits scale their bar by the implied
 * speed, so "longer bar" keeps meaning "better" in both columns.
 *
 * This is a Records-tab block (L3): it never competes with the Summary's
 * first-screen budget, and the six single-number records above keep their place.
 */
export const BestEfforts = ({ bestEfforts, onSelectSession }: BestEffortsProps) => {
  const { t, locale } = useI18n();
  const { power, distance } = bestEfforts;

  // Nothing to show at all: the records grid above already explains the empty
  // state, so a second one would only be noise.
  if (power.length === 0 && distance.length === 0) return null;

  const buildRows = (efforts: BestEffort[], kind: 'power' | 'distance'): EffortRow[] => {
    // Splits are times (lower is better), so their bar length is the implied
    // speed; power windows are watts, where the value itself is the score.
    const scoreOf = (effort: BestEffort) =>
      kind === 'distance' ? (effort.value > 0 ? effort.target / effort.value : 0) : effort.value;
    const maxScore = efforts.reduce((max, effort) => Math.max(max, scoreOf(effort)), 0);

    return efforts.map(effort => ({
      effort,
      valueText: kind === 'distance' ? formatDuration(effort.value) : `${effort.value}`,
      unit: kind === 'distance' ? '' : 'W',
      percent: maxScore > 0 ? Math.max(3, Math.min(100, (scoreOf(effort) / maxScore) * 100)) : 0,
    }));
  };

  const columns: { title: string; icon: ReactNode; empty: string; tone: string; rows: EffortRow[] }[] = [
    {
      title: 'Sustained power',
      icon: <Zap size={12} />,
      empty: 'No power data in this scope',
      tone: 'bg-yellow-400/60',
      rows: buildRows(power, 'power'),
    },
    {
      title: 'Fastest splits',
      icon: <Route size={12} />,
      empty: 'No distance data in this scope',
      tone: 'bg-blue-400/60',
      rows: buildRows(distance, 'distance'),
    },
  ];

  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-accent">
          {t('Best efforts')}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">
          {t('Sustained windows and fastest splits in the record scope')}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
        {columns.map(column => (
          <div key={column.title}>
            <div className="flex items-center gap-1.5 text-white/60">
              <span className="text-hw-muted">{column.icon}</span>
              <span className="text-[9px] font-mono uppercase tracking-[0.16em]">{t(column.title)}</span>
            </div>

            {column.rows.length === 0 ? (
              <p className="mt-2 text-[10px] leading-4 text-white/35">{t(column.empty)}</p>
            ) : (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {column.rows.map(({ effort, valueText, unit, percent }) => {
                  const dateLabel = formatRecordDate(effort.date, locale);
                  const content = (
                    <>
                      <span className="w-11 shrink-0 text-[9px] font-mono uppercase tracking-[0.1em] text-white/45">
                        {t(effort.label)}
                      </span>
                      <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5">
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full ${column.tone}`}
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-white">
                        {valueText}
                      </span>
                      <span className="w-4 shrink-0 text-[8px] font-mono uppercase tracking-[0.08em] text-white/35">
                        {unit}
                      </span>
                      <span className="w-[76px] shrink-0 text-right text-[8px] font-mono uppercase tracking-[0.06em] text-white/30">
                        {dateLabel}
                      </span>
                    </>
                  );

                  if (!onSelectSession) {
                    return (
                      <div key={effort.target} className="flex items-center gap-2 px-2 py-1.5">
                        {content}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={effort.target}
                      type="button"
                      onClick={() => onSelectSession(effort.sessionId)}
                      title={t('Open the session behind this record')}
                      className="vp-focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
