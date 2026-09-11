import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { ComparisonSummary, GlobalSummary, MetricDelta, SummaryInsights } from '@/lib/history-types';

/**
 * Block 1 of the Summary view: the range totals plus their delta against the
 * previous period, followed by one compact caption line.
 *
 * This block absorbs what used to be three separate card grids (QuickStats,
 * TrainingLoadOverview, and the Range Comparison half of SummaryInsights) so
 * every headline figure appears exactly once on the page.
 */
type TotalsKey = 'distance' | 'duration' | 'calories' | 'trimp' | 'sessions';

interface RangeTotalsProps {
  globalSummary: GlobalSummary;
  comparisonSummary: ComparisonSummary | null;
  summaryInsights: SummaryInsights | null;
}

/**
 * Colour follows meaning, not direction: more distance is good news, while a
 * surging training load is a warning — the same stance Load Guidance takes.
 */
const DELTA_TONE: Record<TotalsKey, { up: string; down: string }> = {
  distance: { up: 'text-emerald-300', down: 'text-rose-300' },
  duration: { up: 'text-emerald-300', down: 'text-rose-300' },
  calories: { up: 'text-emerald-300', down: 'text-rose-300' },
  sessions: { up: 'text-emerald-300', down: 'text-rose-300' },
  trimp: { up: 'text-amber-300', down: 'text-blue-300' },
};

const DeltaBadge = ({ metric, delta }: { metric: TotalsKey; delta?: MetricDelta }) => {
  const { t } = useI18n();

  if (!delta || !delta.hasBaseline || delta.value === null) {
    return (
      <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/25">
        {t('No comparison')}
      </span>
    );
  }

  const tone = delta.direction === 'up'
    ? DELTA_TONE[metric].up
    : delta.direction === 'down'
      ? DELTA_TONE[metric].down
      : 'text-white/45';
  const Icon = delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : Minus;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-mono font-bold uppercase tracking-[0.12em] ${tone}`}>
      <Icon size={11} />
      {delta.direction === 'flat' ? '0%' : `${Math.abs(delta.value)}%`}
    </span>
  );
};

export const RangeTotals = ({
  globalSummary,
  comparisonSummary,
  summaryInsights,
}: RangeTotalsProps) => {
  const { t, locale } = useI18n();
  const deltas = comparisonSummary?.deltas;

  const cells = [
    { key: 'distance', label: t('Distance'), value: Number(globalSummary.totalDistance).toFixed(1), unit: 'KM' },
    { key: 'duration', label: t('Duration'), value: globalSummary.totalDuration, unit: '' },
    { key: 'calories', label: t('Calories'), value: globalSummary.totalCalories.toLocaleString(locale), unit: 'KCAL' },
    { key: 'trimp', label: t('Training Load'), value: `${Math.round(globalSummary.totalTrainingLoad)}`, unit: 'TRIMP' },
    { key: 'sessions', label: t('Sessions'), value: `${globalSummary.totalSessions}`, unit: '' },
  ] as const;

  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-accent">
          {t('Range totals')}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">
          {comparisonSummary?.label ?? t('No comparison')}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map(cell => (
          <div key={cell.key} className="rounded-lg border border-white/6 bg-black/20 px-3 py-2.5">
            <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-hw-muted">{cell.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-xl font-bold tabular-nums text-white">{cell.value}</span>
              {cell.unit && (
                <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-white/35">{cell.unit}</span>
              )}
            </div>
            <div className="mt-1">
              <DeltaBadge metric={cell.key} delta={deltas?.[cell.key]} />
            </div>
          </div>
        ))}
      </div>

      {summaryInsights && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/6 pt-2 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">
          <span>
            {t('Avg / Session')}{' '}
            <b className="text-white/70">{summaryInsights.avgDistancePerSession} KM</b>
          </span>
          <span className="text-white/15">·</span>
          <span>
            <b className="text-white/70">{summaryInsights.avgDurationPerSession}</b>
          </span>
          <span className="text-white/15">·</span>
          <span>
            {summaryInsights.activeDaysLabel} {t('active')}
          </span>
          <span className="text-white/15">·</span>
          <span>
            {t('Current Streak')} <b className="text-white/70">{summaryInsights.currentStreakLabel}</b>
          </span>
        </div>
      )}
    </section>
  );
};
