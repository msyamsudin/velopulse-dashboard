import type { ReactNode } from 'react';

type StatusTone = 'neutral' | 'ready' | 'warning' | 'danger' | 'info';

interface StatusPillProps {
  label: ReactNode;
  icon?: ReactNode;
  tone?: StatusTone;
  compact?: boolean;
  /** 'lg' for distance reading (workout cockpit); defaults to the compact 9px size. */
  size?: 'sm' | 'lg';
  className?: string;
}

const toneClass: Record<StatusTone, string> = {
  neutral: 'border-vp-border bg-white/[0.03] text-vp-muted',
  ready: 'border-vp-accent/30 bg-vp-accent/8 text-vp-accent',
  warning: 'border-vp-warning/35 bg-vp-warning/10 text-vp-warning',
  danger: 'border-vp-danger/35 bg-vp-danger/10 text-vp-danger',
  info: 'border-vp-info/35 bg-vp-info/10 text-vp-info',
};

export function StatusPill({
  label,
  icon,
  tone = 'neutral',
  compact = false,
  size = 'sm',
  className = '',
}: StatusPillProps) {
  const sizeClass = size === 'lg'
    ? 'px-3 py-1.5 text-[11px]'
    : compact
      ? 'px-2 py-1 text-[9px]'
      : 'px-2.5 py-1.5 text-[9px]';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border font-mono uppercase tracking-[0.14em] ${sizeClass} ${toneClass[tone]} ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}
