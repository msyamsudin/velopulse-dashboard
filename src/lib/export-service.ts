
import JSZip from 'jszip';
import { calcCaloriesFromPower, DELTA_MAX_SECONDS } from './physics';
import { getFinalMetrics } from './workout-analysis';

export interface HistoryData {
  time: string;
  ts?: number;
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
 * Namespace for VeloPulse-specific TCX extensions. The standard Garmin
 * TrainingCenterDatabase schema keeps Trackpoint <Extensions> open
 * (xsd:any namespace="##other", processContents="lax"), so foreign elements
 * are schema-valid and ignored by Garmin/Strava, while our own importer
 * (and any analysis tooling) can read them back.
 */
export const VELOPULSE_EXTENSION_NS = 'https://velopulse.app/schemas/activity-extension/v1';

const renderTrackpoints = (history: HistoryData[], sessionStartTime: number) => {
  let trackpoints = '';

  history.forEach((point, index) => {
    // Calculate timestamp for each point
    // We use sessionStartTime + index * 1000ms as a base
    // Strava expects ISO8601 format
    const pointTime = new Date(sessionStartTime + index * 1000).toISOString();

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
              ${point.resistance > 0 ? `<vp:Resistance>${Math.round(point.resistance)}</vp:Resistance>` : ''}
            </Extensions>
          </Trackpoint>`;
  });

  return trackpoints;
};

/**
 * Reintegrates calories from the power series when the stored column is
 * unusable (legacy sessions whose per-second rounding froze it at ~0).
 * Shared by the TCX and CSV/JSON/PDF exporters so every format agrees.
 */
const reintegrateCalories = (history: HistoryData[]) => {
  const hasPower = history.some(point => point.power > 0);
  if (!hasPower) return 0;

  let total = 0;
  let previousTs: number | null = null;
  history.forEach(point => {
    let deltaSeconds = 1;
    if (point.ts && previousTs !== null) {
      deltaSeconds = Math.min(Math.max((point.ts - previousTs) / 1000, 0), DELTA_MAX_SECONDS);
    }
    total += calcCaloriesFromPower(point.power || 0, deltaSeconds);
    previousTs = point.ts ?? null;
  });
  return Math.round(total);
};

/**
 * Session calories for the TCX lap element. Prefers the stored accumulator
 * (last history point); for legacy sessions whose calorie column flatlined
 * at ~0 (per-second rounding bug), reintegrates power with real Δt.
 */
const getSessionCalories = (session: WorkoutSession) => {
  const history = session.history || [];
  const lastPoint = history[history.length - 1];
  if (!lastPoint) return 0;

  const storedCalories = Math.round(lastPoint.calories || 0);
  if (storedCalories > 0) return storedCalories;

  return reintegrateCalories(history);
};

const buildLapSummary = (session: WorkoutSession) => {
  const lastPoint = session.history?.[session.history.length - 1];
  const avgHr = session.stats?.avgHr || 0;
  const maxHr = session.stats?.maxHr || 0;
  return [
    `<TotalTimeSeconds>${session.duration}</TotalTimeSeconds>`,
    `<DistanceMeters>${(lastPoint?.distance || 0).toFixed(1)}</DistanceMeters>`,
    maxHr > 0 ? `<MaximumHeartRateBpm><Value>${Math.round(maxHr)}</Value></MaximumHeartRateBpm>` : '',
    `<Calories>${getSessionCalories(session)}</Calories>`,
    avgHr > 0 ? `<AverageHeartRateBpm><Value>${Math.round(avgHr)}</Value></AverageHeartRateBpm>` : '',
    `<Intensity>Active</Intensity>`,
    `<TriggerMethod>Manual</TriggerMethod>`,
  ].filter(Boolean).join('\n        ');
};

/**
 * Generates a TCX (Training Center XML) file from a workout session.
 * This format is widely supported by Strava, Garmin, and others.
 */
export const generateTCX = (session: WorkoutSession): string => {
  const startTime = new Date(session.sessionStartTime).toISOString();
  
  const trackpoints = renderTrackpoints(session.history || [], session.sessionStartTime);

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase 
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:vp="${VELOPULSE_EXTENSION_NS}"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startTime}</Id>
      <Lap StartTime="${startTime}">
        ${buildLapSummary(session)}
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
    const trackpoints = renderTrackpoints(session.history || [], session.sessionStartTime);

    activities += `
    <Activity Sport="Biking">
      <Id>${startTime}</Id>
      <Lap StartTime="${startTime}">
        ${buildLapSummary(session)}
        <Track>${trackpoints}
        </Track>
      </Lap>
    </Activity>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase 
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:vp="${VELOPULSE_EXTENSION_NS}"
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
    const history = session.history || [];
    const { distanceMeters, calories: maxCalories } = getFinalMetrics(history);
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));
    // Legacy sessions whose stored calories flatlined are reintegrated here
    // too, matching the TCX exporter.
    const calories = maxCalories > 0 ? Math.round(maxCalories) : reintegrateCalories(history);
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

export const printSummaryPDF = (sessions: WorkoutSession[]) => {
  if (sessions.length === 0) return;

  const rows = getSessionReportRows(sessions);
  const totals = rows.reduce((acc, row) => {
    acc.sessions += 1;
    acc.durationSeconds += row.durationSeconds;
    acc.distanceKm += row.distanceKm;
    acc.calories += row.calories;
    return acc;
  }, { sessions: 0, durationSeconds: 0, distanceKm: 0, calories: 0 });
  const generatedAt = new Date().toLocaleString();
  const totalHours = totals.durationSeconds / 3600;
  const avgDistance = totals.sessions > 0 ? totals.distanceKm / totals.sessions : 0;
  const avgDuration = totals.sessions > 0 ? totals.durationSeconds / totals.sessions : 0;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>VeloPulse Summary Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
    h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: 0.04em; text-transform: uppercase; }
    .muted { color: #6b7280; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; }
    .value { margin-top: 6px; font-size: 20px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    th { color: #374151; text-transform: uppercase; font-size: 9px; letter-spacing: 0.08em; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <h1>VeloPulse Summary Report</h1>
  <div class="muted">Generated ${generatedAt}</div>
  <div class="grid">
    <div class="card"><div class="label">Sessions</div><div class="value">${totals.sessions}</div></div>
    <div class="card"><div class="label">Distance</div><div class="value">${totals.distanceKm.toFixed(2)} km</div></div>
    <div class="card"><div class="label">Time</div><div class="value">${totalHours.toFixed(1)} h</div></div>
    <div class="card"><div class="label">Calories</div><div class="value">${totals.calories} kcal</div></div>
  </div>
  <div class="grid">
    <div class="card"><div class="label">Avg Distance</div><div class="value">${avgDistance.toFixed(2)} km</div></div>
    <div class="card"><div class="label">Avg Duration</div><div class="value">${Math.round(avgDuration / 60)} min</div></div>
    <div class="card"><div class="label">Best Distance</div><div class="value">${Math.max(...rows.map(row => row.distanceKm)).toFixed(2)} km</div></div>
    <div class="card"><div class="label">Best Avg Power</div><div class="value">${Math.max(...rows.map(row => row.avgPower))} w</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Duration</th>
        <th>Distance</th>
        <th>Calories</th>
        <th>Avg Power</th>
        <th>Avg HR</th>
        <th>Avg Cadence</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `
      <tr>
        <td>${new Date(row.date).toLocaleDateString()}</td>
        <td>${Math.round(row.durationSeconds / 60)} min</td>
        <td>${row.distanceKm.toFixed(2)} km</td>
        <td>${row.calories}</td>
        <td>${row.avgPower} w</td>
        <td>${row.avgHr} bpm</td>
        <td>${row.avgCadence} rpm</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;

  const reportWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!reportWindow) return;
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
};
