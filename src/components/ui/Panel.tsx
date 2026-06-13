import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type PanelProps<T extends ElementType = 'section'> = {
  as?: T;
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  raised?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'title' | 'children' | 'className'>;

export function Panel<T extends ElementType = 'section'>({
  as,
  title,
  eyebrow,
  action,
  raised = false,
  children,
  className = '',
  ...props
}: PanelProps<T>) {
  const Component = as || 'section';
  const panelClass = raised ? 'vp-panel-raised' : 'vp-panel';

  return (
    <Component className={`${panelClass} ${className}`} {...props}>
      {(title || eyebrow || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <div className="vp-label mb-1">{eyebrow}</div>}
            {title && <div className="text-sm font-semibold text-vp-text">{title}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Component>
  );
}
