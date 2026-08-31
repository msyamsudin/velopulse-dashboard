import { Activity } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { WeeklyLoadPoint } from '@/lib/history-types';
import type { TrainingLoadMetrics } from '@/lib/training-load';
import { LoadRatioGauge } from './LoadRatioGauge';
import { WeeklyLoadChart } from './WeeklyLoadChart';
import type { LoadRatioDot } from './useHistorySummary';

interface LoadGuidanceProps {
  trainingLoadMetrics: TrainingLoadMetrics;
  loadRatio: number | null;
  baselineDelta: number | null;
  baselineDeltaLabel: string;
  loadRatioStatus: string;
  loadRatioDelta: string;
  loadRatioDots: LoadRatioDot[];
  loadRatioChartData: WeeklyLoadPoint[];
  loadRatioChartMax: number;
  loadAnalysisText: string;
  loadAnalysisSummary: string;
  loadAnalysisDetail: string;
}

export const LoadGuidance = ({
  trainingLoadMetrics,
  loadRatio,
  baselineDelta,
  baselineDeltaLabel,
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

  return (
    <div className="hardware-card border-blue-400/20 bg-blue-400/5 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-blue-400/10 pb-3">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.2em] text-blue-300">
            <Activity size={12} />
            {t('Load Guidance')}
          </div>
          <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.12em] text-white/45">
            {t('7-day load compared with a 3-week baseline')}
          </div>
        </div>
        <div className={`rounded border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] ${
          trainingLoadMetrics.recommendation === 'Recovery'
            ? 'border-orange-400/30 bg-orange-400/10 text-orange-300'
            : trainingLoadMetrics.recommendation === 'Build'
              ? 'border-blue-400/30 bg-blue-400/10 text-blue-300'
              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
        }`}>
          {t(trainingLoadMetrics.recommendation)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('This week'), value: trainingLoadMetrics.acuteLoad, detail: t('Total load in the last 7 days') },
          { label: t('Usual week'), value: trainingLoadMetrics.chronicLoad, detail: t('Your 3-week baseline') },
          { label: t('Load Ratio'), value: trainingLoadMetrics.acuteChronicRatio?.toFixed(2) ?? '--', detail: t('This week / usual week') },
          { label: t('Recommendation'), value: t(trainingLoadMetrics.recommendation), detail: t('Suggested next training focus') },
        ].map(metric => (
          <div key={metric.label} className="rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
            <div className="text-[8px] text-hw-muted uppercase font-mono tracking-[0.2em]">{metric.label}</div>
            <div className="mt-1 text-2xl font-bold font-mono text-blue-200 tabular-nums">{metric.value}</div>
            <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">{metric.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Week vs baseline')}</div>
              <div className="mt-1 text-[10px] text-white/40">{t('Compare your last 7 days with your normal training week')}</div>
            </div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-white/35">TRIMP</div>
          </div>
          <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-vp-muted">{t('Interpretation')}</div>
              <div className="font-mono text-lg font-bold text-vp-text tabular-nums">{loadRatio?.toFixed(2) ?? '--'}x</div>
            </div>
            <p className="mt-1 text-xs leading-5 text-white/55">
              {t('A ratio near 1.0 means this week is close to your usual load. Above 1.3 means the week is ramping up.')}
            </p>
          </div>
          <div className="mt-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-blue-400/15 bg-blue-400/8 px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-blue-200">{t('This week')}</div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-lg font-bold text-white tabular-nums">{trainingLoadMetrics.acuteLoad}</span>
                  <span className="text-[9px] font-mono uppercase text-white/40">TRIMP</span>
                </div>
              </div>
              <div className="rounded-md border border-purple-400/15 bg-purple-400/8 px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-purple-200">{t('Usual week')}</div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-lg font-bold text-white tabular-nums">{trainingLoadMetrics.chronicLoad}</span>
                  <span className="text-[9px] font-mono uppercase text-white/40">TRIMP</span>
                </div>
              </div>
              <div className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-[0.14em] text-white/45">{t('Difference')}</div>
                <span className={`font-mono text-lg font-bold tabular-nums ${
                  baselineDelta === null
                    ? 'text-white/55'
                    : baselineDelta > 30
                      ? 'text-red-200'
                      : baselineDelta > 0
                        ? 'text-yellow-200'
                        : 'text-blue-200'
                }`}>{baselineDeltaLabel}</span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/50">
              {t('This comparison only shows volume. Use Load Ratio for the training-status view.')}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-blue-400/15 bg-black/20">
          <div className="border-b border-blue-400/10 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Load Ratio')}</div>
                <div className="mt-1 text-[10px] text-white/40">{t('Balanced zone is 0.8 to 1.3')}</div>
              </div>
              <div className="rounded-md border border-blue-400/20 bg-blue-400/8 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-blue-100">
                {loadRatioStatus}
              </div>
            </div>

            <LoadRatioGauge
              loadRatio={loadRatio}
              loadRatioDelta={loadRatioDelta}
              loadRatioDots={loadRatioDots}
            />
          </div>

          <WeeklyLoadChart
            loadRatioChartData={loadRatioChartData}
            loadRatioChartMax={loadRatioChartMax}
            acuteLoad={trainingLoadMetrics.acuteLoad}
            chronicLoad={trainingLoadMetrics.chronicLoad}
          />
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-blue-400/15 bg-black/20 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Load analysis')}</div>
            <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.12em] text-white/38">{t('Plain-language readout')}</div>
          </div>
          <div className={`rounded border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.14em] ${
            loadRatio === null
              ? 'border-white/12 bg-white/5 text-white/55'
              : loadRatio < 0.8
                ? 'border-blue-400/25 bg-blue-400/10 text-blue-200'
                : loadRatio <= 1.3
                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                  : loadRatio <= 1.5
                    ? 'border-yellow-400/25 bg-yellow-400/10 text-yellow-200'
                    : 'border-red-400/25 bg-red-400/10 text-red-200'
          }`}>
            {loadRatioStatus}
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-vp-text">
          {loadAnalysisText} <span className="text-white/70">{loadAnalysisSummary}</span>
        </p>
        <p className="mt-2 border-t border-white/6 pt-2 text-xs leading-5 text-white/50">
          {loadAnalysisDetail}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
        <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Practical recommendation')}</div>
        <p className="mt-2 text-sm leading-6 text-white/70">{t(trainingLoadMetrics.recommendationDetail)}</p>
        <p className="mt-2 border-t border-white/6 pt-2 text-[10px] leading-5 text-white/40">
          {t('Guidance is based only on recorded heart-rate load. Check your actual fatigue, sleep, soreness, illness, pain, and recovery before deciding how to train.')}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
        <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-blue-300">{t('Advanced load signals')}</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    </div>
  );
};
