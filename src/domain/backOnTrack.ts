/**
 * Back on Track - weekly recovery check-in (drug/substance addiction only).
 *
 * This is a self-reflection tool for monitoring perceived changes in overall
 * well-being during drug/substance recovery. It is NOT a medical test or
 * diagnosis. Each assessment can be completed once every 7 days and is stored
 * separately from the daily Journal.
 */

// ── Question option types ─────────────────────────────────────────────────

export type OverallWellBeing = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
export type WeekComparison = 'Much Better' | 'Slightly Better' | 'About the Same' | 'Slightly Worse' | 'Much Worse';
export type EnergyLevel = 'Very High' | 'High' | 'Average' | 'Low' | 'Very Low';
export type SleepQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
export type FocusLevel = 'Very Easy' | 'Easy' | 'Average' | 'Difficult' | 'Very Difficult';
export type MoodRating = 'Very Positive' | 'Mostly Positive' | 'Neutral' | 'Mostly Negative' | 'Very Negative';
export type CravingStrength = 'None' | 'Mild' | 'Moderate' | 'Strong' | 'Very Strong';
export type PhysicalDiscomfort = 'None' | 'Mild' | 'Moderate' | 'Severe';
export type SubstanceUse = 'No' | 'Once' | 'A Few Times' | 'Frequently';

// ── Weekly assessment entry ───────────────────────────────────────────────

export interface BackOnTrackEntry {
  id: string;
  /** Timestamp when the assessment was completed. */
  at: number;
  overallWellBeing: OverallWellBeing;
  weekComparison: WeekComparison;
  energyLevel: EnergyLevel;
  sleepQuality: SleepQuality;
  focusLevel: FocusLevel;
  moodRating: MoodRating;
  cravingStrength: CravingStrength;
  physicalDiscomfort: PhysicalDiscomfort;
  substanceUse: SubstanceUse;
  /** Optional personal notes. */
  notes: string;
}

// ── 7-day cooldown ────────────────────────────────────────────────────────

export const BACK_ON_TRACK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether the assessment is available now.
 * Returns `{ available: true }` or `{ available: false, nextAt, daysLeft }`.
 */
export function backOnTrackAvailability(
  lastAt: number | null,
  now = Date.now(),
): { available: true } | { available: false; nextAt: number; daysLeft: number } {
  if (lastAt == null) return { available: true };
  const nextAt = lastAt + BACK_ON_TRACK_INTERVAL_MS;
  if (now >= nextAt) return { available: true };
  const msLeft = nextAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { available: false, nextAt, daysLeft };
}

// ── Score helpers (for trends / insights) ─────────────────────────────────

function ratingScore(r: string): number {
  switch (r) {
    case 'Excellent': return 5;
    case 'Very High': return 5;
    case 'Very Positive': return 5;
    case 'Very Easy': return 5;
    case 'None': return 5;
    case 'Good': return 4;
    case 'High': return 4;
    case 'Mostly Positive': return 4;
    case 'Easy': return 4;
    case 'Mild': return 4;
    case 'No': return 4;
    case 'Fair': return 3;
    case 'Average': return 3;
    case 'Neutral': return 3;
    case 'Moderate': return 3;
    case 'About the Same': return 3;
    case 'Poor': return 2;
    case 'Low': return 2;
    case 'Mostly Negative': return 2;
    case 'Difficult': return 2;
    case 'Strong': return 2;
    case 'Severe': return 2;
    case 'Once': return 2;
    case 'Very Poor': return 1;
    case 'Very Low': return 1;
    case 'Very Negative': return 1;
    case 'Very Difficult': return 1;
    case 'Very Strong': return 1;
    case 'Frequently': return 1;
    case 'Slightly Better': return 4;
    case 'Much Better': return 5;
    case 'Slightly Worse': return 2;
    case 'Much Worse': return 1;
    default: return 3;
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
export function generateInsights(entries: BackOnTrackEntry[]): Insight[] {
  if (entries.length < 2) return [];

  const insights: Insight[] = [];
  const recent = entries.slice(0, Math.min(2, entries.length));
  const older = entries.slice(-Math.min(2, entries.length));

  const compare = (
    getScore: (e: BackOnTrackEntry) => number,
    label: string,
    improvingMsg: string,
    decliningMsg: string,
    stableMsg: string,
  ) => {
    const rAvg = recent.reduce((s, e) => s + getScore(e), 0) / recent.length;
    const oAvg = older.reduce((s, e) => s + getScore(e), 0) / older.length;
    const diff = rAvg - oAvg;
    if (diff > 0.5) insights.push({ label, value: improvingMsg, trend: 'improving' });
    else if (diff < -0.5) insights.push({ label, value: decliningMsg, trend: 'declining' });
    else insights.push({ label, value: stableMsg, trend: 'stable' });
  };

  compare(
    (e) => ratingScore(e.overallWellBeing),
    'Overall Well-being',
    'Your overall well-being has improved over recent weeks.',
    'Your well-being may have declined recently. Consider reaching out to a healthcare professional.',
    'Your overall well-being has remained consistent.',
  );

  compare(
    (e) => ratingScore(e.moodRating),
    'Mood',
    'Your mood has been more positive recently.',
    'Your mood seems lower than before. Be gentle with yourself.',
    'Your mood has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.energyLevel),
    'Energy',
    'Your energy levels have improved over recent weeks.',
    'Your energy levels seem to have dropped. Rest and nutrition can help.',
    'Your energy levels have stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.sleepQuality),
    'Sleep',
    "You've reported better sleep over the past weeks.",
    'Sleep quality seems to have declined. A consistent routine can help.',
    'Your sleep quality has remained steady.',
  );

  compare(
    (e) => ratingScore(e.cravingStrength),
    'Cravings',
    "You've reported fewer cravings over the past month.",
    'Cravings seem to have increased. Every day is a fresh start.',
    'Your craving levels have stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.substanceUse),
    'Substance Use',
    "You've reported fewer days of substance use.",
    'Substance use seems to have increased. Every day is a fresh start.',
    'Your substance use frequency has stayed about the same.',
  );

  return insights;
}

// ── Supportive messages ───────────────────────────────────────────────────

const SUPPORTIVE_MESSAGES = [
  'Every step forward counts.',
  'Recovery is a journey, not a race.',
  'Small improvements become lasting change.',
  "You're getting back on track, one week at a time.",
  'Each week you reflect is a week closer to a healthier you.',
  'Noticing changes takes awareness. You\'re doing great.',
  'Consistency is key - and you\'re showing up for yourself.',
  'Your body and mind are healing. Give them the time they deserve.',
];

export function randomSupportiveMessage(): string {
  return SUPPORTIVE_MESSAGES[Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)];
}
