import { useI18n } from '@/i18n';
import type { DailySummaryDay, MetricKey } from '@/lib/history-types';
import { formatDailyMetric } from './format';

interface ConsistencyMapProps {
  weeklyDailyData: DailySummaryDay[];
  metricColor: string;
  weeklyMetric: MetricKey;
}

export const ConsistencyMap = ({ weeklyDailyData, metricColor, weeklyMetric }: ConsistencyMapProps) => {
  const { locale, t } = useI18n();

  const parseLocalDate = (date: string) => new Date(`${date}T00:00:00`);
  const activeDays = weeklyDailyData.filter(day => day.hasData).length;
  const totalSessions = weeklyDailyData.reduce((total, day) => total + day.sessions, 0);
  const consistency = Math.round((activeDays / weeklyDailyData.length) * 100);
  const peakSessions = Math.max(...weeklyDailyData.map(day => day.sessions), 1);
  const isCompactMode = weeklyDailyData.length > 28;
  const sessionOpacity = (sessions: number) => {
    if (sessions >= 4) return 0.95;
    if (sessions === 3) return 0.75;
    if (sessions === 2) return 0.52;
    return 0.3;
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted">{t('Consistency Map')}</div>
          <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">
            {t('Daily activity pattern for the selected range')}
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { label: t('Active days'), value: `${activeDays}` },
            { label: t('Sessions'), value: `${totalSessions}` },
            { label: t('Consistency'), value: `${consistency}%` },
          ].map(item => (
            <div key={item.label} className="min-w-[60px] rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-center">
              <div className="whitespace-nowrap text-[7px] font-mono uppercase tracking-[0.12em] text-white/35">{item.label}</div>
              <div className="mt-1 font-mono text-base font-bold text-white tabular-nums">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {isCompactMode ? (
        <div className="overflow-x-auto pb-1">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${Math.min(weeklyDailyData.length, 52)}, minmax(18px, 1fr))`,
              minWidth: `${weeklyDailyData.length * 22}px`,
            }}
          >
            {weeklyDailyData.map(day => {
              const date = parseLocalDate(day.date);
              const tooltipValue = formatDailyMetric(day, weeklyMetric);
              const opacity = sessionOpacity(day.sessions);
              return (
                <div
                  key={day.date}
                  className={`group relative aspect-square rounded-sm transition-all ${
                    day.isToday
                      ? 'ring-1 ring-vp-accent'
                      : ''
                  }`}
                  style={{
                    backgroundColor: day.hasData
                      ? `color-mix(in srgb, var(--color-vp-accent) ${Math.round(opacity * 100)}%, transparent)`
                      : 'rgba(255,255,255,0.04)',
                  }}
                  title={`${date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })} — ${day.sessions} sessions`}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-vp-surface-raised px-2.5 py-1.5 text-[9px] font-mono shadow-xl group-hover:block">
                    <div className="text-white/55">{date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="mt-0.5 text-white">{day.sessions} {t('sessions')}</div>
                    <div className="mt-0.5" style={{ color: metricColor }}>{tooltipValue}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1 overflow-x-hidden text-[7px] font-mono text-white/25">
            {weeklyDailyData.reduce<{ label: string; idx: number }[]>((acc, day, idx) => {
              const d = parseLocalDate(day.date);
              if (idx === 0 || d.getDate() === 1) {
                acc.push({ label: d.toLocaleDateString(locale, { month: 'short' }), idx });
              }
              return acc;
            }, []).map(({ label, idx }) => (
              <span key={`${label}-${idx}`} style={{ marginLeft: idx === 0 ? 0 : `${(22 * (idx)) - (label.length * 4)}px` }}>{label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}
        >
          {weeklyDailyData.map(day => {
            const date = parseLocalDate(day.date);
            const tooltipValue = formatDailyMetric(day, weeklyMetric);
            const opacity = sessionOpacity(day.sessions);
            const heightPct = day.hasData ? Math.max(18, (day.sessions / peakSessions) * 100) : 0;

            return (
              <div
                key={day.date}
                className={`group relative flex min-h-[88px] flex-col rounded-xl border px-2.5 py-2.5 transition-colors ${
                  day.isToday
                    ? 'border-vp-accent/70 bg-vp-accent/8'
                    : day.hasData
                      ? 'border-vp-accent/20 bg-vp-accent/7 hover:border-vp-accent/35'
                      : 'border-white/7 bg-white/[0.025] hover:border-white/14'
                }`}
                title={`${day.label} ${day.shortDate} - ${day.sessions} sessions`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-mono uppercase tracking-[0.08em] text-white/35">
                      {date.toLocaleDateString(locale, { weekday: 'short' })}
                    </div>
                    <div className="mt-0.5 font-mono text-sm font-bold leading-none text-white/80 tabular-nums">
                      {date.getDate()}
                    </div>
                  </div>
                  {day.isToday && (
                    <div className="shrink-0 rounded border border-vp-accent/40 px-1 py-0.5 text-[6px] font-mono uppercase tracking-wider text-vp-accent">
                      {t('Today')}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
                    <div
                      className="h-full rounded-full bg-vp-accent transition-[width] duration-500"
                      style={{ width: `${heightPct}%`, opacity: day.hasData ? opacity : 0 }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[7px] font-mono uppercase text-white/30">{t('ses.')}</span>
                    <span className={`font-mono text-xs font-bold tabular-nums ${
                      day.hasData ? 'text-vp-accent' : 'text-white/20'
                    }`}>
                      {day.sessions}
                    </span>
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-40 -translate-x-1/2 rounded-lg border border-white/10 bg-vp-surface-raised px-2.5 py-2 text-[9px] font-mono shadow-xl group-hover:block">
                  <div className="text-white/55">{day.label} · {day.shortDate}</div>
                  <div className="mt-1 text-white">{day.sessions} {t('sessions')}</div>
                  <div className="mt-1" style={{ color: metricColor }}>{tooltipValue}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8px] font-mono uppercase tracking-[0.12em] text-white/30">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-vp-accent bg-vp-accent/15" />
          <span>{t('Today')}</span>
        </div>
        <span className="text-white/15">·</span>
        <span>{t('Bar length and color show session count')}</span>
      </div>
    </>
  );
};
