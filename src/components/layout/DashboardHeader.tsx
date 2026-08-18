import { Activity, Bug, History, LogIn, Settings } from 'lucide-react';
import { IconButton } from '../ui';
import { CloudStatusIndicator } from './CloudStatusIndicator';
import { useI18n } from '@/i18n';
import type { CloudStatus } from '@/hooks/useConnectionStatus';

interface DashboardHeaderProps {
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  cloudStatus: CloudStatus | null;
  showSignIn?: boolean;
  onSignIn?: () => void;
}

export const DashboardHeader = ({
  showHistory,
  setShowHistory,
  showDebug,
  setShowDebug,
  setShowSettings,
  cloudStatus,
  showSignIn = false,
  onSignIn
}: DashboardHeaderProps) => {
  const { t } = useI18n();
  return (
    <header className="mb-5 flex shrink-0 flex-col gap-4 border-b border-vp-border pb-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-vp-accent/25 bg-vp-accent/8 text-vp-accent">
          <Activity size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-normal text-vp-text md:text-3xl">
            VeloPulse
          </h1>
          <p className="vp-label mt-1">
            {t('Training cockpit')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <CloudStatusIndicator
          status={cloudStatus}
          onOpenHistory={() => setShowHistory(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
        {showSignIn && (
          <IconButton
            onClick={onSignIn}
            label={t('Sign in')}
            icon={<LogIn size={15} />}
            tone="primary"
          />
        )}
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`vp-button vp-focus-ring ${
            showHistory ? 'vp-button-primary' : ''
          }`}
        >
          <History size={13} />
          {t('History')}
        </button>
        <IconButton
          onClick={() => setShowSettings(true)}
          label={t('Open settings')}
          icon={<Settings size={15} />}
        />
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className={`vp-button vp-focus-ring ${
            showDebug ? 'border-vp-warning bg-vp-warning text-vp-bg hover:bg-vp-warning/90 hover:text-vp-bg' : ''
          }`}
        >
          <Bug size={13} />
          {t('Debug')}
        </button>
      </div>
    </header>
  );
};
