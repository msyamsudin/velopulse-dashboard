import { motion } from 'motion/react';
import { FlaskConical, Square } from 'lucide-react';
import { SaveAnimationTest } from './SaveAnimationTest';
import { StatusPill } from './ui';
import { useI18n } from '@/i18n';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import type { SimulationProfile } from '@/lib/telemetry-simulator';

interface TelemetryLogProps {
  rawLogs: string[];
  copyLogs: () => void;
  copyStatus: 'idle' | 'copied';
  /** Profil pengendara: simulator demo menskalakan daya dan HR dari nilai ini. */
  riderProfile: SimulationProfile;
}

export const TelemetryLog = ({
  rawLogs,
  copyLogs,
  copyStatus,
  riderProfile
}: TelemetryLogProps) => {
  const { t } = useI18n();
  const isSimulating = useBluetoothStore((s) => s.isSimulating);
  const startSimulation = useBluetoothStore((s) => s.startSimulation);
  const stopSimulation = useBluetoothStore((s) => s.stopSimulation);
  // Mode demo hanya untuk pengembangan: build produksi tidak boleh menawarkan
  // sumber detak jantung sintetis yang bisa disangka sesi sungguhan.
  const demoAvailable = process.env.NODE_ENV !== 'production';

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="hardware-card bg-black border-yellow-500/30 overflow-hidden mb-6"
    >
      <div className="stat-label text-yellow-500 mb-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span>Raw Bluetooth Telemetry</span>
          <span className="opacity-50 text-[8px] font-normal">{'// Last 50 packets'}</span>
        </div>
        <div className="flex items-center gap-2">
          <SaveAnimationTest />
          <button 
            onClick={copyLogs}
            className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors text-[9px] flex items-center gap-1"
          >
            {copyStatus === 'copied' ? 'COPIED!' : 'COPY LOGS'}
          </button>
        </div>
      </div>

      {/* Mode demo hidup di panel debug: alat pengembangan untuk melihat kokpit
          tanpa memasangkan strap HR dan sepeda statis. */}
      {demoAvailable && (
        <div className="mb-4 rounded-lg border border-yellow-500/25 bg-yellow-500/[0.04] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="stat-label flex flex-wrap items-center gap-2 text-yellow-500">
                <span>{t('Demo mode')}</span>
                <span className="opacity-50 text-[8px] font-normal">{`// ${t('No hardware needed')}`}</span>
              </div>
              <p className="mt-1 max-w-2xl text-[10px] leading-4 text-hw-muted">
                {t('Streams a simulated heart-rate strap and bike so the cockpit can be opened without pairing any device.')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isSimulating) {
                    stopSimulation();
                  } else {
                    startSimulation(riderProfile);
                  }
                }}
                aria-label={t(isSimulating ? 'Stop demo telemetry' : 'Start demo telemetry')}
                className={`vp-focus-ring flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors ${
                  isSimulating
                    ? 'border-vp-warning/40 bg-vp-warning/10 text-vp-warning hover:bg-vp-warning/20'
                    : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 hover:text-yellow-300'
                }`}
              >
                {isSimulating ? <Square size={11} /> : <FlaskConical size={12} />}
                {t(isSimulating ? 'Stop demo' : 'Start demo')}
              </button>
              <StatusPill
                label={t(isSimulating ? 'Simulated devices online' : 'Simulation inactive')}
                tone={isSimulating ? 'warning' : 'neutral'}
                compact
              />
            </div>
          </div>
        </div>
      )}

      <div className="font-mono text-[10px] h-48 overflow-y-auto space-y-1 text-yellow-500/80">
        {rawLogs.length === 0 ? (
          <div className="opacity-50 italic">Waiting for device connection...</div>
        ) : (
          rawLogs.map((log, i) => (
            <div key={i} className="border-b border-yellow-500/10 pb-1">
              <span className="opacity-40 mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};
