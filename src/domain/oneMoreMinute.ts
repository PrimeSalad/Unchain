/**
 * One More Minute - Pomodoro-inspired recovery timer.
 *
 * A universal recovery tool for all addiction types. Helps users redirect
 * attention away from urges by committing to focused recovery time.
 */

// ── Session data ──────────────────────────────────────────────────────────

export interface OneMoreMinuteSession {
  id: string;
  /** Timestamp when the session started. */
  startedAt: number;
  /** Timestamp when the session ended (null if in progress). */
  endedAt: number | null;
  /** Planned duration in seconds. */
  plannedSeconds: number;
  /** Actual duration in seconds (0 if cancelled). */
  actualSeconds: number;
  /** Whether the session was completed fully. */
  completed: boolean;
}

// ── Preset durations (minutes) ────────────────────────────────────────────

export const PRESET_DURATIONS = [10, 15, 25, 45, 60] as const;
export type PresetDuration = (typeof PRESET_DURATIONS)[number];

// ── Motivational messages ─────────────────────────────────────────────────

export const MOTIVATIONAL_MESSAGES = [
  'Just one more minute.',
  'This urge will pass.',
  "You're stronger than this moment.",
  'Recovery happens one choice at a time.',
  'Stay with yourself.',
  "Keep going—you've already come this far.",
  'Small victories become lasting habits.',
  'Your future self will thank you.',
  'Choose recovery for one more minute.',
  'Every minute counts.',
  'You are not your urge.',
  'Breathe. This moment will pass.',
  'You deserve this peace.',
  'One minute at a time.',
  'Your recovery matters.',
  'You are doing something brave.',
  'This feeling is temporary.',
  'You have survived every bad day so far.',
  'Progress, not perfection.',
  'You are worth the wait.',
] as const;

export function randomMotivationalMessage(): string {
  return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
}

// ── Statistics ────────────────────────────────────────────────────────────

export interface OneMoreMinuteStats {
  totalSessions: number;
  completedSessions: number;
  totalSeconds: number;
  longestSession: number;
  averageSession: number;
  currentStreak: number;
  todaySessions: number;
}

const MS_PER_DAY = 86_400_000;

function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function computeStats(sessions: OneMoreMinuteSession[]): OneMoreMinuteStats {
  const completed = sessions.filter((s) => s.completed);
  const today = dayStart(Date.now());

  const totalSessions = sessions.length;
  const completedSessions = completed.length;
  const totalSeconds = completed.reduce((sum, s) => sum + s.actualSeconds, 0);
  const longestSession = completed.length > 0 ? Math.max(...completed.map((s) => s.actualSeconds)) : 0;
  const averageSession = completedSessions > 0 ? Math.round(totalSeconds / completedSessions) : 0;

  // Today's sessions
  const todaySessions = completed.filter((s) => s.endedAt != null && s.endedAt >= today).length;

  // Weekly streak: count consecutive weeks (ending this week) where at least 1 session was completed
  let currentStreak = 0;
  let weekEnd = dayStart(Date.now());
  let weekStart = weekEnd - 6 * MS_PER_DAY;
  for (let i = 0; i < 52; i++) {
    const hadSession = completed.some((s) => s.endedAt != null && s.endedAt >= weekStart && s.endedAt < weekEnd + MS_PER_DAY);
    if (!hadSession) break;
    currentStreak++;
    weekEnd = weekStart;
    weekStart -= 7 * MS_PER_DAY;
  }

  return { totalSessions, completedSessions, totalSeconds, longestSession, averageSession, currentStreak, todaySessions };
}

// ── Achievement types ─────────────────────────────────────────────────────

export interface OneMoreMinuteAchievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  progress?: (stats: OneMoreMinuteStats) => { current: number; target: number };
  test: (stats: OneMoreMinuteStats) => boolean;
}

const countOf = (field: keyof OneMoreMinuteStats, target: number) => ({
  progress: (s: OneMoreMinuteStats) => ({ current: Math.min(s[field] as number, target), target }),
  test: (s: OneMoreMinuteStats) => (s[field] as number) >= target,
});

export const OMM_ACHIEVEMENTS: OneMoreMinuteAchievement[] = [
  {
    id: 'omm-first', title: 'First Minute', icon: 'stopwatch',
    desc: 'Complete your first One More Minute session.',
    progress: (s) => ({ current: Math.min(s.completedSessions, 1), target: 1 }),
    test: (s) => s.completedSessions >= 1,
  },
  {
    id: 'omm-hour', title: 'One Hour of Recovery', icon: 'hourglass',
    desc: 'Accumulate 1 hour of focused recovery time.',
    progress: (s) => ({ current: Math.min(s.totalSeconds, 3600), target: 3600 }),
    test: (s) => s.totalSeconds >= 3600,
  },
  {
    id: 'omm-10', title: 'Ten Sessions', icon: 'trophy',
    desc: 'Complete 10 One More Minute sessions.',
    ...countOf('completedSessions', 10),
  },
  {
    id: 'omm-50', title: 'Fifty Sessions', icon: 'ribbon',
    desc: 'Complete 50 One More Minute sessions.',
    ...countOf('completedSessions', 50),
  },
  {
    id: 'omm-100', title: 'Century Focused', icon: 'star',
    desc: 'Complete 100 One More Minute sessions.',
    ...countOf('completedSessions', 100),
  },
  {
    id: 'omm-streak', title: 'Seven-Day Focus Streak', icon: 'flame',
    desc: 'Complete at least one session every week for 7 weeks.',
    ...countOf('currentStreak', 7),
  },
];

export function evaluateOmmAchievements(stats: OneMoreMinuteStats): string[] {
  return OMM_ACHIEVEMENTS.filter((a) => a.test(stats)).map((a) => a.id);
}

export function ommAchievementById(id: string): OneMoreMinuteAchievement | undefined {
  return OMM_ACHIEVEMENTS.find((a) => a.id === id);
}
