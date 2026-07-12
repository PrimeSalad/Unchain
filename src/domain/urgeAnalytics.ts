/**
 * Urge Analytics - pure domain logic, zero framework dependencies.
 *
 * Computes heatmap data, generates recovery insights, and runs a lightweight
 * trigger-prediction engine - all from the local UrgeLog array.
 */

import type { UrgeLog } from './records';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeatmapCell {
  /** 0-indexed key: hour (0-23) or dow (0=Sun … 6=Sat) */
  key: number;
  count: number;
  totalIntensity: number;
  avgIntensity: number;
  /** 0..1 normalised weight for colour mapping */
  weight: number;
}

export interface CombinedCell {
  hour: number;
  dow: number;
  count: number;
  avgIntensity: number;
  weight: number;
}

export interface HeatmapData {
  byHour: HeatmapCell[];   // length 24
  byDow: HeatmapCell[];    // length 7
  combined: CombinedCell[]; // length 24 × 7 = 168
  totalUrges: number;
  avgIntensity: number;
}

export interface RecoveryInsight {
  id: string;
  icon: string;
  text: string;
  priority: number; // lower = more important
}

export interface TrendData {
  /** Change in urge count: positive = more urges, negative = fewer */
  weeklyDelta: number;
  /** Percentage change vs previous 7-day window */
  weeklyPct: number | null;
  /** Change in average intensity vs previous 7-day window */
  intensityDelta: number | null;
  improving: boolean;
}

export interface PredictionWindow {
  hour: number;
  dow: number;
  score: number;       // 0..1 risk score
  avgIntensity: number;
  topTrigger?: string;
}

export interface AnalyticsResult {
  heatmap: HeatmapData;
  insights: RecoveryInsight[];
  trend: TrendData;
  predictions: PredictionWindow[];
  /** The single next high-risk period to notify about, or null */
  nextPrediction: PredictionWindow | null;
  /** Minimum urge count required before predictions are generated */
  hasSufficientData: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MIN_URGES_FOR_PREDICTION = 10;
const PREDICTION_RISK_THRESHOLD = 0.35;

function urgeTriggers(urge: UrgeLog): string[] {
  return urge.triggers?.length ? urge.triggers : urge.trigger ? [urge.trigger] : [];
}

function sufficientPredictionHistory(urges: UrgeLog[]): boolean {
  if (urges.length < MIN_URGES_FOR_PREDICTION) return false;
  const timestamps = urges.map((urge) => urge.at);
  const span = Math.max(...timestamps) - Math.min(...timestamps);
  const days = new Set(timestamps.map((at) => new Date(at).toDateString())).size;
  return span >= 7 * 86_400_000 && days >= 3;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatHourRange(h: number): string {
  const end = (h + 2) % 24;
  return `${formatHour(h)}–${formatHour(end)}`;
}

function msSinceEpoch(): number {
  return Date.now();
}

/** Returns the count of urges within a rolling N-day window ending at `endMs` */
function urgesInWindow(urges: UrgeLog[], endMs: number, days: number): UrgeLog[] {
  const startMs = endMs - days * 86_400_000;
  return urges.filter((u) => u.at >= startMs && u.at < endMs);
}

// ---------------------------------------------------------------------------
// Heatmap computation
// ---------------------------------------------------------------------------

export function computeHeatmap(urges: UrgeLog[]): HeatmapData {
  if (urges.length === 0) {
    return {
      byHour: buildEmpty(24),
      byDow: buildEmpty(7),
      combined: buildEmptyCombined(),
      totalUrges: 0,
      avgIntensity: 0,
    };
  }

  // --- by hour ---
  const hourCount = new Array(24).fill(0);
  const hourIntensity = new Array(24).fill(0);
  // --- by dow ---
  const dowCount = new Array(7).fill(0);
  const dowIntensity = new Array(7).fill(0);
  // --- combined ---
  const combCount: number[][] = Array.from({ length: 24 }, () => new Array(7).fill(0));
  const combIntensity: number[][] = Array.from({ length: 24 }, () => new Array(7).fill(0));

  let totalIntensity = 0;

  for (const u of urges) {
    const d = new Date(u.at);
    const h = d.getHours();
    const dow = d.getDay();
    hourCount[h]++;
    hourIntensity[h] += u.intensity;
    dowCount[dow]++;
    dowIntensity[dow] += u.intensity;
    combCount[h][dow]++;
    combIntensity[h][dow] += u.intensity;
    totalIntensity += u.intensity;
  }

  const maxHour = Math.max(...hourCount, 1);
  const maxDow = Math.max(...dowCount, 1);

  const byHour: HeatmapCell[] = hourCount.map((count, h) => ({
    key: h,
    count,
    totalIntensity: hourIntensity[h],
    avgIntensity: count > 0 ? Math.round((hourIntensity[h] / count) * 10) / 10 : 0,
    weight: count / maxHour,
  }));

  const byDow: HeatmapCell[] = dowCount.map((count, dow) => ({
    key: dow,
    count,
    totalIntensity: dowIntensity[dow],
    avgIntensity: count > 0 ? Math.round((dowIntensity[dow] / count) * 10) / 10 : 0,
    weight: count / maxDow,
  }));

  // Combined: weight based on count × avg intensity for richer signal
  let maxCombScore = 1;
  for (let h = 0; h < 24; h++) {
    for (let dow = 0; dow < 7; dow++) {
      const c = combCount[h][dow];
      if (c === 0) continue;
      const avg = combIntensity[h][dow] / c;
      const score = c * avg;
      if (score > maxCombScore) maxCombScore = score;
    }
  }

  const combined: CombinedCell[] = [];
  for (let h = 0; h < 24; h++) {
    for (let dow = 0; dow < 7; dow++) {
      const c = combCount[h][dow];
      const avg = c > 0 ? Math.round((combIntensity[h][dow] / c) * 10) / 10 : 0;
      combined.push({
        hour: h,
        dow,
        count: c,
        avgIntensity: avg,
        weight: c > 0 ? (c * avg) / maxCombScore : 0,
      });
    }
  }

  return {
    byHour,
    byDow,
    combined,
    totalUrges: urges.length,
    avgIntensity: urges.length > 0
      ? Math.round((totalIntensity / urges.length) * 10) / 10
      : 0,
  };
}

function buildEmpty(n: number): HeatmapCell[] {
  return Array.from({ length: n }, (_, i) => ({
    key: i, count: 0, totalIntensity: 0, avgIntensity: 0, weight: 0,
  }));
}

function buildEmptyCombined(): CombinedCell[] {
  const cells: CombinedCell[] = [];
  for (let h = 0; h < 24; h++) {
    for (let dow = 0; dow < 7; dow++) {
      cells.push({ hour: h, dow, count: 0, avgIntensity: 0, weight: 0 });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Trend computation
// ---------------------------------------------------------------------------

export function computeTrend(urges: UrgeLog[]): TrendData {
  const now = msSinceEpoch();
  const thisWeek = urgesInWindow(urges, now, 7);
  const lastWeek = urgesInWindow(urges, now - 7 * 86_400_000, 7);

  const delta = thisWeek.length - lastWeek.length;
  const pct = lastWeek.length > 0
    ? Math.round(((thisWeek.length - lastWeek.length) / lastWeek.length) * 100)
    : null;

  const avgThis = thisWeek.length > 0
    ? thisWeek.reduce((s, u) => s + u.intensity, 0) / thisWeek.length
    : null;
  const avgLast = lastWeek.length > 0
    ? lastWeek.reduce((s, u) => s + u.intensity, 0) / lastWeek.length
    : null;

  const intensityDelta =
    avgThis != null && avgLast != null
      ? Math.round((avgThis - avgLast) * 10) / 10
      : null;

  return {
    weeklyDelta: delta,
    weeklyPct: pct,
    intensityDelta,
    improving: delta < 0 || (intensityDelta != null && intensityDelta < 0),
  };
}

// ---------------------------------------------------------------------------
// Insight generation
// ---------------------------------------------------------------------------

export function generateInsights(urges: UrgeLog[], heatmap: HeatmapData, trend: TrendData): RecoveryInsight[] {
  if (urges.length === 0) return [];

  const insights: RecoveryInsight[] = [];
  let id = 0;
  const push = (icon: string, text: string, priority: number) =>
    insights.push({ id: `insight-${id++}`, icon, text, priority });

  // --- Top risk hour ---
  const topHourCell = [...heatmap.byHour].sort((a, b) => b.count - a.count)[0];
  if (topHourCell && topHourCell.count > 0) {
    push(
      'time-outline',
      `Your highest-risk period is around ${formatHourRange(topHourCell.key)}.`,
      1,
    );
  }

  // --- Top risk day ---
  const topDowCell = [...heatmap.byDow].sort((a, b) => b.count - a.count)[0];
  if (topDowCell && topDowCell.count > 0) {
    const topHourOnThatDay = heatmap.combined
      .filter((c) => c.dow === topDowCell.key)
      .sort((a, b) => b.count - a.count)[0];
    if (topHourOnThatDay && topHourOnThatDay.count > 0) {
      push(
        'calendar-outline',
        `Most urges occur on ${DAYS_SHORT[topDowCell.key]} ${topHourOnThatDay.count > 1 ? `evenings around ${formatHour(topHourOnThatDay.hour)}` : 'evenings'}.`,
        2,
      );
    } else {
      push(
        'calendar-outline',
        `${DAYS_SHORT[topDowCell.key]} is your highest-risk day of the week.`,
        2,
      );
    }
  }

  // --- Peak intensity hour ---
  const peakIntensityHour = [...heatmap.byHour]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.avgIntensity - a.avgIntensity)[0];
  if (peakIntensityHour) {
    push(
      'flame-outline',
      `Your average urge intensity is highest at ${formatHour(peakIntensityHour.key)} (${peakIntensityHour.avgIntensity}/10).`,
      3,
    );
  }

  // --- Top trigger in high-risk hours ---
  const highRiskHours = heatmap.byHour
    .filter((c) => c.weight > 0.5)
    .map((c) => c.key);

  if (highRiskHours.length > 0) {
    const highRiskUrges = urges.filter((u) => highRiskHours.includes(new Date(u.at).getHours()));
    const triggerCounts: Record<string, number> = {};
    highRiskUrges.forEach((u) => {
      urgeTriggers(u).forEach((trigger) => {
        triggerCounts[trigger] = (triggerCounts[trigger] ?? 0) + 1;
      });
    });
    const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topTrigger) {
      push(
        'warning-outline',
        `"${topTrigger}" is your most common trigger during high-risk periods.`,
        4,
      );
    }
  }

  // --- Most common mood before urge ---
  const moodCounts: Record<number, number> = {};
  urges.forEach((u) => {
    if (u.mood != null) moodCounts[u.mood] = (moodCounts[u.mood] ?? 0) + 1;
  });
  const moodEntries = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
  if (moodEntries.length > 0) {
    const topMood = +moodEntries[0][0];
    const moodLabel = topMood <= 3 ? 'low' : topMood <= 6 ? 'moderate' : 'elevated';
    push(
      'heart-outline',
      `You most commonly experience urges when your mood is ${moodLabel} (${topMood}/10).`,
      5,
    );
  }

  // --- Overall trend ---
  if (trend.weeklyPct != null && Math.abs(trend.weeklyDelta) >= 2) {
    if (trend.improving) {
      push(
        'trending-down-outline',
        `Urges decreased ${Math.abs(trend.weeklyPct)}% this week compared to last. Keep going.`,
        6,
      );
    } else {
      push(
        'trending-up-outline',
        `Urges increased ${Math.abs(trend.weeklyPct)}% this week. Consider a coping strategy for high-risk times.`,
        7,
      );
    }
  }

  // --- Avg intensity overall ---
  push(
    'analytics-outline',
    `Your overall average urge intensity is ${heatmap.avgIntensity}/10 across ${heatmap.totalUrges} recorded urge${heatmap.totalUrges === 1 ? '' : 's'}.`,
    8,
  );

  return insights.sort((a, b) => a.priority - b.priority);
}

// ---------------------------------------------------------------------------
// Prediction engine
// ---------------------------------------------------------------------------

/**
 * Score every (hour, dow) bucket using a weighted combination of:
 *   - Frequency (how often urges occur at this time)
 *   - Intensity (avg urge strength at this time)
 *   - Recency (recent urges weighted more heavily)
 *
 * Only produces predictions when MIN_URGES_FOR_PREDICTION have been logged.
 */
export function computePredictions(urges: UrgeLog[]): PredictionWindow[] {
  if (!sufficientPredictionHistory(urges)) return [];

  const now = msSinceEpoch();
  const recent = urgesInWindow(urges, now, 28); // last 4 weeks for recency

  // Build a frequency + intensity map per (hour, dow)
  interface Bucket {
    count: number;
    totalIntensity: number;
    recentCount: number;
    triggers: Record<string, number>;
    moodRisk: number;
  }

  const buckets = new Map<string, Bucket>();
  const key = (h: number, d: number) => `${h}:${d}`;

  const recentIds = new Set(recent.map((urge) => urge.id));
  for (const u of urges) {
    const d = new Date(u.at);
    const h = d.getHours();
    const dow = d.getDay();
    const k = key(h, dow);
    const prev = buckets.get(k) ?? { count: 0, totalIntensity: 0, recentCount: 0, triggers: {}, moodRisk: 0 };
    const isRecent = recentIds.has(u.id);
    urgeTriggers(u).forEach((trigger) => {
      prev.triggers[trigger] = (prev.triggers[trigger] ?? 0) + 1;
    });
    buckets.set(k, {
      count: prev.count + 1,
      totalIntensity: prev.totalIntensity + u.intensity,
      recentCount: prev.recentCount + (isRecent ? 1 : 0),
      triggers: prev.triggers,
      moodRisk: prev.moodRisk + (u.mood == null ? 0.5 : (11 - u.mood) / 10),
    });
  }

  const maxCount = Math.max(...Array.from(buckets.values()).map((b) => b.count), 1);
  const maxRecent = Math.max(...Array.from(buckets.values()).map((b) => b.recentCount), 1);

  const windows: PredictionWindow[] = [];

  for (const [k, b] of buckets.entries()) {
    const [hStr, dStr] = k.split(':');
    const h = parseInt(hStr, 10);
    const dow = parseInt(dStr, 10);
    const avgIntensity = Math.round((b.totalIntensity / b.count) * 10) / 10;

    // Frequency and recent behavior lead; intensity and low-mood patterns
    // refine otherwise similar windows.
    const freqScore = b.count / maxCount;
    const recentScore = b.recentCount / maxRecent;
    const intensityScore = avgIntensity / 10;
    const moodScore = b.moodRisk / b.count;
    const score = freqScore * 0.45 + recentScore * 0.25 + intensityScore * 0.2 + moodScore * 0.1;

    if (b.count >= 2 && score >= PREDICTION_RISK_THRESHOLD) {
      const topTrigger = Object.entries(b.triggers).sort((a, b) => b[1] - a[1])[0]?.[0];
      windows.push({ hour: h, dow, score, avgIntensity, topTrigger });
    }
  }

  return windows.sort((a, b) => b.score - a.score);
}

/**
 * Given the current time, find the next upcoming high-risk window
 * (within the next 24 hours) that hasn't already passed today.
 */
export function findNextPrediction(predictions: PredictionWindow[]): PredictionWindow | null {
  if (predictions.length === 0) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentDow = now.getDay();

  // Find windows later today
  const laterToday = predictions.filter(
    (p) => p.dow === currentDow && p.hour > currentHour,
  );
  if (laterToday.length > 0) {
    return laterToday.reduce((best, p) =>
      p.hour < best.hour ? p : best,
    );
  }

  // Find windows tomorrow
  const tomorrow = (currentDow + 1) % 7;
  const tomorrowWindows = predictions.filter((p) => p.dow === tomorrow);
  if (tomorrowWindows.length > 0) {
    return tomorrowWindows.reduce((best, p) =>
      p.score > best.score ? p : best,
    );
  }

  // Fall back to highest-scoring overall
  return predictions[0] ?? null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function analyzeUrges(urges: UrgeLog[]): AnalyticsResult {
  const heatmap = computeHeatmap(urges);
  const trend = computeTrend(urges);
  const insights = generateInsights(urges, heatmap, trend);
  const predictions = computePredictions(urges);
  const nextPrediction = findNextPrediction(predictions);

  return {
    heatmap,
    insights,
    trend,
    predictions,
    nextPrediction,
    hasSufficientData: sufficientPredictionHistory(urges),
  };
}

// ---------------------------------------------------------------------------
// Notification message generator (used by the scheduler)
// ---------------------------------------------------------------------------

export function predictionNotificationMessage(window: PredictionWindow): {
  title: string;
  body: string;
} {
  const messages = [
    {
      title: 'Recovery Check-In',
      body: `You usually experience stronger urges around ${formatHour(window.hour)}. Take a few minutes for a recovery activity.`,
    },
    {
      title: 'Stay Strong',
      body: `This is one of your higher-risk periods. Consider starting your favorite coping exercise.`,
    },
    {
      title: 'Quick Check-In',
      body: `A quick check-in now may help you stay on track. You've got this.`,
    },
  ];
  // Rotate messages based on the hour so it doesn't feel repetitive
  const msg = messages[window.hour % messages.length];
  return msg;
}

export { DAYS_SHORT, MIN_URGES_FOR_PREDICTION, formatHour, formatHourRange };
