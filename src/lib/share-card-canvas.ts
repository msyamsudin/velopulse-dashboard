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

interface ThemePalette {
  bgGradientStart: string;
  bgGradientEnd: string;
  cardBg: string;
  cardBorder: string;
  accentPrimary: string;
  accentSecondary: string;
  accentGlow: string;
  textPrimary: string;
  textMuted: string;
  textAccent: string;
  badgeBg: string;
  badgeBorder: string;
  chartLine: string;
  chartFillStart: string;
  chartFillEnd: string;
}

const THEMES: Record<ShareCardTheme, ThemePalette> = {
  neon: {
    bgGradientStart: '#060813',
    bgGradientEnd: '#0d1326',
    cardBg: 'rgba(255, 255, 255, 0.04)',
    cardBorder: 'rgba(0, 240, 255, 0.22)',
    accentPrimary: '#00f0ff',
    accentSecondary: '#f43f5e',
    accentGlow: 'rgba(0, 240, 255, 0.35)',
    textPrimary: '#ffffff',
    textMuted: '#94a3b8',
    textAccent: '#00f0ff',
    badgeBg: 'rgba(0, 240, 255, 0.1)',
    badgeBorder: 'rgba(0, 240, 255, 0.4)',
    chartLine: '#00f0ff',
    chartFillStart: 'rgba(0, 240, 255, 0.35)',
    chartFillEnd: 'rgba(0, 240, 255, 0.0)',
  },
  gold: {
    bgGradientStart: '#0c0a07',
    bgGradientEnd: '#1c150c',
    cardBg: 'rgba(255, 255, 255, 0.04)',
    cardBorder: 'rgba(245, 158, 11, 0.3)',
    accentPrimary: '#fbbf24',
    accentSecondary: '#f97316',
    accentGlow: 'rgba(245, 158, 11, 0.4)',
    textPrimary: '#ffffff',
    textMuted: '#d6d3d1',
    textAccent: '#fbbf24',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.45)',
    chartLine: '#fbbf24',
    chartFillStart: 'rgba(245, 158, 11, 0.35)',
    chartFillEnd: 'rgba(245, 158, 11, 0.0)',
  },
  stealth: {
    bgGradientStart: '#09090b',
    bgGradientEnd: '#141417',
    cardBg: 'rgba(255, 255, 255, 0.03)',
    cardBorder: 'rgba(255, 255, 255, 0.15)',
    accentPrimary: '#ffffff',
    accentSecondary: '#a1a1aa',
    accentGlow: 'rgba(255, 255, 255, 0.2)',
    textPrimary: '#ffffff',
    textMuted: '#a1a1aa',
    textAccent: '#ffffff',
    badgeBg: 'rgba(255, 255, 255, 0.08)',
    badgeBorder: 'rgba(255, 255, 255, 0.25)',
    chartLine: '#e4e4e7',
    chartFillStart: 'rgba(255, 255, 255, 0.25)',
    chartFillEnd: 'rgba(255, 255, 255, 0.0)',
  },
};

/** Helper to draw rounded rectangle on Canvas */
const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

/**
 * Renders high-resolution share card to a canvas element.
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

  // Resolve previous session for comparison (either directly provided or from allSessions)
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

  // Comparison deltas
  const deltas = showComparison && prevOutcome ? {
    distance: outcome.distanceKm - prevOutcome.distanceKm,
    calories: outcome.calories - prevOutcome.calories,
    avgPower: (session.stats?.avgPower || 0) - (resolvedPrevSession?.stats?.avgPower || 0),
    maxPower: (session.stats?.maxPower || 0) - (resolvedPrevSession?.stats?.maxPower || 0),
    avgHr: (session.stats?.avgHr || 0) - (resolvedPrevSession?.stats?.avgHr || 0),
    avgSpeed: currentSpeed - prevSpeed,
  } : null;

  // 1. Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, pal.bgGradientStart);
  bgGrad.addColorStop(1, pal.bgGradientEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Background ambient glow circles
  const glow1 = ctx.createRadialGradient(width * 0.8, height * 0.15, 10, width * 0.8, height * 0.15, 450);
  glow1.addColorStop(0, pal.accentGlow);
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  if (aspect === 'story') {
    const glow2 = ctx.createRadialGradient(width * 0.2, height * 0.75, 10, width * 0.2, height * 0.75, 500);
    glow2.addColorStop(0, pal.accentGlow);
    glow2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);
  }

  // Grid lines (subtle cyberpunk pattern)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = gridSize; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = gridSize; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Margin and layout constants
  const padX = 72;
  let cursorY = aspect === 'story' ? 120 : 80;

  // 2. Top Header Brand Bar
  ctx.fillStyle = pal.accentPrimary;
  ctx.font = 'bold 22px "JetBrains Mono", monospace, system-ui';
  ctx.letterSpacing = '4px';
  ctx.fillText('⚡ VELOPULSE CYCLING LOG', padX, cursorY);

  // Top Right Pill (Intensity or Comparison tag)
  const tagText = quality.label.toUpperCase();
  const tagWidth = 140;
  const tagHeight = 36;
  const tagX = width - padX - tagWidth;
  const tagY = cursorY - 26;
  drawRoundedRect(ctx, tagX, tagY, tagWidth, tagHeight, 8);
  ctx.fillStyle = pal.badgeBg;
  ctx.fill();
  ctx.strokeStyle = pal.badgeBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = pal.accentPrimary;
  ctx.font = 'bold 16px "JetBrains Mono", monospace, system-ui';
  ctx.letterSpacing = '2px';
  ctx.textAlign = 'center';
  ctx.fillText(tagText, tagX + tagWidth / 2, tagY + 24);
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';

  cursorY += 56;

  // 3. Main Headline / Celebration Title
  const displayHeadline =
    headline ||
    (milestones.length > 0 ? `${milestones[0].icon} ${milestones[0].title}` : null) ||
    (personalRecords.length > 0 ? `${personalRecords[0].icon} ${personalRecords[0].title}` : null) ||
    (showComparison && deltas && deltas.avgPower > 0 ? '📈 PROGRESSION & EFFORT' : null) ||
    'WORKOUT PERFORMANCE';

  ctx.fillStyle = pal.textPrimary;
  ctx.font = '900 48px system-ui, -apple-system, sans-serif';
  ctx.fillText(displayHeadline, padX, cursorY);

  cursorY += 36;

  // Subtitle / Date & Duration Info
  ctx.fillStyle = pal.textMuted;
  ctx.font = '500 22px "JetBrains Mono", monospace, system-ui';
  const durationText = formatDuration(outcome.duration);
  const comparisonSubtitle = showComparison && resolvedPrevSession ? '  •  vs Prev Workout' : '';
  ctx.fillText(`📅 ${dateFormatted}   ⏱️ ${durationText}   📍 Indoor Trainer${comparisonSubtitle}`, padX, cursorY);

  cursorY += 48;

  // 4. Milestone, PR, or Progression Badges Ribbon
  let allBadges = [...milestones, ...personalRecords];

  // If no milestones/PRs but comparison is active and has improvements, create comparison badges
  if (allBadges.length === 0 && deltas) {
    if (deltas.avgPower > 0) {
      allBadges.push({
        id: 'comp_power',
        type: 'pr',
        title: `+${deltas.avgPower}W Power`,
        subtitle: 'vs previous ride',
        icon: '⚡',
        valueFormatted: `+${deltas.avgPower} W`,
        tier: 'silver',
      });
    }
    if (deltas.distance > 0.5) {
      allBadges.push({
        id: 'comp_dist',
        type: 'distance',
        title: `+${deltas.distance.toFixed(1)} km Distance`,
        subtitle: 'longer session',
        icon: '🚴',
        valueFormatted: `+${deltas.distance.toFixed(1)} km`,
        tier: 'silver',
      });
    }
    if (deltas.avgSpeed > 0.5) {
      allBadges.push({
        id: 'comp_speed',
        type: 'pr',
        title: `+${deltas.avgSpeed.toFixed(1)} km/h Speed`,
        subtitle: 'faster pace',
        icon: '🚀',
        valueFormatted: `+${deltas.avgSpeed.toFixed(1)} km/h`,
        tier: 'silver',
      });
    }
  }

  if (allBadges.length > 0) {
    const ribbonY = cursorY;
    let badgeX = padX;
    const maxBadgesToShow = aspect === 'story' ? 4 : 3;

    allBadges.slice(0, maxBadgesToShow).forEach(badge => {
      const text = `${badge.icon} ${badge.title}`;
      ctx.font = 'bold 18px "JetBrains Mono", monospace, system-ui';
      const textWidth = ctx.measureText(text).width;
      const bWidth = textWidth + 36;
      const bHeight = 44;

      if (badgeX + bWidth <= width - padX) {
        drawRoundedRect(ctx, badgeX, ribbonY, bWidth, bHeight, 10);
        ctx.fillStyle = pal.badgeBg;
        ctx.fill();
        ctx.strokeStyle = pal.badgeBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = pal.textPrimary;
        ctx.fillText(text, badgeX + 18, ribbonY + 28);

        badgeX += bWidth + 14;
      }
    });

    cursorY += 64;
  }

  // 5. Main Metric Grid (Big Numbers + Delta comparison pills)
  interface MetricItem {
    label: string;
    value: string;
    unit: string;
    color: string;
    delta?: { text: string; positive: boolean } | null;
  }

  const formatDeltaText = (deltaVal: number, unit: string, decimals = 0, invertGood = false): { text: string; positive: boolean } | null => {
    if (Math.abs(deltaVal) < 0.01) return null;
    const sign = deltaVal > 0 ? '+' : '';
    const formatted = `${sign}${deltaVal.toFixed(decimals)}${unit ? ' ' + unit : ''}`;
    const positive = invertGood ? deltaVal < 0 : deltaVal > 0;
    return { text: formatted, positive };
  };

  const metrics: MetricItem[] = [
    {
      label: 'DISTANCE',
      value: outcome.distanceKm.toFixed(2),
      unit: 'KM',
      color: pal.accentPrimary,
      delta: deltas ? formatDeltaText(deltas.distance, 'km', 1) : null,
    },
    {
      label: 'CALORIES',
      value: String(outcome.calories),
      unit: 'KCAL',
      color: pal.accentSecondary,
      delta: deltas ? formatDeltaText(deltas.calories, 'kcal', 0) : null,
    },
    {
      label: 'AVG POWER',
      value: String(session.stats?.avgPower || 0),
      unit: 'W',
      color: '#facc15',
      delta: deltas ? formatDeltaText(deltas.avgPower, 'W', 0) : null,
    },
    {
      label: 'MAX POWER',
      value: String(session.stats?.maxPower || 0),
      unit: 'W',
      color: '#fb923c',
      delta: deltas ? formatDeltaText(deltas.maxPower, 'W', 0) : null,
    },
    ...(showHr ? [{
      label: 'AVG HR',
      value: String(session.stats?.avgHr || 0),
      unit: 'BPM',
      color: '#f43f5e',
      delta: deltas ? formatDeltaText(deltas.avgHr, 'bpm', 0, true) : null,
    }] : []),
    {
      label: 'AVG SPEED',
      value: currentSpeed.toFixed(1),
      unit: 'KM/H',
      color: '#38bdf8',
      delta: deltas ? formatDeltaText(deltas.avgSpeed, 'km/h', 1) : null,
    },
  ];

  const cols = 3;
  const cardGap = 20;
  const gridWidth = width - (padX * 2);
  const cardW = (gridWidth - (cardGap * (cols - 1))) / cols;
  const cardH = aspect === 'story' ? 140 : 110;

  metrics.slice(0, 6).forEach((m, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const mx = padX + (col * (cardW + cardGap));
    const my = cursorY + (row * (cardH + cardGap));

    // Card background
    drawRoundedRect(ctx, mx, my, cardW, cardH, 14);
    ctx.fillStyle = pal.cardBg;
    ctx.fill();
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Metric Label
    ctx.fillStyle = pal.textMuted;
    ctx.font = 'bold 15px "JetBrains Mono", monospace, system-ui';
    ctx.letterSpacing = '1px';
    ctx.fillText(m.label, mx + 20, my + 32);

    // Delta pill on top right of metric box (if available)
    if (m.delta) {
      const deltaStr = m.delta.text;
      ctx.font = 'bold 12px "JetBrains Mono", monospace, system-ui';
      const dWidth = ctx.measureText(deltaStr).width + 16;
      const dHeight = 22;
      const dx = mx + cardW - dWidth - 14;
      const dy = my + 16;

      drawRoundedRect(ctx, dx, dy, dWidth, dHeight, 6);
      ctx.fillStyle = m.delta.positive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      ctx.fill();
      ctx.strokeStyle = m.delta.positive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = m.delta.positive ? '#4ade80' : '#f87171';
      ctx.fillText(deltaStr, dx + 8, dy + 15);
    }

    // Metric Value
    ctx.fillStyle = pal.textPrimary;
    ctx.font = '900 36px "JetBrains Mono", monospace, system-ui';
    ctx.letterSpacing = '0px';
    ctx.fillText(m.value, mx + 20, my + (cardH - 24));

    // Metric Unit
    const valWidth = ctx.measureText(m.value).width;
    ctx.fillStyle = m.color;
    ctx.font = '600 16px "JetBrains Mono", monospace, system-ui';
    ctx.fillText(m.unit, mx + 20 + valWidth + 8, my + (cardH - 26));
  });

  const numRows = Math.ceil(Math.min(metrics.length, 6) / cols);
  cursorY += (numRows * (cardH + cardGap)) + 16;

  // 6. Mini Telemetry Sparkline Chart
  const history = session.history || [];
  if (showChart && history.length > 5) {
    const chartBoxW = width - (padX * 2);
    const chartBoxH = aspect === 'story' ? 360 : 200;

    // Card Box for chart
    drawRoundedRect(ctx, padX, cursorY, chartBoxW, chartBoxH, 16);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chart Title inside Box
    ctx.fillStyle = pal.textMuted;
    ctx.font = 'bold 14px "JetBrains Mono", monospace, system-ui';
    ctx.letterSpacing = '2px';
    ctx.fillText('TELEMETRY WAVEFORM (POWER & EFFORT)', padX + 24, cursorY + 32);

    const chartPadX = 24;
    const chartPadY = 50;
    const plotW = chartBoxW - (chartPadX * 2);
    const plotH = chartBoxH - chartPadY - 24;
    const plotX = padX + chartPadX;
    const plotY = cursorY + chartPadY;

    // Sample data points for smooth line
    const maxPoints = 80;
    const step = Math.max(1, Math.floor(history.length / maxPoints));
    const sampled: HistoryData[] = [];
    for (let i = 0; i < history.length; i += step) {
      sampled.push(history[i]);
    }
    if (sampled[sampled.length - 1] !== history[history.length - 1]) {
      sampled.push(history[history.length - 1]);
    }

    const maxPowerVal = Math.max(...sampled.map(p => p.power || 0), 100);

    // Build path
    const points = sampled.map((p, idx) => ({
      x: plotX + (idx / (sampled.length - 1)) * plotW,
      y: plotY + plotH - (((p.power || 0) / maxPowerVal) * plotH),
    }));

    if (points.length > 1) {
      // Fill under curve
      ctx.beginPath();
      ctx.moveTo(points[0].x, plotY + plotH);
      points.forEach(pt => ctx.lineTo(pt.x, pt.y));
      ctx.lineTo(points[points.length - 1].x, plotY + plotH);
      ctx.closePath();

      const fillGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
      fillGrad.addColorStop(0, pal.chartFillStart);
      fillGrad.addColorStop(1, pal.chartFillEnd);
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Stroke curve line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.strokeStyle = pal.chartLine;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    cursorY += chartBoxH + 24;
  }

  // 7. HR Recovery & Extra Callout (for Story format or if space allows)
  const hrrScore = typeof session.stats?.hrrScore === 'number' ? session.stats.hrrScore : null;
  if (aspect === 'story' && hrrScore !== null) {
    const hrrW = width - (padX * 2);
    const hrrH = 100;
    drawRoundedRect(ctx, padX, cursorY, hrrW, hrrH, 14);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 16px "JetBrains Mono", monospace, system-ui';
    ctx.fillText(`🫀 HEART RATE RECOVERY (HRR): ${hrrScore} BPM (${session.stats?.hrrClassification || 'Normal'})`, padX + 24, cursorY + 36);

    ctx.fillStyle = pal.textMuted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Strong autonomic recovery recorded in the 2-minute post-ride cooldown.', padX + 24, cursorY + 70);

    cursorY += hrrH + 24;
  }

  // Custom Note if provided
  if (customNote && customNote.trim().length > 0) {
    ctx.fillStyle = pal.textMuted;
    ctx.font = 'italic 18px system-ui, sans-serif';
    ctx.fillText(`"${customNote.trim()}"`, padX, cursorY + 10);
    cursorY += 36;
  }

  // 8. Footer Branding
  const footerY = height - (aspect === 'story' ? 80 : 50);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footerY - 24);
  ctx.lineTo(width - padX, footerY - 24);
  ctx.stroke();

  ctx.fillStyle = pal.textMuted;
  ctx.font = 'bold 16px "JetBrains Mono", monospace, system-ui';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('🚲 VELOPULSE • INDOOR PERFORMANCE TRACKER', padX, footerY);

  ctx.textAlign = 'right';
  ctx.fillStyle = pal.accentPrimary;
  ctx.fillText('velopulse.app', width - padX, footerY);
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';
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
  title = 'VeloPulse Workout Achievement',
  text = 'Check out my indoor cycling workout on VeloPulse!'
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
