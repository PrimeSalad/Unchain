/**
 * Healthy Alternatives — interactive recovery actions (pure definitions).
 * Each activity completes at most once per calendar day; completion state
 * lives in the store as `alternatives[id] = timestamp` and "done today" is
 * always derived with sameDay(), so it resets automatically at local midnight.
 */

export type AlternativeId =
  | 'walk'
  | 'breathe'
  | 'stretch'
  | 'water'
  | 'journal'
  | 'music';

export interface Alternative {
  id: AlternativeId;
  title: string;
  subtitle: string;
  /** Ionicons name. */
  icon: string;
  /** Semantic tint used for the icon chip + completed state. */
  tint: 'primary' | 'success' | 'accent' | 'celebrate';
}

export const ALTERNATIVES: Alternative[] = [
  { id: 'walk',    title: 'Take a Walk',                    subtitle: 'Live steps & distance, on your terms', icon: 'walk',                tint: 'success' },
  { id: 'breathe', title: 'Practice Deep Breathing',        subtitle: 'Slow, guided breathing session',      icon: 'leaf',                 tint: 'primary' },
  { id: 'stretch', title: 'Stretch Your Body',              subtitle: 'A short guided release',              icon: 'body',                 tint: 'celebrate' },
  { id: 'water',   title: 'Drink a Glass of Water',         subtitle: 'Small anchor, real reset',            icon: 'water',                tint: 'primary' },
  { id: 'journal', title: "Write Down What You're Feeling", subtitle: "Today's journal entry",               icon: 'create',               tint: 'primary' },
  { id: 'music',   title: 'Listen to Calming Music',        subtitle: 'A few minutes of built-in calm',      icon: 'musical-notes',        tint: 'celebrate' },
];

export function alternativeById(id: AlternativeId): Alternative {
  return ALTERNATIVES.find((a) => a.id === id) ?? ALTERNATIVES[0];
}

/** Guided stretch — the user picks how many stretches and how long each runs. */
export interface StretchStep {
  title: string;
  instruction: string;
  /** Ionicons name for the simple illustration chip. */
  icon: string;
}

/** The full stretch library — sessions draw a shuffled subset from here. */
export const STRETCH_STEPS: StretchStep[] = [
  { title: 'Neck Release',   instruction: 'Slowly tilt your ear toward each shoulder. Let gravity do the work — no forcing.', icon: 'person' },
  { title: 'Shoulder Rolls', instruction: 'Roll your shoulders back in big, slow circles. Drop them away from your ears.',    icon: 'sync' },
  { title: 'Forward Fold',   instruction: 'Stand and fold forward with soft knees. Hang loose and breathe into your back.',   icon: 'arrow-down' },
  { title: 'Side Stretch',   instruction: 'Reach one arm overhead and lean gently to the side. Switch halfway through.',      icon: 'resize' },
  { title: 'Hamstring Reach', instruction: 'Reach gently toward your toes with soft knees. Ease in — no bouncing.',           icon: 'trending-down' },
  { title: 'Chest Opener',   instruction: 'Clasp your hands behind your back and lift gently. Open across the chest.',        icon: 'expand' },
  { title: 'Hip Circles',    instruction: 'Hands on hips, draw slow circles. Switch direction halfway through.',              icon: 'refresh' },
  { title: 'Calf Stretch',   instruction: 'Step one foot back and press the heel down. Switch legs halfway through.',         icon: 'walk' },
  { title: 'Seated Twist',   instruction: 'Sit tall and twist gently to one side, then the other. Move with your breath.',    icon: 'sync-circle' },
  { title: 'Wrists & Hands', instruction: 'Circle your wrists, spread your fingers wide, then shake everything loose.',       icon: 'hand-left' },
];

/** How many stretches a session can include. */
export const STRETCH_COUNT_OPTIONS = [3, 5, 8, 10] as const;

/** Seconds the user can choose per stretch. */
export const STRETCH_SECONDS_OPTIONS = [20, 30, 40, 60] as const;

/** Daily hydration goal (glasses). */
export const WATER_GOAL_GLASSES = 8;

// ---------------------------------------------------------------------------
// Healthy-habit achievements — permanent unlocks, mirrored on the game
// achievement system (id → unlockedAt in the store, shareable cards).
// ---------------------------------------------------------------------------

/** Lifetime completion counts per activity. `journal` is derived from the
 *  journal itself at evaluation time; the rest are counted by the store. */
export type AltCounts = Partial<Record<AlternativeId, number>>;

export interface AltAchievement {
  id: string;
  title: string;
  desc: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Live progress for locked achievements (counter-based ones only). */
  progress?: (c: AltCounts) => { current: number; target: number };
  /** `fullDay` = every activity completed on the same calendar day. */
  test: (c: AltCounts, fullDay: boolean) => boolean;
}

const total = (c: AltCounts) =>
  ALTERNATIVES.reduce((sum, a) => sum + (c[a.id] ?? 0), 0);

const countOf = (id: AlternativeId, target: number) => ({
  progress: (c: AltCounts) => ({ current: Math.min(c[id] ?? 0, target), target }),
  test: (c: AltCounts) => (c[id] ?? 0) >= target,
});

export const ALT_ACHIEVEMENTS: AltAchievement[] = [
  {
    id: 'alt-first', title: 'First Step', icon: 'footsteps',
    desc: 'Complete your first healthy alternative.',
    progress: (c) => ({ current: Math.min(total(c), 1), target: 1 }),
    test: (c) => total(c) >= 1,
  },
  { id: 'alt-walk-10',    title: 'Ten Walks',       icon: 'walk',           desc: 'Complete 10 recovery walks.',            ...countOf('walk', 10) },
  { id: 'alt-water-10',   title: 'Hydration Habit', icon: 'water',          desc: 'Log a glass of water on 10 days.',       ...countOf('water', 10) },
  { id: 'alt-breathe-10', title: 'Calm Mind',       icon: 'leaf',           desc: 'Finish 10 deep-breathing sessions.',     ...countOf('breathe', 10) },
  { id: 'alt-stretch-10', title: 'Loose & Limber',  icon: 'body',           desc: 'Finish 10 guided stretch sessions.',     ...countOf('stretch', 10) },
  { id: 'alt-music-10',   title: 'Sound of Calm',   icon: 'musical-notes',  desc: 'Complete 10 calming-music sessions.',    ...countOf('music', 10) },
  { id: 'alt-journal-10', title: 'Honest Pages',    icon: 'create',         desc: 'Write 10 journal entries.',              ...countOf('journal', 10) },
  {
    id: 'alt-total-25', title: 'Habit Builder', icon: 'construct',
    desc: 'Complete 25 healthy alternatives in total.',
    progress: (c) => ({ current: Math.min(total(c), 25), target: 25 }),
    test: (c) => total(c) >= 25,
  },
  {
    id: 'alt-total-100', title: 'Lifestyle Change', icon: 'infinite',
    desc: 'Complete 100 healthy alternatives in total.',
    progress: (c) => ({ current: Math.min(total(c), 100), target: 100 }),
    test: (c) => total(c) >= 100,
  },
  {
    id: 'alt-full-day', title: 'Full Reset', icon: 'sparkles',
    desc: 'Complete every healthy alternative in a single day.',
    test: (_c, fullDay) => fullDay,
  },
];

export function altAchievementById(id: string): AltAchievement | undefined {
  return ALT_ACHIEVEMENTS.find((a) => a.id === id);
}

/** Ids whose criteria are currently met. Callers filter out already-unlocked. */
export function evaluateAltAchievements(counts: AltCounts, fullDay: boolean): string[] {
  return ALT_ACHIEVEMENTS.filter((a) => a.test(counts, fullDay)).map((a) => a.id);
}

/** Quick-pick breathing lengths (minutes); the stepper allows 1–30 freely. */
export const BREATHE_MINUTES = [1, 2, 3, 5, 10] as const;
export const BREATHE_MIN_MINUTES = 1;
export const BREATHE_MAX_MINUTES = 30;

/** Listening time that counts as a meaningful calming-music session (seconds). */
export const MUSIC_GOAL_SECONDS = 120;
