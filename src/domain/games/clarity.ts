/**
 * Clarity - a five-letter word puzzle (offline). Six guesses, colour feedback,
 * built-in dictionary, on-screen keyboard state, daily + practice modes.
 */

import { ANSWERS as RAW_ANSWERS, EXTRA as RAW_EXTRA } from './clarity-words';
import { challengeDayFromLocalDate } from './calendar';

export type TileState = 'correct' | 'present' | 'absent' | 'empty';
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

const norm = (w: string) => w.trim().toLowerCase();
const clean = (list: string[]) => list.map(norm).filter((w) => /^[a-z]{5}$/.test(w));

/** De-duplicated answer pool. */
export const ANSWERS: string[] = Array.from(new Set(clean(RAW_ANSWERS)));

/** Every word accepted as a guess (answers ∪ extras). */
const VALID = new Set<string>([...ANSWERS, ...clean(RAW_EXTRA)]);

export function isValidWord(word: string): boolean {
  return VALID.has(norm(word));
}

/**
 * Score a guess against the answer using the canonical Wordle two-pass rule so
 * duplicate letters are handled correctly.
 */
export function evaluate(guess: string, answer: string): TileState[] {
  const g = norm(guess);
  const a = norm(answer);
  const result: TileState[] = new Array(WORD_LENGTH).fill('absent');
  const counts: Record<string, number> = {};

  for (const ch of a) counts[ch] = (counts[ch] ?? 0) + 1;

  // Pass 1 - greens.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct';
      counts[g[i]]--;
    }
  }
  // Pass 2 - yellows from the remaining pool.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const ch = g[i];
    if (counts[ch] > 0) {
      result[i] = 'present';
      counts[ch]--;
    }
  }
  return result;
}

/** Merge a completed guess into the keyboard letter-state map (correct wins). */
export function mergeKeyStates(
  prev: Record<string, TileState>,
  guess: string,
  states: TileState[],
): Record<string, TileState> {
  const rank: Record<TileState, number> = { empty: 0, absent: 1, present: 2, correct: 3 };
  const next = { ...prev };
  const g = norm(guess);
  for (let i = 0; i < WORD_LENGTH; i++) {
    const ch = g[i];
    const s = states[i];
    if (!next[ch] || rank[s] > rank[next[ch]]) next[ch] = s;
  }
  return next;
}

export function dailyNumber(now = Date.now()): number {
  return challengeDayFromLocalDate(now);
}

/** Consecutive daily wins only: a skipped day starts a new streak. */
export function nextDailyStreak(
  current: number,
  lastWonDay: number | null | undefined,
  day: number,
  won: boolean,
): { streak: number; lastWonDay: number | null } {
  if (!won) return { streak: 0, lastWonDay: lastWonDay ?? null };
  return {
    streak: lastWonDay === day - 1 ? current + 1 : 1,
    lastWonDay: day,
  };
}

/** Deterministic daily answer + its puzzle number. */
export function dailyAnswer(now = Date.now()): { word: string; day: number } {
  const day = dailyNumber(now);
  const idx = ((day % ANSWERS.length) + ANSWERS.length) % ANSWERS.length;
  return { word: ANSWERS[idx], day };
}

/** Random answer; pass the previous word to guarantee it never repeats. */
export function randomAnswer(except?: string): string {
  const banned = except ? norm(except) : null;
  const pool = banned ? ANSWERS.filter((w) => w !== banned) : ANSWERS;
  return pool[Math.floor(Math.random() * pool.length)];
}
