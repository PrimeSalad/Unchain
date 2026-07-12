/**
 * Inhibition-training game - pure domain for Go/No-Go.
 *
 * Go/No-Go is an evidence-based cognitive-control paradigm: respond to "go"
 * stimuli, withhold on "no-go" stimuli. It trains prepotent-response
 * inhibition and is widely used in addiction research. The arcade layer
 * (combos, lives, levels) wraps the paradigm so it feels like a game, not a
 * clinical task. All functions here are deterministic and unit-testable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared arcade tuning
// ─────────────────────────────────────────────────────────────────────────────

/** Lives per round - a miss or false tap costs one. */
export const LIVES = 3;

/** Trials per level; speed increases each level. */
export const TRIALS_PER_LEVEL = 8;

/** Base score for a correct response before multipliers. */
export const BASE_POINTS = 10;

/** Combo multiplier: every N consecutive correct answers raises it by 1×. */
export const COMBO_STEP = 5;
export const MAX_MULTIPLIER = 5;

export function comboMultiplier(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_STEP));
}

/**
 * Points for a correct GO response: faster reactions earn more, scaled by the
 * combo multiplier. `windowMs` is the full response window for the trial.
 */
export function goPoints(reactionMs: number, windowMs: number, combo: number): number {
  const speedFactor = Math.max(0, 1 - reactionMs / Math.max(1, windowMs)); // 0..1
  const speedBonus = Math.round(BASE_POINTS * speedFactor);
  return (BASE_POINTS + speedBonus) * comboMultiplier(combo);
}

/** Points for a correct WITHHOLD (no-go / caught stop): flat, combo-scaled. */
export function holdPoints(combo: number): number {
  return Math.round(BASE_POINTS * 1.5) * comboMultiplier(combo);
}

export function levelForTrial(trialIndex: number): number {
  return Math.floor(trialIndex / TRIALS_PER_LEVEL) + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Go / No-Go tuning
// ─────────────────────────────────────────────────────────────────────────────

/** Probability a trial is NO-GO (red). Classic paradigms keep go dominant so
 *  responding becomes prepotent - that's what makes withholding hard. */
export const NOGO_PROBABILITY = 0.3;

/** Response window (ms) for a given level - shrinks as levels climb. */
export function gonogoWindowMs(level: number): number {
  return Math.max(520, 1050 - (level - 1) * 70);
}

/** Gap between trials (ms) at a given level; the screen adds jitter. */
export function gonogoGapMs(level: number): number {
  return Math.max(350, 750 - (level - 1) * 45);
}

/** Random extra delay so stimulus onset is never predictable. */
export const GAP_JITTER_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// Round summary
// ─────────────────────────────────────────────────────────────────────────────

export interface RoundSummary {
  score: number;
  trials: number;
  correct: number;
  accuracy: number;       // 0..1
  maxCombo: number;
  avgReactionMs: number;  // 0 when no go-responses were made
  level: number;
}

export function summarize(
  score: number,
  trials: number,
  correct: number,
  maxCombo: number,
  reactionTimes: number[],
): RoundSummary {
  const avg =
    reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
  return {
    score,
    trials,
    correct,
    accuracy: trials > 0 ? correct / trials : 0,
    maxCombo,
    avgReactionMs: avg,
    level: levelForTrial(Math.max(0, trials - 1)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily challenge - a deterministic per-day target that scales gently with
// the player's personal best, so it is always beatable but never trivial.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const EPOCH = new Date(2024, 0, 1).getTime();

export function challengeDayNumber(now = Date.now()): number {
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.floor((midnight - EPOCH) / DAY_MS);
}

/** Today's target score. Fresh players get an entry-level goal; experienced
 *  players chase a slice above their best, varied a little day to day. */
export function dailyChallengeTarget(best: number, day = challengeDayNumber()): number {
  const wobble = 0.9 + ((day * 37) % 21) / 100; // 0.90 .. 1.10, deterministic
  if (best < 400) return Math.round((350 * wobble) / 10) * 10;
  return Math.round((best * 0.75 * wobble) / 10) * 10;
}
