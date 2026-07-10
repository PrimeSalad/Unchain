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
// Recovery-adjusted money rule:
//   - The journal asks "How much money do you have today?" — that answer is
//     the day's raw balance.
//   - If the user gambled AND lost, the amount lost is SUBTRACTED from that
//     raw balance. The adjusted value is what every financial metric in the
//     app (Home tiles, Progress tracker, trends) is computed from.
//   - If the user gambled and WON, winnings are NEVER added. This app tracks
//     addiction recovery, not gambling performance — a win must not improve
//     any metric, progress figure, or trend.
//   - Financial data never influences streak, calendar, or achievement logic.
// ---------------------------------------------------------------------------

/** The journal fields the financial system reads. */
export interface FinancialJournalEntry {
  at: number;
  moneyBalance?: number;
  gambled?: boolean;
  lost?: boolean;
  amountLost?: number;
}

/**
 * The recovery-adjusted balance for a single journal entry.
 *
 *   - No `moneyBalance` recorded → null (entry is ignored by financial stats).
 *   - Gambled and lost → `moneyBalance - amountLost`, floored at 0.
 *   - Gambled and won  → `moneyBalance` unchanged; winnings are never added.
 *   - Did not gamble   → `moneyBalance` unchanged.
 */
export function recoveryAdjustedBalance(e: FinancialJournalEntry): number | null {
  if (e.moneyBalance == null) return null;
  if (e.gambled === true && e.lost === true && e.amountLost != null) {
    return Math.max(0, e.moneyBalance - e.amountLost);
  }
  return e.moneyBalance;
}

export interface JournalMoneyStats {
  /**
   * Most recent recovery-adjusted balance (raw balance minus any gambling
   * loss that day). null if no entry has a balance.
   */
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
 * Compute financial metrics from journal entries using the recovery-adjusted
 * balance (see `recoveryAdjustedBalance`).
 *
 * Rules:
 *  - Only journal entries with a `moneyBalance` value are considered.
 *  - Each entry's balance is adjusted first: gambling losses are subtracted,
 *    gambling winnings are never added.
 *  - Entries are sorted oldest-first for trend math.
 *  - The adjusted figures feed every financial display in the app; they never
 *    influence streak, calendar, or achievement logic.
 */
export function journalMoneyStats(journal: FinancialJournalEntry[]): JournalMoneyStats {
  // Keep only entries with a recorded balance, adjusted for gambling losses,
  // sorted oldest → newest.
  const entries = journal
    .map((j) => ({ at: j.at, balance: recoveryAdjustedBalance(j) }))
    .filter((j): j is { at: number; balance: number } => j.balance != null)
    .sort((a, b) => a.at - b.at);

  if (entries.length === 0) {
    return { current: null, change: null, weeklyTrend: null, monthlyTrend: null };
  }

  const current = entries[entries.length - 1].balance;
  const change =
    entries.length >= 2
      ? entries[entries.length - 1].balance - entries[entries.length - 2].balance
      : null;

  function windowTrend(windowMs: number): number | null {
    const cutoff = Date.now() - windowMs;
    const window = entries.filter((e) => e.at >= cutoff);
    if (window.length < 2) return null;
    const delta = window[window.length - 1].balance - window[0].balance;
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
