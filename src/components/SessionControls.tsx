import { Play, Square } from 'lucide-react';

interface SessionControlsProps {
  isRecording: boolean;
  toggleRecording: () => void;
  isAnyConnected: boolean;
  disconnect: () => void;
}

export const SessionControls = ({
  isRecording,
  toggleRecording,
  isAnyConnected,
  disconnect
}: SessionControlsProps) => {
  return (
    <div className="pt-6 space-y-3">
      {!isRecording ? (
        <button 
          onClick={toggleRecording}
          className="w-full py-4 bg-hw-accent text-hw-bg font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Play size={20} fill="currentColor" />
          START SESSION
        </button>
      ) : (
        <button 
          onClick={toggleRecording}
          className="w-full py-4 bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Square size={20} fill="currentColor" />
          STOP SESSION
        </button>
      )}
      
      {isAnyConnected && (
        <button 
          onClick={disconnect}
          className="w-full py-2 text-hw-muted text-[10px] font-mono uppercase tracking-widest hover:text-white transition-colors"
        >
          Disconnect All Devices
        </button>
      )}
    </div>
  );
};
