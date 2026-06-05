import { motion } from 'motion/react';
import { Heart, Award, Activity, X } from 'lucide-react';

interface HrrModalProps {
  status: 'idle' | 'detecting' | 'buffer' | 'measuring' | 'complete';
  bufferTime: number;
  measureTime: number;
  startHr: number | null;
  endHr: number | null;
  hrrScore: number | null;
  classification: string | null;
  currentHr: number;
  onClose: () => void;
}

export const HrrModal = ({
  status,
  bufferTime,
  measureTime,
  startHr,
  endHr,
  hrrScore,
  classification,
  currentHr,
  onClose,
}: HrrModalProps) => {
  if (status === 'idle' || status === 'detecting') return null;

  const getScoreColor = (score: number) => {
    if (score >= 29) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
    if (score >= 18) return 'text-teal-400 border-teal-500/30 bg-teal-500/5';
    if (score >= 12) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5';
    return 'text-red-400 border-red-500/30 bg-red-500/5';
  };

  const getPercentage = () => {
    if (status === 'buffer') return (bufferTime / 10) * 100;
    if (status === 'measuring') return (measureTime / 120) * 100;
    return 100;
  };

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-hw-card p-6 shadow-2xl backdrop-blur-xl"
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        }}
      >
        {/* Background glow effects */}
        <div className="absolute -right-20 -top-20 -z-10 h-40 w-40 rounded-full bg-red-500/10 blur-[80px]" />
        <div className="absolute -left-20 -bottom-20 -z-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-[80px]" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-hw-muted hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-hw-accent/20 bg-hw-accent/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-hw-accent">
            <Activity size={10} className="animate-pulse" />
            Heart Rate Recovery
          </div>
          <h2 className="mt-3 text-lg font-bold text-white tracking-wide">
            {status === 'buffer' && 'Persiapan Pemulihan'}
            {status === 'measuring' && 'Mengukur Pemulihan'}
            {status === 'complete' && 'Hasil Analisis Pemulihan'}
          </h2>
        </div>

        {/* Phase content */}
        <div className="flex flex-col items-center justify-center py-4">
          {status !== 'complete' ? (
            <div className="relative flex items-center justify-center">
              {/* Progress Circle SVG */}
              <svg className="h-44 w-44 -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="78"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="6"
                  fill="transparent"
                />
                <motion.circle
                  cx="88"
                  cy="88"
                  r="78"
                  stroke={status === 'buffer' ? '#facc15' : '#10b981'}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray="490"
                  animate={{
                    strokeDashoffset: (490 - (490 * getPercentage()) / 100),
                  }}
                  transition={{ duration: 0.3 }}
                />
              </svg>

              {/* Heart and Text inside circle */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <Heart
                  size={36}
                  className={`animate-pulse ${status === 'buffer' ? 'text-yellow-400' : 'text-emerald-400'}`}
                  fill="currentColor"
                />
                <span className="mt-2 font-mono text-3xl font-black text-white">
                  {status === 'buffer' ? bufferTime : measureTime}
                  <span className="text-xs font-normal text-white/50 align-baseline">s</span>
                </span>
                <span className="text-[9px] font-mono uppercase tracking-wider text-hw-muted">
                  {status === 'buffer' ? 'Persiapan' : 'Pengukuran'}
                </span>
              </div>
            </div>
          ) : (
            /* Complete screen */
            <div className="w-full space-y-5 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Award size={32} />
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">Skor HRR Anda</div>
                <div className="mt-1 font-mono text-6xl font-black tracking-tight text-white">
                  {hrrScore}
                  <span className="text-lg font-normal text-white/45 ml-1">bpm</span>
                </div>
              </div>

              {/* Diagnosis box */}
              {hrrScore !== null && (
                <div className={`mx-auto max-w-[280px] rounded-xl border p-3 text-center ${getScoreColor(hrrScore)}`}>
                  <div className="text-[9px] font-mono uppercase tracking-[0.14em] opacity-60">Klasifikasi Jantung</div>
                  <div className="mt-0.5 text-sm font-extrabold tracking-wide uppercase">{classification}</div>
                </div>
              )}

              {/* Stats detail */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-white/2 p-3 font-mono text-xs w-full">
                <div className="border-r border-white/5 pr-2">
                  <div className="text-hw-muted text-[9px] uppercase tracking-wider">Detak Awal (Puncak)</div>
                  <div className="mt-1 text-sm font-bold text-white">{startHr} BPM</div>
                </div>
                <div className="pl-2">
                  <div className="text-hw-muted text-[9px] uppercase tracking-wider">Detak Setelah 2 Mnt</div>
                  <div className="mt-1 text-sm font-bold text-white">{endHr} BPM</div>
                </div>
              </div>
            </div>
          )}

          {/* Real-time heart rate preview below circle during active phases */}
          {status !== 'complete' && (
            <div className="mt-6 flex items-center gap-3 rounded-full border border-white/5 bg-white/2 px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-xs text-hw-muted">
                Detak jantung saat ini: <strong className="text-white">{currentHr || '--'} BPM</strong>
              </span>
            </div>
          )}

          {/* Advice/Tip text */}
          <p className="mt-6 text-center text-xs leading-relaxed text-hw-muted px-4">
            {status === 'buffer' && 'Kembalikan kayuhan pedal ke 0. Cari posisi istirahat ternyaman Anda sekarang (duduk santai atau bersandar).'}
            {status === 'measuring' && 'Bernapaslah dengan santai dan dalam. Tetap diam, rileks, dan batasi gerakan tubuh Anda.'}
            {status === 'complete' && hrrScore !== null && (
              hrrScore >= 18
                ? 'Kapasitas pemulihan jantung yang baik! Ini menunjukkan sistem kardiovaskular Anda bekerja secara efisien.'
                : 'Skor pemulihan sedikit rendah. Coba tingkatkan porsi kardio secara bertahap atau pastikan tubuh cukup istirahat.'
            )}
          </p>
        </div>

        {/* Action Button at footer */}
        {status === 'complete' && (
          <div className="mt-4">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-hw-accent py-3.5 text-hw-bg font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              SELESAI & SIMPAN SESI
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
