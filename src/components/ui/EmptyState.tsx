import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  detail?: string;
  icon?: ReactNode;
  action?: ReactNode;
  pulse?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  detail,
  icon = <Activity size={20} />,
  action,
  pulse = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex min-h-36 items-center justify-center rounded-lg border border-dashed border-vp-border bg-white/[0.02] p-6 text-center ${className}`}>
      <div className="max-w-sm">
        <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-vp-border bg-white/[0.04] text-vp-muted ${pulse ? 'animate-pulse' : ''}`}>
          {icon}
        </div>
        <div className="text-sm font-semibold text-vp-text">{title}</div>
        {detail && (
          <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted">
            {detail}
          </div>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
