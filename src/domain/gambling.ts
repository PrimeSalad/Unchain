/**
 * Recovery domain — pure TS, zero framework dependencies.
 * Offline-first: everything here is computed from locally-stored data.
 */

export type AddictionType =
  | 'gambling'
  | 'pornography'
  | 'social_media'
  | 'smoking'
  | 'alcohol'
  | 'drugs'
  | 'other';

export interface AddictionMeta {
  key: AddictionType;
  label: string;
  /** Present-tense verb for prompts, e.g. "Did you gamble today?" */
  verb: string;
  /** Suffix for the streak label, e.g. "Gambling-Free" → "18 Days Gambling-Free". */
  freeLabel: string;
  /** The addiction-specific follow-up question. */
  specificQuestion: string;
  /** Options for the follow-up; if omitted, a free-text field is shown. */
  specificOptions?: string[];
  /** Whether a spending question applies (social media / porn usually have none). */
  hasExpense: boolean;
}

export const ADDICTIONS: AddictionMeta[] = [
  {
    key: 'gambling', label: 'Gambling', verb: 'gamble', freeLabel: 'Gambling-Free', hasExpense: true,
    specificQuestion: 'What do you gamble on?',
    specificOptions: ['Sports betting', 'Casino games', 'Online slots', 'Poker', 'Lottery', 'Bingo', 'Sabong', 'Other'],
  },
  {
    key: 'pornography', label: 'Pornography', verb: 'watch porn', freeLabel: 'Porn-Free', hasExpense: false,
    specificQuestion: 'Anything you want to note? (optional)',
  },
  {
    key: 'social_media', label: 'Social Media', verb: 'binge social media', freeLabel: 'Free', hasExpense: false,
    specificQuestion: 'Which platforms pull you in most?',
    specificOptions: ['Facebook', 'TikTok', 'Instagram', 'X (Twitter)', 'YouTube', 'Other'],
  },
  {
    key: 'smoking', label: 'Smoking', verb: 'smoke', freeLabel: 'Smoke-Free', hasExpense: true,
    specificQuestion: 'What do you smoke?',
    specificOptions: ['Cigarettes', 'Vape', 'Cigar', 'Roll-your-own', 'Other'],
  },
  {
    key: 'alcohol', label: 'Alcohol', verb: 'drink', freeLabel: 'Alcohol-Free', hasExpense: true,
    specificQuestion: 'What do you usually drink?',
    specificOptions: ['Beer', 'Wine', 'Spirits / Hard liquor', 'Mixed drinks', 'Other'],
  },
  {
    key: 'drugs', label: 'Drugs / Substances', verb: 'use', freeLabel: 'Substance-Free', hasExpense: true,
    specificQuestion: 'What substance? (optional)',
  },
  {
    key: 'other', label: 'Other', verb: 'do it', freeLabel: 'Free', hasExpense: true,
    specificQuestion: 'Describe the habit you want to quit',
  },
];

export function addictionMeta(k: AddictionType): AddictionMeta {
  return ADDICTIONS.find((a) => a.key === k) ?? ADDICTIONS[0];
}

export type ExpensePeriod = 'daily' | 'weekly' | 'monthly';

export const TRIGGERS = [
  'Stress',
  'Boredom',
  'Payday',
  'Sports',
  'Casino Ads',
  'Friends',
  'Financial Problems',
  'Other',
] as const;
export type Trigger = (typeof TRIGGERS)[number];

export interface RecoveryProfile {
  name: string;
  age?: number;
  addictionType: AddictionType;
  addictionDetail?: string;
  /**
   * The LOCAL midnight timestamp of the day they last used.
   * Stored as local-calendar midnight (00:00:00) so calendar
   * arithmetic is always exact — no fractional-day drift.
   */
  startedAt: number;
  expenseAmount: number;
  expensePeriod: ExpensePeriod;
  currency: string;
  triggers: string[];
  reason: string;
}

const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Streak & timer
// ---------------------------------------------------------------------------

/**
 * Derive the start of the current clean window purely from event arrays.
 *
 * Rules:
 *  1. Collect every relapse timestamp from `relapses` and every journal entry
 *     where `gambled === true`.
 *  2. Find the MOST RECENT one (if any).  That event's LOCAL calendar midnight
 *     is the start of the current streak window.
 *  3. If there are no relapse events, fall back to `profile.startedAt` —
 *     meaning the user has been clean since they first set up the app.
 *
 * This makes the calendar and streak counter independent of `profile.startedAt`
 * mutations.  Relapses are stored as immutable events; history is never wiped.
 */
export function currentStreakStart(
  profileStartedAt: number,
  relapses: Array<{ at: number }>,
  journalEntries: Array<{ gambled?: boolean; at: number }>,
): number {
  const relapseTimestamps: number[] = [
    ...relapses.map((r) => r.at),
    ...journalEntries.filter((j) => j.gambled === true).map((j) => j.at),
  ];

  if (relapseTimestamps.length === 0) {
    // No relapses ever — use the original setup date.
    return profileStartedAt;
  }

  const latestRelapse = Math.max(...relapseTimestamps);
  // Return local midnight of the relapse day so streak arithmetic is whole-day.
  const d = new Date(latestRelapse);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function streakDays(startedAt: number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - startedAt) / MS_PER_DAY));
}

export function recoveryTimer(startedAt: number, now = Date.now()) {
  const ms = Math.max(0, now - startedAt);
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export function dailyRate(p: Pick<RecoveryProfile, 'expenseAmount' | 'expensePeriod'>): number {
  const div = p.expensePeriod === 'weekly' ? 7 : p.expensePeriod === 'monthly' ? 30 : 1;
  return p.expenseAmount / div;
}

export interface MoneySaved {
  today: number;
  week: number;
  month: number;
  total: number;
}

export function moneySaved(p: RecoveryProfile, now = Date.now()): MoneySaved {
  const rate = dailyRate(p);
  const days = streakDays(p.startedAt, now);
  const round = (n: number) => Math.round(n);
  return {
    today: round(rate),
    week: round(rate * Math.min(days + 1, 7)),
    month: round(rate * Math.min(days + 1, 30)),
    total: round(rate * days),
  };
}

export function formatMoney(amount: number, currency = '₱'): string {
  return currency + Math.round(amount).toLocaleString('en-PH');
}

// ---------------------------------------------------------------------------
// Journal-based financial stats
//
// These are INDEPENDENT of recovery metrics. A user can have more money on a
// relapse day (gambling win) or less on a clean day (regular bills). The
// financial system NEVER influences streak, calendar, or achievement logic.
// ---------------------------------------------------------------------------

export interface JournalMoneyStats {
  /** Most recent balance recorded in a journal entry. null if no entry has a balance. */
  current: number | null;
  /**
   * Change between the two most recent journal entries that have a balance.
   * Positive = gained money, negative = lost money. null if fewer than 2
   * balance entries exist.
   */
  change: number | null;
  /**
   * Average daily balance change over the last 7 calendar days that have a
   * journal balance recorded. null if fewer than 2 balance entries exist in
   * that window.
   */
  weeklyTrend: number | null;
  /**
   * Average daily balance change over the last 30 calendar days that have a
   * journal balance recorded. null if fewer than 2 balance entries exist in
   * that window.
   */
  monthlyTrend: number | null;
}

/**
 * Compute financial metrics purely from journal `moneyBalance` entries.
 *
 * Rules:
 *  - Only journal entries with a `moneyBalance` value are considered.
 *  - Entries are sorted oldest-first for trend math.
 *  - Recovery metrics (streak, relapses, gambled) are NOT consulted here.
 *  - A gambling win that increases the balance is reflected as positive change;
 *    this does NOT affect recovery status anywhere in the app — it is financial
 *    data only.
 */
export function journalMoneyStats(
  journal: Array<{ at: number; moneyBalance?: number }>,
): JournalMoneyStats {
  // Keep only entries that have a recorded balance, sorted oldest → newest.
  const entries = journal
    .filter((j): j is typeof j & { moneyBalance: number } => j.moneyBalance != null)
    .sort((a, b) => a.at - b.at);

  if (entries.length === 0) {
    return { current: null, change: null, weeklyTrend: null, monthlyTrend: null };
  }

  const current = entries[entries.length - 1].moneyBalance;
  const change =
    entries.length >= 2
      ? entries[entries.length - 1].moneyBalance - entries[entries.length - 2].moneyBalance
      : null;

  function windowTrend(windowMs: number): number | null {
    const cutoff = Date.now() - windowMs;
    const window = entries.filter((e) => e.at >= cutoff);
    if (window.length < 2) return null;
    const delta = window[window.length - 1].moneyBalance - window[0].moneyBalance;
    const days = Math.max(1, (window[window.length - 1].at - window[0].at) / MS_PER_DAY);
    return Math.round(delta / days);
  }

  return {
    current,
    change,
    weeklyTrend: windowTrend(7 * MS_PER_DAY),
    monthlyTrend: windowTrend(30 * MS_PER_DAY),
  };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export const MILESTONES = [1, 3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];

export function nextMilestone(days: number): number {
  for (const m of MILESTONES) if (days < m) return m;
  return Math.ceil((days + 1) / 365) * 365;
}

export function prevMilestone(days: number): number {
  let p = 0;
  for (const m of MILESTONES) if (days >= m) p = m;
  return p;
}

export function milestoneCrossed(prevDays: number, days: number): number | null {
  for (const m of MILESTONES) if (prevDays < m && days >= m) return m;
  return null;
}

// ---------------------------------------------------------------------------
// Urge level
// ---------------------------------------------------------------------------

export type UrgeLevel = 'low' | 'medium' | 'high';

export function urgeLevel(intensity: number): UrgeLevel {
  if (intensity <= 3) return 'low';
  if (intensity <= 6) return 'medium';
  return 'high';
}
