import { motion } from 'motion/react';

interface SyncActionBarProps {
  onSync: () => void;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export const SyncActionBar = ({ onSync, isPending, isSuccess, isError }: SyncActionBarProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="hardware-card bg-hw-accent/5 border-hw-accent/20 flex flex-col md:flex-row items-center justify-between gap-4 p-6 mb-6"
    >
      <div>
        <h3 className="text-hw-accent font-bold uppercase tracking-widest text-sm">Workout Completed</h3>
        <p className="text-hw-muted text-xs mt-1">Ready to sync your session data to Google Fit?</p>
      </div>
      <button 
        onClick={onSync}
        disabled={isPending || isSuccess}
        className={`px-6 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
          isSuccess ? 'bg-green-500 text-white' : 
          isError ? 'bg-red-500 text-white' :
          'bg-hw-accent text-hw-bg hover:scale-105 active:scale-95'
        }`}
      >
        {isPending ? 'Syncing...' : 
         isSuccess ? 'Synced to Google Fit!' :
         isError ? 'Sync Failed - Try Again' :
         'Sync to Google Fit'}
      </button>
    </motion.div>
  );
};
