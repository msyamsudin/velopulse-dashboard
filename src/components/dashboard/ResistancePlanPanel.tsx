'use client';

import { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useResistancePlanStore } from '@/store/useResistancePlanStore';
import { useI18n } from '@/i18n';
import { Panel } from '../ui';

const DEFAULT_VARIATIONS = [25, 50, 75, 25, 0, 50, 75, 50, 25, 0];

export const ResistancePlanPanel = () => {
  const { t } = useI18n();
  const { enabled, variations, setEnabled, setVariations } = useResistancePlanStore();
  const [expanded, setExpanded] = useState(false);

  const handleVariationChange = (index: number, value: string) => {
    const num = Number(value);
    if (isNaN(num)) return;
    const next = [...variations];
    next[index] = Math.max(0, Math.min(100, num));
    setVariations(next);
  };

  const handleReset = () => setVariations([...DEFAULT_VARIATIONS]);

  return (
    <Panel
      title={t('Resistance Plan')}
      eyebrow={t('Resistance variation plan every 1 km to keep the workout interesting')}
      action={<Settings size={18} className={enabled ? 'text-vp-accent' : 'text-vp-muted'} />}
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="vp-focus-ring h-4 w-4 rounded border-vp-border bg-white/5 text-vp-accent accent-vp-accent"
          />
          <span className="text-sm text-vp-text">{t(enabled ? 'Active' : 'Inactive')}</span>
        </label>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="vp-focus-ring flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted hover:text-vp-text"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {t(expanded ? 'Hide' : 'Edit')}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-1.5 text-center text-[9px] font-mono uppercase tracking-[0.12em] text-vp-muted">
        {variations.map((val, i) => (
          <div key={i}>
            <div className="mb-0.5">{i + 1}K</div>
            <input
              type="number"
              min={0}
              max={100}
              value={val}
              onChange={(e) => handleVariationChange(i, e.target.value)}
              disabled={!expanded}
              className={`vp-focus-ring w-full rounded border px-1 py-1 text-center text-sm font-bold tabular-nums transition-colors ${
                expanded
                  ? 'border-vp-accent/40 bg-white/5 text-vp-text'
                  : 'border-transparent bg-transparent text-vp-text/80'
              }`}
            />
          </div>
        ))}
      </div>

      {expanded && (
        <div className="mt-3 flex items-center justify-between border-t border-vp-border pt-3">
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
      )}
    </Panel>
  );
};
