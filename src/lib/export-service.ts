
export interface HistoryData {
  time: string;
  hr: number;
  cadence: number;
  power: number;
  speed: number;
  distance: number;
  resistance: number;
  calories: number;
}

export interface WorkoutSession {
  id: string;
  sessionStartTime: number;
  date: string;
  duration: number;
  stats: {
    avgHr: number;
    maxHr: number;
    avgPower: number;
    maxPower: number;
    avgCadence: number;
    maxCadence: number;
  };
  history: HistoryData[];
  synced_to_google?: boolean;
}

/**
 * Generates a TCX (Training Center XML) file from a workout session.
 * This format is widely supported by Strava, Garmin, and others.
 */
export const generateTCX = (session: WorkoutSession): string => {
  const startTime = new Date(session.sessionStartTime).toISOString();
  
  let trackpoints = '';
  
  session.history.forEach((point, index) => {
    // Calculate timestamp for each point
    // We use sessionStartTime + index * 1000ms as a base
    // Strava expects ISO8601 format
    const pointTime = new Date(session.sessionStartTime + index * 1000).toISOString();
    
    trackpoints += `
          <Trackpoint>
            <Time>${pointTime}</Time>
            <DistanceMeters>${(point.distance || 0).toFixed(1)}</DistanceMeters>
            ${point.hr > 0 ? `
            <HeartRateBpm>
              <Value>${Math.round(point.hr)}</Value>
            </HeartRateBpm>` : ''}
            ${point.cadence > 0 ? `<Cadence>${Math.round(point.cadence)}</Cadence>` : ''}
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Speed>${(point.speed / 3.6).toFixed(3)}</Speed>
                ${point.power > 0 ? `<Watts>${Math.round(point.power)}</Watts>` : ''}
              </TPX>
            </Extensions>
          </Trackpoint>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase 
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startTime}</Id>
      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${session.duration}</TotalTimeSeconds>
        <DistanceMeters>${(session.history[session.history.length - 1]?.distance || 0).toFixed(1)}</DistanceMeters>
        <Calories>${Math.round(session.history[session.history.length - 1]?.calories || 0)}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
};

/**
 * Triggers a download of the generated TCX file.
 */
export const downloadTCX = (session: WorkoutSession) => {
  const tcxContent = generateTCX(session);
  const blob = new Blob([tcxContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date(session.date).toISOString().split('T')[0];
  const timeStr = new Date(session.date).toTimeString().split(' ')[0].replace(/:/g, '-');
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `velopulse_workout_${dateStr}_${timeStr}.tcx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
