import { Heart, Bike, Zap, Activity, ChevronRight, Settings, Timer } from 'lucide-react';
import { StatsCard } from '../StatsCard';
import { HrZoneBar } from '../HrZoneBar';
import { CadenceGauge } from '../CadenceGauge';
import { PowerGauge } from '../PowerGauge';
import { SpeedVisual } from '../SpeedVisual';
import { DistanceVisual } from '../DistanceVisual';
import { ResistanceVisual } from '../ResistanceVisual';
import { CaloriesVisual } from '../CaloriesVisual';
import { DurationVisual } from '../DurationVisual';

interface TelemetryGridProps {
  currentData: any;
  liveStats: any;
  userProfile: any;
  workout: any;
}

export const TelemetryGrid = ({ currentData, liveStats, userProfile, workout }: TelemetryGridProps) => {
  const safeMaxHr = userProfile.maxHr > 0 ? userProfile.maxHr : 1;
  const currentHr = currentData.hr || 0;
  const resistanceValue = currentData.resistance || 0;
  const hrZoneLabel =
    currentHr >= userProfile.maxHr * 0.9 ? 'Z5' :
    currentHr >= userProfile.maxHr * 0.8 ? 'Z4' :
    currentHr >= userProfile.maxHr * 0.7 ? 'Z3' :
    currentHr >= userProfile.maxHr * 0.6 ? 'Z2' :
    currentHr > 0 ? 'Z1' : 'IDLE';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full p-4">
      <StatsCard 
        label="Heart Rate" 
        value={currentData.hr || '--'} 
        unit="BPM"
        valueMeta={
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-hw-muted">Zone</span>
            <span className="text-[20px] leading-none font-bold font-mono text-red-300">{hrZoneLabel}</span>
            <span className="text-[10px] font-mono text-red-300/70">
              {currentHr > 0 ? `${Math.round((currentHr / safeMaxHr) * 100)}% max` : 'waiting'}
            </span>
          </div>
        }
        icon={<Heart size={12} />} 
        colorClass="text-red-500"
        subValue={`MAX: ${liveStats.maxHr}`}
        visualComponent={<HrZoneBar currentHr={currentData.hr} maxHr={userProfile.maxHr} />}
      />
      <StatsCard 
        label="Cadence" 
        value={currentData.cadence || '--'} 
        icon={<Bike size={12} />} 
        colorClass="text-hw-accent"
        delay={0.1}
        subValue={`MAX: ${liveStats.maxCadence}`}
        visualComponent={<CadenceGauge value={currentData.cadence} max={liveStats.maxCadence} />}
      />
      <StatsCard 
        label="Power" 
        value={currentData.power || '--'} 
        icon={<Zap size={12} />} 
        colorClass="text-yellow-400"
        delay={0.2}
        subValue={`MAX: ${liveStats.maxPower}`}
        visualComponent={<PowerGauge power={currentData.power} ftp={userProfile.ftp} weight={userProfile.weight} />}
      />
      <StatsCard 
        label="Speed" 
        value={currentData.speed?.toFixed(1) || '--'} 
        unit="KM/H"
        icon={<Activity size={12} />} 
        colorClass="text-blue-400"
        delay={0.3}
        visualComponent={<SpeedVisual currentSpeed={currentData.speed} avgSpeed={liveStats.avgSpeed} maxSpeed={liveStats.maxSpeed} />}
      />
      <StatsCard 
        label="Distance" 
        value={currentData.distance ? (currentData.distance / 1000).toFixed(2) : '--'} 
        unit="KM"
        valueMeta={
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-hw-muted">Pace</span>
            <span className="text-[20px] leading-none font-bold font-mono text-hw-accent">
              {currentData.speed && currentData.speed > 0.1
                ? `${Math.floor(60 / currentData.speed)}:${Math.floor(((60 / currentData.speed) % 1) * 60)
                    .toString()
                    .padStart(2, '0')}`
                : '--:--'}
            </span>
            <span className="text-[10px] font-mono text-hw-accent/70">/KM</span>
          </div>
        }
        icon={<ChevronRight size={12} />} 
        colorClass="text-purple-400"
        delay={0.4}
        visualComponent={<DistanceVisual distanceMeters={currentData.distance} currentSpeedKmh={currentData.speed} />}
      />
      <StatsCard 
        label="Resistance" 
        value={currentData.resistance || '--'} 
        unit="%"
        valueMeta={
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-hw-muted">Load</span>
            <span className="text-[20px] leading-none font-bold font-mono text-orange-300">
              {resistanceValue > 70 ? 'CLIMB' : resistanceValue > 30 ? 'ROLLING' : resistanceValue > 0 ? 'EASY' : 'OPEN'}
            </span>
          </div>
        }
        icon={<Settings size={12} />} 
        colorClass="text-orange-400"
        delay={0.5}
        visualComponent={<ResistanceVisual resistance={resistanceValue} />}
      />
      <StatsCard 
        label="Calories" 
        value={currentData.calories || '--'} 
        unit="KCAL"
        icon={<Zap size={12} />} 
        colorClass="text-pink-400"
        delay={0.6}
        visualComponent={<CaloriesVisual power={currentData.power || 0} calories={currentData.calories || 0} />}
      />
      <StatsCard 
        label="Duration" 
        value={workout.formatTime(workout.elapsed)} 
        valueMeta={
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-hw-muted">Elapsed</span>
            <span className="text-[20px] leading-none font-bold font-mono text-blue-300">
              {Math.floor(workout.elapsed / 60)}
            </span>
            <span className="text-[10px] font-mono text-blue-300/70">MIN</span>
          </div>
        }
        icon={<Timer size={12} />} 
        colorClass="text-blue-400"
        delay={0.7}
        visualComponent={<DurationVisual elapsed={workout.elapsed} isRecording={workout.isRecording} />}
      />
    </div>
  );
};
