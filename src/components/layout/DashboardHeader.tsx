import { Activity, RefreshCcw, LogOut, Settings } from 'lucide-react';

interface DashboardHeaderProps {
  isGoogleConnected: boolean;
  handleConnectGoogle: () => void;
  handleDisconnectGoogle: () => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  viewMode: 'grid' | 'telemetry';
  setViewMode: (mode: 'grid' | 'telemetry') => void;
  chartAvailable: boolean;
}

export const DashboardHeader = ({
  isGoogleConnected,
  handleConnectGoogle,
  handleDisconnectGoogle,
  showHistory,
  setShowHistory,
  showDebug,
  setShowDebug,
  setShowSettings,
  viewMode,
  setViewMode,
  chartAvailable
}: DashboardHeaderProps) => {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="text-hw-accent" />
            VELOPULSE <span className="text-hw-muted font-light">PRO</span>
          </h1>
          <p className="text-hw-muted text-xs font-mono uppercase tracking-widest mt-1">
            Mission Control / Fitness Telemetry
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10 ml-4">
          <button 
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest transition-all duration-200 ${
              viewMode === 'grid' 
                ? 'bg-hw-accent text-hw-bg font-bold' 
                : 'text-hw-muted hover:text-white'
            }`}
          >
            Ride
          </button>
          <button 
            onClick={() => setViewMode('telemetry')}
            disabled={!chartAvailable}
            title={chartAvailable ? 'Open session chart' : 'Start a session to enable chart view'}
            className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest transition-all duration-200 ${
              viewMode === 'telemetry' 
                ? 'bg-hw-accent text-hw-bg font-bold' 
                : chartAvailable
                  ? 'text-hw-muted hover:text-white'
                  : 'text-hw-muted/35 cursor-not-allowed'
            }`}
          >
            Chart
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isGoogleConnected ? (
          <div className="flex items-center gap-1">
            <div className="px-3 py-1.5 rounded-l-md text-[10px] font-mono uppercase tracking-widest border border-hw-accent/30 text-hw-accent flex items-center gap-2 bg-hw-accent/5">
              <div className="w-1.5 h-1.5 rounded-full bg-hw-accent" />
              Google Fit
            </div>
            <button 
              onClick={handleConnectGoogle}
              title="Reconnect (Updates Permissions)"
              className="px-2 py-1.5 border-y border-hw-accent/30 text-hw-accent hover:bg-hw-accent/10 transition-colors"
            >
              <RefreshCcw size={12} />
            </button>
            <button 
              onClick={handleDisconnectGoogle}
              title="Disconnect"
              className="px-2 py-1.5 rounded-r-md border border-hw-accent/30 text-hw-accent hover:bg-red-500/20 hover:text-red-500 transition-colors"
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleConnectGoogle}
            className="px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest border border-hw-muted/30 text-hw-muted hover:border-hw-muted hover:text-white transition-colors flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-hw-muted" />
            Connect Google Fit
          </button>
        )}
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest border transition-colors ${
            showHistory ? 'bg-hw-accent text-hw-bg border-hw-accent' : 'border-hw-muted/30 text-hw-muted hover:border-hw-muted'
          }`}
        >
          History
        </button>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-md border border-hw-muted/30 text-hw-muted hover:border-hw-muted hover:text-white transition-colors"
        >
          <Settings size={14} />
        </button>
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-widest border transition-colors ${
            showDebug ? 'bg-yellow-500 text-hw-bg border-yellow-500' : 'border-hw-muted/30 text-hw-muted hover:border-hw-muted'
          }`}
        >
          Debug Console
        </button>
      </div>
    </header>
  );
};
