import { FitPoint, FIT_TYPES, MS_TO_NS, ACTIVITY_INDOOR_CYCLING } from '../google-fit-service';
import { calcCaloriesFromPower } from '../physics';

interface WorkoutPoint {
  hr?: number;
  power?: number;
  cadence?: number;
  speed?: number;
  distance?: number;
  calories?: number;
}

export const mapWorkoutToFitPoints = (startTime: number, actualEndTime: number, history: WorkoutPoint[], maxHr: number) => {
  const metrics = {
    hr: { type: FIT_TYPES.HEART_RATE, points: [] as FitPoint[] },
    power: { type: FIT_TYPES.POWER, points: [] as FitPoint[] },
    cadence: { type: FIT_TYPES.CADENCE, points: [] as FitPoint[] },
    speed: { type: FIT_TYPES.SPEED, points: [] as FitPoint[] },
    distance: { type: FIT_TYPES.DISTANCE, points: [] as FitPoint[] },
    calories: { type: FIT_TYPES.CALORIES, points: [] as FitPoint[] },
    activity: { type: FIT_TYPES.ACTIVITY, points: [] as FitPoint[] },
    active_minutes: { type: FIT_TYPES.ACTIVE_MINUTES, points: [] as FitPoint[] },
  };

  const processedSeconds = new Set<number>();
  const activeSecondsPerMinute = new Map<number, number>();
  const caloriesPerMinutePower = new Map<number, number>();
  const caloriesPerMinuteSensor = new Map<number, number>();
  const distancePerMinute = new Map<number, number>();
  
  let lastUploadedDist = 0;
  let lastUploadedCal = 0;

  history.forEach((point, index) => {
    const pointStartMs = startTime + index * 1000;
    const secondBucket = Math.floor(pointStartMs / 1000);
    if (processedSeconds.has(secondBucket)) return;
    processedSeconds.add(secondBucket);

    const pointEndMs = pointStartMs + 1000;
    const startTimeNs = BigInt(pointStartMs) * MS_TO_NS;
    const endTimeNs = BigInt(pointEndMs) * MS_TO_NS;

    const createPoint = (val: number, type: string) => {
      const isInt = type === FIT_TYPES.ACTIVITY || type === FIT_TYPES.ACTIVE_MINUTES;
      return {
        startTimeNanos: startTimeNs.toString(),
        endTimeNanos: endTimeNs.toString(),
        dataTypeName: type,
        value: [isInt ? { intVal: Math.round(val) } : { fpVal: val }]
      };
    };

    const minuteIndex = Math.floor((pointStartMs - startTime) / 60000);

    if ((point.hr ?? 0) > 0) metrics.hr.points.push(createPoint(point.hr!, FIT_TYPES.HEART_RATE));
    if ((point.power ?? 0) > 0) metrics.power.points.push(createPoint(point.power!, FIT_TYPES.POWER));
    if ((point.cadence ?? 0) > 0) metrics.cadence.points.push(createPoint(point.cadence!, FIT_TYPES.CADENCE));
    if ((point.speed ?? 0) > 0) metrics.speed.points.push(createPoint(point.speed! / 3.6, FIT_TYPES.SPEED));
    
    const deltaDist = Math.max(0, (point.distance ?? 0) - lastUploadedDist);
    if (deltaDist > 0) {
      distancePerMinute.set(minuteIndex, (distancePerMinute.get(minuteIndex) || 0) + deltaDist);
      lastUploadedDist = point.distance ?? lastUploadedDist;
    }

    if ((point.power ?? 0) > 0) {
      const kcalThisSecond = calcCaloriesFromPower(point.power!, 1);
      caloriesPerMinutePower.set(minuteIndex, (caloriesPerMinutePower.get(minuteIndex) || 0) + kcalThisSecond);
    }

    const deltaCal = Math.max(0, (point.calories ?? 0) - lastUploadedCal);
    if (deltaCal > 0) {
      caloriesPerMinuteSensor.set(minuteIndex, (caloriesPerMinuteSensor.get(minuteIndex) || 0) + deltaCal);
      lastUploadedCal = point.calories ?? lastUploadedCal;
    }

    if (point.hr && point.hr / maxHr >= 0.5) {
      activeSecondsPerMinute.set(minuteIndex, (activeSecondsPerMinute.get(minuteIndex) || 0) + 1);
    }
  });

  const clipTime = (timeMs: number) => Math.min(timeMs, actualEndTime);

  activeSecondsPerMinute.forEach((seconds, minuteIdx) => {
    if (seconds >= 30) {
      const startMs = startTime + minuteIdx * 60000;
      const endMs = clipTime(startMs + 60000);
      metrics.active_minutes.points.push({
        startTimeNanos: (BigInt(startMs) * MS_TO_NS).toString(),
        endTimeNanos: (BigInt(endMs) * MS_TO_NS).toString(),
        dataTypeName: FIT_TYPES.ACTIVE_MINUTES,
        value: [{ intVal: 1 }]
      });
    }
  });

  const hasPowerCalories = caloriesPerMinutePower.size > 0;
  const caloriesPerMinute = hasPowerCalories ? caloriesPerMinutePower : caloriesPerMinuteSensor;

  caloriesPerMinute.forEach((total, minuteIdx) => {
    const cappedTotal = Math.min(35, total);
    const startMs = startTime + minuteIdx * 60000;
    const endMs = clipTime(startMs + 60000);
    metrics.calories.points.push({
      startTimeNanos: (BigInt(startMs) * MS_TO_NS).toString(),
      endTimeNanos: (BigInt(endMs) * MS_TO_NS).toString(),
      dataTypeName: FIT_TYPES.CALORIES,
      value: [{ fpVal: cappedTotal }]
    });
  });

  distancePerMinute.forEach((total, minuteIdx) => {
    const cappedTotal = Math.min(2000, total);
    const startMs = startTime + minuteIdx * 60000;
    const endMs = clipTime(startMs + 60000);
    metrics.distance.points.push({
      startTimeNanos: (BigInt(startMs) * MS_TO_NS).toString(),
      endTimeNanos: (BigInt(endMs) * MS_TO_NS).toString(),
      dataTypeName: FIT_TYPES.DISTANCE,
      value: [{ fpVal: cappedTotal }]
    });
  });

  const startNs = BigInt(startTime) * MS_TO_NS;
  const endNs = BigInt(actualEndTime) * MS_TO_NS;

  metrics.activity.points.push({
    startTimeNanos: startNs.toString(),
    endTimeNanos: endNs.toString(),
    dataTypeName: FIT_TYPES.ACTIVITY,
    value: [{ intVal: ACTIVITY_INDOOR_CYCLING }]
  });

  return metrics;
};
