import { Trophy } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { PersonalRecord } from '@/lib/workout-analysis';

interface PersonalRecordsProps {
  personalRecords: PersonalRecord[];
  onSelectSession?: (id: string) => void;
  rangeLabel: string;
  recordCount: number;
}

export const PersonalRecords = ({ personalRecords, onSelectSession, rangeLabel, recordCount }: PersonalRecordsProps) => {
  const { t } = useI18n();

  return (
    <div className="hardware-card border-hw-muted/20 p-4 bg-black/20">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-hw-muted flex items-center gap-2">
            <Trophy size={12} className="text-yellow-300" />
            {t('Personal Records')}
          </div>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/45 mt-1">{t('Best efforts from the selected period')}</div>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/35">{rangeLabel}</div>
      </div>
      {personalRecords.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {personalRecords.map(record => (
            <button
              key={record.title}
              onClick={() => onSelectSession?.(record.sessionId)}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-hw-accent/40 hover:bg-hw-accent/5"
            >
              <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-hw-muted">{t(record.title)}</div>
              <div className="mt-1 text-lg font-bold font-mono text-white tabular-nums">
                {record.value} <span className="text-[10px] font-normal text-white/35">{record.unit}</span>
              </div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.12em] text-hw-accent/70">{t(record.dateLabel)}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">{t('No records in this period')}</div>
        </div>
      )}
      <div className="mt-3 text-[9px] font-mono uppercase tracking-[0.16em] text-white/35">
        {t('{count} sessions in record scope', { count: recordCount })}
      </div>
    </div>
  );
};
