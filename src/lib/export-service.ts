
import JSZip from 'jszip';

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

/**
 * Generates a combined TCX string containing multiple activities/sessions.
 */
export const generateCombinedTCX = (sessions: WorkoutSession[]): string => {
  let activities = '';
  
  sessions.forEach(session => {
    const startTime = new Date(session.sessionStartTime).toISOString();
    let trackpoints = '';
    
    session.history.forEach((point, index) => {
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

    activities += `
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
    </Activity>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase 
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>${activities}
  </Activities>
</TrainingCenterDatabase>`;
};

/**
 * Downloads a combined TCX containing multiple sessions.
 */
export const downloadCombinedTCX = (sessions: WorkoutSession[]) => {
  if (sessions.length === 0) return;
  const tcxContent = generateCombinedTCX(sessions);
  const blob = new Blob([tcxContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split('T')[0];
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `velopulse_workout_batch_${dateStr}.tcx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Downloads multiple workout sessions packed in a ZIP file of TCX files.
 */
export const downloadTCXZip = async (sessions: WorkoutSession[]) => {
  if (sessions.length === 0) return;
  const zip = new JSZip();
  
  sessions.forEach(session => {
    const tcxContent = generateTCX(session);
    const dateStr = new Date(session.date).toISOString().split('T')[0];
    const timeStr = new Date(session.date).toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `velopulse_workout_${dateStr}_${timeStr}.tcx`;
    zip.file(filename, tcxContent);
  });
  
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  
  const dateStr = new Date().toISOString().split('T')[0];
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `velopulse_workouts_${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadTextFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const csvEscape = (value: string | number) => {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

const getSessionReportRows = (sessions: WorkoutSession[]) => {
  return sessions.map(session => {
    const lastPoint = session.history[session.history.length - 1] || {} as HistoryData;
    const distanceKm = Number(((lastPoint.distance || 0) / 1000).toFixed(2));
    const calories = Math.round(lastPoint.calories || 0);
    const avgSpeed = session.duration > 0 ? Number((distanceKm / (session.duration / 3600)).toFixed(1)) : 0;

    return {
      date: new Date(session.date).toISOString(),
      durationSeconds: session.duration,
      distanceKm,
      calories,
      avgSpeed,
      avgPower: session.stats.avgPower,
      maxPower: session.stats.maxPower,
      avgHr: session.stats.avgHr,
      maxHr: session.stats.maxHr,
      avgCadence: session.stats.avgCadence,
      maxCadence: session.stats.maxCadence,
      syncedToGoogle: Boolean(session.synced_to_google),
    };
  });
};

export const downloadSummaryCSV = (sessions: WorkoutSession[]) => {
  const headers = [
    'date',
    'duration_seconds',
    'distance_km',
    'calories',
    'avg_speed_kmh',
    'avg_power_w',
    'max_power_w',
    'avg_hr_bpm',
    'max_hr_bpm',
    'avg_cadence_rpm',
    'max_cadence_rpm',
    'synced_to_google',
  ];
  const rows = getSessionReportRows(sessions);
  const csv = [
    headers.join(','),
    ...rows.map(row => [
      row.date,
      row.durationSeconds,
      row.distanceKm,
      row.calories,
      row.avgSpeed,
      row.avgPower,
      row.maxPower,
      row.avgHr,
      row.maxHr,
      row.avgCadence,
      row.maxCadence,
      row.syncedToGoogle,
    ].map(csvEscape).join(',')),
  ].join('\n');

  const dateStr = new Date().toISOString().split('T')[0];
  downloadTextFile(csv, `velopulse_summary_${dateStr}.csv`, 'text/csv;charset=utf-8');
};

export const downloadSummaryJSON = (sessions: WorkoutSession[]) => {
  const rows = getSessionReportRows(sessions);
  const totals = rows.reduce((acc, row) => {
    acc.sessions += 1;
    acc.durationSeconds += row.durationSeconds;
    acc.distanceKm += row.distanceKm;
    acc.calories += row.calories;
    return acc;
  }, { sessions: 0, durationSeconds: 0, distanceKm: 0, calories: 0 });
  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      ...totals,
      distanceKm: Number(totals.distanceKm.toFixed(2)),
    },
    sessions: rows,
  };
  const dateStr = new Date().toISOString().split('T')[0];
  downloadTextFile(JSON.stringify(report, null, 2), `velopulse_summary_${dateStr}.json`, 'application/json;charset=utf-8');
};
