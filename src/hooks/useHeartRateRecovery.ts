import { useState, useEffect, useRef, useCallback } from 'react';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import { useWorkoutStore } from '@/store/useWorkoutStore';

export type HrrStatus = 'idle' | 'detecting' | 'buffer' | 'measuring' | 'complete';

export const useHeartRateRecovery = () => {
  const isRecording = useWorkoutStore(state => state.isRecording);
  const bleData = useBluetoothStore(state => state.data);
  const bikeConnected = useBluetoothStore(state => state.bikeConnected);
  const hrConnected = useBluetoothStore(state => state.hrConnected);
  const setHrrResult = useWorkoutStore(state => state.setHrrResult);

  const [status, setStatus] = useState<HrrStatus>('idle');
  const [bufferTime, setBufferTime] = useState(0);
  const [measureTime, setMeasureTime] = useState(120); // 120s measurement
  const [startHr, setStartHr] = useState<number | null>(null);
  const [endHr, setEndHr] = useState<number | null>(null);
  const [hrrScore, setHrrScore] = useState<number | null>(null);
  const [classification, setClassification] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentHr = bleData.heartRate || 0;
  const currentHrRef = useRef(currentHr);
  const cadence = bleData.cadence || 0;
  const power = bleData.power || 0;
  const speed = bleData.speed || 0;

  useEffect(() => {
    currentHrRef.current = currentHr;
  }, [currentHr]);

  const isBikeIdle = cadence <= 5 && power <= 10 && speed <= 1;
  const isBikeActive = cadence > 5 || power > 10 || speed > 1;

  const resetHrr = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setStatus('idle');
    setBufferTime(0);
    setMeasureTime(120);
    setStartHr(null);
    setEndHr(null);
    setHrrScore(null);
    setClassification(null);
  }, []);

  // 1. Reset HRR if recording or device connections are unavailable.
  useEffect(() => {
    if (!isRecording || !bikeConnected || !hrConnected) {
      resetHrr();
    }
  }, [isRecording, bikeConnected, hrConnected, resetHrr]);

  // 2. Auto-cancel / Resume if user starts pedaling during buffer or measuring
  useEffect(() => {
    if ((status === 'buffer' || status === 'measuring') && isBikeActive) {
      console.log("[HRR] Activity resumed! Canceling HRR test.");
      resetHrr();
    }
  }, [isBikeActive, status, resetHrr]);

  // 3. Handle buffer countdown. State transitions happen in effects, not inside
  // state updater callbacks, so React never sees cross-store updates during render.
  useEffect(() => {
    if (status !== 'buffer') return;

    if (bufferTime <= 0) {
      setStatus('measuring');
      setMeasureTime(120);
      setStartHr(currentHrRef.current);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setBufferTime(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status, bufferTime]);

  // 4. Handle HRR measurement countdown and publish the completed result.
  useEffect(() => {
    if (status !== 'measuring') return;

    if (measureTime <= 0) {
      const finalHr = currentHrRef.current;
      const initialHr = startHr ?? finalHr;
      const score = Math.max(0, initialHr - finalHr);

      let desc = 'Kurang Optimal';
      if (score >= 29) desc = 'Sangat Baik (Atletis)';
      else if (score >= 18) desc = 'Baik (Normal)';
      else if (score >= 12) desc = 'Cukup';

      setEndHr(finalHr);
      setHrrScore(score);
      setClassification(desc);
      setHrrResult(score, desc);
      setStatus('complete');
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setMeasureTime(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status, measureTime, startHr, setHrrResult]);

  return {
    status,
    bufferTime,
    measureTime,
    startHr,
    endHr,
    hrrScore,
    classification,
    resetHrr,
    startHrrManual: () => {
      if (!isRecording || !bikeConnected || !hrConnected || !isBikeIdle) return;
      setStartHr(null);
      setEndHr(null);
      setHrrScore(null);
      setClassification(null);
      setBufferTime(0);
      setMeasureTime(120);
      setStartHr(currentHrRef.current);
      setStatus('measuring');
    }
  };
};
