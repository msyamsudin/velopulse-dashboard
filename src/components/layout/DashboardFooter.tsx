import { Bluetooth, Settings } from 'lucide-react';
import { APP_METADATA } from '@/lib/constants';

export const DashboardFooter = () => {
  return (
    <footer className="flex justify-between items-center text-[9px] font-mono text-hw-muted uppercase tracking-[0.2em] pt-8 border-t border-hw-muted/10">
      <div>{APP_METADATA.name} v{APP_METADATA.version} // Build {APP_METADATA.buildDate}</div>
      <div className="flex gap-4">
        <span className="flex items-center gap-1"><Bluetooth size={10} /> BLE 5.0 Active</span>
        <span className="flex items-center gap-1"><Settings size={10} /> Low Latency Mode</span>
      </div>
    </footer>
  );
};
