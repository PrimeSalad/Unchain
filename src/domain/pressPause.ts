/**
 * Press Pause - weekly reflection (gaming addiction only).
 *
 * This is a self-reflection tool for monitoring time balance, sleep quality,
 * physical activity, social engagement, and overall balance during gaming
 * recovery. It is NOT a clinical assessment or diagnosis. Each assessment
 * can be completed once every 7 days and is stored separately from the
 * daily Journal.
 */

// ── Question option types ─────────────────────────────────────────────────

export type TimeSatisfaction = 'Very Satisfied' | 'Satisfied' | 'Neutral' | 'Dissatisfied' | 'Very Dissatisfied';
export type GamingTime = 'Less than 1 hour' | '1-2 hours' | '2-4 hours' | '4-6 hours' | 'More than 6 hours';
export type Interference = 'No' | 'Once' | 'A Few Times' | 'Frequently';
export type PhysicalActivity = 'Yes' | 'No' | 'Not Applicable';
export type SleepQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
export type SocialTime = 'Yes' | 'No' | 'Not Applicable';
export type BalanceLevel = 'Much More Balanced' | 'Slightly More Balanced' | 'About the Same' | 'Slightly Less Balanced' | 'Much Less Balanced';

// ── Weekly assessment entry ───────────────────────────────────────────────

export interface PressPauseEntry {
  id: string;
  /** Timestamp when the assessment was completed. */
  at: number;
  timeSatisfaction: TimeSatisfaction;
  gamingTime: GamingTime;
  interference: Interference;
  physicalActivity: PhysicalActivity;
  sleepQuality: SleepQuality;
  socialTime: SocialTime;
  balanceLevel: BalanceLevel;
  /** Optional personal notes. */
  notes: string;
}

// ── 7-day cooldown ────────────────────────────────────────────────────────

export const PRESS_PAUSE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether the assessment is available now.
 * Returns `{ available: true }` or `{ available: false, nextAt, daysLeft }`.
 */
export function pressPauseAvailability(
  lastAt: number | null,
  now = Date.now(),
): { available: true } | { available: false; nextAt: number; daysLeft: number } {
  if (lastAt == null) return { available: true };
  const nextAt = lastAt + PRESS_PAUSE_INTERVAL_MS;
  if (now >= nextAt) return { available: true };
  const msLeft = nextAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { available: false, nextAt, daysLeft };
}

// ── Score helpers (for trends / insights) ─────────────────────────────────

function ratingScore(r: string): number {
  switch (r) {
    case 'Very Satisfied': return 5;
    case 'Excellent': return 5;
    case 'Much More Balanced': return 5;
    case 'Yes': return 4;
    case 'Satisfied': return 4;
    case 'Good': return 4;
    case 'Slightly More Balanced': return 4;
    case 'Less than 1 hour': return 4;
    case '1-2 hours': return 4;
    case 'Neutral': return 3;
    case 'About the Same': return 3;
    case 'Not Applicable': return 3;
    case '2-4 hours': return 3;
    case 'Dissatisfied': return 2;
    case 'Poor': return 2;
    case 'Slightly Less Balanced': return 2;
    case '4-6 hours': return 2;
    case 'No': return 2;
    case 'Very Dissatisfied': return 1;
    case 'Very Poor': return 1;
    case 'Much Less Balanced': return 1;
    case 'More than 6 hours': return 1;
    case 'Once': return 3;
    case 'A Few Times': return 2;
    case 'Frequently': return 1;
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
export function generateInsights(entries: PressPauseEntry[]): Insight[] {
  if (entries.length < 2) return [];

  const insights: Insight[] = [];
  const recent = entries.slice(0, Math.min(2, entries.length));
  const older = entries.slice(-Math.min(2, entries.length));

  const compare = (
    getScore: (e: PressPauseEntry) => number,
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
    (e) => ratingScore(e.timeSatisfaction),
    'Time Satisfaction',
    'You reported a healthier balance this week.',
    'Your satisfaction with time use seems lower. Small adjustments help.',
    'Your time satisfaction has remained consistent.',
  );

  compare(
    (e) => ratingScore(e.gamingTime),
    'Gaming Time',
    'Your gaming time has decreased over recent weeks.',
    'Gaming time seems to have increased. Setting limits can help.',
    'Your gaming time has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.sleepQuality),
    'Sleep Quality',
    "You've reported better sleep over the past weeks.",
    'Sleep quality seems to have declined. A consistent routine can help.',
    'Your sleep quality has remained steady.',
  );

  compare(
    (e) => ratingScore(e.physicalActivity),
    'Physical Activity',
    "You're making time for physical activity.",
    'Physical activity seems lower. Even short walks help.',
    'Your physical activity has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.socialTime),
    'Social Engagement',
    "You're making time for meaningful relationships.",
    'Social engagement seems lower. Even small connections matter.',
    'Your social engagement has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.balanceLevel),
    'Daily Balance',
    'You feel more balanced in your daily life.',
    'Balance seems harder to maintain. One small change at a time.',
    'Your sense of balance has stayed about the same.',
  );

  return insights;
}

// ── Supportive messages ───────────────────────────────────────────────────

const SUPPORTIVE_MESSAGES = [
  'Healthy routines are built one week at a time.',
  'Balance is a practice, not a destination.',
  "You're learning to enjoy gaming without it controlling you.",
  'Every hour you invest in other parts of your life matters.',
  'Each week you reflect is a week closer to a balanced you.',
  'Noticing patterns takes awareness. You\'re doing great.',
  'Consistency is key - and you\'re showing up for yourself.',
  'Your life is bigger than any screen. Keep exploring it.',
];

export function randomSupportiveMessage(): string {
  return SUPPORTIVE_MESSAGES[Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)];
}