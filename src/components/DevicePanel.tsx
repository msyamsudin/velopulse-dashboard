import { Heart, Bike, ChevronRight } from 'lucide-react';
import { InlineNotice, StatusPill } from './ui';

interface DevicePanelProps {
  hrConnected: boolean;
  bikeConnected: boolean;
  error: string | null;
  connectHeartRate: () => void;
  connectBike: () => void;
}

export const DevicePanel = ({
  hrConnected,
  bikeConnected,
  error,
  connectHeartRate,
  connectBike
}: DevicePanelProps) => {
  return (
    <div className="vp-panel h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="vp-label">Device Management</div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={connectHeartRate}
            disabled={hrConnected}
            className={`vp-focus-ring group flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none ${
              hrConnected ? 'border-vp-accent/45 bg-vp-accent/8' : 'border-vp-border bg-white/[0.02] hover:border-vp-accent/30 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Heart size={18} className={hrConnected ? 'text-vp-accent' : 'text-vp-hr'} />
              <div className="text-left">
                <div className="text-xs font-medium text-vp-text">Heart Rate Monitor</div>
                <div className="text-[9px] text-vp-muted font-mono uppercase">
                  {hrConnected ? 'Connected' : 'Rockbros / Standard BLE'}
                </div>
              </div>
            </div>
            {hrConnected ? (
              <StatusPill label="Active" tone="ready" compact />
            ) : (
              <ChevronRight size={14} className="text-vp-muted" />
            )}
          </button>

          <button 
            onClick={connectBike}
            disabled={bikeConnected}
            className={`vp-focus-ring group flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none ${
              bikeConnected ? 'border-vp-accent/45 bg-vp-accent/8' : 'border-vp-border bg-white/[0.02] hover:border-vp-accent/30 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bike size={18} className="text-vp-accent" />
              <div className="text-left">
                <div className="text-xs font-medium text-vp-text">Stationary Bike</div>
                <div className="text-[9px] text-vp-muted font-mono uppercase">
                  {bikeConnected ? 'Connected' : 'Yesoul / FTMS Service'}
                </div>
              </div>
            </div>
            {bikeConnected ? (
              <StatusPill label="Active" tone="ready" compact />
            ) : (
              <ChevronRight size={14} className="text-vp-muted" />
            )}
          </button>
        </div>

        {error && (
          <InlineNotice tone="danger">
            Error: {error}
          </InlineNotice>
        )}
      </div>
    </div>
  );
};
