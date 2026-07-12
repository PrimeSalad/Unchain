/**
 * Block puzzle (Block-Blast style) logic - pure TS, offline.
 * 8×8 board. Three pieces are offered; place them anywhere they fit. Any full
 * row AND column clears. Game over when none of the remaining pieces fit.
 */

export const SIZE = 8;
export type Cell = number; // 0 = empty, else a colour index (1..6)
export type Grid = Cell[]; // length SIZE*SIZE

export interface Shape {
  cells: [number, number][]; // [row, col] offsets, normalised to origin
  w: number;
  h: number;
  size: number;
}

const shape = (cells: [number, number][]): Shape => {
  const h = Math.max(...cells.map((c) => c[0])) + 1;
  const w = Math.max(...cells.map((c) => c[1])) + 1;
  return { cells, w, h, size: cells.length };
};

// Grouped by rough difficulty so we can bias toward bigger pieces over time.
const SMALL: Shape[] = [
  shape([[0, 0]]),
  shape([[0, 0], [0, 1]]),
  shape([[0, 0], [1, 0]]),
  shape([[0, 0], [1, 0], [1, 1]]),
  shape([[0, 1], [1, 0], [1, 1]]),
  shape([[0, 0], [0, 1], [1, 0]]),
  shape([[0, 0], [0, 1], [1, 1]]),
];
const MEDIUM: Shape[] = [
  shape([[0, 0], [0, 1], [0, 2]]),
  shape([[0, 0], [1, 0], [2, 0]]),
  shape([[0, 0], [0, 1], [1, 0], [1, 1]]), // 2x2
  shape([[0, 0], [0, 1], [0, 2], [1, 1]]), // T
  shape([[0, 1], [0, 2], [1, 0], [1, 1]]), // S
  shape([[0, 0], [0, 1], [1, 1], [1, 2]]), // Z
  shape([[0, 0], [1, 0], [2, 0], [2, 1]]), // J
  shape([[0, 1], [1, 1], [2, 0], [2, 1]]), // L
];
const LARGE: Shape[] = [
  shape([[0, 0], [0, 1], [0, 2], [0, 3]]),
  shape([[0, 0], [1, 0], [2, 0], [3, 0]]),
  shape([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]),
  shape([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]),
  shape([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]), // 2x3
  shape([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]), // 3x2
  shape([[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]), // plus
  shape([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]), // big L
  shape([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]), // 3x3
];

export const COLOR_COUNT = 6;

export function emptyGrid(): Grid {
  return new Array(SIZE * SIZE).fill(0);
}

export const at = (grid: Grid, r: number, c: number): Cell => grid[r * SIZE + c];

export function canPlace(grid: Grid, s: Shape, row: number, col: number): boolean {
  for (const [dr, dc] of s.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (grid[r * SIZE + c] !== 0) return false;
  }
  return true;
}

export function place(grid: Grid, s: Shape, row: number, col: number, color: number): Grid {
  const g = grid.slice();
  for (const [dr, dc] of s.cells) g[(row + dr) * SIZE + (col + dc)] = color;
  return g;
}

/** Clear any full rows and columns simultaneously. Returns the new grid and how many lines cleared. */
export function clearLines(grid: Grid): { grid: Grid; lines: number } {
  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let r = 0; r < SIZE; r++) {
    let full = true;
    for (let c = 0; c < SIZE; c++) if (grid[r * SIZE + c] === 0) { full = false; break; }
    if (full) fullRows.push(r);
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) if (grid[r * SIZE + c] === 0) { full = false; break; }
    if (full) fullCols.push(c);
  }
  if (fullRows.length === 0 && fullCols.length === 0) return { grid, lines: 0 };
  const g = grid.slice();
  for (const r of fullRows) for (let c = 0; c < SIZE; c++) g[r * SIZE + c] = 0;
  for (const c of fullCols) for (let r = 0; r < SIZE; r++) g[r * SIZE + c] = 0;
  return { grid: g, lines: fullRows.length + fullCols.length };
}

/** Can shape `s` be placed anywhere on the grid? */
export function canPlaceAnywhere(grid: Grid, s: Shape): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (canPlace(grid, s, r, c)) return true;
  return false;
}

/** Any of the remaining (un-placed) pieces still fit? */
export function hasAnyMove(grid: Grid, pieces: (Piece | null)[]): boolean {
  return pieces.some((p) => p && canPlaceAnywhere(grid, p.shape));
}

export interface Piece {
  id: string;
  shape: Shape;
  color: number;
}

let pieceSeq = 0;
const randOf = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Draw a piece; bias toward larger shapes as the score grows (difficulty ramp). */
export function newPiece(score = 0): Piece {
  const roll = Math.random();
  // Difficulty ramps with score: more large pieces later.
  const largeChance = Math.min(0.5, 0.18 + score / 6000);
  const mediumChance = 0.42;
  let pool: Shape[];
  if (roll < largeChance) pool = LARGE;
  else if (roll < largeChance + mediumChance) pool = MEDIUM;
  else pool = SMALL;
  return {
    id: `p${pieceSeq++}-${Math.random().toString(36).slice(2, 7)}`,
    shape: randOf(pool),
    color: 1 + Math.floor(Math.random() * COLOR_COUNT),
  };
}

export function newTray(score = 0): Piece[] {
  return [newPiece(score), newPiece(score), newPiece(score)];
}

/** Points: 1 per placed cell, plus a rising bonus per cleared line scaled by combo. */
export function scorePlacement(placedCells: number, lines: number, combo: number): number {
  let pts = placedCells;
  if (lines > 0) {
    // Line clears escalate; simultaneous multi-line and combos pay more.
    pts += lines * 10 * lines * Math.max(1, combo);
  }
  return pts;
}
