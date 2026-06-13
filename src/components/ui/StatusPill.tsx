import type { ReactNode } from 'react';

type StatusTone = 'neutral' | 'ready' | 'warning' | 'danger' | 'info';

interface StatusPillProps {
  label: ReactNode;
  icon?: ReactNode;
  tone?: StatusTone;
  compact?: boolean;
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
  className = '',
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border font-mono text-[9px] uppercase tracking-[0.14em] ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} ${toneClass[tone]} ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}
