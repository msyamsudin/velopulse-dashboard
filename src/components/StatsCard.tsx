import { ReactNode, useMemo } from 'react';
import { motion } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { downsample } from '../lib/chart-utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  unit?: string;
  valueMeta?: ReactNode;
  icon: ReactNode;
  colorClass: string;
  chartData?: unknown[];
  chartKey?: string;
  chartColor?: string;
  delay?: number;
  subValue?: string;
  visualComponent?: ReactNode;
}

export const StatsCard = ({ 
  label, 
  value, 
  unit, 
  valueMeta,
  icon, 
  colorClass, 
  chartData, 
  chartKey, 
  chartColor, 
  delay = 0,
  subValue,
  visualComponent
}: StatsCardProps) => {
  const displayData = useMemo(() => 
    chartData && chartKey ? downsample(chartData, 60) : null
  , [chartData, chartKey]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="hardware-card relative overflow-hidden group h-full flex flex-col"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="stat-label flex items-center gap-1">
          <span className={colorClass}>{icon}</span> {label}
        </div>
        {subValue && <div className="text-[10px] font-mono text-hw-muted">{subValue}</div>}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-3">
        <div className={`stat-value ${colorClass} flex items-center`}>
          {value} {unit && <span className="text-base font-normal opacity-60 ml-2">{unit}</span>}
        </div>
        {valueMeta && <div>{valueMeta}</div>}
      </div>
      
      {visualComponent && (
        <div className="mt-5 min-h-20 flex flex-col justify-end">
          {visualComponent}
        </div>
      )}
      
      {displayData && displayData.length > 0 && chartKey && (
        <div className={`mt-4 h-12 ${visualComponent ? 'opacity-30 absolute inset-x-0 bottom-4 pointer-events-none' : ''}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={1}>
            <AreaChart data={displayData}>
              <Area 
                type="monotone" 
                dataKey={chartKey} 
                stroke={chartColor} 
                fill={`${chartColor}33`} 
                strokeWidth={2} 
                isAnimationActive={false} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {!visualComponent && !chartData && (
        <div className="mt-4 flex justify-between items-end">
          <div className="text-[10px] font-mono text-hw-muted uppercase tracking-widest">
            {label}
          </div>
          <div className={`w-1.5 h-1.5 rounded-full ${colorClass} bg-current opacity-50`} />
        </div>
      )}
    </motion.div>
  );
};
