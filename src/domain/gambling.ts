/**
 * Recovery domain - pure TS, zero framework dependencies.
 * Offline-first: everything here is computed from locally-stored data.
 */

export type AddictionType =
  | 'gambling'
  | 'pornography'
  | 'social_media'
  | 'online_shopping'
  | 'smoking'
  | 'alcohol'
  | 'drugs'
  | 'gaming'
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
    key: 'online_shopping', label: 'Online Shopping', verb: 'shop online', freeLabel: 'Shop-Free', hasExpense: true,
    specificQuestion: 'Where do you mostly shop?',
    specificOptions: ['Shopee', 'Lazada', 'Amazon', 'TikTok Shop', 'Instagram Shopping', 'Facebook Marketplace', 'Other'],
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
    key: 'gaming', label: 'Gaming', verb: 'play', freeLabel: 'Gaming-Free', hasExpense: true,
    specificQuestion: 'What do you mostly play?',
    specificOptions: ['Mobile games', 'Console (PlayStation, Xbox, Switch)', 'PC games', 'Online multiplayer', 'Browser / web games', 'Gambling-style games (gacha, loot boxes)', 'Other'],
  },
  {
    key: 'other', label: 'Other', verb: 'do it', freeLabel: 'Free', hasExpense: true,
    specificQuestion: 'Describe the habit you want to quit',
  },
];

export function addictionMeta(k: AddictionType): AddictionMeta {
  return ADDICTIONS.find((a) => a.key === k) ?? ADDICTIONS[0];
}

/** Addiction-specific streak wording for the Home recovery summary. */
export function recoveryFreeLabel(k: AddictionType, addictionDetail?: string): string {
  if (k === 'social_media') return 'Social Media-Free';
  if (k === 'online_shopping') return 'Shop-Free';
  if (k === 'other') {
    const customLabel = addictionDetail?.trim();
    return customLabel ? `${customLabel}-Free` : 'Habit-Free';
  }
  return addictionMeta(k).freeLabel;
}

export type ExpensePeriod = 'daily' | 'weekly' | 'monthly';

export const DEFAULT_CURRENCY = '₱';

export const SUPPORTED_CURRENCIES = [
  { symbol: '₱', code: 'PHP', label: 'Philippine Peso' },
  { symbol: '$', code: 'USD', label: 'US Dollar' },
  { symbol: '€', code: 'EUR', label: 'Euro' },
  { symbol: '£', code: 'GBP', label: 'British Pound' },
  { symbol: '¥', code: 'JPY', label: 'Japanese Yen' },
  { symbol: '₹', code: 'INR', label: 'Indian Rupee' },
] as const;

/** Legacy generic list kept for backward-compatibility. Not used in UI. */
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

// ---------------------------------------------------------------------------
// Per-addiction trigger lists
// ---------------------------------------------------------------------------

export const GAMBLING_TRIGGERS = [
  'Stress',
  'Boredom',
  'Payday',
  'Watching sports',
  'Casino / betting ads',
  'Friends who gamble',
  'Winning streak',
  'Financial problems',
  'Celebrating a win',
  'Loneliness',
  'After drinking',
  'Other',
] as const;

export const SMOKING_TRIGGERS = [
  'Stress',
  'After a meal',
  'Morning coffee / tea',
  'Drinking alcohol',
  'Boredom',
  'Work break',
  'Driving',
  'Around other smokers',
  'Anxiety',
  'Craving the routine',
  'After waking up',
  'Other',
] as const;

export const ALCOHOL_TRIGGERS = [
  'Stress',
  'Social pressure',
  'Celebrations / parties',
  'Loneliness',
  'Boredom',
  'After work',
  'Negative emotions',
  'Habitual drinking time',
  'Seeing alcohol ads',
  'Relationship problems',
  'Anxiety',
  'Other',
] as const;

export const DRUGS_TRIGGERS = [
  'Stress',
  'Peer pressure',
  'Emotional pain',
  'Boredom',
  'Withdrawal symptoms',
  'Past trauma',
  'Availability / easy access',
  'Celebratory moments',
  'Loneliness',
  'Mental health episodes',
  'Old environment / places',
  'Other',
] as const;

export const SOCIAL_MEDIA_TRIGGERS = [
  'Boredom',
  'Procrastinating tasks',
  'Waking up / before bed',
  'FOMO',
  'Loneliness',
  'Waiting (queues, commute)',
  'Anxiety or stress',
  'Seeking validation',
  'Habit / muscle memory',
  "Watching other people's highlights",
  'Idle moments',
  'Other',
] as const;

export const OTHER_TRIGGERS = [
  'Stress',
  'Boredom',
  'Loneliness',
  'Anxiety',
  'Emotional pain',
  'Peer / social pressure',
  'Idle time',
  'Habit / routine',
  'Negative emotions',
  'Environmental cues',
  'Other',
] as const;

export const GAMING_TRIGGERS = [
  'Boredom',
  'Stress',
  'Loneliness',
  'Friends online',
  'FOMO / missing events',
  'Daily login rewards',
  'Competitive streak / rank',
  'Escaping responsibilities',
  'Late night / can\'t sleep',
  'Winning streak',
  'Anxiety',
  'Other',
] as const;

export const ONLINE_SHOPPING_TRIGGERS = [
  'Boredom',
  'Stress',
  'Sale / flash deals',
  'Social media ads',
  'FOMO / limited stock',
  'Emotional spending',
  'Payday / extra cash',
  'Loneliness',
  'Anxiety',
  'Peer pressure',
  'Habit / routine',
  'Other',
] as const;

/** Returns the appropriate trigger list for a given addiction type. */
export function triggersForAddiction(type: AddictionType): readonly string[] {
  switch (type) {
    case 'gambling':       return GAMBLING_TRIGGERS;
    case 'smoking':        return SMOKING_TRIGGERS;
    case 'alcohol':        return ALCOHOL_TRIGGERS;
    case 'drugs':          return DRUGS_TRIGGERS;
    case 'social_media':   return SOCIAL_MEDIA_TRIGGERS;
    case 'gaming':         return GAMING_TRIGGERS;
    case 'online_shopping': return ONLINE_SHOPPING_TRIGGERS;
    case 'pornography':    return []; // handled separately via PORN_TRIGGERS
    default:               return OTHER_TRIGGERS;
  }
}

export interface RecoveryProfile {
  name: string;
  age?: number;
  addictionType: AddictionType;
  addictionDetail?: string;
  /**
   * The LOCAL midnight timestamp of the day they last used.
   * Stored as local-calendar midnight (00:00:00) so calendar
   * arithmetic is always exact - no fractional-day drift.
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
 *  3. If there are no relapse events, fall back to `profile.startedAt` -
 *     meaning the user has been clean since they first set up the app.
 *
 * This makes the calendar and streak counter independent of `profile.startedAt`
 * mutations.  Relapses are stored as immutable events; history is never wiped.
 */
export function currentStreakStart(
  profileStartedAt: number,
  relapses: Array<{ at: number }>,
  journalEntries: Array<{ gambled?: boolean; watched?: boolean; drank?: boolean; smoked?: boolean; binged?: boolean; used?: boolean; played?: boolean; shopped?: boolean; at: number }>,
): number {
  const relapseTimestamps: number[] = [
    ...relapses.map((r) => r.at),
    // Gambling relapse: gambled === true
    // Porn relapse: watched === true
    // Alcohol relapse: drank === true
    // Smoking relapse: smoked === true
    // Social media relapse: binged === true
    // Drugs relapse: used === true
    // Gaming relapse: played === true
    // Online shopping relapse: shopped === true
    ...journalEntries.filter((j) => j.gambled === true || j.watched === true || j.drank === true || j.smoked === true || j.binged === true || j.used === true || j.played === true || j.shopped === true).map((j) => j.at),
  ];

  if (relapseTimestamps.length === 0) {
    // No relapses ever - use the original setup date.
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

export function formatMoneyInput(input: string, allowDecimal = false): string {
  const stripped = input.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
  const parts = stripped.split('.');
  const intPart = (parts[0] || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!allowDecimal || parts.length === 1) return intPart;
  return `${intPart}.${parts.slice(1).join('').slice(0, 2)}`;
}

export function parseMoneyInput(input: string): number {
  return parseFloat(input.replace(/,/g, '')) || 0;
}

export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  const n = Math.round(amount);
  // Sign before the currency symbol: -₱500, never ₱-500.
  return (n < 0 ? '-' : '') + currency + Math.abs(n).toLocaleString('en-PH');
}

// ---------------------------------------------------------------------------
// Journal-based financial stats
//
// Recovery-adjusted money rule (single source of truth for the app's balance):
//   - The journal asks "How much money do you have today?" - that answer is
//     the day's raw balance (moneyToday).
//   - If the user gambled AND lost the wager, the WAGER AMOUNT is subtracted:
//         remainingMoney = moneyToday - wagerAmount
//     The adjusted value is what every financial metric in the app (Home
//     tiles, Progress tracker, trends) is computed from.
//   - If the user gambled and WON, nothing is added:
//         remainingMoney = moneyToday
//     This app tracks addiction recovery, not gambling performance - a win
//     must never improve any metric, progress figure, or trend.
//   - Financial data never influences streak, calendar, or achievement logic.
// ---------------------------------------------------------------------------

/** The journal fields the financial system reads. */
export interface FinancialJournalEntry {
  at: number;
  moneyBalance?: number;
  gambled?: boolean;
  lost?: boolean;
  amountWagered?: number;
  amountLost?: number;
  shopped?: boolean;
  shopAmountSpent?: number;
  watched?: boolean;
  pornDidSpend?: boolean;
  pornSpendAmount?: number;
  smoked?: boolean;
  smokeDidSpend?: boolean;
  smokeSpendAmount?: number;
}

/**
 * The recovery-adjusted balance for a single journal entry.
 *
 *   - No `moneyBalance` recorded → null (entry is ignored by financial stats).
 *   - Gambled and lost → `moneyBalance - amountWagered`, floored at 0.
 *   - Shopped online  → `moneyBalance - shopAmountSpent`, floored at 0.
 *   - Watched porn and spent → `moneyBalance - pornSpendAmount`, floored at 0.
 *   - Smoked and spent → `moneyBalance - smokeSpendAmount`, floored at 0.
 *   - Did not spend → `moneyBalance` unchanged.
 */
export function recoveryAdjustedBalance(e: FinancialJournalEntry): number | null {
  if (e.moneyBalance == null) return null;
  if (e.gambled === true && e.lost === true) {
    const deduction = e.amountWagered ?? e.amountLost;
    if (deduction != null) return Math.max(0, e.moneyBalance - deduction);
  }
  if (e.shopped === true && e.shopAmountSpent != null) {
    return Math.max(0, e.moneyBalance - e.shopAmountSpent);
  }
  if (e.watched === true && e.pornDidSpend === true && e.pornSpendAmount != null) {
    return Math.max(0, e.moneyBalance - e.pornSpendAmount);
  }
  if (e.smoked === true && e.smokeDidSpend === true && e.smokeSpendAmount != null) {
    return Math.max(0, e.moneyBalance - e.smokeSpendAmount);
  }
  return e.moneyBalance;
}

export interface JournalMoneyStats {
  /**
   * Most recent recovery-adjusted balance (raw balance minus the wager on a
   * losing day). null if no entry has a balance.
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
 *  - Each entry's balance is adjusted first: a lost wager is subtracted,
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
