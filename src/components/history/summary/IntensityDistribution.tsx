import { useI18n } from '@/i18n';
import type { IntensitySummary } from '@/lib/history-types';
import { SESSION_TYPE_LABELS } from '@/lib/workout-analysis';
import { formatDuration } from '@/utils/formatters';

interface IntensityDistributionProps {
  intensity: IntensitySummary;
}

/** Zone colours mirror HR_ZONES in lib/constants, as bar backgrounds. */
const ZONE_BAR = [
  'bg-hw-muted/50',
  'bg-green-400',
  'bg-hw-accent',
  'bg-orange-500',
  'bg-red-500',
];

const TYPE_THEME: Record<string, { badge: string; dot: string }> = {
  easy: {
    badge: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  tempo: {
    badge: 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    dot: 'bg-cyan-400',
  },
  hard: {
    badge: 'border border-rose-500/20 bg-rose-500/10 text-rose-300',
    dot: 'bg-rose-500',
  },
};

const DEFAULT_TYPE_THEME = {
  badge: 'border border-white/10 bg-white/5 text-white/70',
  dot: 'bg-white/40',
};

/**
 * Block 4 of the Summary view: how the recorded time was actually spent.
 *
 * The range totals answer "how much" and the trend answers "improving?", but
 * neither says whether the riding was mostly easy or mostly hard. This block is
 * the evidence behind the abstract "repetition risk" warning: a monotony score
 * of 3.1 becomes readable when the zone bar shows 82% of the time in Z3.
 *
 * Two sub-blocks share the card: heart-rate zones (always) and power zones
 * (only while the rider has an FTP). They use the same definitions — samples
 * outside the lowest countable zone belong to no zone and are reported as a
 * coverage footnote instead of being folded into the catch-all zone.
 */
export const IntensityDistribution = ({ intensity }: IntensityDistributionProps) => {
  const { t } = useI18n();
  const {
    zones,
    countedSeconds,
    belowZoneSeconds,
    easyShare,
    hardShare,
    zoneByType,
    powerZones,
    powerCountedSeconds,
    powerBelowZoneSeconds,
    hasFtp,
  } = intensity;

  const recordedSeconds = countedSeconds + belowZoneSeconds;
  const belowZonePercent = recordedSeconds > 0 ? Math.round((belowZoneSeconds / recordedSeconds) * 100) : 0;
  const easyPercent = Math.round(easyShare * 100);
  const hardPercent = Math.round(hardShare * 100);
  const midPercent = Math.max(0, 100 - easyPercent - hardPercent);

  const powerRecordedSeconds = powerCountedSeconds + powerBelowZoneSeconds;
  const powerBelowPercent = powerRecordedSeconds > 0
    ? Math.round((powerBelowZoneSeconds / powerRecordedSeconds) * 100)
    : 0;

  const verdict = easyShare >= 0.75
    ? t('Mostly easy volume — a solid aerobic base.')
    : hardShare >= 0.25
      ? t('A large share of hard riding — watch recovery.')
      : t('Balanced mix of easy and hard riding.');

  const insightStatus = easyShare >= 0.75
    ? {
        badge: t('Aerobic Base'),
        color: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
        dot: 'bg-emerald-400',
      }
    : hardShare >= 0.25
      ? {
          badge: t('Watch Recovery'),
          color: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
          dot: 'bg-amber-400',
        }
      : {
          badge: t('Balanced Mix'),
          color: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300',
          dot: 'bg-cyan-400',
        };

  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-accent">
          {t('Intensity')}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">
          {t('Time in heart-rate zones')}
        </div>
      </div>

      {countedSeconds === 0 ? (
        <p className="mt-3 text-[11px] text-white/40">{t('No heart-rate data in this range')}</p>
      ) : (
        <>
          {/* Vertical Histogram (5 HR Zones) */}
          <div className="mt-3 grid grid-cols-5 gap-2">
            {zones.map((zone, index) => (
              <div key={zone.label} className="group flex min-w-0 flex-col items-center">
                <span className="font-mono text-xs font-bold tabular-nums text-white transition-colors group-hover:text-hw-accent">
                  {zone.percent}%
                </span>
                <div className="relative mt-1.5 flex h-20 w-full items-end justify-center overflow-hidden rounded-md border border-white/[0.04] bg-white/[0.03] p-1">
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 group-hover:brightness-110 ${ZONE_BAR[index] ?? 'bg-white/20'}`}
                    style={{ height: `${Math.max(zone.percent > 0 ? 6 : 0, zone.percent)}%` }}
                    title={`${zone.label} ${zone.range} · ${zone.percent}% · ${zone.time}`}
                  />
                </div>
                <div className="mt-2 flex w-full min-w-0 flex-col items-center text-center">
                  <div className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ZONE_BAR[index] ?? 'bg-white/20'}`} />
                    <span className="text-[10px] font-mono font-bold uppercase text-white/80">{zone.label}</span>
                  </div>
                  <span className="mt-0.5 truncate font-mono text-[9px] font-medium tabular-nums text-white/60">
                    {zone.time}
                  </span>
                  <span className="truncate font-mono text-[8px] uppercase tracking-[0.05em] text-white/30">
                    {zone.range}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 3-Zone Macro TID (Training Intensity Distribution) & Metrics */}
          <div className="mt-4 border-t border-white/6 pt-3">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="bg-emerald-400 transition-all duration-300"
                style={{ width: `${easyPercent}%` }}
                title={`Easy: ${easyPercent}%`}
              />
              <div
                className="bg-hw-accent transition-all duration-300"
                style={{ width: `${midPercent}%` }}
                title={`Moderate: ${midPercent}%`}
              />
              <div
                className="bg-rose-500 transition-all duration-300"
                style={{ width: `${hardPercent}%` }}
                title={`Hard: ${hardPercent}%`}
              />
            </div>

            {/* 3-Zone Macro TID Stat Row */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[9px] font-mono uppercase tracking-[0.12em] text-white/45">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>
                  {t('Easy volume')} <b className="text-emerald-300">{easyPercent}%</b>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-hw-accent" />
                <span>
                  {t('Tempo volume')} <b className="text-hw-accent">({midPercent}%)</b>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>
                  {t('Hard volume')}{' '}
                  <b className={hardPercent >= 25 ? 'text-amber-300' : 'text-white/70'}>{hardPercent}%</b>
                </span>
              </div>
            </div>

            {/* Smart Insight Callout Box */}
            <div className={`mt-3 rounded-lg border p-2.5 transition-colors ${insightStatus.color}`}>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${insightStatus.dot}`} />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em]">
                  {insightStatus.badge}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">{verdict}</p>
            </div>

            {belowZonePercent >= 5 && (
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                {t('{percent}% of the recorded time stayed below Z1 (warm-up or no heart-rate signal).', { percent: belowZonePercent })}
              </p>
            )}
          </div>
        </>
      )}

      {/* Same zones, split by session type */}
      {zoneByType.length > 0 && (
        <div className="mt-3 border-t border-white/6 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">
              {t('Zone mix by session type')}
            </div>
            <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/25">
              {t('Sessions')}
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-2">
            {zoneByType.map(entry => {
              const theme = TYPE_THEME[entry.type] ?? DEFAULT_TYPE_THEME;
              const dominantZone = entry.countedSeconds > 0
                ? entry.zones.reduce((max, z) => (z.seconds > max.seconds ? z : max), entry.zones[0])
                : null;

              return (
                <div
                  key={entry.type}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.015] p-2.5 transition-colors hover:border-white/10"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${theme.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                        {t(SESSION_TYPE_LABELS[entry.type])}
                      </span>
                      {dominantZone && dominantZone.percent > 0 && (
                        <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-white/40">
                          {dominantZone.label} · {dominantZone.percent}%
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {entry.countedSeconds > 0 && (
                        <span className="font-mono text-[9px] tabular-nums text-white/40">
                          {formatDuration(entry.countedSeconds)}
                        </span>
                      )}
                      <span className="font-mono text-[11px] font-bold tabular-nums text-white/75">
                        {entry.sessions}
                      </span>
                    </span>
                  </span>

                  {entry.countedSeconds === 0 ? (
                    <span className="mt-2 block font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
                      {t('No heart-rate data')}
                    </span>
                  ) : (
                    <span className="mt-2 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/5 p-0.5">
                      {entry.zones.map((zone, index) => (
                        <span
                          key={zone.label}
                          className={`h-full rounded-full transition-all ${ZONE_BAR[index] ?? 'bg-white/20'}`}
                          style={{ width: `${(zone.seconds / entry.countedSeconds) * 100}%` }}
                          title={`${zone.label} ${zone.range} · ${zone.percent}% · ${zone.time}`}
                        />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Power zones */}
      <div className="mt-3 border-t border-white/6 pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-hw-muted">
            {t('Power zones')}
          </div>
          {hasFtp && powerCountedSeconds > 0 && (
            <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/30">
              {t('Time in power zones')}
            </div>
          )}
        </div>

        {!hasFtp ? (
          <p className="mt-2 text-[11px] leading-5 text-white/40">
            {t('Set your FTP to see power zones.')}
          </p>
        ) : powerCountedSeconds === 0 ? (
          <p className="mt-2 text-[11px] leading-5 text-white/40">
            {t('No power data in this range')}
          </p>
        ) : (
          <>
            {/* Vertical Histogram (7 Power Zones) */}
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {powerZones.map(zone => (
                <div key={zone.label} className="group flex min-w-0 flex-col items-center">
                  <span className="font-mono text-xs font-bold tabular-nums text-white transition-colors group-hover:text-hw-accent">
                    {zone.percent}%
                  </span>
                  <div className="relative mt-1.5 flex h-16 w-full items-end justify-center overflow-hidden rounded-md border border-white/[0.04] bg-white/[0.03] p-1">
                    <div
                      className={`w-full rounded-t-sm transition-all duration-300 group-hover:brightness-110 ${zone.color}`}
                      style={{ height: `${Math.max(zone.percent > 0 ? 6 : 0, zone.percent)}%` }}
                      title={`${zone.label} ${t(zone.name)} ${zone.range} · ${zone.percent}% · ${zone.time}`}
                    />
                  </div>
                  <div className="mt-2 flex w-full min-w-0 flex-col items-center text-center">
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${zone.color}`} />
                      <span className="text-[10px] font-mono font-bold uppercase text-white/80">{zone.label}</span>
                    </div>
                    <span className="mt-0.5 truncate font-mono text-[9px] font-medium tabular-nums text-white/60">
                      {zone.time}
                    </span>
                    <div className="truncate font-mono text-[8px] uppercase tracking-[0.05em] text-white/30">
                      {t(zone.name)} · {zone.range}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {powerBelowPercent >= 5 && (
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
                {t('{percent}% of the recorded time had no power sample (coasting or no power meter).', { percent: powerBelowPercent })}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
};
