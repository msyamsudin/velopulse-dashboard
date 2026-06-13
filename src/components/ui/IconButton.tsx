import type { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonTone = 'neutral' | 'primary' | 'danger';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  tone?: IconButtonTone;
}

const toneClass: Record<IconButtonTone, string> = {
  neutral: 'border-vp-border bg-white/[0.04] text-vp-muted hover:border-vp-border-strong hover:text-vp-text',
  primary: 'border-vp-accent/35 bg-vp-accent/10 text-vp-accent hover:border-vp-accent/60 hover:bg-vp-accent/15',
  danger: 'border-vp-danger/35 bg-vp-danger/10 text-vp-danger hover:border-vp-danger/60 hover:bg-vp-danger/15',
};

export function IconButton({
  icon,
  label,
  tone = 'neutral',
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`vp-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors disabled:pointer-events-none disabled:opacity-40 ${toneClass[tone]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
