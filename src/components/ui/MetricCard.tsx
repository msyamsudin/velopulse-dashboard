import type { ReactNode } from 'react';

type MetricTone =
  | 'default'
  | 'heart'
  | 'power'
  | 'cadence'
  | 'speed'
  | 'distance'
  | 'calories'
  | 'resistance';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  detail?: ReactNode;
  footer?: ReactNode;
  tone?: MetricTone;
  size?: 'sm' | 'md' | 'lg';
  waiting?: boolean;
  className?: string;
}

const toneClass: Record<MetricTone, string> = {
  default: 'text-vp-text',
  heart: 'text-vp-hr',
  power: 'text-vp-power',
  cadence: 'text-vp-cadence',
  speed: 'text-vp-speed',
  distance: 'text-vp-distance',
  calories: 'text-vp-calories',
  resistance: 'text-vp-resistance',
};

const sizeClass = {
  sm: 'text-3xl',
  md: 'text-5xl',
  lg: 'text-[clamp(3.5rem,8vw,6.5rem)]',
};

export function MetricCard({
  label,
  value,
  unit,
  icon,
  detail,
  footer,
  tone = 'default',
  size = 'md',
  waiting = false,
  className = '',
}: MetricCardProps) {
  return (
    <section className={`vp-panel flex min-h-32 flex-col justify-between ${waiting ? 'opacity-70' : ''} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="vp-label flex items-center gap-2">
          {icon && <span className={toneClass[tone]}>{icon}</span>}
          {label}
        </div>
        {detail && <div className="text-right text-[10px] font-mono uppercase tracking-[0.14em] text-vp-muted">{detail}</div>}
      </div>

      <div className="py-4">
        <div className={`vp-value ${sizeClass[size]} ${toneClass[tone]}`}>
          {value}
          {unit && <span className="ml-2 align-middle text-sm font-medium text-vp-muted">{unit}</span>}
        </div>
      </div>

      {footer && <div className="text-xs text-vp-muted">{footer}</div>}
    </section>
  );
}
