'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { useBluetoothStore } from './store/useBluetoothStore';
import { useWorkoutStore } from './store/useWorkoutStore';
import { HR_ZONES, getActiveHrZoneIndex } from '@/lib/constants';

// Hooks
import { useAppInitialization } from './hooks/useAppInitialization';
import { useGoogleFitSync } from './hooks/useGoogleFitSync';

// Components
import { DevicePanel } from './components/DevicePanel';
import { TelemetryLog } from './components/TelemetryLog';
import { SetupLanding } from './components/SetupLanding';

// Layout & Dashboard Components
import { DashboardHeader } from './components/layout/DashboardHeader';
import { DashboardFooter } from './components/layout/DashboardFooter';
import { SyncActionBar } from './components/dashboard/SyncActionBar';
import { RecordingCockpit } from './components/dashboard/RecordingCockpit';
import { PreRideCockpit } from './components/dashboard/PreRideCockpit';
import { useHeartRateRecovery } from './hooks/useHeartRateRecovery';
import { HrrModal } from './components/dashboard/HrrModal';

const DeferredPanelLoader = () => (
  <div className="hardware-card h-full min-h-40 flex items-center justify-center">
    <div className="text-[10px] font-mono text-hw-muted uppercase tracking-[0.2em]">
      Loading...
    </div>
  </div>
);

const PerformanceChart = dynamic(
  () => import('./components/PerformanceChart').then(mod => mod.PerformanceChart),
  { ssr: false, loading: DeferredPanelLoader }
);

const WorkoutHistory = dynamic(
  () => import('./components/WorkoutHistory').then(mod => mod.WorkoutHistory),
  { ssr: false, loading: DeferredPanelLoader }
);

const SettingsModal = dynamic(
  () => import('./components/SettingsModal').then(mod => mod.SettingsModal),
  { ssr: false }
);

const SessionSummaryModal = dynamic(
  () => import('./components/SessionSummaryModal').then(mod => mod.SessionSummaryModal),
  { ssr: false }
);

type PrimarySurface = 'ready' | 'ride' | 'telemetry';
type AppMode = 'setup' | 'ready' | 'ride' | 'telemetry' | 'review';

export default function App() {
  const hrr = useHeartRateRecovery();
  const isRecording = useWorkoutStore(state => state.isRecording);
  const elapsed = useWorkoutStore(state => state.elapsed);
  const workoutHistory = useWorkoutStore(state => state.history);
  const sessionHistory = useWorkoutStore(state => state.sessionHistory);
  const toggleRecording = useWorkoutStore(state => state.toggleRecording);
  const incrementElapsed = useWorkoutStore(state => state.incrementElapsed);
  const addHistoryPoint = useWorkoutStore(state => state.addHistoryPoint);
  const saveSession = useWorkoutStore(state => state.saveSession);
  const syncPendingSupabaseSessions = useWorkoutStore(state => state.syncPendingSupabaseSessions);
  const loadHistoryFromSupabase = useWorkoutStore(state => state.loadHistoryFromSupabase);
  const loadMoreHistoryFromSupabase = useWorkoutStore(state => state.loadMoreHistoryFromSupabase);
  const hasMoreSupabaseHistory = useWorkoutStore(state => state.hasMoreSupabaseHistory);
  const importTCX = useWorkoutStore(state => state.importTCX);
  const discardSession = useWorkoutStore(state => state.discardSession);
  const formatTime = useWorkoutStore(state => state.formatTime);
  const startDistance = useWorkoutStore(state => state.startDistance);
  const startCalories = useWorkoutStore(state => state.startCalories);
  const liveStats = useWorkoutStore(state => state.liveStats);

  const bleData = useBluetoothStore(state => state.data);
  const bleRawLogs = useBluetoothStore(state => state.rawLogs);
  const hrConnected = useBluetoothStore(state => state.hrConnected);
  const bikeConnected = useBluetoothStore(state => state.bikeConnected);
  const bleError = useBluetoothStore(state => state.error);
  const connectHeartRate = useBluetoothStore(state => state.connectHeartRate);
  const connectBike = useBluetoothStore(state => state.connectBike);
  const disconnect = useBluetoothStore(state => state.disconnect);

  const {
    userProfile,
    setUserProfile,
    profileStatus,
    sysConfigCheck,
    refetchAuth,
    refetchSysCheck,
    isGoogleConnected
  } = useAppInitialization();

  const [viewMode, setViewMode] = useState<'grid' | 'telemetry'>('grid');
  const [showDebug, setShowDebug] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [wasRecording, setWasRecording] = useState(false);
  const [hasRequestedRemoteHistory, setHasRequestedRemoteHistory] = useState(false);
  const chartAvailable = workoutHistory.length > 0;
  const requiresSetup = (sysConfigCheck && !sysConfigCheck.configured) || profileStatus === 'new';
  const primarySurface: PrimarySurface = viewMode === 'telemetry'
    ? 'telemetry'
    : isRecording
      ? 'ride'
      : 'ready';
  const appMode: AppMode = requiresSetup
    ? 'setup'
    : showHistory
      ? 'review'
      : primarySurface;
  const isReadySurface = primarySurface === 'ready';
  const isRideSurface = primarySurface === 'ride';
  const isTelemetrySurface = primarySurface === 'telemetry';
  const isCompactSurface = isRideSurface || isTelemetrySurface;
  const showChrome = appMode === 'ready';
  const shellPadding = isCompactSurface ? 'p-2 md:p-4' : 'p-3 md:p-6 lg:p-8';
  const contentWidth = isCompactSurface ? 'max-w-none' : 'max-w-7xl';

  // Sync session data with BLE data
  useEffect(() => {
    if (isRecording) {
      addHistoryPoint(bleData);
    }
  }, [bleData, isRecording, addHistoryPoint]);

  useEffect(() => {
    if (viewMode === 'telemetry' && !chartAvailable) {
      setViewMode('grid');
    }
  }, [viewMode, chartAvailable]);

  useEffect(() => {
    if (!showHistory || hasRequestedRemoteHistory) return;

    setHasRequestedRemoteHistory(true);
    loadHistoryFromSupabase()
      .then(() => syncPendingSupabaseSessions())
      .catch(err => {
        console.error('Failed to load remote workout history:', err);
      });
  }, [showHistory, hasRequestedRemoteHistory, loadHistoryFromSupabase, syncPendingSupabaseSessions]);

  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        incrementElapsed();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, incrementElapsed]);

  // Handle Summary Modal Trigger
  useEffect(() => {
    if (isRecording) {
      setWasRecording(true);
    } else if (wasRecording) {
      if (workoutHistory.length > 5) { // Only show if there's actual data
        setShowSummary(true);
      } else {
        discardSession(); // Just clear if it was too short
      }
      setWasRecording(false);
    }
  }, [isRecording, wasRecording, workoutHistory.length, discardSession]);

  const { syncMutation, handleSyncGoogle } = useGoogleFitSync(isGoogleConnected, userProfile, liveStats);

  const handleConnectGoogle = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      const { url } = await response.json();
      const authWindow = window.open(url, 'google_auth', 'width=600,height=700');
      if (!authWindow) alert('Please allow popups to connect Google Fit');
    } catch (err) {
      console.error('Failed to get auth URL:', err);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect from Google Fit? You will need to reconnect to sync future workouts.')) return;
    try {
      const res = await fetch('/api/auth/disconnect', { method: 'POST' });
      if (res.ok) {
        refetchAuth();
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const copyLogs = () => {
    const logText = bleRawLogs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  };

  const currentData = {
    hr: bleData.heartRate || 0,
    cadence: bleData.cadence || 0,
    power: bleData.power || 0,
    speed: bleData.speed || 0,
    distance: isRecording ? Math.max(0, (bleData.distance || 0) - startDistance) : (bleData.distance || 0),
    resistance: bleData.resistance || 0,
    calories: isRecording ? Math.max(0, (bleData.calories || 0) - startCalories) : (bleData.calories || 0)
  };

  const getHrZone = (hr: number) => {
    const idx = getActiveHrZoneIndex(hr, userProfile.maxHr);
    if (idx < 0) return { label: 'IDLE', color: 'text-hw-muted', bg: 'bg-hw-muted/10' };
    const ZONE_LABELS = ['WARM UP', 'FAT BURN', 'AEROBIC', 'ANAEROBIC', 'PEAK'];
    const zone = HR_ZONES[idx];
    return { label: ZONE_LABELS[idx], color: zone.color, bg: zone.bg };
  };

  const hrZone = getHrZone(currentData.hr);

  if (requiresSetup) {
    return (
      <>
        <SetupLanding
          onInitialize={() => setShowSettings(true)}
          missingFields={sysConfigCheck?.missingFields || []}
          isProfileMissing={profileStatus === 'new'}
        />
        <AnimatePresence>
          {showSettings && (
            <SettingsModal
              onClose={() => {
                setShowSettings(false);
                refetchSysCheck();
              }}
              onSave={(profile) => setUserProfile(profile)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className={`h-dvh overflow-hidden bg-vp-bg ${shellPadding}`}>
      <div className={`mx-auto flex h-full w-full ${contentWidth} flex-col overflow-hidden transition-all duration-500 ease-out`}>
      <AnimatePresence mode="wait">
        {showChrome && (
          <motion.div
            key="header"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <DashboardHeader
              isGoogleConnected={isGoogleConnected}
              handleConnectGoogle={handleConnectGoogle}
              handleDisconnectGoogle={handleDisconnectGoogle}
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
              setShowSettings={setShowSettings}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDebug && (
          <TelemetryLog rawLogs={bleRawLogs} copyLogs={copyLogs} copyStatus={copyStatus} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <WorkoutHistory
            sessions={sessionHistory}
            onClose={() => setShowHistory(false)}
            isGoogleConnected={isGoogleConnected}
            maxHr={userProfile.maxHr}
            onSyncSupabasePending={syncPendingSupabaseSessions}
            onLoadMoreSupabaseHistory={loadMoreHistoryFromSupabase}
            hasMoreSupabaseHistory={hasMoreSupabaseHistory}
            onImportTCX={importTCX}
            onSyncSession={(session) => {
              const startTime = session.sessionStartTime || new Date(session.date).getTime();
              syncMutation.mutate({
                startTime: startTime,
                endTime: startTime + session.duration * 1000,
                stats: session.stats,
                history: session.history,
                maxHr: userProfile.maxHr,
                weight: userProfile.weight
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onSave={(profile) => setUserProfile(profile)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSummary && (
          <SessionSummaryModal
            stats={liveStats}
            duration={formatTime(elapsed)}
            calories={currentData.calories}
            distance={currentData.distance}
            history={workoutHistory}
            sessionStartTime={useWorkoutStore.getState().sessionStartTime || Date.now()}
            onSave={async () => {
              await saveSession();
              setShowSummary(false);
            }}
            onDiscard={() => {
              discardSession();
              setShowSummary(false);
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-hidden no-scrollbar">
        <AnimatePresence mode="wait">
          {!isTelemetrySurface && (
            <motion.div
              key={isRideSurface ? 'ride-view' : 'ready-view'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col space-y-6 overflow-y-auto no-scrollbar px-4 pb-8"
            >
              {isReadySurface && (
                <div className="grid grid-cols-1 gap-4 shrink-0">
                  <motion.div
                    key="device-panel"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <DevicePanel
                      hrConnected={hrConnected}
                      bikeConnected={bikeConnected}
                      error={bleError}
                      connectHeartRate={connectHeartRate}
                      connectBike={connectBike}
                    />
                  </motion.div>
                </div>
              )}

              {isReadySurface && workoutHistory.length > 0 && isGoogleConnected && (
                <SyncActionBar
                  onSync={handleSyncGoogle}
                  isPending={syncMutation.isPending}
                  isSuccess={syncMutation.isSuccess}
                  isError={syncMutation.isError}
                />
              )}

              <div className="flex-1 min-h-0">
                {isRideSurface ? (
                  <RecordingCockpit
                    currentData={currentData}
                    liveStats={liveStats}
                    userProfile={userProfile}
                    workout={{ history: workoutHistory, elapsed, formatTime }}
                    hrConnected={hrConnected}
                    bikeConnected={bikeConnected}
                    hrrStatus={hrr.status}
                    canStartHrr={
                      hrr.status === 'idle' &&
                      hrConnected &&
                      bikeConnected &&
                      currentData.hr > 0 &&
                      currentData.cadence <= 5 &&
                      currentData.power <= 10 &&
                      currentData.speed <= 1
                    }
                    onStartHrr={hrr.startHrrManual}
                    chartAvailable={chartAvailable}
                    onOpenChart={() => setViewMode('telemetry')}
                  />
                ) : (
                  <PreRideCockpit
                    currentData={currentData}
                    userProfile={userProfile}
                    sessions={sessionHistory}
                    hrConnected={hrConnected}
                    bikeConnected={bikeConnected}
                    isGoogleConnected={isGoogleConnected}
                    onStart={toggleRecording}
                    onDisconnect={disconnect}
                  />
                )}
              </div>
            </motion.div>
          )}

          {isTelemetrySurface && (
            <motion.div
              key="telemetry-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <PerformanceChart
                data={workoutHistory}
                hrZone={hrZone}
                userFtp={userProfile.ftp}
                userMaxHr={userProfile.maxHr}
                height="100%"
                onExit={() => setViewMode('grid')}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Stealth Floating Stop Button */}
      <AnimatePresence>
        {isRideSurface && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileHover={{
              width: 128,
              height: 40,
              backgroundColor: '#ef4444',
              borderRadius: '12px'
            }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleRecording}
            className="fixed top-6 right-6 z-100 group flex items-center justify-center bg-white/5 backdrop-blur-sm rounded-full transition-all duration-300 ease-out overflow-hidden h-8 w-8 shadow-2xl border border-white/10 hover:border-red-500/50"
          >
            {/* The Stealth Dot (Normal state) */}
            <div className="group-hover:hidden relative w-2 h-2">
              <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-60" />
              <div className="absolute inset-0 rounded-full bg-white opacity-100" />
            </div>

            {/* The Stop Content (Hover state) */}
            <div className="hidden group-hover:flex items-center gap-2 px-3 animate-in fade-in zoom-in duration-300">
              <div className="w-2.5 h-2.5 bg-white rounded-sm" />
              <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap text-white">
                Stop Session
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* PerformanceChart is now inside the viewMode conditional block above */}

      <AnimatePresence>
        {showChrome && (
          <motion.div
            key="footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DashboardFooter />
          </motion.div>
        )}
      </AnimatePresence>

      <HrrModal
        status={hrr.status}
        bufferTime={hrr.bufferTime}
        measureTime={hrr.measureTime}
        startHr={hrr.startHr}
        endHr={hrr.endHr}
        hrrScore={hrr.hrrScore}
        classification={hrr.classification}
        currentHr={currentData.hr}
        onClose={() => {
          if (hrr.status === 'complete') {
            hrr.resetHrr();
            if (isRecording) {
              toggleRecording(); // Stops recording and triggers SessionSummaryModal
            }
          } else {
            hrr.resetHrr();
          }
        }}
      />
      </div>
    </div>
  );
}
