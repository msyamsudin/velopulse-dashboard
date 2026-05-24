import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkoutHistoryData } from '../hooks/useWorkoutHistoryData';
import { HistoryList } from './history/HistoryList';
import { HistorySummary } from './history/HistorySummary';
import { HistoryDetail } from './history/HistoryDetail';

interface WorkoutHistoryProps {
  sessions: any[];
  onClose: () => void;
  onSyncSession?: (session: any) => void;
  isGoogleConnected?: boolean;
  maxHr?: number;
}

export const WorkoutHistory = ({ sessions, onClose, onSyncSession, isGoogleConnected, maxHr = 190 }: WorkoutHistoryProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'sessions' | 'summary'>('sessions');
  const [summaryPeriod, setSummaryPeriod] = useState<'yearly' | 'monthly' | 'weekly' | 'daily'>('daily');
  const [summaryRange, setSummaryRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [weeklyMetric, setWeeklyMetric] = useState<'distance' | 'calories' | 'duration'>('distance');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [showTotals, setShowTotals] = useState(false);
  const [offsetDays, setOffsetDays] = useState(0);

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

  const selectedSession = useMemo(() =>
    sessions.find(s => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  const fullStats = useMemo(() =>
    selectedSession ? calculateFullStats(selectedSession) : null,
    [selectedSession, calculateFullStats]
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
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
                <HistoryList 
                  sessions={sessions} 
                  maxHr={maxHr} 
                  onSelectSession={setSelectedSessionId} 
                />
              </div>
            ) : (
              <HistorySummary 
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
          isGoogleConnected={isGoogleConnected}
          onSyncSession={onSyncSession}
          onBack={() => setSelectedSessionId(null)}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
};
