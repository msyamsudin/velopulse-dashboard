import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { HistorySummary } from './HistorySummary';
import type { ComparisonSummary, GlobalSummary, SummaryInsights } from '@/lib/history-types';
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

const baseProps = {
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
});
