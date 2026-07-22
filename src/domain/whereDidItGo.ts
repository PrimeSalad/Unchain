/**
 * Where Did It Go? - weekly financial self-reflection (gambling addiction only).
 *
 * This is a self-reflection tool for monitoring financial confidence, gambling
 * urges, and spending habits during gambling recovery. It is NOT a financial
 * advisor or budget tool. Each assessment can be completed once every 7 days
 * and is stored separately from the daily Journal.
 */

// ── Question option types ─────────────────────────────────────────────────

export type FinancialConfidence = 'Very Confident' | 'Confident' | 'Neutral' | 'Uncertain' | 'Very Uncertain';
export type GamblingUrges = 'None' | 'Mild' | 'Moderate' | 'Strong' | 'Very Strong';
export type DidYouGamble = 'No' | 'Once' | 'A Few Times' | 'Frequently';
export type SpendingSatisfaction = 'Very Satisfied' | 'Satisfied' | 'Neutral' | 'Dissatisfied' | 'Very Dissatisfied';
export type DidYouSave = 'Yes' | 'No' | 'Not Applicable';
export type MeaningfulSpending = 'Yes' | 'No' | 'Not Sure';
export type SpendingControl = 'Much More' | 'Slightly More' | 'About the Same' | 'Slightly Less' | 'Much Less';

// ── Weekly assessment entry ───────────────────────────────────────────────

export interface WhereDidItGoEntry {
  id: string;
  /** Timestamp when the assessment was completed. */
  at: number;
  financialConfidence: FinancialConfidence;
  gamblingUrges: GamblingUrges;
  didYouGamble: DidYouGamble;
  spendingSatisfaction: SpendingSatisfaction;
  didYouSave: DidYouSave;
  meaningfulSpending: MeaningfulSpending;
  spendingControl: SpendingControl;
  /** Optional personal notes. */
  notes: string;
}

// ── 7-day cooldown ────────────────────────────────────────────────────────

export const WHERE_DID_IT_GO_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether the assessment is available now.
 * Returns `{ available: true }` or `{ available: false, nextAt, daysLeft }`.
 */
export function whereDidItGoAvailability(
  lastAt: number | null,
  now = Date.now(),
): { available: true } | { available: false; nextAt: number; daysLeft: number } {
  if (lastAt == null) return { available: true };
  const nextAt = lastAt + WHERE_DID_IT_GO_INTERVAL_MS;
  if (now >= nextAt) return { available: true };
  const msLeft = nextAt - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { available: false, nextAt, daysLeft };
}

// ── Score helpers (for trends / insights) ─────────────────────────────────

function ratingScore(r: string): number {
  switch (r) {
    case 'Very Confident': return 5;
    case 'None': return 5;
    case 'Very Satisfied': return 5;
    case 'Yes': return 4;
    case 'Confident': return 4;
    case 'Mild': return 4;
    case 'Satisfied': return 4;
    case 'Neutral': return 3;
    case 'About the Same': return 3;
    case 'Not Sure': return 3;
    case 'Not Applicable': return 3;
    case 'Uncertain': return 2;
    case 'Moderate': return 2;
    case 'Dissatisfied': return 2;
    case 'No': return 2;
    case 'Slightly More': return 4;
    case 'Much More': return 5;
    case 'Slightly Less': return 2;
    case 'Much Less': return 1;
    case 'Very Uncertain': return 1;
    case 'Strong': return 1;
    case 'Very Strong': return 1;
    case 'Very Dissatisfied': return 1;
    case 'Once': return 2;
    case 'A Few Times': return 1;
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
export function generateInsights(entries: WhereDidItGoEntry[]): Insight[] {
  if (entries.length < 2) return [];

  const insights: Insight[] = [];
  const recent = entries.slice(0, Math.min(2, entries.length));
  const older = entries.slice(-Math.min(2, entries.length));

  const compare = (
    getScore: (e: WhereDidItGoEntry) => number,
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
    (e) => ratingScore(e.financialConfidence),
    'Financial Confidence',
    'You reported feeling more confident managing your money this week.',
    'Your financial confidence seems lower than before. Small steps count.',
    'Your financial confidence has remained consistent.',
  );

  compare(
    (e) => ratingScore(e.gamblingUrges),
    'Gambling Urges',
    "You've reported fewer gambling urges over the past weeks.",
    'Gambling urges seem to have increased. Every day is a fresh start.',
    'Your gambling urge levels have stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.spendingSatisfaction),
    'Spending Satisfaction',
    "You're becoming more intentional with your spending.",
    'Your satisfaction with spending seems lower. Consider reflecting on what changed.',
    'Your spending satisfaction has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.didYouGamble),
    'Gambling Activity',
    "You've reported fewer days of gambling.",
    'Gambling activity seems to have increased. Every day is a fresh start.',
    'Your gambling frequency has stayed about the same.',
  );

  compare(
    (e) => ratingScore(e.spendingControl),
    'Spending Control',
    'You feel more in control of your spending compared to last week.',
    'You feel less in control of your spending. Consider setting small financial goals.',
    'Your sense of spending control has stayed about the same.',
  );

  return insights;
}

// ── Supportive messages ───────────────────────────────────────────────────

const SUPPORTIVE_MESSAGES = [
  'Small financial choices build lasting habits.',
  'Every dollar you keep is a win.',
  "You're building a healthier relationship with your money.",
  'Financial awareness is the first step to financial freedom.',
  'Each week you reflect is a week closer to financial confidence.',
  'Noticing your spending patterns takes awareness. You\'re doing great.',
  'Consistency is key - and you\'re showing up for yourself.',
  'Your future self will thank you for the choices you make today.',
];

export function randomSupportiveMessage(): string {
  return SUPPORTIVE_MESSAGES[Math.floor(Math.random() * SUPPORTIVE_MESSAGES.length)];
}