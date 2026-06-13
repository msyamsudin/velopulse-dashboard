import type { ReactNode } from 'react';

interface SegmentOption<T extends string> {
  label: ReactNode;
  value: T;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex rounded-lg border border-vp-border bg-white/[0.03] p-1 ${className}`}
    >
      {options.map(option => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`vp-focus-ring rounded-md px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] transition-colors disabled:pointer-events-none disabled:opacity-35 ${
              selected
                ? 'bg-vp-accent text-vp-bg'
                : 'text-vp-muted hover:bg-white/[0.04] hover:text-vp-text'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
