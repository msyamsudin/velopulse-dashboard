import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '@/i18n';
import type { AutoSyncNotice as AutoSyncNoticeData } from '@/hooks/useAutoSync';

interface AutoSyncNoticeProps {
  notice: AutoSyncNoticeData | null;
  onDismiss: () => void;
  onOpenHistory: () => void;
}

/**
 * Floating toast reporting the outcome of an automatic Supabase sync after
 * the connection recovers. Success toasts dismiss themselves; failed ones
 * persist until dismissed and open the History view (where the retry button
 * lives) when clicked.
 */
export function AutoSyncNotice({ notice, onDismiss, onOpenHistory }: AutoSyncNoticeProps) {
  const { t } = useI18n();

  if (!notice) return null;

  const isFailure = notice.kind === 'failure';
  const message = isFailure
    ? t('Auto-sync failed, {count} sessions still pending', { count: notice.count })
    : t('Auto-synced {count} sessions to Supabase', { count: notice.count });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.25 }}
        className={`fixed bottom-6 right-6 z-100 flex items-center gap-1 rounded-lg border px-2 py-2 pl-4 shadow-2xl backdrop-blur-sm ${
          isFailure
            ? 'border-vp-danger/40 bg-vp-danger/15 text-vp-danger'
            : 'border-vp-accent/40 bg-vp-accent/15 text-vp-accent'
        }`}
      >
        <button
          type="button"
          onClick={isFailure ? onOpenHistory : onDismiss}
          title={isFailure ? t('Open history to retry sync') : undefined}
          className="vp-focus-ring flex min-w-0 flex-1 items-center gap-3 rounded text-left"
        >
          {isFailure ? (
            <AlertTriangle size={16} className="shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0" />
          )}
          <span className="text-xs font-medium leading-snug">{message}</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('Close')}
          className="vp-focus-ring shrink-0 rounded p-1.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
