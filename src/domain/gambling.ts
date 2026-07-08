/**
 * Gambling recovery domain (V1 — gambling only). Pure logic, no framework.
 * Offline-first: everything here is computed from locally-stored data.
 */

export type GamblingType =
  | 'online_casino'
  | 'sports'
  | 'lottery'
  | 'slots'
  | 'bingo'
  | 'sabong'
  | 'other';

export const GAMBLING_TYPES: { key: GamblingType; label: string }[] = [
  { key: 'online_casino', label: 'Online Casino' },
  { key: 'sports', label: 'Sports Betting' },
  { key: 'lottery', label: 'Lottery' },
  { key: 'slots', label: 'Slots' },
  { key: 'bingo', label: 'Bingo' },
  { key: 'sabong', label: 'Sabong' },
  { key: 'other', label: 'Other' },
];

export type ExpensePeriod = 'daily' | 'weekly' | 'monthly';

/** Unified trigger vocabulary (onboarding + check-in + urge log). */
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
  gamblingType: GamblingType;
  /** Recovery start = the moment they last gambled. Streak counts from here. */
  startedAt: number;
  expenseAmount: number;
  expensePeriod: ExpensePeriod;
  currency: string; // e.g. "₱"
  triggers: string[];
  reason: string;
}

const MS_PER_DAY = 86_400_000;

// --- streak & timer ---------------------------------------------------------

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

// --- money ------------------------------------------------------------------

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

// --- milestones -------------------------------------------------------------

export const MILESTONES = [1, 3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365];

export function nextMilestone(days: number): number {
  for (const m of MILESTONES) if (days < m) return m;
  // past the last — next full year
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

// --- urge response (spec: escalate by level) --------------------------------

export type UrgeLevel = 'low' | 'medium' | 'high';

export function urgeLevel(intensity: number): UrgeLevel {
  if (intensity <= 3) return 'low';
  if (intensity <= 6) return 'medium';
  return 'high';
}
