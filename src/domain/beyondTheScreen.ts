/**
 * Beyond the Screen - weekly reflection (pornography addiction only).
 *
 * This is a self-reflection tool for monitoring focus, motivation, confidence,
 * social engagement, and overall well-being during pornography recovery. It is
 * NOT a clinical assessment or diagnosis. Each assessment can be completed once
 * every 7 days and is stored separately from the daily Journal.
 */

// ── Question option types ─────────────────────────────────────────────────

export type FocusLevel = 'Very Focused' | 'Focused' | 'Neutral' | 'Distracted' | 'Very Distracted';
export type MotivationLevel = 'Very Motivated' | 'Motivated' | 'Neutral' | 'Unmotivated' | 'Very Unmotivated';
export type ConfidenceLevel = 'Very Confident' | 'Confident' | 'Neutral' | 'Uncertain' | 'Very Uncertain';
export type UrgeFrequency = 'None' | 'Mild' | 'Moderate' | 'Strong' | 'Very Strong';
export type SocialTime = 'Yes' | 'No' | 'Not Applicable';
export type HobbiesTime = 'Yes' | 'No' | 'Not Applicable';
export type PresenceLevel = 'Much More' | 'Slightly More' | 'About the Same' | 'Slightly Less' | 'Much Less';

// ── Weekly assessment entry ───────────────────────────────────────────────

export interface BeyondTheScreenEntry {
  id: string;
  /** Timestamp when the assessment was completed. */
  at: number;
  focusLevel: FocusLevel;
  motivationLevel: MotivationLevel;
  confidenceLevel: ConfidenceLevel;
  urgeFrequency: UrgeFrequency;
  socialTime: SocialTime;
  hobbiesTime: HobbiesTime;
  presenceLevel: PresenceLevel;
  /** Optional personal notes. */
  notes: string;
}

// ── 7-day cooldown ────────────────────────────────────────────────────────

export const BEYOND_THE_SCREEN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether the assessment is available now.
 * Returns `{ available: true }` or `{ available: false, nextAt, daysLeft }`.
 */
export function beyondTheScreenAvailability(
  lastAt: number | null,
  now = Date.now(),
): { available: true } | { available: false; nextAt: number; daysLeft: number } {
  if (lastAt == null) return { available: true };
  const nextAt = lastAt + BEYOND_THE_SCREEN_INTERVAL_MS;
  if (now >= nextAt) return { available: true };
  const msLeft = nextAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { available: false, nextAt, daysLeft };
}

// ── Score helpers (for trends / insights) ─────────────────────────────────

function ratingScore(r: string): number {
  switch (r) {
    case 'Very Focused': return 5;
    case 'Very Motivated': return 5;
    case 'Very Confident': return 5;
    case 'None': return 5;
    case 'Yes': return 4;
    case 'Focused': return 4;
    case 'Motivated': return 4;
    case 'Confident': return 4;
    case 'Mild': return 4;
    case 'Neutral': return 3;
    case 'About the Same': return 3;
    case 'Not Applicable': return 3;
    case 'Distracted': return 2;
    case 'Unmotivated': return 2;
    case 'Uncertain': return 2;
    case 'Moderate': return 2;
    case 'No': return 2;
    case 'Much More': return 5;
    case 'Slightly More': return 4;
    case 'Slightly Less': return 2;
    case 'Much Less': return 1;
    case 'Very Distracted': return 1;
    case 'Very Unmotivated': return 1;
    case 'Very Uncertain': return 1;
    case 'Strong': return 1;
    case 'Very Strong': return 1;
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
export function generateInsights(entries: BeyondTheScreenEntry[]): Insight[] {
  if (entries.length < 2) return [];

  const insights: Insight[] = [];
  const recent = entries.slice(0, Math.min(2, entries.length));
  const older = entries.slice(-Math.min(2, entries.length));

  const compare = (
    getScore: (e: BeyondTheScreenEntry) => number,
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
    (e) => ratingScore(e.focusLevel),
    'Focus',
    'You reported feeling more focused this week.',
    'Your focus seems lower than before. Small steps count.',
    'Your focus level has remained consistent.',
  );

  compare(
    (e) => ratingScore(e.motivationLevel),
    'Motivation',
    'Your motivation has improved over recent weeks.',
    'Your motivation seems to have dropped. Rest and small wins help.',
    'Your motivation levels have stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.confidenceLevel),
    'Confidence',
    'You reported feeling more confident this week.',
    'Your confidence seems lower than before. Be gentle with yourself.',
    'Your confidence has remained steady.',
  );

  compare(
    (e) => ratingScore(e.urgeFrequency),
    'Urge Frequency',
    "You've reported fewer urges over the past weeks.",
    'Urges seem to have increased. Every day is a fresh start.',
    'Your urge frequency has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.socialTime),
    'Social Engagement',
    "You're making more time for meaningful activities.",
    'Social engagement seems lower. Even small connections matter.',
    'Your social engagement has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.presenceLevel),
    'Presence',
    'You feel more present during your day-to-day life.',
    'You feel less present. Mindfulness can help ground you.',
    'Your sense of presence has stayed about the same.',
  );

  return insights;
}

// ── Supportive messages ───────────────────────────────────────────────────

const SUPPORTIVE_MESSAGES = [
  'Small improvements become lasting habits.',
  'Every moment of awareness is a win.',
  "You're building a healthier relationship with yourself.",
  'Your attention is your most valuable resource.',
  'Each week you reflect is a week closer to a more present you.',
  'Noticing changes takes awareness. You\'re doing great.',
  'Consistency is key - and you\'re showing up for yourself.',
  'The real world has so much to offer. Keep exploring it.',
];

export function randomSupportiveMessage(): string {
  return SUPPORTIVE_MESSAGES[Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)];
}