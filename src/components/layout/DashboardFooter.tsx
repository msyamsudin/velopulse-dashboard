import { useI18n } from '@/i18n';
import { versionLabel } from '@/lib/version';

/**
 * Build identity of the running deployment.
 *
 * Deliberately always visible rather than buried in Settings: "which commit is
 * live?" is the first question of every bug report and every rollback, and the
 * version number alone cannot answer it.
 */
export const DashboardFooter = () => {
  const { t } = useI18n();

  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-vp-border pt-3 font-mono text-[9px] uppercase tracking-widest text-vp-muted">
      <span>VeloPulse</span>
      <span
        className="select-all"
        title={t('Build identity of the running deployment — include it in bug reports.')}
      >
        {t('Version')} {versionLabel()}
      </span>
    </footer>
  );
};
