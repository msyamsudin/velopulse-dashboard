import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '@/i18n';
import type { WeeklyLoadPoint } from '@/lib/history-types';

interface WeeklyLoadChartProps {
  loadRatioChartData: WeeklyLoadPoint[];
  loadRatioChartMax: number;
  acuteLoad: number;
  chronicLoad: number;
}

export const WeeklyLoadChart = ({
  loadRatioChartData,
  loadRatioChartMax,
  acuteLoad,
  chronicLoad,
}: WeeklyLoadChartProps) => {
  const { t } = useI18n();

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em] text-white/45">
        <span>{t('Weekly load chart')}</span>
        <span>{t('TRIMP')}</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={loadRatioChartData} margin={{ top: 8, right: 6, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis domain={[0, loadRatioChartMax]} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.06)' }}
              contentStyle={{ background: '#1f2022', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff' }}
              formatter={(value: number) => [value.toFixed(1), t('Training Load')]}
            />
            <ReferenceLine y={chronicLoad} stroke="#a98cff" strokeDasharray="4 4" />
            <Bar dataKey="trimp" radius={[3, 3, 0, 0]} maxBarSize={40}>
              {loadRatioChartData.map((point) => (
                <Cell key={point.label} fill={point.isCurrent ? '#35f0bd' : '#5da8ff'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-mono text-white/65">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vp-info" /> {t('Acute load')} <b className="float-right text-white">{acuteLoad}</b>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-mono text-white/65">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vp-distance" /> {t('Chronic baseline')} <b className="float-right text-white">{chronicLoad}</b>
        </div>
      </div>
    </div>
  );
};
