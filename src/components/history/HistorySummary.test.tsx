import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { HistorySummary } from './HistorySummary';
import type { AdvancedSummary, ComparisonSummary, GlobalSummary, IntensitySummary, PowerZoneShare, SummaryInsights } from '@/lib/history-types';
import type { TrainingLoadMetrics } from '@/lib/training-load';

// Pin the locale so number formatting (e.g. 3,980 kcal) is deterministic
// instead of following the machine's default locale.
beforeEach(() => {
  try {
    window.localStorage.setItem('velopulse-locale', 'en');
  } catch {
    // storage unavailable — the provider falls back to the browser language
  }
});

const globalSummary: GlobalSummary = {
  totalDistance: '214.37',
  totalCalories: 3980,
  totalDuration: '6:42:10',
  totalSessions: 12,
  totalTrainingLoad: 512.4,
  averageTrainingLoad: 42.7,
  sevenDayTrainingLoad: 120,
  hrrSessions: 3,
  avgHrr: 24,
  bestHrr: 31,
  hrrSeries: [21, 24, 27],
};

const summaryInsights: SummaryInsights = {
  avgDistancePerSession: '17.9',
  avgDurationPerSession: '33:30',
  bestPeriodLabel: 'Apr 3',
  bestPeriodDistance: '48.0',
  lastWorkoutLabel: 'Apr 12, 2026',
  activeDaysLabel: '22/30 days',
  currentStreakLabel: '4 days',
  longestStreakLabel: '6 days',
  activeSpanLabel: '30 days',
};

const comparisonSummary: ComparisonSummary = {
  label: 'vs previous 30 days',
  headline: 'distance up 18%',
  metrics: { distance: 214.37, calories: 3980, duration: 402, sessions: 12, trimp: 512.4 },
  deltas: {
    distance: { value: 18, direction: 'up', hasBaseline: true },
    calories: { value: -4, direction: 'down', hasBaseline: true },
    duration: { value: 9, direction: 'up', hasBaseline: true },
    sessions: { value: 0, direction: 'flat', hasBaseline: true },
    trimp: { value: 22, direction: 'up', hasBaseline: true },
  },
};

const powerZones: PowerZoneShare[] = [
  { label: 'Z1', name: 'Recovery', color: 'bg-hw-muted', range: '<110', seconds: 600, percent: 20, time: '10:00' },
  { label: 'Z2', name: 'Endurance', color: 'bg-blue-400', range: '110-150', seconds: 900, percent: 30, time: '15:00' },
  { label: 'Z3', name: 'Tempo', color: 'bg-green-400', range: '150-180', seconds: 600, percent: 20, time: '10:00' },
  { label: 'Z4', name: 'Threshold', color: 'bg-yellow-400', range: '180-210', seconds: 450, percent: 15, time: '07:30' },
  { label: 'Z5', name: 'VO2 Max', color: 'bg-orange-500', range: '210-240', seconds: 240, percent: 8, time: '04:00' },
  { label: 'Z6', name: 'Anaerobic', color: 'bg-red-500', range: '240-300', seconds: 150, percent: 5, time: '02:30' },
  { label: 'Z7', name: 'Neuro', color: 'bg-purple-500', range: '>300', seconds: 60, percent: 2, time: '01:00' },
];

const intensity: IntensitySummary = {
  zones: [
    { label: 'Z1', range: '<95', seconds: 600, percent: 20, time: '10:00' },
    { label: 'Z2', range: '95-114', seconds: 1500, percent: 50, time: '25:00' },
    { label: 'Z3', range: '114-133', seconds: 570, percent: 19, time: '09:30' },
    { label: 'Z4', range: '133-152', seconds: 270, percent: 9, time: '04:30' },
    { label: 'Z5', range: '>152', seconds: 60, percent: 2, time: '01:00' },
  ],
  countedSeconds: 3000,
  belowZoneSeconds: 0,
  easyShare: 0.72,
  hardShare: 0.1,
  sessionTypes: { easy: 8, moderate: 3, hard: 1 },
  powerZones,
  powerCountedSeconds: 3000,
  powerBelowZoneSeconds: 0,
  hasFtp: true,
};

const trainingLoadMetrics: TrainingLoadMetrics = {
  acuteLoad: 120,
  chronicLoad: 110,
  acuteChronicRatio: 1.09,
  monotony: 1.2,
  strain: 144,
  trainingDays: 5,
  recommendation: 'Maintain',
  recommendationDetail: 'Recent load is close to your 3-week baseline. Keep the next session controlled.',
};

const advanced: AdvancedSummary = {
  coverage: { sessions: 12, withHeartRate: 12, withPower: 9, withHrr: 3 },
  loadTrend: {
    ctl: 52.4,
    atl: 61.2,
    tsb: -8.8,
    ctlSeries: [40, 45, 52.4],
    atlSeries: [50, 58, 61.2],
    days: 90,
    trainingDays: 30,
    established: true,
  },
  bodyMetrics: {
    avgPower: 172,
    peakPower: 420,
    avgWkg: 2.15,
    peakWkg: 5.25,
    kcalPerKgHour: 8.4,
  },
  hasWeight: true,
};

const baseProps = {
  intensity,
  advanced,
  summaryPeriod: 'daily' as const,
  setSummaryPeriod: () => {},
  summaryRange: '30d' as const,
  setSummaryRange: () => {},
  weeklyMetric: 'distance' as const,
  setWeeklyMetric: () => {},
  normalizedChartData: [],
  weeklyDailyData: [],
  loadRatioWeeklyData: [],
  summaryInsights: null,
  comparisonSummary: null,
  trainingLoadMetrics,
};

describe('HistorySummary', () => {
  it('keeps the range selector usable when the range holds no sessions', () => {
    const setSummaryRange = vi.fn();
    render(
      <I18nProvider>
        <HistorySummary {...baseProps} globalSummary={null} setSummaryRange={setSummaryRange} />
      </I18nProvider>
    );

    // Regression: the header used to disappear with the data, leaving an empty
    // tab and no way to widen the selected range.
    expect(screen.getByText('No sessions in this range')).toBeInTheDocument();
    expect(screen.getByText('Try a wider range or record a workout')).toBeInTheDocument();

    const ranges = screen.getAllByRole('radio');
    expect(ranges).toHaveLength(5);
    fireEvent.click(screen.getByRole('radio', { name: 'ALL' }));
    expect(setSummaryRange).toHaveBeenCalledWith('all');
  });

  it('renders the range totals once, with a caption', () => {
    render(
      <I18nProvider>
        <HistorySummary {...baseProps} globalSummary={globalSummary} summaryInsights={summaryInsights} />
      </I18nProvider>
    );

    expect(screen.getByText('214.4')).toBeInTheDocument();
    expect(screen.getByText('6:42:10')).toBeInTheDocument();
    expect(screen.getByText(/^3[.,]980$/)).toBeInTheDocument();
    expect(screen.getByText('512')).toBeInTheDocument();
    expect(screen.getByText('17.9', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('22/30 days', { exact: false })).toBeInTheDocument();
  });

  it('renders deltas against the previous period when a baseline exists', () => {
    render(
      <I18nProvider>
        <HistorySummary
          {...baseProps}
          globalSummary={globalSummary}
          summaryInsights={summaryInsights}
          comparisonSummary={comparisonSummary}
        />
      </I18nProvider>
    );

    expect(screen.getByText('18%')).toBeInTheDocument();
    expect(screen.getByText('22%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('No comparison')).not.toBeInTheDocument();
  });

  it('reports "No comparison" instead of a new baseline on the all-time range', () => {
    render(
      <I18nProvider>
        <HistorySummary
          {...baseProps}
          globalSummary={globalSummary}
          summaryInsights={summaryInsights}
          summaryRange="all"
        />
      </I18nProvider>
    );

    expect(screen.getAllByText('No comparison').length).toBeGreaterThan(0);
    expect(screen.queryByText('New baseline')).not.toBeInTheDocument();
  });

  it('summarises load once, with a concrete target band and the HRR trend row', () => {
    render(
      <I18nProvider>
        <HistorySummary {...baseProps} globalSummary={globalSummary} summaryInsights={summaryInsights} />
      </I18nProvider>
    );

    // Recommendation appears once on the surface (the detail text lives in the
    // collapsed panel), and the target band is derived from the usual week.
    expect(screen.getAllByText('Maintain')).toHaveLength(1);
    expect(screen.getByText('Target next week')).toBeInTheDocument();
    expect(screen.getByText('88–143')).toBeInTheDocument();

    // HRR is a single row: average, best, latest and its delta vs earlier rides.
    // (The values are nested elements, so match the label as a substring.)
    expect(screen.getByText(/Avg HRR/)).toBeInTheDocument();
    expect(screen.getByText(/Best HRR/)).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('shows the intensity split: zone legend, easy/hard volume and session types', () => {
    render(
      <I18nProvider>
        <HistorySummary {...baseProps} globalSummary={globalSummary} summaryInsights={summaryInsights} />
      </I18nProvider>
    );

    expect(screen.getByText('Time in heart-rate zones')).toBeInTheDocument();
    // Z5 exists in both the heart-rate and the power legend.
    expect(screen.getAllByText('Z5').length).toBeGreaterThan(0);
    expect(screen.getByText(/Easy volume/)).toBeInTheDocument();
    // 72% easy / 10% hard is neither "mostly easy" nor hard-heavy.
    expect(screen.getByText('Balanced mix of easy and hard riding.')).toBeInTheDocument();
    expect(screen.getByText('8 Easy')).toBeInTheDocument();
    expect(screen.getByText('1 Hard')).toBeInTheDocument();
  });

  it('renders the power-zone distribution only once an FTP is set', () => {
    render(
      <I18nProvider>
        <HistorySummary {...baseProps} globalSummary={globalSummary} summaryInsights={summaryInsights} />
      </I18nProvider>
    );

    expect(screen.getByText('Power zones')).toBeInTheDocument();
    expect(screen.getByText('Time in power zones')).toBeInTheDocument();
    // Z6/Z7 only exist in the power legend (heart-rate zones stop at Z5) and
    // the legend spells out the POWER_ZONES name with the absolute watt range.
    expect(screen.getByText('Z7')).toBeInTheDocument();
    expect(screen.getAllByText('Z6').length).toBeGreaterThan(0);
    expect(screen.getByText('Recovery · <110')).toBeInTheDocument();
    expect(screen.getByText('Neuro · >300')).toBeInTheDocument();
    expect(screen.queryByText('Set your FTP to see power zones.')).not.toBeInTheDocument();
  });

  it('shows only an invitation when the FTP gate is closed', () => {
    render(
      <I18nProvider>
        <HistorySummary
          {...baseProps}
          intensity={{ ...intensity, powerZones: [], powerCountedSeconds: 0, powerBelowZoneSeconds: 0, hasFtp: false }}
          globalSummary={globalSummary}
          summaryInsights={summaryInsights}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Set your FTP to see power zones.')).toBeInTheDocument();
    // Regression guard: no zone number may leak out of a closed gate — not even
    // a 0% bar that would read as "all of it was Recovery".
    expect(screen.queryByText('Z6')).not.toBeInTheDocument();
    expect(screen.queryByText('Z7')).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery · <110')).not.toBeInTheDocument();
    expect(screen.queryByText('Time in power zones')).not.toBeInTheDocument();
  });

  it('reports missing power data instead of an empty power bar', () => {
    render(
      <I18nProvider>
        <HistorySummary
          {...baseProps}
          intensity={{ ...intensity, powerZones: [], powerCountedSeconds: 0, powerBelowZoneSeconds: 1200, hasFtp: true }}
          globalSummary={globalSummary}
          summaryInsights={summaryInsights}
        />
      </I18nProvider>
    );

    expect(screen.getByText('No power data in this range')).toBeInTheDocument();
    expect(screen.queryByText('Z7')).not.toBeInTheDocument();
  });

  it('degrades gracefully when no session in the range has heart-rate data', () => {
    render(
      <I18nProvider>
        <HistorySummary
          {...baseProps}
          intensity={{
            ...intensity,
            zones: intensity.zones.map(zone => ({ ...zone, seconds: 0, percent: 0, time: '00:00' })),
            countedSeconds: 0,
            belowZoneSeconds: 0,
            easyShare: 0,
            hardShare: 0,
            sessionTypes: { easy: 0, moderate: 0, hard: 0 },
          }}
          globalSummary={globalSummary}
          summaryInsights={summaryInsights}
        />
      </I18nProvider>
    );

    expect(screen.getByText('No heart-rate data in this range')).toBeInTheDocument();
  });

  it('keeps duration, coverage and the fitness model in the collapsed panel', () => {
    render(
      <I18nProvider>
        <HistorySummary {...baseProps} globalSummary={globalSummary} summaryInsights={summaryInsights} />
      </I18nProvider>
    );

    // Active time (3000 s counted, nothing below Z1).
    expect(screen.getByText('50:00')).toBeInTheDocument();
    expect(screen.getByText('100% of 50:00 recorded')).toBeInTheDocument();
    // Coverage chips.
    expect(screen.getByText('Data coverage')).toBeInTheDocument();
    expect(screen.getByText('12 sessions')).toBeInTheDocument();
    expect(screen.getByText('Power 9')).toBeInTheDocument();
    // Fitness / fatigue / form (CTL 52.4, ATL 61.2 → TSB -8.8 = neutral).
    expect(screen.getByText(/Fitness \(CTL\)/)).toBeInTheDocument();
    expect(screen.getByText('52.4')).toBeInTheDocument();
    expect(screen.getByText('61.2')).toBeInTheDocument();
    expect(screen.getByText('-8.8')).toBeInTheDocument();
    expect(screen.getByText(/Neutral/)).toBeInTheDocument();
    // Repetition risk and strain moved here from the load card.
    expect(screen.getByText('1.20')).toBeInTheDocument();
    expect(screen.getByText('144')).toBeInTheDocument();
  });

  it('shows W/kg and kcal/kg/h in the L2 panel when a weight is set', () => {
    render(
      <I18nProvider>
        <HistorySummary {...baseProps} globalSummary={globalSummary} summaryInsights={summaryInsights} />
      </I18nProvider>
    );

    // Body-mass metrics sit in the collapsed panel: they re-scale numbers that
    // already hold the first screen, so they must not consume its budget.
    expect(screen.getByText('Per body mass')).toBeInTheDocument();
    expect(screen.getAllByText(/Avg W\/kg/).length).toBeGreaterThan(0);
    expect(screen.getByText('2.15')).toBeInTheDocument();
    expect(screen.getByText('5.25')).toBeInTheDocument();
    expect(screen.getByText('8.4')).toBeInTheDocument();
    expect(screen.queryByText('Add your weight in Settings to see W/kg and kcal/kg per hour.')).not.toBeInTheDocument();
  });

  it('hides every per-kilogram figure without a body weight', () => {
    render(
      <I18nProvider>
        <HistorySummary
          {...baseProps}
          advanced={{ ...advanced, bodyMetrics: null, hasWeight: false }}
          globalSummary={globalSummary}
          summaryInsights={summaryInsights}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Add your weight in Settings to see W/kg and kcal/kg per hour.')).toBeInTheDocument();
    expect(screen.queryByText(/Avg W\/kg/)).not.toBeInTheDocument();
    expect(screen.queryByText('2.15')).not.toBeInTheDocument();
  });
});
