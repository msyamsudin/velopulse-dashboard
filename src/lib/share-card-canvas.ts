import type { WorkoutSession, HistoryData } from '@/store/useWorkoutStore';
import { getSessionOutcome, getWorkoutQuality } from './workout-analysis';
import { formatDuration } from '../utils/formatters';
import type { MilestoneBadge } from './milestone-records';

export type ShareCardAspect = 'square' | 'story';
export type ShareCardTheme = 'neon' | 'gold' | 'stealth';

export interface ShareCardRenderOptions {
  session: WorkoutSession;
  allSessions?: WorkoutSession[];
  previousSession?: WorkoutSession;
  aspect: ShareCardAspect;
  theme: ShareCardTheme;
  headline?: string;
  milestones?: MilestoneBadge[];
  personalRecords?: MilestoneBadge[];
  showHr?: boolean;
  showChart?: boolean;
  showComparison?: boolean;
  customNote?: string;
  maxHr?: number;
}

/**
 * Minimal editorial palettes. Flat background, one ink color, one muted
 * color, one accent, and hairlines. No gradients, no glow, no texture.
 */
interface ThemePalette {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  hairline: string;
  deltaUp: string;
  deltaDown: string;
}

const THEMES: Record<ShareCardTheme, ThemePalette> = {
  neon: {
    bg: '#0a0c0d',
    ink: '#eef4f1',
    muted: '#7c8a85',
    accent: '#35f0bd',
    hairline: 'rgba(255, 255, 255, 0.1)',
    deltaUp: '#4ade80',
    deltaDown: '#f87171',
  },
  gold: {
    bg: '#12100b',
    ink: '#f2ead9',
    muted: '#9a8f77',
    accent: '#d9ab55',
    hairline: 'rgba(255, 255, 255, 0.1)',
    deltaUp: '#4ade80',
    deltaDown: '#f87171',
  },
  stealth: {
    bg: '#f4f2ed',
    ink: '#181a1c',
    muted: '#8d8f8a',
    accent: '#181a1c',
    hairline: 'rgba(24, 26, 28, 0.16)',
    deltaUp: '#15803d',
    deltaDown: '#b91c1c',
  },
};

const MONO_STACK = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';
const SANS_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const mono = (size: number, weight = '600') => `${weight} ${size}px ${MONO_STACK}`;
const sans = (size: number, weight = '700') => `${weight} ${size}px ${SANS_STACK}`;

/** Formats a signed duration delta as +M:SS / −M:SS */
const formatDurationDelta = (seconds: number): string => {
  const sign = seconds > 0 ? '+' : seconds < 0 ? '−' : '±';
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = Math.round(abs % 60);
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Renders a minimalist, typography-driven share card to a canvas element.
 * Flat background, hairline table of metrics, one thin chart line.
 */
export const renderShareCardToCanvas = (
  canvas: HTMLCanvasElement,
  options: ShareCardRenderOptions
): void => {
  const {
    session,
    allSessions,
    previousSession,
    aspect = 'square',
    theme = 'neon',
    headline,
    milestones = [],
    personalRecords = [],
    showHr = true,
    showChart = true,
    showComparison = true,
    customNote,
    maxHr = 190,
  } = options;

  const width = 1080;
  const height = aspect === 'story' ? 1920 : 1080;
  const isStory = aspect === 'story';

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const pal = THEMES[theme] || THEMES.neon;
  const outcome = getSessionOutcome(session);
  const quality = getWorkoutQuality(session, maxHr);
  const sessionDate = new Date(session.sessionStartTime || session.date || Date.now());
  const dateFormatted = Number.isNaN(sessionDate.getTime())
    ? 'Recent Workout'
    : sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // Session number (RIDE #N)
  let sessionNumber = 1;
  if (allSessions && allSessions.length > 0) {
    const sorted = [...allSessions].sort((a, b) => {
      const tA = a.sessionStartTime || new Date(a.date).getTime() || 0;
      const tB = b.sessionStartTime || new Date(b.date).getTime() || 0;
      return tA - tB;
    });
    const idx = sorted.findIndex(s => s.id === session.id);
    if (idx !== -1) sessionNumber = idx + 1;
  }

  // Previous session for comparison
  let resolvedPrevSession: WorkoutSession | undefined = previousSession;
  if (!resolvedPrevSession && allSessions && allSessions.length > 1) {
    const sorted = [...allSessions].sort((a, b) => {
      const tA = a.sessionStartTime || new Date(a.date).getTime() || 0;
      const tB = b.sessionStartTime || new Date(b.date).getTime() || 0;
      return tA - tB;
    });
    const currIdx = sorted.findIndex(s => s.id === session.id);
    if (currIdx > 0) {
      resolvedPrevSession = sorted[currIdx - 1];
    }
  }

  const prevOutcome = resolvedPrevSession ? getSessionOutcome(resolvedPrevSession) : null;
  const prevSpeed = prevOutcome && prevOutcome.duration > 0 ? (prevOutcome.distanceKm / (prevOutcome.duration / 3600)) : 0;
  const currentSpeed = outcome.duration > 0 ? (outcome.distanceKm / (outcome.duration / 3600)) : 0;

  const deltas = showComparison && prevOutcome ? {
    distance: outcome.distanceKm - prevOutcome.distanceKm,
    distancePct: prevOutcome.distanceKm > 0 ? ((outcome.distanceKm - prevOutcome.distanceKm) / prevOutcome.distanceKm) * 100 : null,
    calories: outcome.calories - prevOutcome.calories,
    caloriesPct: prevOutcome.calories > 0 ? ((outcome.calories - prevOutcome.calories) / prevOutcome.calories) * 100 : null,
    avgPower: (session.stats?.avgPower || 0) - (resolvedPrevSession?.stats?.avgPower || 0),
    avgPowerPct: (resolvedPrevSession?.stats?.avgPower || 0) > 0 ? (((session.stats?.avgPower || 0) - (resolvedPrevSession?.stats?.avgPower || 0)) / (resolvedPrevSession?.stats?.avgPower || 1)) * 100 : null,
    maxPower: (session.stats?.maxPower || 0) - (resolvedPrevSession?.stats?.maxPower || 0),
    avgHr: (session.stats?.avgHr || 0) - (resolvedPrevSession?.stats?.avgHr || 0),
    avgSpeed: currentSpeed - prevSpeed,
    avgSpeedPct: prevSpeed > 0 ? ((currentSpeed - prevSpeed) / prevSpeed) * 100 : null,
  } : null;

  // Duration comparisons: average across all logged rides + delta vs previous
  let avgDuration: number | null = null;
  if (allSessions && allSessions.length > 0) {
    const total = allSessions.reduce((sum, s) => sum + getSessionOutcome(s).duration, 0);
    avgDuration = total / allSessions.length;
  }
  const durationDelta = prevOutcome && prevOutcome.duration > 0
    ? outcome.duration - prevOutcome.duration
    : null;
  const hasDurationCompare = avgDuration !== null || (durationDelta !== null && Math.abs(durationDelta) >= 1);

  const formatDeltaText = (
    deltaVal: number,
    unit: string,
    decimals = 0,
    pctVal: number | null = null,
    invertGood = false
  ): { text: string; positive: boolean } | null => {
    if (Math.abs(deltaVal) < 0.01) return null;
    const sign = deltaVal > 0 ? '+' : '';
    const pctSign = pctVal && pctVal > 0 ? '+' : '';
    const pctStr = pctVal !== null ? ` (${pctSign}${pctVal.toFixed(1)}%)` : '';
    const formatted = `${sign}${deltaVal.toFixed(decimals)}${unit ? ' ' + unit : ''}${pctStr}`;
    const positive = invertGood ? deltaVal < 0 : deltaVal > 0;
    return { text: formatted, positive };
  };

  // ---- Flat background -------------------------------------------------
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);

  const padX = 84;
  const contentW = width - padX * 2;

  const hairline = (y: number) => {
    ctx.strokeStyle = pal.hairline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  };

  const setSpacing = (value: string) => {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
  };

  let y = isStory ? 150 : 100;

  // ---- Overline: accent tick + brand / session line --------------------
  ctx.fillStyle = pal.accent;
  ctx.fillRect(padX, y - 13, 15, 15);

  ctx.font = mono(isStory ? 20 : 18);
  setSpacing('3.5px');
  ctx.fillStyle = pal.muted;
  ctx.fillText(`VELOPULSE  /  RIDE #${sessionNumber}  /  ${quality.label.toUpperCase()}`, padX + 32, y);
  setSpacing('0px');

  y += isStory ? 100 : 72;

  // ---- Headline: one line, auto-fit ------------------------------------
  const displayHeadline = (
    headline ||
    (milestones.length > 0 ? milestones[0].title : null) ||
    (personalRecords.length > 0 ? personalRecords[0].title : null) ||
    'INDOOR RIDE'
  ).toUpperCase();

  let headSize = isStory ? 96 : 70;
  ctx.font = sans(headSize, '800');
  while (ctx.measureText(displayHeadline).width > contentW && headSize > 28) {
    headSize -= 4;
    ctx.font = sans(headSize, '800');
  }
  ctx.fillStyle = pal.ink;
  ctx.fillText(displayHeadline, padX, y);

  y += isStory ? 58 : 44;

  // ---- Date line --------------------------------------------------------
  ctx.font = mono(isStory ? 21 : 19);
  setSpacing('1.5px');
  ctx.fillStyle = pal.muted;
  ctx.fillText(`${dateFormatted.toUpperCase()}   ·   INDOOR TRAINER`, padX, y);
  setSpacing('0px');

  // ---- Achievements as a single quiet line (no pills, no icons) --------
  const badgeLine = [...milestones, ...personalRecords]
    .slice(0, 3)
    .map(b => b.title)
    .join('   ·   ');
  if (badgeLine) {
    y += isStory ? 48 : 40;
    ctx.font = mono(isStory ? 20 : 17);
    setSpacing('2px');
    ctx.fillStyle = pal.accent;
    ctx.fillText(badgeLine.toUpperCase(), padX, y);
    setSpacing('0px');
  }

  y += isStory ? 56 : 44;
  hairline(y);

  // Chart availability decides the layout: without the chart the metrics
  // grid takes the full canvas.
  const history = session.history || [];
  const hasChart = showChart && history.length > 5;

  // ---- Hero metric: duration (kept modest — metrics are the focus) -----
  y += isStory ? 76 : 52;
  ctx.font = mono(isStory ? 19 : 16);
  setSpacing('3px');
  ctx.fillStyle = pal.muted;
  ctx.fillText('DURATION', padX, y);
  setSpacing('0px');

  y += isStory ? 150 : 108;
  ctx.font = sans(isStory ? 168 : 118, '700');
  ctx.fillStyle = pal.ink;
  ctx.fillText(formatDuration(outcome.duration), padX, y);

  // Comparison line under the hero: average of all rides + delta vs last ride
  if (hasDurationCompare) {
    y += isStory ? 54 : 42;
    ctx.font = mono(isStory ? 20 : 17);
    setSpacing('1.5px');
    let cx = padX;
    if (avgDuration !== null) {
      ctx.fillStyle = pal.muted;
      const avgText = `AVG ${formatDuration(Math.round(avgDuration))}`;
      ctx.fillText(avgText, cx, y);
      cx += ctx.measureText(avgText).width + 26;
    }
    if (durationDelta !== null && Math.abs(durationDelta) >= 1) {
      ctx.fillStyle = durationDelta > 0 ? pal.deltaUp : pal.deltaDown;
      ctx.fillText(`${formatDurationDelta(durationDelta)} VS LAST RIDE`, cx, y);
    }
    setSpacing('0px');
    y += isStory ? 46 : 34;
  } else {
    y += isStory ? 76 : 52;
  }
  hairline(y);

  // ---- Metric table: 2 columns, hairline grid --------------------------
  interface MetricItem {
    label: string;
    value: string;
    unit: string;
    delta?: { text: string; positive: boolean } | null;
  }

  const metrics: MetricItem[] = [
    {
      label: 'DISTANCE',
      value: outcome.distanceKm.toFixed(2),
      unit: 'KM',
      delta: deltas ? formatDeltaText(deltas.distance, 'km', 1, deltas.distancePct) : null,
    },
    {
      label: 'CALORIES',
      value: String(outcome.calories),
      unit: 'KCAL',
      delta: deltas ? formatDeltaText(deltas.calories, 'kcal', 0, deltas.caloriesPct) : null,
    },
    {
      label: 'AVG POWER',
      value: String(session.stats?.avgPower || 0),
      unit: 'W',
      delta: deltas ? formatDeltaText(deltas.avgPower, 'W', 0, deltas.avgPowerPct) : null,
    },
    {
      label: 'MAX POWER',
      value: String(session.stats?.maxPower || 0),
      unit: 'W',
      delta: deltas ? formatDeltaText(deltas.maxPower, 'W', 0) : null,
    },
    ...(showHr ? [{
      label: 'AVG HR',
      value: String(session.stats?.avgHr || 0),
      unit: 'BPM',
      delta: deltas ? formatDeltaText(deltas.avgHr, 'bpm', 0, null, true) : null,
    }] : []),
    {
      label: 'AVG SPEED',
      value: currentSpeed.toFixed(1),
      unit: 'KM/H',
      delta: deltas ? formatDeltaText(deltas.avgSpeed, 'km/h', 1, deltas.avgSpeedPct) : null,
    },
  ];

  const cols = 2;
  const rows = Math.ceil(metrics.length / cols);
  const hasDeltas = deltas !== null;
  const cellH = hasChart
    ? (isStory ? (hasDeltas ? 136 : 108) : (hasDeltas ? 96 : 78))
    : (isStory ? (hasDeltas ? 300 : 240) : (hasDeltas ? 172 : 138));
  const gridTop = y;
  const colW = contentW / 2;
  const colX = [padX, padX + colW + 44];

  metrics.forEach((m, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = colX[col];
    const cellY = gridTop + row * cellH;

    ctx.font = mono(hasChart ? (isStory ? 16 : 14) : (isStory ? 18 : 15));
    setSpacing('2.5px');
    ctx.fillStyle = pal.muted;
    ctx.fillText(m.label, x, cellY + (hasChart ? 18 : 20));
    setSpacing('0px');

    ctx.font = sans(hasChart ? (isStory ? 52 : 40) : (isStory ? 100 : 72), '700');
    ctx.fillStyle = pal.ink;
    const valueBaseline = cellY + (hasChart ? (isStory ? 86 : 62) : (isStory ? 130 : 96));
    ctx.fillText(m.value, x, valueBaseline);

    const valueW = ctx.measureText(m.value).width;
    ctx.font = mono(hasChart ? (isStory ? 18 : 15) : (isStory ? 22 : 18));
    ctx.fillStyle = pal.muted;
    ctx.fillText(m.unit, x + valueW + (hasChart ? 10 : 12), valueBaseline);

    if (m.delta) {
      ctx.font = mono(hasChart ? (isStory ? 17 : 15) : (isStory ? 28 : 22), '600');
      setSpacing('0.5px');
      ctx.fillStyle = m.delta.positive ? pal.deltaUp : pal.deltaDown;
      ctx.fillText(m.delta.text, x, cellY + (hasChart ? (isStory ? 122 : 90) : (isStory ? 190 : 144)));
      setSpacing('0px');
    }
  });

  const gridBottom = gridTop + rows * cellH;

  // Row separators + single vertical divider
  for (let r = 1; r < rows; r++) {
    hairline(gridTop + r * cellH);
  }
  ctx.strokeStyle = pal.hairline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX + colW, gridTop + 8);
  ctx.lineTo(padX + colW, gridBottom - 8);
  ctx.stroke();

  y = gridBottom;

  // ---- Power chart: single thin line, no box, no fill ------------------
  if (hasChart) {
    const maxPoints = 90;
    const step = Math.max(1, Math.floor(history.length / maxPoints));
    const sampled: HistoryData[] = [];
    for (let i = 0; i < history.length; i += step) {
      sampled.push(history[i]);
    }
    if (sampled[sampled.length - 1] !== history[history.length - 1]) {
      sampled.push(history[history.length - 1]);
    }

    const maxPowerVal = Math.max(...sampled.map(p => p.power || 0), 100);

    y += isStory ? 72 : 46;

    ctx.font = mono(isStory ? 17 : 14);
    setSpacing('2.5px');
    ctx.fillStyle = pal.muted;
    ctx.fillText('POWER', padX, y);
    setSpacing('0px');

    ctx.font = mono(isStory ? 17 : 14);
    setSpacing('1px');
    ctx.textAlign = 'right';
    ctx.fillText(`PEAK ${Math.round(maxPowerVal)} W`, width - padX, y);
    ctx.textAlign = 'left';
    setSpacing('0px');

    const plotTop = y + (isStory ? 44 : 28);
    const plotH = isStory ? 300 : 92;
    const plotBottom = plotTop + plotH;

    hairline(plotBottom);

    const points = sampled.map((p, idx) => ({
      x: padX + (idx / (sampled.length - 1)) * contentW,
      y: plotBottom - ((p.power || 0) / maxPowerVal) * plotH,
    }));

    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    y = plotBottom;
  }

  // ---- Heart-rate recovery (story only, one quiet line) ----------------
  const hrrScore = typeof session.stats?.hrrScore === 'number' ? session.stats.hrrScore : null;
  if (isStory && hrrScore !== null) {
    y += isStory ? 56 : 44;
    ctx.font = mono(isStory ? 19 : 17);
    setSpacing('2px');
    ctx.fillStyle = pal.muted;
    ctx.fillText('HEART-RATE RECOVERY', padX, y);
    setSpacing('0px');
    ctx.font = mono(isStory ? 19 : 17, '700');
    ctx.fillStyle = pal.ink;
    const labelW = ctx.measureText('HEART-RATE RECOVERY').width;
    ctx.fillText(`   ${hrrScore} BPM  ·  ${(session.stats?.hrrClassification || 'Normal').toUpperCase()}`, padX + labelW, y);

    y += isStory ? 30 : 24;
  }

  // ---- Rider note -------------------------------------------------------
  if (customNote && customNote.trim().length > 0) {
    y += isStory ? 64 : 48;
    ctx.font = `italic ${isStory ? 26 : 22}px ${SANS_STACK}`;
    ctx.fillStyle = pal.muted;
    let note = `"${customNote.trim()}"`;
    while (ctx.measureText(note).width > contentW && note.length > 12) {
      note = `${note.slice(0, -5)}…"`;
    }
    ctx.fillText(note, padX, y);
  }
};

/** Generates PNG Blob from Share Card options */
export const generateShareCardBlob = (options: ShareCardRenderOptions): Promise<Blob | null> => {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    renderShareCardToCanvas(canvas, options);
    canvas.toBlob(blob => resolve(blob), 'image/png', 0.95);
  });
};

/** Triggers automatic PNG download for Share Card */
export const downloadShareCardPNG = async (
  options: ShareCardRenderOptions,
  filename = 'velopulse-achievement.png'
): Promise<void> => {
  const blob = await generateShareCardBlob(options);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Shares image directly using Web Share API (mobile/desktop browsers) */
export const shareViaWebShareApi = async (
  options: ShareCardRenderOptions,
  title = 'VeloPulse Workout',
  text = 'My indoor cycling session, tracked with VeloPulse.'
): Promise<boolean> => {
  const blob = await generateShareCardBlob(options);
  if (!blob) return false;

  const file = new File([blob], 'velopulse-workout.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title,
        text,
        files: [file],
      });
      return true;
    } catch {
      // User cancelled share dialog or error
      return false;
    }
  }

  return false;
};

/** Copies the generated share image to user clipboard */
export const copyShareCardToClipboard = async (options: ShareCardRenderOptions): Promise<boolean> => {
  const blob = await generateShareCardBlob(options);
  if (!blob || !navigator.clipboard?.write) return false;

  try {
    const item = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
};