import { useEffect, useRef, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { SessionSummaryModal } from './SessionSummaryModal';
import type { HistoryData, SaveSessionPhase } from '@/store/useWorkoutStore';

const DUMMY_HISTORY: HistoryData[] = Array.from({ length: 60 }, (_, i) => ({
  time: `${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`,
  ts: Date.now() - (60 - i) * 1000,
  hr: 120 + (i % 20),
  cadence: 80 + (i % 10),
  power: 150 + (i % 30),
  speed: 28 + (i % 5),
  distance: i * 8,
  resistance: 30,
  calories: i * 2,
}));

const SAVE_STEPS: Array<{ progress: number; phase: SaveSessionPhase; delay: number }> = [
  { progress: 5, phase: 'preparing', delay: 400 },
  { progress: 20, phase: 'local', delay: 500 },
  { progress: 40, phase: 'sync', delay: 1100 },
  { progress: 65, phase: 'sync', delay: 1100 },
  { progress: 85, phase: 'finalizing', delay: 600 },
  { progress: 100, phase: 'done', delay: 800 },
];

export const SaveAnimationTest = () => {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [savePhase, setSavePhase] = useState<SaveSessionPhase>('idle');
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => {
    timersRef.current.forEach(id => window.clearTimeout(id));
  }, []);

  const startSimulation = () => {
    setIsSaving(true);
    setSaveProgress(0);
    setSavePhase('idle');
    timersRef.current.forEach(id => window.clearTimeout(id));
    timersRef.current = [];

    let acc = 0;
    for (const step of SAVE_STEPS) {
      acc += step.delay;
      timersRef.current.push(
        window.setTimeout(() => {
          setSaveProgress(step.progress);
          setSavePhase(step.phase);
        }, acc)
      );
    }
    timersRef.current.push(
      window.setTimeout(() => {
        setIsSaving(false);
        setOpen(false);
        setSavePhase('idle');
      }, acc + 500)
    );
  };

  const close = () => {
    timersRef.current.forEach(id => window.clearTimeout(id));
    timersRef.current = [];
    setIsSaving(false);
    setSavePhase('idle');
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors text-[9px] flex items-center gap-1 text-yellow-500"
        aria-label="Test save progress animation with dummy data"
        title="Test save progress animation with dummy data"
      >
        <FlaskConical size={11} />
        TEST SAVE ANIMATION
      </button>

      {open && (
        <SessionSummaryModal
          stats={{
            avgHr: 128,
            maxHr: 148,
            avgPower: 165,
            maxPower: 240,
            avgCadence: 84,
            maxCadence: 102,
            avgSpeed: 29.4,
            maxSpeed: 38.2,
            hrrScore: 18,
            hrrClassification: 'Good',
          }}
          duration="10:00"
          calories={420}
          distance={4900}
          maxHr={190}
          history={DUMMY_HISTORY}
          sessionStartTime={DUMMY_HISTORY[0].ts}
          isSaving={isSaving}
          saveProgress={saveProgress}
          savePhase={savePhase}
          onSave={startSimulation}
          onDiscard={close}
        />
      )}
    </>
  );
};
