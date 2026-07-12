/**
 * Per-game achievements - each game has its own tailored set (beginner,
 * skill, speed, consistency, hidden, long-term). Pure domain: definitions +
 * unlock tests evaluated against the post-update stats and the triggering
 * event. Unlocks are stored (id → unlockedAt) and are permanent.
 */

export type GameId = 'checkers' | 'clarity' | 'sudoku' | 'blocks' | 'gonogo';

/** The slice of game stats the tests need (structurally satisfied by the store's GamesState). */
export interface GameStatsSnapshot {
  blocksBest: number;
  blocksGames: number;
  checkersWins: number;
  checkersLosses: number;
  sudokuSolved: number;
  clarityStreak: number;
  clarityBestStreak: number;
  clarityPlayed: number;
  clarityWon: number;
  clarityPracticePlayed: number;
  clarityPracticeWon: number;
  gonogoBest: number;
  gonogoGames: number;
}

export type GameEvent =
  | { game: 'checkers'; result: 'win' | 'loss'; difficulty: 'easy' | 'medium' | 'hard'; piecesLeft: number }
  | { game: 'sudoku'; level: 'easy' | 'medium' | 'hard' | 'expert'; ms: number; mistakes: number; hints: number }
  | { game: 'blocks'; score: number; maxCombo: number; maxLines: number }
  | { game: 'clarity'; won: boolean; guessCount: number; daily: boolean }
  | { game: 'gonogo'; score: number; accuracy: number; maxCombo: number; avgReactionMs: number; trials: number };

export interface GameAchievement {
  id: string;
  game: GameId;
  title: string;
  desc: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Hidden until unlocked. */
  secret?: boolean;
  /** Optional live progress for locked achievements (counters only). */
  progress?: (s: GameStatsSnapshot) => { current: number; target: number };
  test: (s: GameStatsSnapshot, ev: GameEvent) => boolean;
}

export const GAME_NAMES: Record<GameId, string> = {
  checkers: 'Checkers',
  clarity: 'Clarity',
  sudoku: 'Sudoku',
  blocks: 'Block Puzzle',
  gonogo: 'Go / No-Go',
};

const clarityTotalWins = (s: GameStatsSnapshot) => s.clarityWon + s.clarityPracticeWon;

export const GAME_ACHIEVEMENTS: GameAchievement[] = [
  // ── Checkers ─────────────────────────────────────────────────────────────
  {
    id: 'checkers-first-win', game: 'checkers', title: 'First Victory', icon: 'trophy',
    desc: 'Win your first game of Checkers.',
    progress: (s) => ({ current: Math.min(s.checkersWins, 1), target: 1 }),
    test: (s) => s.checkersWins >= 1,
  },
  {
    id: 'checkers-5-wins', game: 'checkers', title: 'Seasoned Player', icon: 'ribbon',
    desc: 'Win 5 games of Checkers.',
    progress: (s) => ({ current: Math.min(s.checkersWins, 5), target: 5 }),
    test: (s) => s.checkersWins >= 5,
  },
  {
    id: 'checkers-20-wins', game: 'checkers', title: 'Board Master', icon: 'school',
    desc: 'Win 20 games of Checkers.',
    progress: (s) => ({ current: Math.min(s.checkersWins, 20), target: 20 }),
    test: (s) => s.checkersWins >= 20,
  },
  {
    id: 'checkers-hard-win', game: 'checkers', title: 'Giant Slayer', icon: 'flash',
    desc: 'Beat the AI on Hard difficulty.',
    test: (s, ev) => ev.game === 'checkers' && ev.result === 'win' && ev.difficulty === 'hard',
  },
  {
    id: 'checkers-flawless', game: 'checkers', title: 'Untouchable', icon: 'shield-checkmark', secret: true,
    desc: 'Win without losing a single piece.',
    test: (s, ev) => ev.game === 'checkers' && ev.result === 'win' && ev.piecesLeft >= 12,
  },
  {
    id: 'checkers-10-games', game: 'checkers', title: 'Committed', icon: 'calendar',
    desc: 'Play 10 games of Checkers.',
    progress: (s) => ({ current: Math.min(s.checkersWins + s.checkersLosses, 10), target: 10 }),
    test: (s) => s.checkersWins + s.checkersLosses >= 10,
  },

  // ── Clarity ──────────────────────────────────────────────────────────────
  {
    id: 'clarity-first-win', game: 'clarity', title: 'First Light', icon: 'sunny',
    desc: 'Solve your first Clarity word.',
    progress: (s) => ({ current: Math.min(clarityTotalWins(s), 1), target: 1 }),
    test: (s) => clarityTotalWins(s) >= 1,
  },
  {
    id: 'clarity-streak-3', game: 'clarity', title: 'Three-Day Glow', icon: 'flame',
    desc: 'Win the daily puzzle 3 days in a row.',
    progress: (s) => ({ current: Math.min(s.clarityBestStreak, 3), target: 3 }),
    test: (s) => s.clarityBestStreak >= 3,
  },
  {
    id: 'clarity-streak-7', game: 'clarity', title: 'Weekly Clarity', icon: 'bonfire',
    desc: 'Win the daily puzzle 7 days in a row.',
    progress: (s) => ({ current: Math.min(s.clarityBestStreak, 7), target: 7 }),
    test: (s) => s.clarityBestStreak >= 7,
  },
  {
    id: 'clarity-two-guesses', game: 'clarity', title: 'Sharp Eye', icon: 'eye',
    desc: 'Solve a word in two guesses or fewer.',
    test: (s, ev) => ev.game === 'clarity' && ev.won && ev.guessCount <= 2,
  },
  {
    id: 'clarity-one-guess', game: 'clarity', title: 'Mind Reader', icon: 'sparkles', secret: true,
    desc: 'Solve a word on the very first guess.',
    test: (s, ev) => ev.game === 'clarity' && ev.won && ev.guessCount === 1,
  },
  {
    id: 'clarity-25-wins', game: 'clarity', title: 'Wordsmith', icon: 'library',
    desc: 'Solve 25 words across daily and practice.',
    progress: (s) => ({ current: Math.min(clarityTotalWins(s), 25), target: 25 }),
    test: (s) => clarityTotalWins(s) >= 25,
  },
  {
    id: 'clarity-10-dailies', game: 'clarity', title: 'Daily Devotee', icon: 'today',
    desc: 'Play 10 daily puzzles.',
    progress: (s) => ({ current: Math.min(s.clarityPlayed, 10), target: 10 }),
    test: (s) => s.clarityPlayed >= 10,
  },

  // ── Sudoku ───────────────────────────────────────────────────────────────
  {
    id: 'sudoku-first', game: 'sudoku', title: 'First Grid', icon: 'grid',
    desc: 'Complete your first Sudoku.',
    progress: (s) => ({ current: Math.min(s.sudokuSolved, 1), target: 1 }),
    test: (s) => s.sudokuSolved >= 1,
  },
  {
    id: 'sudoku-10', game: 'sudoku', title: 'Puzzle Regular', icon: 'apps',
    desc: 'Solve 10 Sudoku puzzles.',
    progress: (s) => ({ current: Math.min(s.sudokuSolved, 10), target: 10 }),
    test: (s) => s.sudokuSolved >= 10,
  },
  {
    id: 'sudoku-50', game: 'sudoku', title: 'Grid Sage', icon: 'planet',
    desc: 'Solve 50 Sudoku puzzles.',
    progress: (s) => ({ current: Math.min(s.sudokuSolved, 50), target: 50 }),
    test: (s) => s.sudokuSolved >= 50,
  },
  {
    id: 'sudoku-hard', game: 'sudoku', title: 'Hard Mode Hero', icon: 'barbell',
    desc: 'Complete a Hard puzzle.',
    test: (s, ev) => ev.game === 'sudoku' && ev.level === 'hard',
  },
  {
    id: 'sudoku-expert', game: 'sudoku', title: 'Expert Class', icon: 'diamond',
    desc: 'Complete an Expert puzzle.',
    test: (s, ev) => ev.game === 'sudoku' && ev.level === 'expert',
  },
  {
    id: 'sudoku-speed', game: 'sudoku', title: 'Five-Minute Flow', icon: 'timer',
    desc: 'Solve any puzzle in under 5 minutes.',
    test: (s, ev) => ev.game === 'sudoku' && ev.ms < 5 * 60 * 1000,
  },
  {
    id: 'sudoku-perfect', game: 'sudoku', title: 'Flawless Logic', icon: 'shield-checkmark', secret: true,
    desc: 'Solve a puzzle with no mistakes and no hints.',
    test: (s, ev) => ev.game === 'sudoku' && ev.mistakes === 0 && ev.hints === 0,
  },

  // ── Block Puzzle ─────────────────────────────────────────────────────────
  {
    id: 'blocks-500', game: 'blocks', title: 'Warming Up', icon: 'cube',
    desc: 'Score 500 points in one game.',
    progress: (s) => ({ current: Math.min(s.blocksBest, 500), target: 500 }),
    test: (s, ev) => ev.game === 'blocks' && ev.score >= 500,
  },
  {
    id: 'blocks-1500', game: 'blocks', title: 'Flow State', icon: 'water',
    desc: 'Score 1,500 points in one game.',
    progress: (s) => ({ current: Math.min(s.blocksBest, 1500), target: 1500 }),
    test: (s, ev) => ev.game === 'blocks' && ev.score >= 1500,
  },
  {
    id: 'blocks-3000', game: 'blocks', title: 'Zen Master', icon: 'flower',
    desc: 'Score 3,000 points in one game.',
    progress: (s) => ({ current: Math.min(s.blocksBest, 3000), target: 3000 }),
    test: (s, ev) => ev.game === 'blocks' && ev.score >= 3000,
  },
  {
    id: 'blocks-combo-3', game: 'blocks', title: 'Chain Reaction', icon: 'link',
    desc: 'Reach a ×3 combo.',
    test: (s, ev) => ev.game === 'blocks' && ev.maxCombo >= 3,
  },
  {
    id: 'blocks-triple-clear', game: 'blocks', title: 'Triple Clear', icon: 'layers', secret: true,
    desc: 'Clear 3 or more lines with a single piece.',
    test: (s, ev) => ev.game === 'blocks' && ev.maxLines >= 3,
  },
  {
    id: 'blocks-10-games', game: 'blocks', title: 'Ten Sessions', icon: 'refresh-circle',
    desc: 'Finish 10 games of Block Puzzle.',
    progress: (s) => ({ current: Math.min(s.blocksGames, 10), target: 10 }),
    test: (s) => s.blocksGames >= 10,
  },

  // ── Go / No-Go (inhibitory control training) ─────────────────────────────
  {
    id: 'gng-first', game: 'gonogo', title: 'First Reflex', icon: 'radio-button-on',
    desc: 'Finish your first Go / No-Go round.',
    progress: (s) => ({ current: Math.min(s.gonogoGames, 1), target: 1 }),
    test: (s) => s.gonogoGames >= 1,
  },
  {
    id: 'gng-750', game: 'gonogo', title: 'Steady Hand', icon: 'hand-left',
    desc: 'Score 750 points in one round.',
    progress: (s) => ({ current: Math.min(s.gonogoBest, 750), target: 750 }),
    test: (s, ev) => ev.game === 'gonogo' && ev.score >= 750,
  },
  {
    id: 'gng-2000', game: 'gonogo', title: 'Impulse Master', icon: 'shield-checkmark',
    desc: 'Score 2,000 points in one round.',
    progress: (s) => ({ current: Math.min(s.gonogoBest, 2000), target: 2000 }),
    test: (s, ev) => ev.game === 'gonogo' && ev.score >= 2000,
  },
  {
    id: 'gng-combo-15', game: 'gonogo', title: 'In the Zone', icon: 'flame',
    desc: 'Reach a ×15 combo.',
    test: (s, ev) => ev.game === 'gonogo' && ev.maxCombo >= 15,
  },
  {
    id: 'gng-sharpshooter', game: 'gonogo', title: 'Sharpshooter', icon: 'locate',
    desc: 'Finish a round of 30+ trials at 95% accuracy or better.',
    test: (s, ev) => ev.game === 'gonogo' && ev.trials >= 30 && ev.accuracy >= 0.95,
  },
  {
    id: 'gng-lightning', game: 'gonogo', title: 'Lightning Calm', icon: 'flash', secret: true,
    desc: 'Average under 350 ms reactions across a 30+ trial round.',
    test: (s, ev) => ev.game === 'gonogo' && ev.trials >= 30 && ev.avgReactionMs > 0 && ev.avgReactionMs < 350,
  },
  {
    id: 'gng-10-games', game: 'gonogo', title: 'Training Habit', icon: 'calendar',
    desc: 'Finish 10 Go / No-Go rounds.',
    progress: (s) => ({ current: Math.min(s.gonogoGames, 10), target: 10 }),
    test: (s) => s.gonogoGames >= 10,
  },
];

export function achievementById(id: string): GameAchievement | undefined {
  return GAME_ACHIEVEMENTS.find((a) => a.id === id);
}

/** Ids whose conditions hold after this event (caller filters already-unlocked). */
export function evaluateGameAchievements(s: GameStatsSnapshot, ev: GameEvent): string[] {
  return GAME_ACHIEVEMENTS.filter((a) => a.game === ev.game && a.test(s, ev)).map((a) => a.id);
}

/** A short "next up" hint for the game's closest locked counter achievement. */
export function nextAchievementHint(
  game: GameId,
  s: GameStatsSnapshot,
  unlocked: Record<string, number>,
): string | null {
  let best: { a: GameAchievement; remaining: number; current: number; target: number } | null = null;
  for (const a of GAME_ACHIEVEMENTS) {
    if (a.game !== game || a.secret || !a.progress || unlocked[a.id]) continue;
    const { current, target } = a.progress(s);
    const remaining = target - current;
    if (remaining <= 0) continue;
    if (!best || remaining < best.remaining) best = { a, remaining, current, target };
  }
  if (!best) return null;
  return `Next: ${best.a.title} - ${best.current}/${best.target}`;
}
