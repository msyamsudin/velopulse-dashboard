import { useI18n } from '@/i18n';
import { RANGE_OPTIONS, type SummaryRange } from './constants';

interface SummaryHeaderProps {
  summaryRange: SummaryRange;
  setSummaryRange: (range: SummaryRange) => void;
}

export const SummaryHeader = ({ summaryRange, setSummaryRange }: SummaryHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-accent">
          {t('Summary')}
        </div>
        <div className="mt-1 text-[11px] text-white/50">
          {t('Overview, trends, and training load')}
        </div>
      </div>
      <div className="flex overflow-hidden rounded-lg border border-white/10 bg-black/20">
        {RANGE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSummaryRange(option.value)}
            className={`px-2.5 py-2 text-[9px] font-mono font-bold uppercase tracking-widest transition-colors ${summaryRange === option.value ? 'bg-white/10 text-white' : 'text-hw-muted hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
