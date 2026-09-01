'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { useBluetoothStore } from './store/useBluetoothStore';
import { sensorCaloriesDelta, useWorkoutStore } from './store/useWorkoutStore';
import { useAuthStore } from './store/useAuthStore';
import { HR_ZONES, getActiveHrZoneIndex } from '@/lib/constants';

// Hooks
import { useAppInitialization } from './hooks/useAppInitialization';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useAutoSync } from './hooks/useAutoSync';
import { AutoSyncNotice } from './components/layout/AutoSyncNotice';
import type { TelemetrySnapshot } from './lib/cockpit-types';

// Components
import { TelemetryLog } from './components/TelemetryLog';
import { SetupLanding } from './components/SetupLanding';
import { AuthScreen } from './components/AuthScreen';

// Layout & Dashboard Components
import { DashboardHeader } from './components/layout/DashboardHeader';
import { DashboardFooter } from './components/layout/DashboardFooter';
import { RecordingCockpit } from './components/dashboard/RecordingCockpit';
import { PreRideCockpit } from './components/dashboard/PreRideCockpit';
import { useHeartRateRecovery } from './hooks/useHeartRateRecovery';
import { HrrModal } from './components/dashboard/HrrModal';
import { EmptyState } from './components/ui';
import { useI18n } from './i18n';

const DeferredPanelLoader = () => {
  const { t } = useI18n();
  return <EmptyState title={t('Loading panel')} detail={t('Preparing telemetry view')} pulse className="h-full min-h-40" />;
};

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
  const { t } = useI18n();
  const authSession = useAuthStore(state => state.session);
  const authLoading = useAuthStore(state => state.loading);
  const hrr = useHeartRateRecovery();
  const isRecording = useWorkoutStore(state => state.isRecording);
  const { status: cloudStatus } = useConnectionStatus();
  const { autoSyncNotice, dismissAutoSyncNotice } = useAutoSync(cloudStatus);
  const elapsed = useWorkoutStore(state => state.elapsed);
  const workoutHistory = useWorkoutStore(state => state.history);
  const sessionHistory = useWorkoutStore(state => state.sessionHistory);
  const toggleRecording = useWorkoutStore(state => state.toggleRecording);
  const incrementElapsed = useWorkoutStore(state => state.incrementElapsed);
  const addHistoryPoint = useWorkoutStore(state => state.addHistoryPoint);
  const saveSession = useWorkoutStore(state => state.saveSession);
  const isSavingSession = useWorkoutStore(state => state.isSavingSession);
  const saveSessionProgress = useWorkoutStore(state => state.saveSessionProgress);
  const saveSessionPhase = useWorkoutStore(state => state.saveSessionPhase);
  const syncPendingSupabaseSessions = useWorkoutStore(state => state.syncPendingSupabaseSessions);
  const loadHistoryFromSupabase = useWorkoutStore(state => state.loadHistoryFromSupabase);
  const loadMoreHistoryFromSupabase = useWorkoutStore(state => state.loadMoreHistoryFromSupabase);
  const hasMoreSupabaseHistory = useWorkoutStore(state => state.hasMoreSupabaseHistory);
  const importTCX = useWorkoutStore(state => state.importTCX);
  const deleteSession = useWorkoutStore(state => state.deleteSession);
  const discardSession = useWorkoutStore(state => state.discardSession);
  const formatTime = useWorkoutStore(state => state.formatTime);
  const startDistance = useWorkoutStore(state => state.startDistance);
  const startCalories = useWorkoutStore(state => state.startCalories);
  const sessionStartTime = useWorkoutStore(state => state.sessionStartTime);
  const liveStats = useWorkoutStore(state => state.liveStats);
  const supabaseSyncError = useWorkoutStore(state => state.supabaseSyncError);
  const clearSupabaseSyncError = useWorkoutStore(state => state.clearSupabaseSyncError);

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
    profileError,
    retryProfile,
    sysConfigCheck,
    refetchSysCheck,
  } = useAppInitialization();

  const [viewMode, setViewMode] = useState<'grid' | 'telemetry'>('grid');
  const [showDebug, setShowDebug] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [skipAuth, setSkipAuth] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('velopulse-skip-auth') === '1';
  });
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
  const isRideSurface = primarySurface === 'ride';
  const isTelemetrySurface = primarySurface === 'telemetry';
  const isCompactSurface = isRideSurface || isTelemetrySurface;
  const showChrome = appMode === 'ready';
  const shellPadding = isCompactSurface ? 'p-2 md:p-4' : 'p-3 md:p-6 lg:p-8';
  const contentWidth = 'max-w-none';
  const scrollSurfaceBleed = isCompactSurface
    ? '-mx-2 px-6 md:-mx-4 md:px-8'
    : '-mx-3 px-7 md:-mx-6 md:px-10 lg:-mx-8 lg:px-12';

  // Initialize Supabase auth (restores a persisted session, then claims
  // pre-auth workouts and refreshes cloud history when signed in).
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

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
    let interval: ReturnType<typeof setInterval> | undefined;
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

  const copyLogs = () => {
    const logText = bleRawLogs.join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  };

  const handleStopRecording = () => {
    if (confirm(t('Stop this workout session?'))) {
      toggleRecording();
    }
  };

  const latestHistoryPoint = workoutHistory[workoutHistory.length - 1];
  // Single calorie source: the shared fractional accumulator stored on the
  // latest history point. The sensor delta only serves as a fallback before
  // the first point of a session exists.
  const currentSessionCalories = latestHistoryPoint?.calories ?? sensorCaloriesDelta(bleData.calories, startCalories);

  const currentData: TelemetrySnapshot = {
    hr: bleData.heartRate || 0,
    cadence: bleData.cadence || 0,
    power: bleData.power || 0,
    speed: bleData.speed || 0,
    distance: isRecording ? Math.max(0, (bleData.distance || 0) - startDistance) : (bleData.distance || 0),
    resistance: bleData.resistance || 0,
    calories: Math.round(currentSessionCalories)
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
          connectionError={profileError}
          onRetryConnection={retryProfile}
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

  // Supabase Auth gate: when the cloud is configured and reachable but the
  // user is not signed in, ask for login before showing the dashboard. Users
  // can continue locally (data stays on this device and syncs later).
  const cloudUnavailable = cloudStatus?.state === 'offline' || cloudStatus?.state === 'unreachable';
  const authRequired = Boolean(sysConfigCheck?.configured) && !cloudUnavailable;
  const handleContinueLocal = () => {
    try {
      window.sessionStorage.setItem('velopulse-skip-auth', '1');
    } catch {
      // Session storage unavailable (private mode); the skip lasts this render.
    }
    setSkipAuth(true);
  };
  const handleSignIn = () => {
    try {
      window.sessionStorage.removeItem('velopulse-skip-auth');
    } catch {
      // Ignore storage failures; the in-memory flag is enough.
    }
    setSkipAuth(false);
  };

  if (authRequired && !authLoading && !authSession && !skipAuth) {
    return (
      <AuthScreen
        onContinueLocal={handleContinueLocal}
      />
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
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
              setShowSettings={setShowSettings}
              cloudStatus={cloudStatus}
              showSignIn={authRequired && !authSession}
              onSignIn={handleSignIn}
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
            maxHr={userProfile.maxHr}
            onSyncSupabasePending={syncPendingSupabaseSessions}
            onLoadMoreSupabaseHistory={loadMoreHistoryFromSupabase}
            hasMoreSupabaseHistory={hasMoreSupabaseHistory}
            onImportTCX={importTCX}
            onDeleteSession={deleteSession}
            supabaseSyncError={supabaseSyncError}
            onDismissSupabaseError={clearSupabaseSyncError}
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
            maxHr={userProfile.maxHr}
            history={workoutHistory}
            sessionStartTime={sessionStartTime ?? 0}
            onSave={async () => {
              if (isSavingSession) return; // Prevent double-submit while saving
              await saveSession();
              setShowSummary(false);
            }}
            onDiscard={() => {
              discardSession();
              setShowSummary(false);
            }}
            isSaving={isSavingSession}
            saveProgress={saveSessionProgress}
            savePhase={saveSessionPhase}
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
              className={`h-full flex flex-col space-y-6 overflow-y-auto no-scrollbar pb-8 ${scrollSurfaceBleed}`}
            >
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
                    onStopSession={handleStopRecording}
                    onReconnectHr={connectHeartRate}
                    onReconnectBike={connectBike}
                  />
                ) : (
                  <PreRideCockpit
                    currentData={currentData}
                    userProfile={userProfile}
                    hrConnected={hrConnected}
                    bikeConnected={bikeConnected}
                    bleError={bleError}
                    connectHeartRate={connectHeartRate}
                    connectBike={connectBike}
                    onStart={() => {
                      // HR strap is required to start: the bike HR fallback
                      // was removed, so a session without the strap records
                      // no heart rate at all.
                      if (hrConnected) toggleRecording();
                    }}
                    onDisconnect={disconnect}
                    onOpenSettings={() => setShowSettings(true)}
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
              borderRadius: '8px'
            }}
            type="button"
            onClick={handleStopRecording}
            aria-label={t('Stop workout session')}
            title={t('Stop workout session')}
            className="vp-focus-ring fixed top-6 right-6 z-100 group flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-vp-danger/30 bg-vp-danger/10 text-vp-danger shadow-2xl backdrop-blur-sm transition-colors hover:border-vp-danger/60 hover:bg-vp-danger hover:text-white"
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

      <AutoSyncNotice
        notice={autoSyncNotice}
        onDismiss={dismissAutoSyncNotice}
        onOpenHistory={() => setShowHistory(true)}
      />

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
