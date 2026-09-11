import { useI18n } from '@/i18n';
import type { IntensitySummary } from '@/lib/history-types';

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

/**
 * Block 4 of the Summary view: how the recorded time was actually spent.
 *
 * The range totals answer "how much" and the trend answers "improving?", but
 * neither says whether the riding was mostly easy or mostly hard. This block is
 * the evidence behind the abstract "repetition risk" warning: a monotony score
 * of 3.1 becomes readable when the zone bar shows 82% of the time in Z3.
 */
export const IntensityDistribution = ({ intensity }: IntensityDistributionProps) => {
  const { t } = useI18n();
  const { zones, countedSeconds, belowZoneSeconds, easyShare, hardShare, sessionTypes } = intensity;

  const recordedSeconds = countedSeconds + belowZoneSeconds;
  const belowZonePercent = recordedSeconds > 0 ? Math.round((belowZoneSeconds / recordedSeconds) * 100) : 0;
  const easyPercent = Math.round(easyShare * 100);
  const hardPercent = Math.round(hardShare * 100);

  const verdict = easyShare >= 0.75
    ? t('Mostly easy volume — a solid aerobic base.')
    : hardShare >= 0.25
      ? t('A large share of hard riding — watch recovery.')
      : t('Balanced mix of easy and hard riding.');

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
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            {zones.map((zone, index) => (
              <div
                key={zone.label}
                className={ZONE_BAR[index] ?? 'bg-white/20'}
                style={{ width: `${(zone.seconds / countedSeconds) * 100}%` }}
                title={`${zone.label} ${zone.range} · ${zone.percent}% · ${zone.time}`}
              />
            ))}
          </div>

          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {zones.map((zone, index) => (
              <div key={zone.label} className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-sm ${ZONE_BAR[index] ?? 'bg-white/20'}`} />
                  <span className="text-[9px] font-mono font-bold uppercase text-white/70">{zone.label}</span>
                </div>
                <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-white">{zone.percent}%</div>
                <div className="truncate text-[8px] font-mono uppercase tracking-[0.1em] text-white/30">
                  {zone.time} · {zone.range}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/6 pt-2 text-[9px] font-mono uppercase tracking-[0.12em] text-white/45">
            <span>
              {t('Easy volume')} <b className="text-emerald-300">{easyPercent}%</b>
            </span>
            <span>
              {t('Hard volume')}{' '}
              <b className={hardPercent >= 25 ? 'text-amber-300' : 'text-white/70'}>{hardPercent}%</b>
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] font-mono uppercase tracking-[0.12em] text-white/40">
            <span className="text-white/30">{t('Session types')}</span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              {sessionTypes.easy} {t('Easy')}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              {sessionTypes.moderate} {t('Tempo')}
            </span>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
              {sessionTypes.hard} {t('Hard')}
            </span>
          </div>

          <p className="mt-2 text-[11px] leading-5 text-white/55">{verdict}</p>

          {belowZonePercent >= 5 && (
            <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.1em] text-white/30">
              {t('{percent}% of the recorded time stayed below Z1 (warm-up or no heart-rate signal).', { percent: belowZonePercent })}
            </p>
          )}
        </>
      )}
    </section>
  );
};
