import { Activity, Bug, History, LogOut, RefreshCcw, Settings } from 'lucide-react';
import { IconButton, StatusPill } from '../ui';
import { useI18n } from '@/i18n';

interface DashboardHeaderProps {
  isGoogleConnected: boolean;
  handleConnectGoogle: () => void;
  handleDisconnectGoogle: () => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
}

export const DashboardHeader = ({
  isGoogleConnected,
  handleConnectGoogle,
  handleDisconnectGoogle,
  showHistory,
  setShowHistory,
  showDebug,
  setShowDebug,
  setShowSettings
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
        {isGoogleConnected ? (
          <div className="flex items-center gap-1 rounded-lg border border-vp-accent/25 bg-vp-accent/5 p-1">
            <StatusPill label="Google Fit" tone="ready" compact />
            <IconButton
              onClick={handleConnectGoogle}
              label={t('Reconnect Google Fit')}
              icon={<RefreshCcw size={13} />}
              tone="primary"
              className="h-7 w-7"
            />
            <IconButton
              onClick={handleDisconnectGoogle}
              label={t('Disconnect Google Fit')}
              icon={<LogOut size={13} />}
              tone="danger"
              className="h-7 w-7"
            />
          </div>
        ) : (
          <button 
            onClick={handleConnectGoogle}
            className="vp-button vp-focus-ring"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-vp-muted" />
            {t('Connect Google Fit')}
          </button>
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
