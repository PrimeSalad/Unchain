/**
 * Sudoku - generator, solver & validation. Pure TS, offline.
 * Grid is a flat array of 81 numbers (0 = empty), index = row*9 + col.
 */

export type Grid = number[];
export type SudokuLevel = 'easy' | 'medium' | 'hard' | 'expert';

const GIVENS: Record<SudokuLevel, number> = {
  easy: 42,
  medium: 34,
  hard: 30,
  expert: 26,
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

/** Solve a grid (returns a completed copy, or null if unsolvable). */
export function solve(grid: Grid): Grid | null {
  const g = grid.slice();
  return fillSolution(g) ? g : null;
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
}

export function generate(level: SudokuLevel): Puzzle {
  const solution = new Array(81).fill(0);
  fillSolution(solution);

  const puzzle = solution.slice();
  const target = GIVENS[level];
  let givens = 81;

  // Dig holes symmetrically-ish while keeping a unique solution.
  for (const i of shuffle([...Array(81).keys()])) {
    if (givens <= target) break;
    if (puzzle[i] === 0) continue;
    const backup = puzzle[i];
    puzzle[i] = 0;
    // Uniqueness check on a copy so we don't mutate `puzzle`'s zeros away.
    if (countSolutions(puzzle.slice(), 2) !== 1) {
      puzzle[i] = backup; // removing broke uniqueness - keep it
    } else {
      givens--;
    }
  }

  return { puzzle, solution };
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
