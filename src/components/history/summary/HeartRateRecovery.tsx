import { useI18n } from '@/i18n';
import type { GlobalSummary } from '@/lib/history-types';
import { Sparkline } from './Sparkline';

interface HeartRateRecoveryProps {
  globalSummary: GlobalSummary;
}

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
        <Sparkline series={[{ values: series, color: '#35f0bd' }]} label={t('Heart Rate Recovery')} />
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
