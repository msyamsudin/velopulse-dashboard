'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeFtpResult,
  FTP_EFFORT_SECONDS,
  FTP_WARMUP_SECONDS,
  type FtpResult,
  type FtpSample,
} from '@/lib/ftp-test';
import { useBluetoothStore } from '@/store/useBluetoothStore';
import { useWorkoutStore, type HistoryData } from '@/store/useWorkoutStore';
import { BLE_STALE_TIMEOUT_MS } from '@/store/workout/constants';

export type FtpTestStatus = 'closed' | 'intro' | 'warmup' | 'effort' | 'result';
export type FtpTestSaveState = 'idle' | 'saving' | 'saved' | 'failed';

const formatClockTime = (ms: number) => {
  const date = new Date(ms);
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${date.getHours()}:${minutes}:${seconds}`;
};

/**
 * Menjalankan tes FTP 20 menit di atas telemetri BLE yang sedang berjalan.
 *
 * Tes tidak memakai jalur rekaman latihan: ia punya timer sendiri supaya
 * pengguna bisa mengukur tanpa HR strap, tanpa mengubah sesi latihan yang
 * sedang berjalan, dan tanpa modal ringkasan di akhir. Sampel tetap disimpan
 * sebagai sesi latihan biasa lewat `saveTestSession`.
 */
export const useFtpTest = () => {
  const data = useBluetoothStore(state => state.data);
  const bikeConnected = useBluetoothStore(state => state.bikeConnected);
  const hrConnected = useBluetoothStore(state => state.hrConnected);
  const saveTestSession = useWorkoutStore(state => state.saveTestSession);

  const [status, setStatus] = useState<FtpTestStatus>('closed');
  const [warmupRemaining, setWarmupRemaining] = useState(FTP_WARMUP_SECONDS);
  const [effortRemaining, setEffortRemaining] = useState(FTP_EFFORT_SECONDS);
  const [avgPower, setAvgPower] = useState(0);
  const [result, setResult] = useState<FtpResult | null>(null);
  const [saveState, setSaveState] = useState<FtpTestSaveState>('idle');
  const [abortReason, setAbortReason] = useState<'bike' | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const statusRef = useRef<FtpTestStatus>('closed');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const samplesRef = useRef<FtpSample[]>([]);
  const historyRef = useRef<HistoryData[]>([]);
  const warmupEndsAtRef = useRef<number | null>(null);
  const effortStartRef = useRef<number | null>(null);
  const effortEndsAtRef = useRef<number | null>(null);
  const startDistanceRef = useRef(0);
  const startCaloriesRef = useRef(0);
  const deviceNameRef = useRef<string | null>(null);

  const changeStatus = useCallback((next: FtpTestStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopTicker = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const recordSample = useCallback((now: number) => {
    const ble = useBluetoothStore.getState();
    const { lastUpdate } = ble;
    const isStale = (key: 'heartRate' | 'power' | 'cadence' | 'speed') => {
      const updatedAt = lastUpdate[key];
      return updatedAt === undefined || now - updatedAt > BLE_STALE_TIMEOUT_MS;
    };

    const power = ble.data.power || 0;
    const heartRate = ble.data.heartRate || 0;
    const cadence = ble.data.cadence || 0;
    const speed = ble.data.speed || 0;

    const point: HistoryData = {
      time: formatClockTime(now),
      ts: now,
      hr: heartRate,
      cadence,
      power,
      speed,
      distance: Math.max(0, (ble.data.distance || 0) - startDistanceRef.current),
      resistance: ble.data.resistance || 0,
      calories: Math.max(0, (ble.data.calories || 0) - startCaloriesRef.current),
      staleHr: heartRate === 0 && isStale('heartRate'),
      stalePower: power === 0 && isStale('power'),
      staleCadence: cadence === 0 && isStale('cadence'),
      staleSpeed: speed === 0 && isStale('speed'),
    };

    historyRef.current.push(point);
    samplesRef.current.push({
      ts: now,
      power,
      stalePower: point.stalePower,
    });
  }, []);

  const finishEffort = useCallback((now: number) => {
    stopTicker();
    const effortStart = effortStartRef.current ?? now;
    const measured = computeFtpResult(samplesRef.current, {
      effortStart,
      effortEnd: now,
    });

    setResult(measured);
    setAvgPower(measured.avgPower);
    changeStatus('result');

    if (historyRef.current.length < 2) {
      setSaveState('idle');
      return;
    }

    setSaveState('saving');
    void saveTestSession({
      history: historyRef.current,
      testType: 'ftp',
      ftpWatts: measured.ftp,
      deviceName: deviceNameRef.current,
    })
      .then(() => {
        if (mountedRef.current) setSaveState('saved');
      })
      .catch(error => {
        console.error('Failed to save the FTP test session:', error);
        if (mountedRef.current) setSaveState('failed');
      });
  }, [changeStatus, saveTestSession, stopTicker]);

  const beginEffort = useCallback((now: number) => {
    effortStartRef.current = now;
    effortEndsAtRef.current = now + FTP_EFFORT_SECONDS * 1000;
    changeStatus('effort');
    setEffortRemaining(FTP_EFFORT_SECONDS);
  }, [changeStatus]);

  // Timer memakai deadline absolut, bukan hitungan mundur per tick, supaya
  // interval yang telat (tab tidak aktif) tidak memperpanjang tes.
  const tick = useCallback(() => {
    const now = Date.now();

    if (statusRef.current === 'warmup') {
      recordSample(now);
      const warmupEndsAt = warmupEndsAtRef.current ?? now;
      const remaining = Math.max(0, Math.ceil((warmupEndsAt - now) / 1000));
      setWarmupRemaining(remaining);
      if (remaining <= 0) beginEffort(now);
      return;
    }

    if (statusRef.current === 'effort') {
      recordSample(now);
      const effortEndsAt = effortEndsAtRef.current ?? now;
      const remaining = Math.max(0, Math.ceil((effortEndsAt - now) / 1000));
      setEffortRemaining(remaining);
      const measured = computeFtpResult(samplesRef.current, {
        effortStart: effortStartRef.current ?? now,
        effortEnd: now,
      });
      setAvgPower(measured.avgPower);
      if (remaining <= 0) finishEffort(now);
    }
  }, [beginEffort, finishEffort, recordSample]);

  const startTicker = useCallback(() => {
    stopTicker();
    intervalRef.current = setInterval(tick, 1000);
  }, [stopTicker, tick]);

  const resetTest = useCallback(() => {
    stopTicker();
    samplesRef.current = [];
    historyRef.current = [];
    warmupEndsAtRef.current = null;
    effortStartRef.current = null;
    effortEndsAtRef.current = null;
    startDistanceRef.current = 0;
    startCaloriesRef.current = 0;
    deviceNameRef.current = null;
    setDeviceName(null);
    setWarmupRemaining(FTP_WARMUP_SECONDS);
    setEffortRemaining(FTP_EFFORT_SECONDS);
    setAvgPower(0);
    setResult(null);
    setSaveState('idle');
    setAbortReason(null);
  }, [stopTicker]);

  const open = useCallback(() => {
    if (statusRef.current !== 'closed' && statusRef.current !== 'intro') return;
    resetTest();
    changeStatus('intro');
  }, [changeStatus, resetTest]);

  const close = useCallback(() => {
    resetTest();
    changeStatus('closed');
  }, [changeStatus, resetTest]);

  const cancel = useCallback(() => {
    resetTest();
    changeStatus('intro');
  }, [changeStatus, resetTest]);

  const start = useCallback(() => {
    const ble = useBluetoothStore.getState();
    const now = Date.now();

    if (!ble.bikeConnected) {
      setAbortReason('bike');
      changeStatus('intro');
      return;
    }

    resetTest();
    startDistanceRef.current = ble.data.distance || 0;
    startCaloriesRef.current = ble.data.calories || 0;
    deviceNameRef.current = ble.bikeDevice?.name ?? null;
    setDeviceName(deviceNameRef.current);
    warmupEndsAtRef.current = now + FTP_WARMUP_SECONDS * 1000;

    changeStatus('warmup');
    setWarmupRemaining(FTP_WARMUP_SECONDS);
    recordSample(now);
    startTicker();
  }, [changeStatus, recordSample, resetTest, startTicker]);

  const skipWarmup = useCallback(() => {
    if (statusRef.current !== 'warmup') return;
    const now = Date.now();
    beginEffort(now);
    // Sampel pertama effort diambil tepat saat pemanasan dilewati, supaya
    // detik-detik awal tidak hilang dari cakupan.
    recordSample(now);
  }, [beginEffort, recordSample]);

  // Sepeda yang terputus di tengah tes tidak bisa menghasilkan angka; hentikan
  // lebih awal daripada membiarkan pengguna menyelesaikan 20 menit sia-sia.
  useEffect(() => {
    if ((status === 'warmup' || status === 'effort') && !bikeConnected) {
      resetTest();
      setAbortReason('bike');
      changeStatus('intro');
    }
  }, [bikeConnected, changeStatus, resetTest, status]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopTicker();
    };
  }, [stopTicker]);

  return {
    status,
    warmupRemaining,
    effortRemaining,
    effortElapsed: Math.max(0, FTP_EFFORT_SECONDS - effortRemaining),
    avgPower,
    result,
    saveState,
    abortReason,
    currentPower: data.power || 0,
    currentHr: data.heartRate || 0,
    hrConnected,
    bikeConnected,
    deviceName,
    open,
    start,
    skipWarmup,
    cancel,
    close,
  };
};
