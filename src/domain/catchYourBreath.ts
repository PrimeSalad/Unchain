/**
 * Catch Your Breath - weekly lung health reflection (smoking addiction only).
 *
 * This is a self-reflection tool for monitoring perceived breathing changes
 * over time. It is NOT a medical test or diagnosis. Each assessment can be
 * completed once every 7 days and is stored separately from the daily Journal.
 */

// ── Question option types ─────────────────────────────────────────────────

export type BreathingRating = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
export type BreathingComparison = 'Much Better' | 'Slightly Better' | 'About the Same' | 'Slightly Worse' | 'Much Worse';
export type CoughFrequency = 'Never' | 'Occasionally' | 'Frequently' | 'Almost Every Day';
export type MucusFrequency = 'No' | 'Occasionally' | 'Frequently';
export type ShortnessOfBreathLevel =
  | 'I rarely get out of breath'
  | 'After climbing several flights of stairs'
  | 'After one flight of stairs'
  | 'During light walking'
  | 'Even while resting';
export type WheezingFrequency = 'Never' | 'Sometimes' | 'Often';
export type ChestDiscomfortFrequency = 'Never' | 'Sometimes' | 'Frequently';
export type ActivityTolerance =
  | 'More than 30 minutes'
  | '15–30 minutes'
  | '5–15 minutes'
  | 'Less than 5 minutes';
export type SmokingFrequency = "I didn't smoke" | 'Less than usual' | 'About the same' | 'More than usual';

// ── Weekly assessment entry ───────────────────────────────────────────────

export interface CatchYourBreathEntry {
  id: string;
  /** Timestamp when the assessment was completed. */
  at: number;
  breathingRating: BreathingRating;
  breathingComparison: BreathingComparison;
  coughFrequency: CoughFrequency;
  mucusFrequency: MucusFrequency;
  shortnessOfBreath: ShortnessOfBreathLevel;
  wheezingFrequency: WheezingFrequency;
  chestDiscomfort: ChestDiscomfortFrequency;
  activityTolerance: ActivityTolerance;
  smokingFrequency: SmokingFrequency;
  /** Optional personal notes. */
  notes: string;
}

// ── 7-day cooldown ────────────────────────────────────────────────────────

export const CATCH_YOUR_BREATH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether the assessment is available now.
 * Returns `{ available: true }` or `{ available: false, nextAt, daysLeft }`.
 */
export function catchYourBreathAvailability(
  lastAt: number | null,
  now = Date.now(),
): { available: true } | { available: false; nextAt: number; daysLeft: number } {
  if (lastAt == null) return { available: true };
  const nextAt = lastAt + CATCH_YOUR_BREATH_INTERVAL_MS;
  if (now >= nextAt) return { available: true };
  const msLeft = nextAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { available: false, nextAt, daysLeft };
}

// ── Score helpers (for trends / insights) ─────────────────────────────────

/** Numeric score for breathing rating (higher = better). */
function breathingRatingScore(r: BreathingRating): number {
  switch (r) {
    case 'Excellent': return 5;
    case 'Good': return 4;
    case 'Fair': return 3;
    case 'Poor': return 2;
    case 'Very Poor': return 1;
  }
}

/** Numeric score for shortness of breath (higher = better). */
function shortnessScore(s: ShortnessOfBreathLevel): number {
  switch (s) {
    case 'I rarely get out of breath': return 4;
    case 'After climbing several flights of stairs': return 3;
    case 'After one flight of stairs': return 2;
    case 'During light walking': return 1;
    case 'Even while resting': return 0;
  }
}

/** Numeric score for activity tolerance (higher = better). */
function activityScore(a: ActivityTolerance): number {
  switch (a) {
    case 'More than 30 minutes': return 4;
    case '15–30 minutes': return 3;
    case '5–15 minutes': return 2;
    case 'Less than 5 minutes': return 1;
  }
}

// ── Progress Insights ─────────────────────────────────────────────────────

export interface Insight {
  label: string;
  value: string;
  trend: 'improving' | 'stable' | 'declining' | 'neutral';
}

/**
 * Generate simple progress insights from a list of entries (newest first).
 * Returns at most one insight per metric.
 */
export function generateInsights(entries: CatchYourBreathEntry[]): Insight[] {
  if (entries.length === 0) return [];

  const insights: Insight[] = [];

  // Breathing score trend (compare last 2 vs first 2 if 4+ entries)
  if (entries.length >= 2) {
    const recent = entries.slice(0, Math.min(2, entries.length));
    const older = entries.slice(-Math.min(2, entries.length));
    const recentAvg = recent.reduce((s, e) => s + breathingRatingScore(e.breathingRating), 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + breathingRatingScore(e.breathingRating), 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 0.5) {
      insights.push({ label: 'Breathing', value: 'Your breathing has improved over recent weeks.', trend: 'improving' });
    } else if (diff < -0.5) {
      insights.push({ label: 'Breathing', value: 'Your breathing may have declined recently. Consider reaching out to a healthcare professional.', trend: 'declining' });
    } else {
      insights.push({ label: 'Breathing', value: 'Your breathing has remained consistent.', trend: 'stable' });
    }
  }

  // Smoking frequency trend
  if (entries.length >= 2) {
    const smokingScores: Record<SmokingFrequency, number> = {
      "I didn't smoke": 4,
      'Less than usual': 3,
      'About the same': 2,
      'More than usual': 1,
    };
    const recent = entries.slice(0, Math.min(3, entries.length));
    const older = entries.slice(-Math.min(3, entries.length));
    const recentAvg = recent.reduce((s, e) => s + smokingScores[e.smokingFrequency], 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + smokingScores[e.smokingFrequency], 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 0.3) {
      insights.push({ label: 'Smoking', value: "You've reported smoking less frequently in recent weeks.", trend: 'improving' });
    } else if (diff < -0.3) {
      insights.push({ label: 'Smoking', value: 'You seem to be smoking more frequently. Every day is a chance to try again.', trend: 'declining' });
    } else {
      insights.push({ label: 'Smoking', value: 'Your smoking frequency has stayed about the same.', trend: 'stable' });
    }
  }

  // Cough frequency
  if (entries.length >= 2) {
    const coughScores: Record<CoughFrequency, number> = {
      'Never': 4,
      'Occasionally': 3,
      'Frequently': 2,
      'Almost Every Day': 1,
    };
    const recent = entries.slice(0, Math.min(3, entries.length));
    const older = entries.slice(-Math.min(3, entries.length));
    const recentAvg = recent.reduce((s, e) => s + coughScores[e.coughFrequency], 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + coughScores[e.coughFrequency], 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 0.3) {
      insights.push({ label: 'Coughing', value: "You're reporting less coughing than before.", trend: 'improving' });
    } else if (diff < -0.3) {
      insights.push({ label: 'Coughing', value: 'Your coughing may have increased. If it persists, consider consulting a healthcare professional.', trend: 'declining' });
    }
  }

  // Wheezing
  if (entries.length >= 2) {
    const wheezeScores: Record<WheezingFrequency, number> = {
      'Never': 3,
      'Sometimes': 2,
      'Often': 1,
    };
    const recent = entries.slice(0, Math.min(3, entries.length));
    const older = entries.slice(-Math.min(3, entries.length));
    const recentAvg = recent.reduce((s, e) => s + wheezeScores[e.wheezingFrequency], 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + wheezeScores[e.wheezingFrequency], 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 0.3) {
      insights.push({ label: 'Wheezing', value: "You're reporting less wheezing over time.", trend: 'improving' });
    } else if (diff < -0.3) {
      insights.push({ label: 'Wheezing', value: 'Wheezing seems to be increasing. Please consider seeing a healthcare professional.', trend: 'declining' });
    }
  }

  // Shortness of breath
  if (entries.length >= 2) {
    const recent = entries.slice(0, Math.min(3, entries.length));
    const older = entries.slice(-Math.min(3, entries.length));
    const recentAvg = recent.reduce((s, e) => s + shortnessScore(e.shortnessOfBreath), 0) / recent.length;
    const olderAvg = older.reduce((s, e) => s + shortnessScore(e.shortnessOfBreath), 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 0.3) {
      insights.push({ label: 'Shortness of Breath', value: 'You seem to be getting less out of breath over time.', trend: 'improving' });
    } else if (diff < -0.3) {
      insights.push({ label: 'Shortness of Breath', value: 'Shortness of breath may be worsening. Consider consulting a healthcare professional.', trend: 'declining' });
    }
  }

  return insights;
}

// ── Supportive messages ───────────────────────────────────────────────────

const SUPPORTIVE_MESSAGES = [
  'Small improvements add up. Keep going.',
  'Every smoke-free choice gives your lungs another chance to recover.',
  "You're building healthier habits one week at a time.",
  'Tracking your progress shows real commitment to your health.',
  'Each week you reflect is a week closer to a healthier you.',
  'Noticing changes takes awareness. You\'re doing great.',
  'Your lungs are working hard to recover. Keep supporting them.',
  'Consistency is key - and you\'re showing up for yourself.',
];

export function randomSupportiveMessage(): string {
  return SUPPORTIVE_MESSAGES[Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)];
}

// ── Summary builder ───────────────────────────────────────────────────────

export function buildSummary(e: CatchYourBreathEntry): string {
  return `Breathing: ${e.breathingRating}, Coughing: ${e.coughFrequency}, Out of Breath: ${e.shortnessOfBreath}, Smoking: ${e.smokingFrequency}`;
}
