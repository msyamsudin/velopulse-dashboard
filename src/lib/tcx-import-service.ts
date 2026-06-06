import type { HistoryData, WorkoutSession } from '@/store/useWorkoutStore';

const getChildrenByLocalName = (node: Element | Document, localName: string) =>
  Array.from(node.getElementsByTagName('*')).filter(element => element.localName === localName);

const getFirstChildText = (node: Element, localName: string) => {
  const child = getChildrenByLocalName(node, localName)[0];
  return child?.textContent?.trim() || '';
};

const getDirectChildText = (node: Element, localName: string) => {
  const child = Array.from(node.children).find(element => element.localName === localName);
  return child?.textContent?.trim() || '';
};

const toNumber = (value: string | null | undefined) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPointTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const calculateStats = (history: HistoryData[]) => ({
  avgHr: Math.round(history.reduce((sum, point) => sum + point.hr, 0) / history.length) || 0,
  maxHr: Math.max(...history.map(point => point.hr)) || 0,
  avgPower: Math.round(history.reduce((sum, point) => sum + point.power, 0) / history.length) || 0,
  maxPower: Math.max(...history.map(point => point.power)) || 0,
  avgCadence: Math.round(history.reduce((sum, point) => sum + point.cadence, 0) / history.length) || 0,
  maxCadence: Math.max(...history.map(point => point.cadence)) || 0,
});

const parseActivity = (activity: Element, index: number): WorkoutSession | null => {
  const laps = getChildrenByLocalName(activity, 'Lap');
  const firstLap = laps[0];
  const trackpoints = getChildrenByLocalName(activity, 'Trackpoint');
  if (trackpoints.length === 0) return null;

  const activityId = getDirectChildText(activity, 'Id');
  const firstPointTime = getDirectChildText(trackpoints[0], 'Time');
  const startTimeText = firstLap?.getAttribute('StartTime') || activityId || firstPointTime;
  const startTime = Date.parse(startTimeText);

  if (!Number.isFinite(startTime)) return null;

  const lapCalories = toNumber(firstLap ? getDirectChildText(firstLap, 'Calories') : '0');
  const history = trackpoints.map((trackpoint, pointIndex) => {
    const pointTimeText = getDirectChildText(trackpoint, 'Time');
    const pointTimestamp = Date.parse(pointTimeText);
    const fallbackTimestamp = startTime + pointIndex * 1000;
    const timestamp = Number.isFinite(pointTimestamp) ? pointTimestamp : fallbackTimestamp;
    const speedMetersPerSecond = toNumber(getFirstChildText(trackpoint, 'Speed'));

    return {
      time: formatPointTime(timestamp),
      hr: Math.round(toNumber(getFirstChildText(trackpoint, 'Value'))),
      cadence: Math.round(toNumber(getDirectChildText(trackpoint, 'Cadence'))),
      power: Math.round(toNumber(getFirstChildText(trackpoint, 'Watts'))),
      speed: Number((speedMetersPerSecond * 3.6).toFixed(1)),
      distance: toNumber(getDirectChildText(trackpoint, 'DistanceMeters')),
      resistance: 0,
      calories: 0,
    };
  });

  const finalCalories = lapCalories || history[history.length - 1]?.calories || 0;
  const historyWithCalories = history.map((point, pointIndex) => ({
    ...point,
    calories: finalCalories > 0
      ? Math.round((finalCalories * (pointIndex + 1)) / history.length)
      : 0,
  }));

  const explicitDuration = toNumber(firstLap ? getDirectChildText(firstLap, 'TotalTimeSeconds') : '0');
  const firstPointTimestamp = Date.parse(getDirectChildText(trackpoints[0], 'Time'));
  const lastPointTime = Date.parse(getDirectChildText(trackpoints[trackpoints.length - 1], 'Time'));
  const inferredDuration = Number.isFinite(firstPointTimestamp) && Number.isFinite(lastPointTime)
    ? Math.max(1, Math.round((lastPointTime - firstPointTimestamp) / 1000))
    : historyWithCalories.length;

  return {
    id: `imported_${startTime}_${index}`,
    sessionStartTime: startTime,
    date: new Date(startTime).toISOString(),
    duration: explicitDuration || inferredDuration,
    stats: calculateStats(historyWithCalories),
    history: historyWithCalories,
    synced_to_google: false,
    synced_to_supabase: false,
  };
};

export const parseTCXWorkoutSessions = (tcxContent: string): WorkoutSession[] => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('TCX import is only available in the browser.');
  }

  const document = new DOMParser().parseFromString(tcxContent, 'application/xml');
  const parserError = document.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Invalid TCX XML file.');
  }

  const activities = getChildrenByLocalName(document, 'Activity');
  const sessions = activities
    .map((activity, index) => parseActivity(activity, index))
    .filter((session): session is WorkoutSession => Boolean(session));

  if (sessions.length === 0) {
    throw new Error('No supported workout activities found in this TCX file.');
  }

  return sessions;
};
