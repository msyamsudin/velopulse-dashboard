import { useI18n } from '@/i18n';
import type { LoadRatioDot } from './useHistorySummary';

interface LoadRatioGaugeProps {
  loadRatio: number | null;
  loadRatioDelta: string;
  loadRatioDots: LoadRatioDot[];
}

export const LoadRatioGauge = ({ loadRatio, loadRatioDelta, loadRatioDots }: LoadRatioGaugeProps) => {
  const { t } = useI18n();

  return (
    <div className="mx-auto mt-5 max-w-[520px]">
      <div className="text-center">
        <div className="font-mono text-4xl font-bold leading-none tabular-nums text-vp-text drop-shadow">
          {loadRatio?.toFixed(2) ?? '--'}
        </div>
        <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-vp-muted">
          {loadRatioDelta} {t('load change')}
        </div>
      </div>

      <div className="relative mt-5 px-1" role="img" aria-label={`${t('Current load ratio')} ${loadRatio?.toFixed(2) ?? '--'}`}>
        <div className="grid grid-cols-[repeat(37,minmax(0,1fr))] items-center gap-1.5">
          {loadRatioDots.map((dot, index) => (
            <div key={index} className="flex h-5 items-center justify-center">
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: dot.isCurrent ? 14 : dot.isPast ? 9 : 7,
                  height: dot.isCurrent ? 14 : dot.isPast ? 9 : 7,
                  backgroundColor: dot.isPast ? dot.color : 'rgba(255,255,255,0.13)',
                  border: dot.isCurrent ? '2px solid #f4f7f8' : '0 solid transparent',
                  boxShadow: dot.isCurrent ? '0 0 0 6px rgba(244,247,248,0.08)' : 'none',
                  opacity: dot.isCurrent ? 1 : dot.isPast ? 0.95 : 0.75,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-mono text-white/45">
          <span>0</span>
          <span>0.8</span>
          <span>1.3</span>
          <span>1.5</span>
          <span>2+</span>
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-mono uppercase tracking-wider text-vp-muted">
          <span>{t('Low')}</span>
          <span>{t('Balanced')}</span>
          <span>{t('High')}</span>
        </div>
      </div>
    </div>
  );
};
