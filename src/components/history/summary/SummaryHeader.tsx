import { useI18n } from '@/i18n';
import { RANGE_OPTIONS, type SummaryRange } from './constants';

interface SummaryHeaderProps {
  summaryRange: SummaryRange;
  setSummaryRange: (range: SummaryRange) => void;
  sessionCount: number;
  rangeLabel: string;
  /** Single-sentence readout of the selected range; also the empty state. */
  headline: string;
}

/**
 * Sticky header of the Summary view.
 *
 * It owns the only range selector in the view and is rendered unconditionally —
 * including when the selected range has no sessions — so a user can never get
 * stuck on an empty Summary with no way to widen the range.
 */
export const SummaryHeader = ({
  summaryRange,
  setSummaryRange,
  sessionCount,
  rangeLabel,
  headline,
}: SummaryHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="sticky top-0 z-20 flex flex-col gap-3 rounded-xl border border-white/8 bg-vp-bg/92 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-accent">
          {t('Summary')}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-white/60">{headline}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">
          {sessionCount} {t('sessions')} · {rangeLabel}
        </span>
        <div
          role="radiogroup"
          aria-label={t('Range')}
          className="flex overflow-hidden rounded-lg border border-white/10 bg-black/20"
        >
          {RANGE_OPTIONS.map(option => {
            const selected = summaryRange === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSummaryRange(option.value)}
                className={`vp-focus-ring px-2.5 py-2 text-[9px] font-mono font-bold uppercase tracking-widest transition-colors ${selected ? 'bg-white/10 text-white' : 'text-hw-muted hover:text-white'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
