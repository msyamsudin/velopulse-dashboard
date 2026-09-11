import { Activity, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { GlobalSummary, WeeklyLoadPoint } from '@/lib/history-types';
import type { TrainingLoadMetrics } from '@/lib/training-load';
import { LoadRatioGauge } from './LoadRatioGauge';
import { WeeklyLoadChart } from './WeeklyLoadChart';
import { HeartRateRecovery } from './HeartRateRecovery';
import type { LoadRatioDot } from './useHistorySummary';

interface LoadGuidanceProps {
  trainingLoadMetrics: TrainingLoadMetrics;
  globalSummary: GlobalSummary;
  loadRatio: number | null;
  loadRatioStatus: string;
  loadRatioDelta: string;
  loadRatioDots: LoadRatioDot[];
  loadRatioChartData: WeeklyLoadPoint[];
  loadRatioChartMax: number;
  loadAnalysisText: string;
  loadAnalysisSummary: string;
  loadAnalysisDetail: string;
}

const statusTone = (loadRatio: number | null) => {
  if (loadRatio === null) return 'border-white/12 bg-white/5 text-white/55';
  if (loadRatio < 0.8) return 'border-blue-400/25 bg-blue-400/10 text-blue-200';
  if (loadRatio <= 1.3) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
  if (loadRatio <= 1.5) return 'border-yellow-400/25 bg-yellow-400/10 text-yellow-200';
  return 'border-red-400/25 bg-red-400/10 text-red-200';
};

const recommendationTone = (recommendation: TrainingLoadMetrics['recommendation']) => {
  if (recommendation === 'Recovery') return 'border-orange-400/30 bg-orange-400/10 text-orange-300';
  if (recommendation === 'Build') return 'border-blue-400/30 bg-blue-400/10 text-blue-300';
  return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
};

/**
 * Block 3 of the Summary view: training load and recovery in one card.
 *
 * Everything that used to be repeated across six sub-panels now appears once —
 * the recommendation badge, the ratio (only inside the gauge), the week/usual
 * week pair, and the status badge. The long explanations, the practical
 * recommendation and the advanced signals live in the collapsed detail, so the
 * visible card answers "how hard was this week, and what next?" at a glance.
 */
export const LoadGuidance = ({
  trainingLoadMetrics,
  globalSummary,
  loadRatio,
  loadRatioStatus,
  loadRatioDelta,
  loadRatioDots,
  loadRatioChartData,
  loadRatioChartMax,
  loadAnalysisText,
  loadAnalysisSummary,
  loadAnalysisDetail,
}: LoadGuidanceProps) => {
  const { t } = useI18n();
  const { acuteLoad, chronicLoad } = trainingLoadMetrics;
  // The band that keeps the acute:chronic ratio inside the balanced zone.
  const targetLow = chronicLoad > 0 ? Math.round(chronicLoad * 0.8) : null;
  const targetHigh = chronicLoad > 0 ? Math.round(chronicLoad * 1.3) : null;

  const cells = [
    { key: 'acute', label: t('This week'), value: `${acuteLoad}`, detail: t('Total load in the last 7 days') },
    { key: 'chronic', label: t('Usual week'), value: `${chronicLoad}`, detail: t('Your 3-week baseline') },
    {
      key: 'target',
      label: t('Target next week'),
      value: targetLow === null || targetHigh === null ? '--' : `${targetLow}–${targetHigh}`,
      detail: t('Balanced zone is 0.8 to 1.3'),
    },
  ];

  return (
    <section className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-400/10 pb-3">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-blue-300">
            <Activity size={12} />
            {t('Load & recovery')}
          </div>
          <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-white/45">
            {t('7-day load compared with a 3-week baseline')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.14em] ${statusTone(loadRatio)}`}>
            {loadRatioStatus}
          </span>
          <span className={`rounded border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.14em] ${recommendationTone(trainingLoadMetrics.recommendation)}`}>
            {t(trainingLoadMetrics.recommendation)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cells.map(cell => (
          <div key={cell.key} className="rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
            <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{cell.label}</div>
            <div className="mt-1 text-2xl font-bold font-mono text-blue-200 tabular-nums">
              {cell.value} <span className="text-[9px] font-normal text-white/35">TRIMP</span>
            </div>
            <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">{cell.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
          <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Load Ratio')}</div>
          <LoadRatioGauge
            loadRatio={loadRatio}
            loadRatioDelta={loadRatioDelta}
            loadRatioDots={loadRatioDots}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-blue-400/15 bg-black/20">
          <WeeklyLoadChart
            loadRatioChartData={loadRatioChartData}
            loadRatioChartMax={loadRatioChartMax}
            acuteLoad={acuteLoad}
            chronicLoad={chronicLoad}
          />
        </div>
      </div>

      {globalSummary.hrrSessions > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-4 py-2.5">
          <HeartRateRecovery globalSummary={globalSummary} />
        </div>
      )}

      <details className="group mt-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
        <summary className="vp-focus-ring flex cursor-pointer list-none items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">
          <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
          {t('Load detail')}
          <span className="tracking-[0.12em] text-white/30">{t('Plain-language readout')}</span>
        </summary>

        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-vp-text">
            {loadAnalysisText} <span className="text-white/70">{loadAnalysisSummary}</span>
          </p>
          <p className="border-t border-white/6 pt-2 text-xs leading-5 text-white/50">
            {loadAnalysisDetail}
          </p>
          <p className="text-xs leading-5 text-white/40">
            {t('A ratio near 1.0 means this week is close to your usual load. Above 1.3 means the week is ramping up.')}
          </p>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">
              {t('Practical recommendation')}
            </div>
            <p className="mt-2 text-sm leading-6 text-white/70">{t(trainingLoadMetrics.recommendationDetail)}</p>
            <p className="mt-2 border-t border-white/6 pt-2 text-[10px] leading-5 text-white/40">
              {t('Guidance is based only on recorded heart-rate load. Check your actual fatigue, sleep, soreness, illness, pain, and recovery before deciding how to train.')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/50">{t('Repetition risk')}</div>
                <div className="font-mono text-xl font-bold text-white tabular-nums">{trainingLoadMetrics.monotony.toFixed(2)}</div>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/50">{t('Higher means your daily training load is very similar, with less easy/hard variation.')}</p>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-white/50">{t('Overall strain')}</div>
                <div className="font-mono text-xl font-bold text-white tabular-nums">{trainingLoadMetrics.strain}</div>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/50">{t('Combines weekly load and repetition risk; useful when deciding whether to back off.')}</p>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
};
