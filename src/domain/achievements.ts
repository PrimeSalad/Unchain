/**
 * Achievements, goals & recovery stats — pure TS, no framework deps.
 *
 * This is what gives the app *purpose* beyond breathing: measurable goals to
 * strive for and badges to collect. Everything is derived locally from the
 * records the user already generates (check-ins, urges, journal, tools).
 */

import type { RecoveryProfile } from './gambling';
import { streakDays, moneySaved, MILESTONES } from './gambling';
import type {
  DailyCheckIn,
  JournalEntry,
  Reflection,
  RelapseEvent,
  TimelineEvent,
  UrgeLog,
} from './records';

// ---------------------------------------------------------------------------
// Aggregate stats
// ---------------------------------------------------------------------------

export interface RecoveryStats {
  currentStreak: number;
  longestStreak: number;
  moneyTotal: number;
  checkIns: number;
  cleanCheckIns: number;
  urgesLogged: number;
  urgesResisted: number;
  journalEntries: number;
  reflections: number;
  toolSessions: number;
  relapses: number;
  points: number;
}

export interface StatsInput {
  profile: RecoveryProfile;
  checkIns: DailyCheckIn[];
  urges: UrgeLog[];
  relapses: RelapseEvent[];
  journal: JournalEntry[];
  reflections: Reflection[];
  timeline: TimelineEvent[];
  points: number;
  longestStreak: number;
  now?: number;
}

export function computeStats(i: StatsInput): RecoveryStats {
  const now = i.now ?? Date.now();
  const currentStreak = streakDays(i.profile.startedAt, now);
  return {
    currentStreak,
    longestStreak: Math.max(i.longestStreak, currentStreak),
    moneyTotal: moneySaved(i.profile, now).total,
    checkIns: i.checkIns.length,
    cleanCheckIns: i.checkIns.filter((c) => !c.gambled).length,
    urgesLogged: i.urges.length,
    urgesResisted: i.urges.filter((u) => u.resisted).length,
    journalEntries: i.journal.length,
    reflections: i.reflections.length,
    // Breathing + delay tool completions are recorded on the timeline.
    toolSessions: i.timeline.filter((e) => e.type === 'breathing' || e.type === 'badge').length,
    relapses: i.relapses.length,
    points: i.points,
  };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export type BadgeCategory = 'streak' | 'resilience' | 'consistency' | 'reflection' | 'tools' | 'money';

export interface Badge {
  id: string;
  title: string;
  desc: string;
  icon: string; // Ionicons name
  category: BadgeCategory;
  /** Reads the current value + target from stats. */
  metric: (s: RecoveryStats) => { value: number; target: number };
}

/** Progress-carrying view of a badge for the UI. */
export interface BadgeProgress extends Badge {
  value: number;
  target: number;
  earned: boolean;
  /** 0..1 */
  pct: number;
}

export const BADGES: Badge[] = [
  // Streak
  { id: 'streak-1',   title: 'First Day',   desc: '1 day free',      icon: 'flag',           category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 1 }) },
  { id: 'streak-3',   title: '72 Hours',    desc: '3 days free',     icon: 'time',           category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 3 }) },
  { id: 'streak-7',   title: 'One Week',    desc: '7 days free',     icon: 'calendar',       category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 7 }) },
  { id: 'streak-14',  title: 'Fortnight',   desc: '14 days free',    icon: 'calendar-clear', category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 14 }) },
  { id: 'streak-30',  title: 'One Month',   desc: '30 days free',    icon: 'ribbon',         category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 30 }) },
  { id: 'streak-90',  title: '90 Days',     desc: 'A full quarter',  icon: 'trophy',         category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 90 }) },
  { id: 'streak-180', title: 'Half a Year', desc: '180 days free',   icon: 'medal',          category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 180 }) },
  { id: 'streak-365', title: 'One Year',    desc: '365 days free',   icon: 'star',           category: 'streak', metric: (s) => ({ value: s.longestStreak, target: 365 }) },

  // Resilience
  { id: 'urge-1',   title: 'Named It',    desc: 'Logged your first urge',     icon: 'pulse',       category: 'resilience', metric: (s) => ({ value: s.urgesLogged, target: 1 }) },
  { id: 'resist-5', title: 'Rode 5 Waves', desc: 'Resisted 5 urges',          icon: 'water',       category: 'resilience', metric: (s) => ({ value: s.urgesResisted, target: 5 }) },
  { id: 'resist-25', title: 'Wave Rider', desc: 'Resisted 25 urges',          icon: 'trending-up', category: 'resilience', metric: (s) => ({ value: s.urgesResisted, target: 25 }) },

  // Consistency
  { id: 'checkin-1',  title: 'Checked In',  desc: 'First daily check-in',     icon: 'checkmark-circle', category: 'consistency', metric: (s) => ({ value: s.checkIns, target: 1 }) },
  { id: 'checkin-7',  title: 'Steady Week', desc: '7 check-ins logged',       icon: 'shield-checkmark', category: 'consistency', metric: (s) => ({ value: s.checkIns, target: 7 }) },
  { id: 'checkin-30', title: 'Reliable',    desc: '30 check-ins logged',      icon: 'shield',           category: 'consistency', metric: (s) => ({ value: s.checkIns, target: 30 }) },

  // Reflection
  { id: 'journal-1',  title: 'First Words', desc: 'Wrote your first entry',   icon: 'create',      category: 'reflection', metric: (s) => ({ value: s.journalEntries, target: 1 }) },
  { id: 'journal-10', title: 'Journaler',   desc: 'Wrote 10 entries',         icon: 'book',        category: 'reflection', metric: (s) => ({ value: s.journalEntries, target: 10 }) },

  // Tools
  { id: 'tool-1',  title: 'Toolbox',   desc: 'Used a calming tool',          icon: 'leaf',         category: 'tools', metric: (s) => ({ value: s.toolSessions, target: 1 }) },
  { id: 'tool-10', title: 'Grounded',  desc: 'Used calming tools 10 times',  icon: 'flower',       category: 'tools', metric: (s) => ({ value: s.toolSessions, target: 10 }) },

  // Money
  { id: 'save-1k',  title: '₱1,000 Kept',   desc: 'Saved your first ₱1,000',  icon: 'cash',        category: 'money', metric: (s) => ({ value: s.moneyTotal, target: 1000 }) },
  { id: 'save-10k', title: '₱10,000 Kept',  desc: 'Saved ₱10,000',            icon: 'wallet',      category: 'money', metric: (s) => ({ value: s.moneyTotal, target: 10000 }) },
  { id: 'save-50k', title: '₱50,000 Kept',  desc: 'Saved ₱50,000',            icon: 'diamond',     category: 'money', metric: (s) => ({ value: s.moneyTotal, target: 50000 }) },
];

export function badgeProgress(stats: RecoveryStats): BadgeProgress[] {
  return BADGES.map((b) => {
    const { value, target } = b.metric(stats);
    const pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
    return { ...b, value, target, earned: value >= target, pct };
  });
}

export function earnedBadgeIds(stats: RecoveryStats): string[] {
  return badgeProgress(stats).filter((b) => b.earned).map((b) => b.id);
}

// ---------------------------------------------------------------------------
// Goals — the "commitment" the user sets for themselves ("bitaw")
// ---------------------------------------------------------------------------

export type GoalKind = 'streak' | 'money' | 'checkins';

export interface Goal {
  id: string;
  kind: GoalKind;
  target: number;
  createdAt: number;
  achievedAt?: number;
}

export const GOAL_META: Record<GoalKind, { label: string; unit: string; icon: string }> = {
  streak:   { label: 'Days free',    unit: 'days',       icon: 'flame' },
  money:    { label: 'Money saved',  unit: '₱',          icon: 'wallet' },
  checkins: { label: 'Check-ins',    unit: 'check-ins',  icon: 'checkmark-done' },
};

/** Suggested starter goals the user can tap to add. */
export const GOAL_PRESETS: { kind: GoalKind; target: number }[] = [
  { kind: 'streak', target: 7 },
  { kind: 'streak', target: 30 },
  { kind: 'streak', target: 90 },
  { kind: 'money', target: 5000 },
  { kind: 'money', target: 20000 },
  { kind: 'checkins', target: 30 },
];

export function goalValue(kind: GoalKind, stats: RecoveryStats): number {
  if (kind === 'streak') return stats.currentStreak;
  if (kind === 'money') return stats.moneyTotal;
  return stats.checkIns;
}

export function goalProgress(goal: Goal, stats: RecoveryStats): { value: number; pct: number; done: boolean } {
  const value = goalValue(goal.kind, stats);
  const pct = goal.target > 0 ? Math.max(0, Math.min(1, value / goal.target)) : 0;
  return { value, pct, done: value >= goal.target };
}

export function goalTitle(goal: Goal): string {
  const m = GOAL_META[goal.kind];
  if (goal.kind === 'money') return `Save ₱${goal.target.toLocaleString('en-PH')}`;
  if (goal.kind === 'streak') return `Reach ${goal.target} days free`;
  return `Log ${goal.target} check-ins`;
}
