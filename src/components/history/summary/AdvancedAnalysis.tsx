import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { AdvancedSummary, IntensitySummary } from '@/lib/history-types';
import type { TrainingLoadMetrics } from '@/lib/training-load';
import { formatDuration } from '@/utils/formatters';
import { LoadTrendChart } from './LoadTrendChart';

const CTL_COLOR = '#35f0bd';
const ATL_COLOR = '#f5c542';

interface AdvancedAnalysisProps {
  intensity: IntensitySummary;
  advanced: AdvancedSummary;
  trainingLoadMetrics: TrainingLoadMetrics;
  rangeLabel: string;
}

/**
 * L2 panel of the Summary view: everything that informs *how much to trust* the
 * blocks above, plus the one long-horizon model.
 *
 * Collapsed by default. Its job is to keep the door open for a rider who wants
 * the detail (how much of the time was actually active, which sessions carry HR
 * or power, fitness versus fatigue, repetition risk and strain) without paying
 * for it on every visit.
 */
export const AdvancedAnalysis = ({ intensity, advanced, trainingLoadMetrics, rangeLabel }: AdvancedAnalysisProps) => {
  const { t, locale } = useI18n();
  const { coverage, loadTrend, bodyMetrics, hasWeight, bodyTrend } = advanced;

  const recordedSeconds = intensity.countedSeconds + intensity.belowZoneSeconds;
  const activePercent = recordedSeconds > 0
    ? Math.round((intensity.countedSeconds / recordedSeconds) * 100)
    : 0;

  // W/kg and kcal/kg/h are only rendered when the rider's weight is set; the
  // row keeps a single formatting rule so the two decimals cannot drift.
  const formatMetric = (value: number | null, digits: number) =>
    value === null
      ? '--'
      : value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const form = !loadTrend.established
    ? { label: t('Building baseline'), tone: 'text-white/45' }
    : loadTrend.tsb > 5
      ? { label: t('Fresh'), tone: 'text-emerald-300' }
      : loadTrend.tsb < -10
        ? { label: t('Fatigued'), tone: 'text-amber-300' }
        : { label: t('Neutral'), tone: 'text-white/70' };

  return (
    <details className="group rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
      <summary className="vp-focus-ring flex cursor-pointer list-none items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">
        <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
        {t('Advanced analysis')}
        <span className="tracking-[0.12em] text-white/25">
          {t('Duration, data coverage, fitness and fatigue')}
        </span>
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
          <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">
            {t('Active time')}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
            {formatDuration(intensity.countedSeconds)}
          </div>
          <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">
            {t('{percent}% of {total} recorded', {
              percent: activePercent,
              total: formatDuration(recordedSeconds),
            })}
          </div>
          <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">
            {rangeLabel}
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
          <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">
            {t('Data coverage')}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-mono uppercase tracking-[0.12em] text-white/60">
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              {coverage.sessions} {t('sessions')}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              HR {coverage.withHeartRate}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              {t('Power')} {coverage.withPower}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              HRR {coverage.withHrr}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              {t('HRV')} {coverage.withHrv}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-white/40">
            {t('Sessions without heart rate are excluded from the zone, load and recovery metrics.')}
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-black/20 px-4 py-3">
          <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">
            {t('Fitness & fatigue')}
          </div>
          {/* The area between the lines is TSB itself: emerald while fitness
              holds above fatigue, amber while fatigue is on top. It replaced the
              sparkline so the same two series are not drawn twice. */}
          <div className="mt-2">
            <LoadTrendChart
              ctlSeries={loadTrend.ctlSeries}
              atlSeries={loadTrend.atlSeries}
              label={t('Fitness and fatigue over the last {count} days', { count: loadTrend.days })}
              width={320}
              height={96}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
            <span className="flex items-baseline gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CTL_COLOR }} />
              {t('Fitness (CTL)')} <b className="text-white/80">{loadTrend.ctl}</b>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ATL_COLOR }} />
              {t('Fatigue (ATL)')} <b className="text-white/80">{loadTrend.atl}</b>
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
            {t('Form (TSB)')} <b className={form.tone}>{loadTrend.tsb}</b> · {form.label}
          </div>
          <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">
            {t('Last {count} days of Edwards TRIMP.', { count: loadTrend.days })}
          </div>
        </div>
      </div>

      {/* Body-mass normalised metrics live here (L2) rather than in RangeTotals:
          they are a different scale of the same power/energy numbers already
          shown in L1, so they must not compete for the first-screen budget. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
        <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-hw-muted">
          {t('Per body mass')}
        </div>
        {hasWeight && bodyMetrics ? (
          <div
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45"
            title={`${bodyMetrics.avgPower} W · ${bodyMetrics.peakPower} W`}
          >
            <span>
              {t('Avg W/kg')}{' '}
              <b className="text-base text-white/85 tabular-nums">{formatMetric(bodyMetrics.avgWkg, 2)}</b>
            </span>
            <span>
              {t('Peak W/kg')}{' '}
              <b className="text-base text-white/85 tabular-nums">{formatMetric(bodyMetrics.peakWkg, 2)}</b>
            </span>
            <span>
              {t('kcal/kg/h')}{' '}
              <b className="text-base text-white/85 tabular-nums">{formatMetric(bodyMetrics.kcalPerKgHour, 1)}</b>
            </span>
          </div>
        ) : (
          <p className="text-[10px] leading-4 text-white/40">
            {t('Add your weight in Settings to see W/kg and kcal/kg per hour.')}
          </p>
        )}
      </div>

      {/* Dated body trend: the per-kilogram numbers above only mean something
          across months if the body they were divided by is visible. */}
      {(bodyTrend.weight || bodyTrend.restingHr) && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
          <span className="text-[8px] tracking-[0.2em] text-hw-muted">{t('Body trend')}</span>
          {bodyTrend.weight && (
            <span>
              {t('Weight')}{' '}
              <b className="text-white/85 tabular-nums">
                {formatMetric(bodyTrend.weight.first.value, 1)} → {formatMetric(bodyTrend.weight.last.value, 1)} kg
              </b>
              {bodyTrend.weight.count > 1 && (
                <span className={bodyTrend.weight.delta <= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                  {' '}
                  {bodyTrend.weight.delta > 0 ? '+' : ''}
                  {formatMetric(bodyTrend.weight.delta, 1)}
                </span>
              )}
            </span>
          )}
          {bodyTrend.restingHr && (
            <span>
              {t('Resting HR')}{' '}
              <b className="text-white/85 tabular-nums">
                {formatMetric(bodyTrend.restingHr.first.value, 0)} → {formatMetric(bodyTrend.restingHr.last.value, 0)} bpm
              </b>
            </span>
          )}
          <span className="text-[8px] tracking-[0.12em] text-white/25">
            {t('From {count} entries on this device', { count: Math.max(bodyTrend.weight?.count ?? 0, bodyTrend.restingHr?.count ?? 0) })}
          </span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/50">
              {t('Repetition risk')}
            </div>
            <div className="font-mono text-xl font-bold text-white tabular-nums">
              {trainingLoadMetrics.monotony.toFixed(2)}
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/50">
            {t('Higher means your daily training load is very similar, with less easy/hard variation.')}
          </p>
        </div>

        <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/50">
              {t('Overall strain')}
            </div>
            <div className="font-mono text-xl font-bold text-white tabular-nums">
              {trainingLoadMetrics.strain}
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/50">
            {t('Combines weekly load and repetition risk; useful when deciding whether to back off.')}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">
        {t('Repetition risk and strain describe the last 4 weeks; the rest of this panel follows the selected range.')}
      </p>
    </details>
  );
};
