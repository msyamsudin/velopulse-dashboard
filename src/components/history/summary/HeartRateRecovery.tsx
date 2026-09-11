import { useI18n } from '@/i18n';
import type { GlobalSummary } from '@/lib/history-types';

interface HeartRateRecoveryProps {
  globalSummary: GlobalSummary;
}

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 26;

/**
 * Inline HRR sparkline. Deliberately a hand-rolled SVG rather than a chart
 * library: it is a single 96×26 row inside the load card, not a plot.
 */
const Sparkline = ({ values, label }: { values: number[]; label: string }) => {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (SPARK_WIDTH - 4) + 2;
    const y = SPARK_HEIGHT - 3 - ((value - min) / span) * (SPARK_HEIGHT - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lastX, lastY] = points[points.length - 1].split(',');

  return (
    <svg
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      role="img"
      aria-label={`${label}: ${values.join(', ')}`}
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#35f0bd"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="#35f0bd" />
    </svg>
  );
};

/**
 * One compact row: how heart-rate recovery is trending across the range.
 *
 * The HRR score is already stored per session; the row shows the chronological
 * trend plus the latest value against the rider's own earlier sessions, which
 * is the only fitness-direction signal the recorded data supports.
 */
export const HeartRateRecovery = ({ globalSummary }: HeartRateRecoveryProps) => {
  const { t } = useI18n();
  const series = globalSummary.hrrSeries;
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const previous = series.slice(0, -1);
  const baseline = previous.length > 0
    ? Math.round(previous.reduce((total, value) => total + value, 0) / previous.length)
    : null;
  const latestDelta = latest !== null && baseline !== null ? latest - baseline : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300">
            {t('Heart Rate Recovery')}
          </div>
          <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">
            {globalSummary.hrrSessions}/{globalSummary.totalSessions} {t('sessions')}
          </div>
        </div>
        <Sparkline values={series} label={t('Heart Rate Recovery')} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/45">
        <span>
          {t('Avg HRR')} <b className="text-white/80">{globalSummary.avgHrr ?? '--'}</b> BPM
        </span>
        <span>
          {t('Best HRR')} <b className="text-white/80">{globalSummary.bestHrr ?? '--'}</b> BPM
        </span>
        <span>
          {t('Latest')} <b className="text-white/80">{latest ?? '--'}</b> BPM
          {latestDelta !== null && (
            // A larger 2-minute HR drop is better recovery: up is good, down is a watch signal.
            <b className={`ml-1 ${latestDelta > 0 ? 'text-emerald-300' : latestDelta < 0 ? 'text-amber-300' : 'text-white/50'}`}>
              {latestDelta > 0 ? '+' : ''}{latestDelta}
            </b>
          )}
        </span>
      </div>
    </div>
  );
};
