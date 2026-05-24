import { Heart, Bike, ChevronRight } from 'lucide-react';

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
    <div className="hardware-card h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="stat-label">Device Management</div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={connectHeartRate}
            disabled={hrConnected}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors group ${
              hrConnected ? 'border-hw-accent/50 bg-hw-accent/5' : 'border-hw-muted/20 hover:bg-hw-muted/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Heart size={18} className={`${hrConnected ? 'text-hw-accent' : 'text-red-500'} group-hover:scale-110 transition-transform`} />
              <div className="text-left">
                <div className="text-xs font-medium">Heart Rate Monitor</div>
                <div className="text-[9px] text-hw-muted font-mono uppercase">
                  {hrConnected ? 'Connected' : 'Rockbros / Standard BLE'}
                </div>
              </div>
            </div>
            {hrConnected ? (
              <div className="text-[10px] font-mono text-hw-accent uppercase">Active</div>
            ) : (
              <ChevronRight size={14} className="text-hw-muted" />
            )}
          </button>

          <button 
            onClick={connectBike}
            disabled={bikeConnected}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors group ${
              bikeConnected ? 'border-hw-accent/50 bg-hw-accent/5' : 'border-hw-muted/20 hover:bg-hw-muted/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bike size={18} className="text-hw-accent group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div className="text-xs font-medium">Stationary Bike</div>
                <div className="text-[9px] text-hw-muted font-mono uppercase">
                  {bikeConnected ? 'Connected' : 'Yesoul / FTMS Service'}
                </div>
              </div>
            </div>
            {bikeConnected ? (
              <div className="text-[10px] font-mono text-hw-accent uppercase">Active</div>
            ) : (
              <ChevronRight size={14} className="text-hw-muted" />
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-mono">
            ERROR: {error}
          </div>
        )}
      </div>
    </div>
  );
};
