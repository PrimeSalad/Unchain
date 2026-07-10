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
  | 'message'
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
  { id: 'walk',    title: 'Take a 10-Minute Walk',          subtitle: 'Move your body, quiet the urge',      icon: 'walk',                 tint: 'success' },
  { id: 'breathe', title: 'Practice Deep Breathing',        subtitle: 'Slow, guided breathing session',      icon: 'leaf',                 tint: 'primary' },
  { id: 'stretch', title: 'Stretch Your Body',              subtitle: 'A short guided release',              icon: 'body',                 tint: 'celebrate' },
  { id: 'water',   title: 'Drink a Glass of Water',         subtitle: 'Small anchor, real reset',            icon: 'water',                tint: 'primary' },
  { id: 'journal', title: "Write Down What You're Feeling", subtitle: "Today's journal entry",               icon: 'create',               tint: 'primary' },
  { id: 'message', title: 'Message Someone You Trust',      subtitle: 'Reach out — connection helps',        icon: 'chatbubble-ellipses',  tint: 'accent' },
  { id: 'music',   title: 'Listen to Calming Music',        subtitle: 'A few minutes of built-in calm',      icon: 'musical-notes',        tint: 'celebrate' },
];

export function alternativeById(id: AlternativeId): Alternative {
  return ALTERNATIVES.find((a) => a.id === id) ?? ALTERNATIVES[0];
}

/** Guided stretch sequence — each step runs on its own timer. */
export interface StretchStep {
  title: string;
  instruction: string;
  seconds: number;
  /** Ionicons name for the simple illustration chip. */
  icon: string;
}

export const STRETCH_STEPS: StretchStep[] = [
  { title: 'Neck Release',   instruction: 'Slowly tilt your ear toward each shoulder. Let gravity do the work — no forcing.', seconds: 40, icon: 'person' },
  { title: 'Shoulder Rolls', instruction: 'Roll your shoulders back in big, slow circles. Drop them away from your ears.',    seconds: 40, icon: 'sync' },
  { title: 'Forward Fold',   instruction: 'Stand and fold forward with soft knees. Hang loose and breathe into your back.',   seconds: 40, icon: 'arrow-down' },
  { title: 'Side Stretch',   instruction: 'Reach one arm overhead and lean gently to the side. Switch halfway through.',      seconds: 40, icon: 'resize' },
];

/** Walk session length (seconds). */
export const WALK_SECONDS = 10 * 60;

/** Breathing session options (minutes). */
export const BREATHE_MINUTES = [1, 2, 5] as const;

/** Listening time that counts as a meaningful calming-music session (seconds). */
export const MUSIC_GOAL_SECONDS = 120;
