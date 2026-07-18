/**
 * Cheers to Change - weekly body wellness reflection (alcohol addiction only).
 *
 * This is a self-reflection tool for monitoring perceived improvements in
 * overall well-being during alcohol recovery. It is NOT a medical test or
 * diagnosis. Each assessment can be completed once every 7 days and is stored
 * separately from the daily Journal.
 */

// ── Question option types ─────────────────────────────────────────────────

export type PhysicalHealthRating = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
export type BodyComparison = 'Much Better' | 'Slightly Better' | 'About the Same' | 'Slightly Worse' | 'Much Worse';
export type EnergyLevel = 'Very High' | 'Good' | 'Average' | 'Low' | 'Very Low';
export type SleepQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
export type HeadacheFrequency = 'Never' | 'Occasionally' | 'Frequently';
export type DigestiveIssues = 'Never' | 'Occasionally' | 'Frequently';
export type HydrationLevel = 'Very Well Hydrated' | 'Mostly Hydrated' | 'Sometimes Dehydrated' | 'Frequently Dehydrated';
export type MoodRating = 'Very Positive' | 'Mostly Positive' | 'Neutral' | 'Mostly Negative' | 'Very Negative';
export type DrinkingDays = 'None' | '1–2 Days' | '3–4 Days' | '5–7 Days';

// ── Weekly assessment entry ───────────────────────────────────────────────

export interface CheersToChangeEntry {
  id: string;
  /** Timestamp when the assessment was completed. */
  at: number;
  physicalHealth: PhysicalHealthRating;
  bodyComparison: BodyComparison;
  energyLevel: EnergyLevel;
  sleepQuality: SleepQuality;
  headacheFrequency: HeadacheFrequency;
  digestiveIssues: DigestiveIssues;
  hydrationLevel: HydrationLevel;
  moodRating: MoodRating;
  drinkingDays: DrinkingDays;
  /** Optional personal notes. */
  notes: string;
}

// ── 7-day cooldown ────────────────────────────────────────────────────────

export const CHEERS_TO_CHANGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether the assessment is available now.
 * Returns `{ available: true }` or `{ available: false, nextAt, daysLeft }`.
 */
export function cheersToChangeAvailability(
  lastAt: number | null,
  now = Date.now(),
): { available: true } | { available: false; nextAt: number; daysLeft: number } {
  if (lastAt == null) return { available: true };
  const nextAt = lastAt + CHEERS_TO_CHANGE_INTERVAL_MS;
  if (now >= nextAt) return { available: true };
  const msLeft = nextAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { available: false, nextAt, daysLeft };
}

// ── Score helpers (for trends / insights) ─────────────────────────────────

function healthRatingScore(r: string): number {
  switch (r) {
    case 'Excellent': return 5;
    case 'Very High': return 5;
    case 'Good': return 4;
    case 'Mostly Positive': return 4;
    case 'Fair': return 3;
    case 'Average': return 3;
    case 'Neutral': return 3;
    case 'Poor': return 2;
    case 'Low': return 2;
    case 'Mostly Negative': return 2;
    case 'Very Poor': return 1;
    case 'Very Low': return 1;
    case 'Very Negative': return 1;
    default: return 3;
  }
}

function drinkingDaysScore(d: DrinkingDays): number {
  switch (d) {
    case 'None': return 4;
    case '1–2 Days': return 3;
    case '3–4 Days': return 2;
    case '5–7 Days': return 1;
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
export function generateInsights(entries: CheersToChangeEntry[]): Insight[] {
  if (entries.length < 2) return [];

  const insights: Insight[] = [];
  const recent = entries.slice(0, Math.min(2, entries.length));
  const older = entries.slice(-Math.min(2, entries.length));

  const compare = (getScore: (e: CheersToChangeEntry) => number, label: string, improvingMsg: string, decliningMsg: string, stableMsg: string) => {
    const rAvg = recent.reduce((s, e) => s + getScore(e), 0) / recent.length;
    const oAvg = older.reduce((s, e) => s + getScore(e), 0) / older.length;
    const diff = rAvg - oAvg;
    if (diff > 0.5) insights.push({ label, value: improvingMsg, trend: 'improving' });
    else if (diff < -0.5) insights.push({ label, value: decliningMsg, trend: 'declining' });
    else insights.push({ label, value: stableMsg, trend: 'stable' });
  };

  compare(
    (e) => healthRatingScore(e.physicalHealth),
    'Physical Health',
    'Your overall physical health has improved over recent weeks.',
    'Your physical health may have declined recently. Consider reaching out to a healthcare professional.',
    'Your physical health has remained consistent.',
  );

  compare(
    (e) => healthRatingScore(e.energyLevel),
    'Energy',
    "Your energy levels have improved over recent weeks.",
    "Your energy levels seem to have dropped. Rest and nutrition can help.",
    'Your energy levels have stayed about the same.',
  );

  compare(
    (e) => healthRatingScore(e.sleepQuality),
    'Sleep',
    "You've reported better sleep over the past weeks.",
    "Sleep quality seems to have declined. A consistent routine can help.",
    'Your sleep quality has remained steady.',
  );

  compare(
    (e) => healthRatingScore(e.moodRating),
    'Mood',
    "Your mood has been more positive recently.",
    "Your mood seems lower than before. Be gentle with yourself.",
    'Your mood has stayed about the same.',
  );

  compare(
    (e) => drinkingDaysScore(e.drinkingDays),
    'Drinking',
    "You've been drinking less frequently in recent weeks.",
    "Drinking frequency seems to have increased. Every day is a fresh start.",
    'Your drinking frequency has stayed about the same.',
  );

  return insights;
}

// ── Supportive messages ───────────────────────────────────────────────────

const SUPPORTIVE_MESSAGES = [
  'Every alcohol-free day gives your body more time to recover.',
  "Recovery isn't about perfection - it's about progress.",
  'Small healthy choices today build a stronger tomorrow.',
  'Keep listening to your body and celebrating every step forward.',
  'Your body is healing. Give it the time and care it deserves.',
  'Each week you reflect is a week closer to a healthier you.',
  'Noticing changes takes awareness. You\'re doing great.',
  'Consistency is key - and you\'re showing up for yourself.',
];

export function randomSupportiveMessage(): string {
  return SUPPORTIVE_MESSAGES[Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)];
}
