/**
 * Daily Missions — gamified recovery habits that reset every local calendar day.
 *
 * Design principles:
 *  - "Make a Daily Log Entry" is always first (journaling is the core feature).
 *  - Missions are encouraging, not punishing — never shame-based.
 *  - Completion state resets automatically at local midnight (same pattern as
 *    Healthy Alternatives: store a timestamp and use sameDay() to derive
 *    done-today without a scheduler).
 *  - Each completion awards XP toward the user's level and contributes to
 *    streak / badge progression.
 *  - The pool is fixed to keep every day predictable and routine-forming.
 */

export type MissionId =
  | 'daily_log'       // always first — journal entry
  | 'mindful_pause'   // mindful-pause screen
  | 'play_game'       // any recreational game session
  | 'breathing'       // breathing exercise
  | 'review_progress'; // view the Progress/Journey tab

export interface Mission {
  id: MissionId;
  /** Short display label. */
  title: string;
  /** Supportive one-liner shown below the title. */
  subtitle: string;
  /** Ionicons glyph name. */
  icon: string;
  /** XP awarded on completion. */
  xp: number;
  /** Semantic tint for the icon chip and completed state. */
  tint: 'primary' | 'success' | 'accent' | 'celebrate';
}

/**
 * The canonical ordered mission list. "Make a Daily Log Entry" is index 0
 * and must always remain so.
 */
export const MISSIONS: Mission[] = [
  {
    id: 'daily_log',
    title: 'Make a Daily Log Entry',
    subtitle: 'Write in your journal — reflection builds resilience',
    icon: 'book',
    xp: 20,
    tint: 'primary',
  },
  {
    id: 'mindful_pause',
    title: 'Take a Mindful Pause',
    subtitle: 'A few minutes of intentional calm',
    icon: 'flower',
    xp: 15,
    tint: 'success',
  },
  {
    id: 'play_game',
    title: 'Play 1 Recreational Game',
    subtitle: 'Healthy entertainment, no stakes',
    icon: 'game-controller',
    xp: 10,
    tint: 'celebrate',
  },
  {
    id: 'breathing',
    title: 'Complete a Breathing Exercise',
    subtitle: 'Slow your breath, steady your mind',
    icon: 'leaf',
    xp: 15,
    tint: 'success',
  },
  {
    id: 'review_progress',
    title: 'Review Your Progress',
    subtitle: 'See how far you have come',
    icon: 'stats-chart',
    xp: 10,
    tint: 'primary',
  },
];

export function missionById(id: MissionId): Mission {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

// ---------------------------------------------------------------------------
// Daily-reset logic
// ---------------------------------------------------------------------------

/**
 * Returns the local calendar day key: "YYYY-MM-DD" in the user's timezone.
 * This is the same key strategy used by quotes so the two are consistent.
 */
export function missionDayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/**
 * Completion state per day. The store persists this and checks on hydration
 * whether the stored day matches today — if not, it resets automatically.
 */
export interface DailyMissionState {
  /** Local "YYYY-MM-DD" key for the day this state belongs to. */
  day: string;
  /** Set of mission IDs completed on `day`. */
  completed: MissionId[];
}

/** True when all missions are complete for this state. */
export function allMissionsComplete(state: DailyMissionState): boolean {
  return MISSIONS.every((m) => state.completed.includes(m.id));
}

/** Count of completed missions. */
export function completedCount(state: DailyMissionState): number {
  return state.completed.length;
}

/** XP total earned from completed missions in this state. */
export function earnedXp(state: DailyMissionState): number {
  return state.completed.reduce((sum, id) => {
    const m = MISSIONS.find((mission) => mission.id === id);
    return sum + (m?.xp ?? 0);
  }, 0);
}

/** Total XP available per day. */
export const DAILY_XP_TOTAL = MISSIONS.reduce((s, m) => s + m.xp, 0);

// ---------------------------------------------------------------------------
// XP → Level system (simple threshold curve)
// ---------------------------------------------------------------------------

const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  500,   // Level 4
  850,   // Level 5
  1300,  // Level 6
  1900,  // Level 7
  2700,  // Level 8
  3700,  // Level 9
  5000,  // Level 10 (max displayed; XP continues)
] as const;

export function xpToLevel(totalXp: number): { level: number; current: number; next: number; progress: number } {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  const current = LEVEL_THRESHOLDS[Math.min(level - 1, LEVEL_THRESHOLDS.length - 1)];
  const nextIdx = Math.min(level, LEVEL_THRESHOLDS.length - 1);
  const next = LEVEL_THRESHOLDS[nextIdx];
  const progress = next > current ? (totalXp - current) / (next - current) : 1;
  return { level, current, next, progress: Math.min(1, progress) };
}
