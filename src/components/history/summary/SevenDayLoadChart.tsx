import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useI18n } from '@/i18n';
import type { DailySummaryDay } from '@/lib/history-types';

interface SevenDayLoadChartProps {
  loadRatioChartData: DailySummaryDay[];
  loadRatioChartMax: number;
  acuteLoad: number;
  chronicLoad: number;
}

export const SevenDayLoadChart = ({
  loadRatioChartData,
  loadRatioChartMax,
  acuteLoad,
  chronicLoad,
}: SevenDayLoadChartProps) => {
  const { t } = useI18n();

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em] text-white/45">
        <span>{t('7-day load chart')}</span>
        <span>{t('TRIMP')}</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={loadRatioChartData} margin={{ top: 8, right: 6, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, loadRatioChartMax]} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeDasharray: '3 3' }}
              contentStyle={{ background: '#1f2022', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff' }}
              formatter={(value: number) => [value.toFixed(1), t('Training Load')]}
            />
            <ReferenceLine y={chronicLoad} stroke="#a98cff" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="trimp" stroke="#5da8ff" strokeWidth={2.5} dot={{ r: 3, fill: '#35f0bd', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f4f7f8', stroke: '#5da8ff' }} />
          </LineChart>
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
