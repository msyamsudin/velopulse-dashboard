import type { ReactNode } from 'react';
import { Cloud, CloudOff, WifiOff } from 'lucide-react';
import { StatusPill } from '../ui';
import { useI18n } from '@/i18n';
import type { CloudStatus } from '@/hooks/useConnectionStatus';

interface CloudStatusIndicatorProps {
  /** Connection state, tracked once at the app level by useConnectionStatus. */
  status: CloudStatus | null;
  /** Opens the History view (offline / cloud unreachable states). */
  onOpenHistory?: () => void;
  /** Opens the Settings modal (Supabase not configured state). */
  onOpenSettings?: () => void;
}

type PillMeta = {
  tone: 'neutral' | 'warning' | 'danger';
  icon: ReactNode;
  label: string;
  title: string;
};

const pillFor = (status: CloudStatus, t: (key: string) => string): PillMeta | null => {
  switch (status.state) {
    case 'offline':
      return {
        tone: 'warning',
        icon: <WifiOff size={12} />,
        label: t('Offline — data stays local'),
        title: t('Offline — data stays local'),
      };
    case 'config-missing':
      return {
        tone: 'neutral',
        icon: <CloudOff size={12} />,
        label: t('Supabase not configured'),
        title: t('Supabase not configured'),
      };
    case 'unreachable': {
      const kind = status.detail.kind;
      if (kind === 'paused') {
        return {
          tone: 'danger',
          icon: <Cloud size={12} />,
          label: t('Cloud paused'),
          title: status.detail.userMessage,
        };
      }
      if (kind === 'auth') {
        return {
          tone: 'danger',
          icon: <Cloud size={12} />,
          label: t('Check Supabase credentials'),
          title: status.detail.userMessage,
        };
      }
      if (kind === 'network') {
        return {
          tone: 'warning',
          icon: <Cloud size={12} />,
          label: t('Cloud unreachable'),
          title: status.detail.userMessage,
        };
      }
      return {
        tone: 'warning',
        icon: <Cloud size={12} />,
        label: t('Cloud issue'),
        title: status.detail.userMessage,
      };
    }
    default:
      return null;
  }
};

/**
 * Compact connection indicator for the header. Renders nothing while healthy;
 * appears only when the app is offline, Supabase is not configured, or the
 * cloud cannot be reached — each with a distinct message so users can tell
 * the conditions apart. Clicking it jumps to the most useful screen:
 * History (pending/retry sync) for offline or cloud errors, Settings for a
 * missing configuration. Hover shows the underlying error detail.
 */
export function CloudStatusIndicator({
  status,
  onOpenHistory,
  onOpenSettings,
}: CloudStatusIndicatorProps) {
  const { t } = useI18n();

  if (!status || status.state === 'ok') return null;

  const meta = pillFor(status, t);
  if (!meta) return null;

  const opensHistory = status.state === 'offline' || status.state === 'unreachable';
  const onClick = opensHistory ? onOpenHistory : onOpenSettings;
  const actionLabel = opensHistory
    ? t('Open history to see pending sync')
    : t('Open settings to configure Supabase');

  const pill = <StatusPill label={meta.label} icon={meta.icon} tone={meta.tone} compact />;

  if (!onClick) {
    return <span title={meta.title}>{pill}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${meta.title}. ${actionLabel}`}
      aria-label={`${meta.label}. ${actionLabel}`}
      className="vp-focus-ring cursor-pointer rounded-md transition-opacity hover:opacity-80"
    >
      {pill}
    </button>
  );
}
