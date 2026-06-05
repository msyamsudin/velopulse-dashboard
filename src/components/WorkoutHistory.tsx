import { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkoutHistoryData } from '../hooks/useWorkoutHistoryData';
import { HistoryList } from './history/HistoryList';
import { HistorySummary } from './history/HistorySummary';
import { HistoryDetail } from './history/HistoryDetail';
import { downloadCombinedTCX, downloadTCXZip } from '../lib/export-service';
import { Download, RefreshCw, Search, Upload, X } from 'lucide-react';
import type { ImportTcxResult } from '../store/useWorkoutStore';
import { getSessionOutcome, getWorkoutQuality } from '../lib/workout-analysis';

interface WorkoutHistoryProps {
  sessions: any[];
  onClose: () => void;
  onSyncSession?: (session: any) => void;
  onSyncSupabasePending?: () => Promise<void>;
  onLoadMoreSupabaseHistory?: () => Promise<void>;
  onImportTCX?: (tcxContent: string, filename?: string) => Promise<ImportTcxResult>;
  hasMoreSupabaseHistory?: boolean;
  isGoogleConnected?: boolean;
  maxHr?: number;
}

export const WorkoutHistory = ({
  sessions,
  onClose,
  onSyncSession,
  onSyncSupabasePending,
  onLoadMoreSupabaseHistory,
  onImportTCX,
  hasMoreSupabaseHistory = false,
  isGoogleConnected,
  maxHr = 190
}: WorkoutHistoryProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sessions' | 'summary'>('sessions');
  const [summaryPeriod, setSummaryPeriod] = useState<'yearly' | 'monthly' | 'weekly' | 'daily'>('daily');
  const [summaryRange, setSummaryRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [weeklyMetric, setWeeklyMetric] = useState<'distance' | 'calories' | 'duration'>('distance');
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
    await downloadTCXZip(selectedSessions);
  };

  const handleExportCombined = () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    downloadCombinedTCX(selectedSessions);
  };

  // Reset offset when range changes
  useMemo(() => {
    setOffsetDays(0);
  }, [summaryRange]);

  const { calculateFullStats, globalSummary, normalizedChartData, summaryInsights, comparisonSummary, weeklyDailyData } = useWorkoutHistoryData({
    sessions,
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
          className="fixed inset-0 z-100 bg-hw-bg/95 backdrop-blur-xl p-4 md:p-8 flex flex-col overflow-y-auto"
        >
          <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight uppercase font-mono flex items-center gap-4">
                  <span>Workout <span className="text-hw-accent">History</span></span>
                  <div className="flex bg-hw-muted/10 p-1 rounded-lg text-xs ml-2 md:ml-4">
                    <button
                      onClick={() => setViewMode('sessions')}
                      className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'sessions' ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                    >
                      Sessions
                    </button>
                    <button
                      onClick={() => setViewMode('summary')}
                      className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'summary' ? 'bg-hw-accent text-hw-bg' : 'text-hw-muted hover:text-white'}`}
                    >
                      Summary
                    </button>
                  </div>
                </h2>
                <div className="text-hw-muted text-xs font-mono uppercase tracking-widest mt-1">
                  Past workout telemetry data
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded border border-hw-muted/30 text-hw-muted hover:border-hw-muted hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all"
              >
                Close Dashboard
              </button>
            </div>

            {viewMode === 'sessions' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Batch Export Control Panel */}
                {sessions.length > 0 && (
                  <div className="flex flex-col gap-4 mb-6 p-4 rounded-lg bg-hw-muted/5 border border-hw-muted/10 backdrop-blur-md">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="relative w-full lg:max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-hw-muted" />
                        <input
                          value={sessionSearch}
                          onChange={(event) => setSessionSearch(event.target.value)}
                          placeholder="Search month, date, intensity, metric..."
                          className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-9 text-xs text-white outline-none transition-colors placeholder:text-hw-muted focus:border-hw-accent/40 font-mono"
                        />
                        {sessionSearch && (
                          <button
                            onClick={() => setSessionSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-hw-muted hover:text-white"
                            title="Clear search"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-hw-muted">
                        <span>Showing <span className="text-white">{filteredSessions.length}</span> of {sessions.length} sessions</span>
                        <span className={`rounded border px-2 py-1 ${
                          pendingSupabaseCount > 0
                            ? 'border-yellow-400/25 bg-yellow-400/5 text-yellow-300'
                            : 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
                        }`}>
                          Supabase {pendingSupabaseCount > 0 ? `${pendingSupabaseCount} pending` : 'synced'}
                        </span>
                        {pendingSupabaseCount > 0 && onSyncSupabasePending && (
                          <button
                            onClick={handleRetrySupabaseSync}
                            disabled={isSupabaseRetrying}
                            title="Retry Supabase sync"
                            aria-label="Retry Supabase sync"
                            className="rounded border border-hw-accent/30 px-2 py-1 text-hw-accent transition-colors hover:bg-hw-accent hover:text-hw-bg disabled:opacity-40"
                          >
                            <RefreshCw size={10} className={isSupabaseRetrying ? 'animate-spin' : ''} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                      <button
                        onClick={handleToggleSelectionMode}
                        className={`px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest transition-all border ${
                          isSelectionMode 
                            ? 'bg-hw-accent text-hw-bg border-hw-accent font-bold' 
                            : 'border-hw-muted/30 text-hw-muted hover:border-hw-accent hover:text-hw-accent'
                        }`}
                      >
                        {isSelectionMode ? 'Cancel Batch' : '✓ Batch Export'}
                      </button>
                      {isSelectionMode && (
                        <span className="text-[10px] font-mono uppercase text-hw-accent tracking-widest font-bold">
                          {visibleSelectedCount} of {filteredSessions.length} visible selected
                        </span>
                      )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white hover:border-hw-accent hover:text-hw-accent font-mono text-[10px] uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-1.5"
                          >
                            <Upload size={10} />
                            {isImporting ? 'Importing' : 'Import TCX'}
                          </button>
                        )}
                        {isSelectionMode && (
                          <>
                          <button
                            onClick={visibleSelectedCount === filteredSessions.length ? handleClearSelection : handleSelectAll}
                            className="px-3 py-1.5 rounded border border-white/10 text-white hover:border-white/30 font-mono text-[10px] uppercase tracking-widest transition-all"
                          >
                            {visibleSelectedCount === filteredSessions.length ? 'Deselect Visible' : 'Select Visible'}
                          </button>
                          <button
                            onClick={handleExportCombined}
                            disabled={selectedSessionIds.length === 0}
                            className="px-3 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500 hover:text-black font-mono text-[10px] uppercase tracking-widest transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download size={10} />
                            Combined TCX
                          </button>
                          <button
                            onClick={handleExportZip}
                            disabled={selectedSessionIds.length === 0}
                            className="px-3 py-1.5 rounded bg-hw-accent/10 border border-hw-accent/30 text-hw-accent hover:bg-hw-accent hover:text-hw-bg font-mono text-[10px] uppercase tracking-widest transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download size={10} />
                            ZIP (Individual)
                          </button>
                          </>
                        )}
                      </div>
                    </div>
                    {importNotice && (
                      <div className="rounded border border-hw-accent/20 bg-hw-accent/5 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-hw-accent">
                        {importNotice}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
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
                        onClick={handleLoadOlder}
                        disabled={isLoadingOlder}
                        className="inline-flex items-center gap-2 rounded border border-hw-accent/30 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-hw-accent transition-colors hover:bg-hw-accent hover:text-hw-bg disabled:opacity-40"
                      >
                        <RefreshCw size={12} className={isLoadingOlder ? 'animate-spin' : ''} />
                        {isLoadingOlder ? 'Loading older' : 'Load older workouts'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <HistorySummary 
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
                weeklyDailyData={weeklyDailyData}
                offsetDays={offsetDays}
                setOffsetDays={setOffsetDays}
              />
            )}

            <div className="mt-4 pt-6 border-t border-white/5 text-[10px] font-mono text-hw-muted uppercase tracking-[0.4em] text-center">
              Secured via Cloud Telemetry
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
          isGoogleConnected={isGoogleConnected}
          onSyncSession={onSyncSession}
          onBack={() => setSelectedSessionId(null)}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
};
