import { motion } from 'motion/react';
import { CheckCircle, RefreshCw, UploadCloud, XCircle } from 'lucide-react';
import { InlineNotice } from '../ui';
import { useI18n } from '@/i18n';

interface SyncActionBarProps {
  onSync: () => void;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const SyncActionBar = ({ onSync, isPending, isSuccess, isError }: SyncActionBarProps) => {
  const { t } = useI18n();
  const noticeTone = isSuccess ? 'success' : isError ? 'danger' : 'info';
  const noticeIcon = isSuccess
    ? <CheckCircle size={13} />
    : isError
      ? <XCircle size={13} />
      : <UploadCloud size={13} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 rounded-lg border border-vp-border bg-white/[0.03] p-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <InlineNotice tone={noticeTone} icon={noticeIcon} className="md:flex-1">
          {isSuccess
            ? t('Workout synced to Google Fit')
            : isError
              ? t('Sync failed. Try again when the connection is ready')
              : t('Workout complete. Session data is ready to sync')}
        </InlineNotice>
        <button
          type="button"
          onClick={onSync}
          disabled={isPending || isSuccess}
          aria-label={isError ? 'Retry Google Fit sync' : 'Sync workout to Google Fit'}
          className={`vp-focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors disabled:pointer-events-none disabled:opacity-50 ${
            isError
              ? 'border border-vp-danger/35 bg-vp-danger/10 text-vp-danger hover:bg-vp-danger/15'
              : 'bg-vp-accent text-vp-bg hover:bg-vp-accent/90'
          }`}
        >
          <RefreshCw size={13} className={isPending ? 'animate-spin' : ''} />
          {t(isPending ? 'Syncing' : isSuccess ? 'Synced' : isError ? 'Retry Sync' : 'Sync Google Fit')}
        </button>
      </div>
    </motion.div>
  );
};
