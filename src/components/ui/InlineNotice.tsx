import type { ReactNode } from 'react';

type NoticeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface InlineNoticeProps {
  children: ReactNode;
  tone?: NoticeTone;
  icon?: ReactNode;
  className?: string;
}

const toneClass: Record<NoticeTone, string> = {
  neutral: 'border-vp-border bg-white/[0.03] text-vp-muted',
  success: 'border-vp-accent/25 bg-vp-accent/8 text-vp-accent',
  warning: 'border-vp-warning/30 bg-vp-warning/10 text-vp-warning',
  danger: 'border-vp-danger/30 bg-vp-danger/10 text-vp-danger',
  info: 'border-vp-info/30 bg-vp-info/10 text-vp-info',
};

export function InlineNotice({
  children,
  tone = 'neutral',
  icon,
  className = '',
}: InlineNoticeProps) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] ${toneClass[tone]} ${className}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
