'use client';

import { useMemo, useState } from 'react';
import { Settings, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useResistancePlanStore } from '@/store/useResistancePlanStore';
import { useI18n } from '@/i18n';
import { Panel } from '../ui';

const DEFAULT_VARIATIONS = [25, 50, 75, 25, 0, 50, 75, 50, 25, 0];
const GUIDE_LINES = [25, 50, 75, 100];

export const ResistancePlanPanel = () => {
  const { t } = useI18n();
  const { enabled, variations, setEnabled, setVariations } = useResistancePlanStore();
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleVariationChange = (index: number, value: string) => {
    const num = Number(value);
    if (isNaN(num)) return;
    const next = [...variations];
    next[index] = Math.max(0, Math.min(100, num));
    setVariations(next);
  };

  const handleReset = () => setVariations([...DEFAULT_VARIATIONS]);

  const avg = useMemo(
    () => Math.round(variations.reduce((sum, v) => sum + v, 0) / Math.max(variations.length, 1)),
    [variations]
  );
  const max = useMemo(() => Math.max(...variations), [variations]);
  const maxIndex = variations.indexOf(max);

  return (
    <Panel
      title={t('Resistance Plan')}
      eyebrow={t('Resistance variation plan every 1 km to keep the workout interesting')}
      action={<Settings size={18} className={enabled ? 'text-vp-accent' : 'text-vp-muted'} />}
    >
      <div className="flex items-center justify-between gap-3 pb-4">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('Resistance plan')}
          onClick={() => setEnabled(!enabled)}
          className={`vp-focus-ring flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors ${
            enabled
              ? 'border-vp-accent/30 bg-vp-accent/8 text-vp-accent'
              : 'border-vp-border bg-white/[0.03] text-vp-muted hover:text-vp-text'
          }`}
        >
          <span
            className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${
              enabled ? 'bg-vp-accent' : 'bg-vp-dim'
            }`}
          >
            <span
              className={`absolute top-0.5 size-2.5 rounded-full bg-vp-bg transition-all ${
                enabled ? 'left-3' : 'left-0.5'
              }`}
            />
          </span>
          {t(enabled ? 'Active' : 'Inactive')}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="vp-focus-ring flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted hover:text-vp-text"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {t(expanded ? 'Hide' : 'Edit')}
        </button>
      </div>

      <div
        className={`rounded-lg border border-vp-border bg-white/[0.025] p-3 transition-opacity ${
          enabled ? '' : 'opacity-60'
        }`}
      >
        <div className="relative h-24">
          {GUIDE_LINES.map((guide) => (
            <div
              key={guide}
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/[0.06]"
              style={{ bottom: `${guide}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-between gap-1.5">
            {variations.map((val, i) => (
              <div
                key={i}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                className="group relative flex h-full flex-1 items-end justify-center"
              >
                <div
                  className={`pointer-events-none absolute -top-0.5 z-10 rounded border border-vp-border-strong bg-vp-bg/90 px-1 py-0.5 font-mono text-[8px] font-bold tabular-nums text-vp-resistance shadow-lg transition-opacity ${
                    activeIndex === i ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {val}%
                </div>
                <div
                  className={`w-full rounded-t-sm transition-all duration-200 ${
                    activeIndex === i && !expanded
                      ? 'bg-gradient-to-t from-vp-resistance/40 to-vp-resistance ring-1 ring-vp-accent/70'
                      : val > 0
                        ? 'bg-gradient-to-t from-vp-resistance/40 to-vp-resistance'
                        : 'bg-vp-border'
                  }`}
                  style={{ height: `${Math.max(val, 2)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between gap-1.5">
          {variations.map((_, i) => (
            <span
              key={i}
              className={`flex-1 text-center font-mono text-[8px] uppercase tracking-wider ${
                i === maxIndex ? 'text-vp-resistance' : 'text-vp-muted'
              }`}
            >
              {i + 1}K
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em] text-vp-muted">
        <span>
          {t('Average')} <span className="font-bold text-vp-text">{avg}%</span>
        </span>
        <span>
          {t('Peak')}{' '}
          <span className="font-bold text-vp-resistance">
            {max}% @ {maxIndex + 1}K
          </span>
        </span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2.5 border-t border-vp-border pt-4">
          {variations.map((val, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-9 shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-vp-muted">
                {i + 1}K
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={val}
                aria-label={`Resistance ${i + 1} km`}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex(null)}
                onChange={(e) => handleVariationChange(i, e.target.value)}
                className="vp-focus-ring h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-vp-border accent-[var(--color-vp-accent)]"
              />
              <span className="w-11 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-vp-text">
                {val}%
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-vp-border pt-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-vp-muted">
              {t('0–100% per km')}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="vp-focus-ring flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted hover:text-vp-accent"
            >
              <RotateCcw size={12} />
              {t('Reset')}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
};
