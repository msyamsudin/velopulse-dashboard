import { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkoutHistoryData } from '../hooks/useWorkoutHistoryData';
import { HistoryList } from './history/HistoryList';
import { HistorySummary } from './history/HistorySummary';
import { HistoryDetail } from './history/HistoryDetail';
import { Download, RefreshCw, Search, Upload, X, AlertTriangle } from 'lucide-react';
import type { ImportTcxResult } from '../store/useWorkoutStore';
import { getSessionOutcome, getWorkoutQuality } from '../lib/workout-analysis';
import { IconButton, SegmentedControl, StatusPill } from './ui';
import type { SupabaseErrorInfo } from '../lib/supabase-errors';
import { useI18n } from '@/i18n';

interface WorkoutHistoryProps {
  sessions: any[];
  onClose: () => void;
  onSyncSupabasePending?: () => Promise<void>;
  onLoadMoreSupabaseHistory?: () => Promise<void>;
  onImportTCX?: (tcxContent: string, filename?: string) => Promise<ImportTcxResult>;
  hasMoreSupabaseHistory?: boolean;
  maxHr?: number;
  supabaseSyncError?: SupabaseErrorInfo | null;
  onDismissSupabaseError?: () => void;
}

export const WorkoutHistory = ({
  sessions,
  onClose,
  onSyncSupabasePending,
  onLoadMoreSupabaseHistory,
  onImportTCX,
  hasMoreSupabaseHistory = false,
  maxHr = 190,
  supabaseSyncError,
  onDismissSupabaseError
}: WorkoutHistoryProps) => {
  const { t } = useI18n();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sessions' | 'overview' | 'trends' | 'load'>('sessions');
  const [summaryPeriod, setSummaryPeriod] = useState<'yearly' | 'monthly' | 'weekly' | 'daily'>('daily');
  const [summaryRange, setSummaryRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [weeklyMetric, setWeeklyMetric] = useState<'distance' | 'calories' | 'duration' | 'cadence' | 'trimp'>('distance');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [showTotals, setShowTotals] = useState(false);
  const [offsetDays, setOffsetDays] = useState(0);
  const [sessionSearch, setSessionSearch] = useState('');
  const [isSupabaseRetrying, setIsSupabaseRetrying] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Batch selection states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedSessionIds([]);
  };

  const handleToggleSelectSession = (id: string) => {
    setSelectedSessionIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedSessionIds(filteredSessions.map(s => s.id));
  };

  const handleClearSelection = () => {
    setSelectedSessionIds([]);
  };

  const handleExportZip = async () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    const { downloadTCXZip } = await import('../lib/export-service');
    await downloadTCXZip(selectedSessions);
  };

  const handleExportCombined = async () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    const { downloadCombinedTCX } = await import('../lib/export-service');
    downloadCombinedTCX(selectedSessions);
  };

  // Reset offset when range changes
  useMemo(() => {
    setOffsetDays(0);
  }, [summaryRange]);

  const summaryInputSessions = useMemo(
    () => viewMode !== 'sessions' ? sessions : [],
    [viewMode, sessions]
  );

  const { calculateFullStats, globalSummary, normalizedChartData, summaryInsights, comparisonSummary, trainingLoadMetrics, weeklyDailyData } = useWorkoutHistoryData({
    sessions: summaryInputSessions,
    maxHr,
    summaryPeriod,
    summaryRange,
    weeklyMetric,
    offsetDays
  });

  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    if (!query) return sessions;

    return sessions.filter(session => {
      const outcome = getSessionOutcome(session);
      const quality = getWorkoutQuality(session, maxHr);
      const date = new Date(session.date);
      const dateText = Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      const monthText = Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const searchable = [
        dateText,
        monthText,
        quality.label,
        `${outcome.distanceKm.toFixed(2)} km`,
        `${outcome.calories} kcal`,
        `${outcome.avgPower} w`,
        `${outcome.avgHr} bpm`,
        `${session.stats?.avgCadence || 0} rpm`,
      ].join(' ').toLowerCase();

      return searchable.includes(query);
    });
  }, [sessions, sessionSearch, maxHr]);

  const visibleSelectedCount = useMemo(() =>
    filteredSessions.filter(session => selectedSessionIds.includes(session.id)).length,
    [filteredSessions, selectedSessionIds]
  );

  const pendingSupabaseCount = useMemo(() =>
    sessions.filter(session => !session.synced_to_supabase).length,
    [sessions]
  );

  const handleRetrySupabaseSync = async () => {
    if (!onSyncSupabasePending) return;
    setIsSupabaseRetrying(true);
    try {
      await onSyncSupabasePending();
    } finally {
      setIsSupabaseRetrying(false);
    }
  };

  const handleLoadOlder = async () => {
    if (!onLoadMoreSupabaseHistory) return;
    setIsLoadingOlder(true);
    try {
      await onLoadMoreSupabaseHistory();
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !onImportTCX) return;
    setIsImporting(true);
    setImportNotice(null);

    const totals = { imported: 0, skipped: 0, synced: 0, pending: 0 };
    const messages: string[] = [];

    try {
      for (const file of Array.from(files)) {
        try {
          const content = await file.text();
          const result = await onImportTCX(content, file.name);
          totals.imported += result.imported;
          totals.skipped += result.skipped;
          totals.synced += result.synced;
          totals.pending += result.pending;
          messages.push(...result.messages);
        } catch (err: any) {
          messages.push(`${file.name}: ${err?.message || 'Import failed'}`);
        }
      }

      const summary = [
        totals.imported > 0 ? `${totals.imported} imported` : '',
        totals.synced > 0 ? `${totals.synced} synced` : '',
        totals.pending > 0 ? `${totals.pending} pending` : '',
        totals.skipped > 0 ? `${totals.skipped} skipped` : '',
      ].filter(Boolean).join(' / ');

      setImportNotice(summary || messages[0] || 'No sessions imported');
      if (messages.length > 0 && !summary) {
        console.warn('[TCX Import]', messages.join('\n'));
      }
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedSession = useMemo(() =>
    sessions.find(s => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const fullStats = useMemo(() =>
    selectedSession ? calculateFullStats(selectedSession) : null,
    [selectedSession, calculateFullStats]
  );

  const previousSession = useMemo(() => {
    if (!selectedSession) return null;
    const sorted = [...sessions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const selectedIndex = sorted.findIndex(s => s.id === selectedSession.id);
    return selectedIndex > 0 ? sorted[selectedIndex - 1] : null;
  }, [sessions, selectedSession]);

  const previousFullStats = useMemo(() =>
    previousSession ? calculateFullStats(previousSession) : null,
    [previousSession, calculateFullStats]
  );

  return (
    <AnimatePresence mode="wait">
      {!selectedSessionId ? (
        <motion.div
          key="list"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="fixed inset-0 z-100 flex flex-col overflow-y-auto bg-vp-bg/95 p-3 backdrop-blur-xl md:p-6"
        >
          <div className="flex h-full w-full flex-col">
            {/* Header */}
            <div className="mb-3 flex flex-col gap-4 border-b border-vp-border pb-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="vp-label">{t('Review mode')}</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal text-vp-text">
                  {t('Training log')}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill label={`${sessions.length} ${t('sessions')}`} tone="neutral" />
                  <StatusPill
                    label={pendingSupabaseCount > 0 ? `${pendingSupabaseCount} ${t('pending sync')}` : t('Supabase synced')}
                    tone={pendingSupabaseCount > 0 ? 'warning' : 'ready'}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <SegmentedControl
                  ariaLabel={t('History view')}
                  value={viewMode}
                  options={[
                    { label: t('Sessions'), value: 'sessions' },
                    { label: t('Overview'), value: 'overview' },
                    { label: t('Trends'), value: 'trends' },
                    { label: t('Load'), value: 'load' },
                  ]}
                  onChange={(value) => setViewMode(value as typeof viewMode)}
                />
                <button type="button" onClick={onClose} className="vp-button vp-focus-ring" aria-label={t('Close training log')}>
                  {t('Close')}
                </button>
              </div>
            </div>

            {supabaseSyncError && (
              <div className="mb-3 flex flex-wrap items-start gap-3 rounded-lg border border-vp-warning/40 bg-vp-warning/10 px-3 py-2.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-vp-warning" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-vp-warning">
                    {t('History sync unavailable')}
                  </p>
                  <p className="text-[11px] leading-relaxed text-vp-text/80">
                    {supabaseSyncError.userMessage}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onSyncSupabasePending && (
                    <IconButton
                      onClick={handleRetrySupabaseSync}
                      disabled={isSupabaseRetrying}
                      label={t('Retry Supabase sync')}
                      icon={<RefreshCw size={13} className={isSupabaseRetrying ? 'animate-spin' : ''} />}
                      tone="primary"
                    />
                  )}
                  {onDismissSupabaseError && (
                    <IconButton
                      onClick={onDismissSupabaseError}
                      label={t('Close')}
                      icon={<X size={13} />}
                    />
                  )}
                </div>
              </div>
            )}

            {viewMode === 'sessions' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Batch Export Control Panel */}
                {sessions.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-vp-border bg-white/[0.03] p-2.5">
                    <div className="contents">
                      <div className="relative order-1 min-w-[260px] flex-1 lg:max-w-xl">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vp-muted" />
                        <input
                          value={sessionSearch}
                          onChange={(event) => setSessionSearch(event.target.value)}
                          placeholder={t('Search month, date, intensity, metric...')}
                          className="vp-focus-ring w-full rounded-lg border border-vp-border bg-vp-bg/60 py-2.5 pl-9 pr-9 text-xs text-vp-text outline-none transition-colors placeholder:text-vp-muted focus:border-vp-accent/40 font-mono"
                        />
                        {sessionSearch && (
                          <IconButton
                            onClick={() => setSessionSearch('')}
                            className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2"
                            label={t('Clear search')}
                            icon={<X size={13} />}
                          />
                        )}
                      </div>
                      <div className="order-4 ml-auto flex flex-wrap items-center gap-2">
                        <StatusPill label={`${t('Showing')} ${filteredSessions.length} ${t('of')} ${sessions.length}`} tone="neutral" />
                        {pendingSupabaseCount > 0 && onSyncSupabasePending && (
                          <IconButton
                            onClick={handleRetrySupabaseSync}
                            disabled={isSupabaseRetrying}
                            label={t('Retry Supabase sync')}
                            icon={<RefreshCw size={13} className={isSupabaseRetrying ? 'animate-spin' : ''} />}
                            tone="primary"
                          />
                        )}
                      </div>
                    </div>

                    <div className="contents">
                      <div className="order-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleSelectionMode}
                        aria-label={isSelectionMode ? 'Cancel batch export selection' : 'Start batch export selection'}
                        className={`vp-button vp-focus-ring ${
                          isSelectionMode 
                            ? 'vp-button-primary' 
                            : ''
                        }`}
                      >
                        {t(isSelectionMode ? 'Cancel Batch' : 'Batch Export')}
                      </button>
                      {isSelectionMode && (
                        <span className="text-[10px] font-mono uppercase text-vp-accent tracking-widest font-bold">
                          {visibleSelectedCount} {t('of')} {filteredSessions.length} {t('visible selected')}
                        </span>
                      )}
                      </div>

                      <div className="order-3 flex flex-wrap items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".tcx,.xml,application/xml,text/xml"
                          multiple
                          className="hidden"
                          onChange={(event) => handleImportFiles(event.target.files)}
                        />
                        {onImportTCX && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            aria-label="Import TCX workout files"
                            className="vp-button vp-focus-ring"
                          >
                            <Upload size={13} />
                            {t(isImporting ? 'Importing' : 'Import TCX')}
                          </button>
                        )}
                        {isSelectionMode && (
                          <>
                          <button
                            type="button"
                            onClick={visibleSelectedCount === filteredSessions.length ? handleClearSelection : handleSelectAll}
                            aria-label={visibleSelectedCount === filteredSessions.length ? 'Deselect visible sessions' : 'Select visible sessions'}
                            className="vp-button vp-focus-ring"
                          >
                            {t(visibleSelectedCount === filteredSessions.length ? 'Deselect Visible' : 'Select Visible')}
                          </button>
                          <button
                            type="button"
                            onClick={handleExportCombined}
                            disabled={selectedSessionIds.length === 0}
                            aria-label="Export selected sessions as one combined TCX file"
                            className="vp-button vp-focus-ring border-vp-warning/30 bg-vp-warning/10 text-vp-warning hover:bg-vp-warning hover:text-vp-bg"
                          >
                            <Download size={13} />
                            Combined TCX
                          </button>
                          <button
                            type="button"
                            onClick={handleExportZip}
                            disabled={selectedSessionIds.length === 0}
                            aria-label="Export selected sessions as individual TCX files in a ZIP"
                            className="vp-button vp-focus-ring border-vp-accent/30 bg-vp-accent/10 text-vp-accent hover:bg-vp-accent hover:text-vp-bg"
                          >
                            <Download size={13} />
                            ZIP (Individual)
                          </button>
                          </>
                        )}
                      </div>
                    </div>
                    {importNotice && (
                      <div className="order-5 basis-full rounded border border-vp-accent/20 bg-vp-accent/5 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-vp-accent">
                        {importNotice}
                      </div>
                    )}
                  </div>
                )}

                <div className="-mx-3 flex-1 overflow-y-auto px-3 pb-8 custom-scrollbar md:-mx-6 md:px-6">
                  <HistoryList 
                    sessions={filteredSessions}
                    maxHr={maxHr} 
                    onSelectSession={setSelectedSessionId} 
                    isSelectionMode={isSelectionMode}
                    selectedSessionIds={selectedSessionIds}
                    onToggleSelectSession={handleToggleSelectSession}
                  />
                  {hasMoreSupabaseHistory && !sessionSearch && (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={handleLoadOlder}
                        disabled={isLoadingOlder}
                        aria-label="Load older workouts"
                        className="vp-button vp-focus-ring border-vp-accent/30 text-vp-accent hover:bg-vp-accent hover:text-vp-bg"
                      >
                        <RefreshCw size={12} className={isLoadingOlder ? 'animate-spin' : ''} />
                        {t(isLoadingOlder ? 'Loading older' : 'Load older workouts')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <HistorySummary 
                section={viewMode}
                sessions={sessions}
                onSelectSession={setSelectedSessionId}
                globalSummary={globalSummary}
                showTotals={showTotals}
                setShowTotals={setShowTotals}
                summaryPeriod={summaryPeriod}
                setSummaryPeriod={setSummaryPeriod}
                summaryRange={summaryRange}
                setSummaryRange={setSummaryRange}
                chartType={chartType}
                setChartType={setChartType}
                weeklyMetric={weeklyMetric}
                setWeeklyMetric={setWeeklyMetric}
                normalizedChartData={normalizedChartData}
                summaryInsights={summaryInsights}
                comparisonSummary={comparisonSummary}
                trainingLoadMetrics={trainingLoadMetrics}
                weeklyDailyData={weeklyDailyData}
                offsetDays={offsetDays}
                setOffsetDays={setOffsetDays}
              />
            )}

            <div className="mt-4 border-t border-vp-border pt-5 text-center text-[10px] font-mono uppercase tracking-[0.24em] text-vp-muted">
              Cloud telemetry archive
            </div>
          </div>
        </motion.div>
      ) : (
        <HistoryDetail 
          session={selectedSession}
          fullStats={fullStats}
          previousSession={previousSession}
          previousFullStats={previousFullStats}
          maxHr={maxHr}
          onBack={() => setSelectedSessionId(null)}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
};
