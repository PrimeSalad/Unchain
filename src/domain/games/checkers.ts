/**
 * Checkers (American / English draughts) engine + AI - pure TS, offline.
 *
 * Board is 64 cells, index = row*8 + col, row 0 at the TOP.
 * Human = red ('r'), starts at the bottom, moves UP (row decreasing).
 * AI    = black ('b'), starts at the top, moves DOWN (row increasing).
 * Only dark squares ((row+col) % 2 === 1) are used.
 *
 * Rules implemented: mandatory captures, multi-jumps, king promotion (a man that
 * reaches the crown-head is promoted and its move ends), win/loss detection.
 */

export type Player = 'r' | 'b';
export interface Piece { player: Player; king: boolean }
export type Board = (Piece | null)[];

export interface Move {
  from: number;
  to: number;
  /** Indices of pieces captured along the way (empty for a simple move). */
  captures: number[];
  /** Landing squares after each hop (for animating multi-jumps). */
  path: number[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export const rc = (idx: number) => [Math.floor(idx / 8), idx % 8] as const;
export const toIdx = (r: number, c: number) => r * 8 + c;
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function initialBoard(): Board {
  const b: Board = new Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    const [r, c] = rc(i);
    if ((r + c) % 2 !== 1) continue; // light square
    if (r < 3) b[i] = { player: 'b', king: false };
    else if (r > 4) b[i] = { player: 'r', king: false };
  }
  return b;
}

const opponent = (p: Player): Player => (p === 'r' ? 'b' : 'r');

/** Forward directions for a man; kings use all four. */
function directions(piece: Piece): [number, number][] {
  const fwd = piece.player === 'r' ? -1 : 1; // red moves up
  if (piece.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return [[fwd, -1], [fwd, 1]];
}

/** Crown-head row for a player (where a man becomes a king). */
const crownRow = (p: Player) => (p === 'r' ? 0 : 7);

// ---------------------------------------------------------------------------
// Move generation
// ---------------------------------------------------------------------------

function jumpSequences(board: Board, idx: number): Move[] {
  const start = board[idx];
  if (!start) return [];
  const results: Move[] = [];

  const dfs = (curBoard: Board, curIdx: number, piece: Piece, captures: number[], path: number[]) => {
    const [r, c] = rc(curIdx);
    let extended = false;
    for (const [dr, dc] of directions(piece)) {
      const or = r + dr, oc = c + dc; // over
      const lr = r + 2 * dr, lc = c + 2 * dc; // landing
      if (!inBounds(lr, lc)) continue;
      const overIdx = toIdx(or, oc);
      const landIdx = toIdx(lr, lc);
      const over = curBoard[overIdx];
      if (!over || over.player !== opponent(piece.player)) continue;
      if (curBoard[landIdx]) continue;
      if (captures.includes(overIdx)) continue; // don't re-capture

      extended = true;
      // Apply this hop on a copy.
      const nb = curBoard.slice();
      nb[curIdx] = null;
      nb[overIdx] = null;
      // Promotion mid-jump ends the move.
      const promoted = !piece.king && lr === crownRow(piece.player);
      const moved: Piece = { player: piece.player, king: piece.king || promoted };
      nb[landIdx] = moved;
      const nextCaps = [...captures, overIdx];
      const nextPath = [...path, landIdx];
      if (promoted) {
        results.push({ from: idx, to: landIdx, captures: nextCaps, path: nextPath });
      } else {
        dfs(nb, landIdx, moved, nextCaps, nextPath);
      }
    }
    if (!extended && captures.length > 0) {
      results.push({ from: idx, to: curIdx, captures, path });
    }
  };

  dfs(board, idx, start, [], []);
  return results;
}

function simpleMoves(board: Board, idx: number): Move[] {
  const piece = board[idx];
  if (!piece) return [];
  const [r, c] = rc(idx);
  const moves: Move[] = [];
  for (const [dr, dc] of directions(piece)) {
    const nr = r + dr, nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    const to = toIdx(nr, nc);
    if (board[to]) continue;
    moves.push({ from: idx, to, captures: [], path: [to] });
  }
  return moves;
}

/** All legal moves for a player. American/English draughts requires a capture
 * whenever any piece belonging to that player can jump. */
export function legalMoves(board: Board, player: Player): Move[] {
  const jumps: Move[] = [];
  const plain: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.player !== player) continue;
    jumps.push(...jumpSequences(board, i));
    plain.push(...simpleMoves(board, i));
  }
  return jumps.length > 0 ? jumps : plain;
}

/** Legal moves originating from a given square (respecting the forced-capture rule). */
export function movesFrom(board: Board, idx: number): Move[] {
  const all = legalMoves(board, board[idx]?.player ?? 'r');
  return all.filter((m) => m.from === idx);
}

export function applyMove(board: Board, move: Move): Board {
  const nb = board.slice();
  const piece = nb[move.from];
  if (!piece) return nb;
  nb[move.from] = null;
  for (const cap of move.captures) nb[cap] = null;
  const [lr] = rc(move.to);
  const king = piece.king || lr === crownRow(piece.player);
  nb[move.to] = { player: piece.player, king };
  return nb;
}

export interface GameStatus {
  over: boolean;
  winner: Player | null;
}

export function status(board: Board, toMove: Player): GameStatus {
  const rCount = board.filter((p) => p?.player === 'r').length;
  const bCount = board.filter((p) => p?.player === 'b').length;
  if (rCount === 0) return { over: true, winner: 'b' };
  if (bCount === 0) return { over: true, winner: 'r' };
  if (legalMoves(board, toMove).length === 0) return { over: true, winner: opponent(toMove) };
  return { over: false, winner: null };
}

// ---------------------------------------------------------------------------
// Draw tracking
// ---------------------------------------------------------------------------

export type CheckersDrawReason = 'threefold_repetition' | 'no_progress';

export interface CheckersDrawTracker {
  /** Position includes the side to move, so visually identical boards with a
   * different turn are not treated as the same position. */
  positionCounts: Readonly<Record<string, number>>;
  /** Half-moves since the last capture or promotion. */
  noProgressPly: number;
}

export interface CheckersDrawUpdate {
  tracker: CheckersDrawTracker;
  reason: CheckersDrawReason | null;
}

export const CHECKERS_REPETITION_LIMIT = 3;
/** Forty moves by each side without a capture or promotion. */
export const CHECKERS_NO_PROGRESS_PLY_LIMIT = 80;

/** Stable, serialization-safe position identity for repetition detection. */
export function checkersPositionKey(board: Board, toMove: Player): string {
  const cells = board.map((piece) => {
    if (!piece) return '.';
    if (piece.player === 'r') return piece.king ? 'R' : 'r';
    return piece.king ? 'B' : 'b';
  }).join('');
  return `${toMove}:${cells}`;
}

export function createCheckersDrawTracker(
  board: Board,
  toMove: Player,
): CheckersDrawTracker {
  return {
    positionCounts: { [checkersPositionKey(board, toMove)]: 1 },
    noProgressPly: 0,
  };
}

/** Captures and promotions are the two irreversible events that reset the
 * no-progress clock. */
export function moveResetsCheckersDrawClock(
  before: Board,
  move: Move,
  after: Board,
): boolean {
  const movingPiece = before[move.from];
  const landedPiece = after[move.to];
  const promoted = Boolean(movingPiece && !movingPiece.king && landedPiece?.king);
  return move.captures.length > 0 || promoted;
}

/** Advance draw history after a legal move has landed. This is immutable so
 * callers can safely retain an earlier tracker while an animation is pending. */
export function advanceCheckersDrawTracker(
  previous: CheckersDrawTracker,
  nextBoard: Board,
  nextToMove: Player,
  progressMade: boolean,
): CheckersDrawUpdate {
  const key = checkersPositionKey(nextBoard, nextToMove);
  const nextCount = (previous.positionCounts[key] ?? 0) + 1;
  const noProgressPly = progressMade ? 0 : previous.noProgressPly + 1;
  const tracker: CheckersDrawTracker = {
    positionCounts: { ...previous.positionCounts, [key]: nextCount },
    noProgressPly,
  };
  return {
    tracker,
    reason: nextCount >= CHECKERS_REPETITION_LIMIT
      ? 'threefold_repetition'
      : noProgressPly >= CHECKERS_NO_PROGRESS_PLY_LIMIT
        ? 'no_progress'
        : null,
  };
}

// ---------------------------------------------------------------------------
// AI - minimax with alpha-beta pruning
// ---------------------------------------------------------------------------

const SEARCH_DEADLINE = Symbol('checkers-search-deadline');
const SEARCH_CANCELLED = Symbol('checkers-search-cancelled');
type CancellationCheck = () => boolean;

function evaluate(board: Board, me: Player): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const [r] = rc(i);
    const val = p.king ? 18 : 10;
    // Advancement bonus for men (encourage pushing forward).
    const adv = p.king ? 0 : p.player === 'r' ? (7 - r) : r;
    const back = (p.player === 'r' && r === 7) || (p.player === 'b' && r === 0) ? 2 : 0; // guard back row
    const sub = val + adv * 0.4 + back;
    score += p.player === me ? sub : -sub;
  }
  return score;
}

function minimax(
  board: Board,
  player: Player,
  me: Player,
  depth: number,
  alpha: number,
  beta: number,
  deadline = Infinity,
  isCancelled?: CancellationCheck,
): number {
  if (isCancelled?.()) throw SEARCH_CANCELLED;
  if (Date.now() >= deadline) throw SEARCH_DEADLINE;
  const st = status(board, player);
  if (st.over) return st.winner === me ? 100000 - (6 - depth) : -100000 + (6 - depth);
  if (depth === 0) return evaluate(board, me);

  const moves = legalMoves(board, player);
  if (player === me) {
    let best = -Infinity;
    for (const m of moves) {
      const v = minimax(
        applyMove(board, m), opponent(player), me, depth - 1, alpha, beta, deadline, isCancelled,
      );
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const v = minimax(
        applyMove(board, m), opponent(player), me, depth - 1, alpha, beta, deadline, isCancelled,
      );
      best = Math.min(best, v);
      beta = Math.min(beta, v);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function shuffledMoves(moves: Move[]): Move[] {
  return moves
    .map((move) => ({ move, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ move }) => move);
}

/** Choose the AI's move. Returns null if no move is available. */
export function chooseMove(board: Board, me: Player, difficulty: Difficulty): Move | null {
  const moves = legalMoves(board, me);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  if (difficulty === 'easy') {
    // Prefer captures, otherwise random - beatable but not silly.
    const caps = moves.filter((m) => m.captures.length > 0);
    const pool = Math.random() < 0.65 && caps.length ? caps : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Light shuffle so equal-value games vary.
  const shuffled = shuffledMoves(moves);

  if (difficulty === 'hard') {
    // Synchronous compatibility path. Screens should use chooseMoveAsync so
    // Hard search can yield and be cancelled; direct callers still receive a
    // legal bounded fallback without occupying a frame for tens of ms.
    const deadline = Date.now() + 10;
    let completedBest = shuffled[0];
    for (let depth = 2; depth <= 4; depth++) {
      let depthBest = shuffled[0];
      let depthBestValue = -Infinity;
      try {
        for (const move of shuffled) {
          const value = minimax(
            applyMove(board, move), opponent(me), me, depth - 1, -Infinity, Infinity, deadline,
          );
          if (value > depthBestValue) {
            depthBestValue = value;
            depthBest = move;
          }
        }
        completedBest = depthBest;
      } catch (error) {
        if (error !== SEARCH_DEADLINE) throw error;
        break;
      }
    }
    return completedBest;
  }

  let best = shuffled[0];
  let bestVal = -Infinity;
  for (const move of shuffled) {
    const value = minimax(applyMove(board, move), opponent(me), me, 3, -Infinity, Infinity);
    if (value > bestVal) {
      bestVal = value;
      best = move;
    }
  }
  return best;
}

export interface AsyncCheckersSearchOptions {
  /** Checked at every minimax node and after every host yield. */
  isCancelled?: CancellationCheck;
  /** Total search budget. A fully legal fallback is retained if it expires. */
  maxTimeMs?: number;
  /** Maximum uninterrupted root-search slice before returning to the host. */
  sliceMs?: number;
  /** Injectable for deterministic tests; defaults to a zero-delay host task. */
  yieldControl?: () => Promise<void>;
}

const yieldToHost = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Cancellable AI search for interactive screens.
 *
 * Work is split at root moves. Each root receives a short deadline, then the
 * function yields to React Native so AppState/navigation/dialog cancellation
 * can run before another chunk begins. A partially searched depth is never
 * used; the last fully completed depth (or a legal fallback) is returned.
 * `null` means either no legal move or a caller-requested cancellation, so UI
 * callers must check their cancellation token before treating it as game over.
 */
export async function chooseMoveAsync(
  board: Board,
  me: Player,
  difficulty: Difficulty,
  options: AsyncCheckersSearchOptions = {},
): Promise<Move | null> {
  const moves = legalMoves(board, me);
  if (moves.length === 0 || options.isCancelled?.()) return null;
  const yieldControl = options.yieldControl ?? yieldToHost;
  // Even a forced/easy move crosses one host boundary. This gives a queued
  // route-blur or AppState event a chance to cancel before the UI animates it.
  await yieldControl();
  if (options.isCancelled?.()) return null;
  if (moves.length === 1) return moves[0];
  if (difficulty === 'easy') return chooseMove(board, me, difficulty);

  const shuffled = shuffledMoves(moves);
  const maxTimeMs = Math.max(1, options.maxTimeMs ?? (difficulty === 'hard' ? 90 : 45));
  const sliceMs = Math.max(1, Math.min(12, options.sliceMs ?? 6));
  const deadline = Date.now() + maxTimeMs;
  const firstDepth = difficulty === 'hard' ? 2 : 3;
  const lastDepth = difficulty === 'hard' ? 6 : 3;
  let completedBest = shuffled[0];

  for (let depth = firstDepth; depth <= lastDepth; depth++) {
    if (options.isCancelled?.()) return null;
    if (Date.now() >= deadline) break;
    let depthBest = shuffled[0];
    let depthBestValue = -Infinity;
    let completedDepth = true;

    for (const move of shuffled) {
      if (options.isCancelled?.()) return null;
      const chunkDeadline = Math.min(deadline, Date.now() + sliceMs);
      try {
        const value = minimax(
          applyMove(board, move),
          opponent(me),
          me,
          depth - 1,
          -Infinity,
          Infinity,
          chunkDeadline,
          options.isCancelled,
        );
        if (value > depthBestValue) {
          depthBestValue = value;
          depthBest = move;
        }
      } catch (error) {
        if (error === SEARCH_CANCELLED) return null;
        if (error !== SEARCH_DEADLINE) throw error;
        completedDepth = false;
        break;
      }

      // This is the cancellation boundary that the old synchronous Hard AI
      // lacked. Even fast root evaluations yield before the next root.
      await yieldControl();
      if (options.isCancelled?.()) return null;
    }

    if (!completedDepth) break;
    completedBest = depthBest;
  }

  return options.isCancelled?.() ? null : completedBest;
}
