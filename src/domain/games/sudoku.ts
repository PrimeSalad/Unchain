/**
 * Sudoku - generator, solver & validation. Pure TS, offline.
 * Grid is a flat array of 81 numbers (0 = empty), index = row*9 + col.
 */

export type Grid = number[];
export type SudokuLevel = 'easy' | 'medium' | 'hard' | 'expert';

/** Return the committed hint count, or null when another hint is not allowed. */
export function nextSudokuHintCount(current: number, limit: number): number | null {
  if (!Number.isInteger(current) || !Number.isInteger(limit) || current < 0 || limit < 1) return null;
  return current >= limit ? null : current + 1;
}

/**
 * Prevalidated, uniquely solvable seeds. Runtime generation used to perform
 * recursive uniqueness checks on the input path (especially slow for Expert).
 * Symmetry and digit transforms below create many equivalent puzzles in
 * bounded O(81) time while preserving both validity and uniqueness.
 */
const PUZZLE_BANK: Record<SudokuLevel, { puzzle: string; solution: string }> = {
  easy: {
    puzzle: '530078000670195008098002060800760003420803091700024006060500280200419035000280079',
    solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  },
  medium: {
    puzzle: '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
    solution: '435269781682571493197834562826195347374682915951743628519326874248957136763418259',
  },
  hard: {
    puzzle: '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
    solution: '462831957795426183381795426173984265659312748248567319926178534834259671517643892',
  },
  expert: {
    puzzle: '005300000800000020070010500400005300010070006003200080060500009004000030000009700',
    solution: '145327698839654127672918543496185372218473956753296481367542819984761235521839764',
  },
};

const rowOf = (i: number) => Math.floor(i / 9);
const colOf = (i: number) => i % 9;
const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Can `val` go at `i` in `grid` without breaking row/col/box? */
export function isValidPlacement(grid: Grid, i: number, val: number): boolean {
  const r = rowOf(i), c = colOf(i), b = boxOf(i);
  for (let k = 0; k < 81; k++) {
    if (k === i || grid[k] !== val) continue;
    if (rowOf(k) === r || colOf(k) === c || boxOf(k) === b) return false;
  }
  return true;
}

function fillSolution(grid: Grid): boolean {
  const i = grid.indexOf(0);
  if (i === -1) return true;
  for (const val of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (isValidPlacement(grid, i, val)) {
      grid[i] = val;
      if (fillSolution(grid)) return true;
      grid[i] = 0;
    }
  }
  return false;
}

/** Count solutions up to `limit` (used to guarantee a unique puzzle). */
function countSolutions(grid: Grid, limit = 2): number {
  const i = grid.indexOf(0);
  if (i === -1) return 1;
  let count = 0;
  for (let val = 1; val <= 9; val++) {
    if (isValidPlacement(grid, i, val)) {
      grid[i] = val;
      count += countSolutions(grid, limit);
      grid[i] = 0;
      if (count >= limit) break;
    }
  }
  return count;
}

/** Number of solutions, capped at `limit`, without mutating the input. */
export function solutionCount(grid: Grid, limit = 2): number {
  return countSolutions(grid.slice(), limit);
}

/** Solve a grid (returns a completed copy, or null if unsolvable). */
export function solve(grid: Grid): Grid | null {
  const g = grid.slice();
  return fillSolution(g) ? g : null;
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
}

const parseGrid = (encoded: string): Grid => Array.from(encoded, Number);

function transformGrid(grid: Grid, orientation: number, digitShift: number): Grid {
  const out = new Array<number>(81).fill(0);
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      let r = row;
      let c = orientation >= 4 ? 8 - col : col;
      for (let turn = 0; turn < orientation % 4; turn++) [r, c] = [c, 8 - r];
      const value = grid[row * 9 + col];
      out[r * 9 + c] = value === 0 ? 0 : ((value - 1 + digitShift) % 9) + 1;
    }
  }
  return out;
}

export function generate(level: SudokuLevel): Puzzle {
  const seed = PUZZLE_BANK[level];
  const variant = Math.floor(Math.random() * 72);
  const orientation = variant % 8;
  const digitShift = Math.floor(variant / 8);
  return {
    puzzle: transformGrid(parseGrid(seed.puzzle), orientation, digitShift),
    solution: transformGrid(parseGrid(seed.solution), orientation, digitShift),
  };
}

/** Indices that conflict with another filled cell of the same value. */
export function conflicts(grid: Grid): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) {
    if (grid[i] === 0) continue;
    for (let k = i + 1; k < 81; k++) {
      if (grid[k] === 0 || grid[k] !== grid[i]) continue;
      if (rowOf(k) === rowOf(i) || colOf(k) === colOf(i) || boxOf(k) === boxOf(i)) {
        bad.add(i);
        bad.add(k);
      }
    }
  }
  return bad;
}

export const isComplete = (grid: Grid): boolean => grid.every((v) => v !== 0);
