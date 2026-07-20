import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';

const calendar = await import('../.test-build/domain/games/calendar.js');
const clarity = await import('../.test-build/domain/games/clarity.js');
const checkers = await import('../.test-build/domain/games/checkers.js');
const sudoku = await import('../.test-build/domain/games/sudoku.js');
const inhibition = await import('../.test-build/domain/games/inhibition.js');
const blocks = await import('../.test-build/domain/games/blocks.js');

test('calendar ordinals advance exactly once across DST transition dates', () => {
  const spring = [
    calendar.calendarOrdinalFromParts(2026, 2, 7),
    calendar.calendarOrdinalFromParts(2026, 2, 8),
    calendar.calendarOrdinalFromParts(2026, 2, 9),
  ];
  const fall = [
    calendar.calendarOrdinalFromParts(2026, 9, 31),
    calendar.calendarOrdinalFromParts(2026, 10, 1),
    calendar.calendarOrdinalFromParts(2026, 10, 2),
  ];
  assert.deepEqual(spring.map((day, index) => index === 0 ? 0 : day - spring[index - 1]), [0, 1, 1]);
  assert.deepEqual(fall.map((day, index) => index === 0 ? 0 : day - fall[index - 1]), [0, 1, 1]);
});

test('Clarity duplicate letters use a two-pass score and skipped days reset streak', () => {
  assert.deepEqual(
    clarity.evaluate('allee', 'apple'),
    ['correct', 'present', 'absent', 'absent', 'correct'],
  );
  assert.deepEqual(clarity.nextDailyStreak(3, 20, 21, true), { streak: 4, lastWonDay: 21 });
  assert.deepEqual(clarity.nextDailyStreak(4, 21, 23, true), { streak: 1, lastWonDay: 23 });
  assert.deepEqual(clarity.nextDailyStreak(4, 21, 22, false), { streak: 0, lastWonDay: 21 });
});

test('Clarity daily identity advances when a mounted session crosses local midnight', () => {
  const before = clarity.dailyAnswer(new Date(2026, 6, 20, 23, 59, 59, 900).getTime());
  const after = clarity.dailyAnswer(new Date(2026, 6, 21, 0, 0, 0, 100).getTime());
  assert.equal(after.day, before.day + 1);
});

test('Checkers enforces mandatory capture across every piece', () => {
  const board = new Array(64).fill(null);
  board[checkers.toIdx(5, 0)] = { player: 'r', king: false };
  board[checkers.toIdx(4, 1)] = { player: 'b', king: false };
  board[checkers.toIdx(5, 4)] = { player: 'r', king: false };

  const moves = checkers.legalMoves(board, 'r');
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].captures, [checkers.toIdx(4, 1)]);
  assert.equal(checkers.movesFrom(board, checkers.toIdx(5, 4)).length, 0);
});

test('Checkers returns the full multi-jump path and crowns on the final row', () => {
  const chain = new Array(64).fill(null);
  chain[checkers.toIdx(5, 0)] = { player: 'r', king: false };
  chain[checkers.toIdx(4, 1)] = { player: 'b', king: false };
  chain[checkers.toIdx(2, 3)] = { player: 'b', king: false };
  const move = checkers.legalMoves(chain, 'r')[0];
  assert.deepEqual(move.path, [checkers.toIdx(3, 2), checkers.toIdx(1, 4)]);
  assert.deepEqual(move.captures, [checkers.toIdx(4, 1), checkers.toIdx(2, 3)]);

  const crown = new Array(64).fill(null);
  crown[checkers.toIdx(2, 1)] = { player: 'r', king: false };
  crown[checkers.toIdx(1, 2)] = { player: 'b', king: false };
  const crowned = checkers.applyMove(crown, checkers.legalMoves(crown, 'r')[0]);
  assert.deepEqual(crowned[checkers.toIdx(0, 3)], { player: 'r', king: true });
});

test('Checkers Hard AI stays time-budgeted and always returns a legal move', () => {
  const board = checkers.initialBoard();
  const legal = checkers.legalMoves(board, 'b');
  const started = performance.now();
  const move = checkers.chooseMove(board, 'b', 'hard');
  const elapsed = performance.now() - started;
  assert.ok(move);
  assert.ok(legal.some((candidate) =>
    candidate.from === move.from
      && candidate.to === move.to
      && candidate.captures.join(',') === move.captures.join(','),
  ));
  assert.ok(elapsed < 150, `Hard AI budget overran badly: ${elapsed.toFixed(2)} ms`);
});

test('Checkers async Hard AI yields between root chunks and remains cancellable', async () => {
  const board = checkers.initialBoard();
  const legal = checkers.legalMoves(board, 'b');
  let yields = 0;
  const move = await checkers.chooseMoveAsync(board, 'b', 'hard', {
    maxTimeMs: 60,
    sliceMs: 5,
    yieldControl: async () => { yields += 1; },
  });
  assert.ok(yields > 0, 'Hard AI must yield control before searching another root');
  assert.ok(move);
  assert.ok(legal.some((candidate) =>
    candidate.from === move.from
      && candidate.to === move.to
      && candidate.captures.join(',') === move.captures.join(','),
  ));

  let cancelled = false;
  let cancellationYields = 0;
  const cancelledMove = await checkers.chooseMoveAsync(board, 'b', 'hard', {
    maxTimeMs: 100,
    isCancelled: () => cancelled,
    yieldControl: async () => {
      cancellationYields += 1;
      cancelled = true;
    },
  });
  assert.ok(cancellationYields > 0);
  assert.equal(cancelledMove, null);
});

test('Checkers declares threefold repetition and resets its no-progress clock', () => {
  const board = new Array(64).fill(null);
  board[checkers.toIdx(2, 1)] = { player: 'r', king: true };
  board[checkers.toIdx(5, 6)] = { player: 'b', king: true };

  let tracker = checkers.createCheckersDrawTracker(board, 'r');
  let update = checkers.advanceCheckersDrawTracker(tracker, board, 'r', false);
  assert.equal(update.reason, null);
  tracker = update.tracker;
  update = checkers.advanceCheckersDrawTracker(tracker, board, 'r', false);
  assert.equal(update.reason, 'threefold_repetition');

  const almostStalled = {
    positionCounts: {},
    noProgressPly: checkers.CHECKERS_NO_PROGRESS_PLY_LIMIT - 1,
  };
  const stalled = checkers.advanceCheckersDrawTracker(almostStalled, board, 'b', false);
  assert.equal(stalled.reason, 'no_progress');
  const reset = checkers.advanceCheckersDrawTracker(almostStalled, board, 'b', true);
  assert.equal(reset.tracker.noProgressPly, 0);
  assert.equal(reset.reason, null);
});

test('Checkers draw clock treats captures and promotions as progress', () => {
  const captureBoard = new Array(64).fill(null);
  captureBoard[checkers.toIdx(5, 0)] = { player: 'r', king: false };
  captureBoard[checkers.toIdx(4, 1)] = { player: 'b', king: false };
  const capture = checkers.legalMoves(captureBoard, 'r')[0];
  assert.equal(
    checkers.moveResetsCheckersDrawClock(captureBoard, capture, checkers.applyMove(captureBoard, capture)),
    true,
  );

  const promotionBoard = new Array(64).fill(null);
  promotionBoard[checkers.toIdx(1, 2)] = { player: 'r', king: false };
  promotionBoard[checkers.toIdx(7, 0)] = { player: 'b', king: true };
  const promotion = checkers.legalMoves(promotionBoard, 'r')
    .find((move) => move.to === checkers.toIdx(0, 1));
  assert.ok(promotion);
  assert.equal(
    checkers.moveResetsCheckersDrawClock(
      promotionBoard,
      promotion,
      checkers.applyMove(promotionBoard, promotion),
    ),
    true,
  );
});

test('every bounded Sudoku bank level remains valid and uniquely solvable', () => {
  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    for (let sample = 0; sample < 6; sample++) {
      const { puzzle, solution } = sudoku.generate(level);
      assert.equal(puzzle.length, 81);
      assert.equal(solution.length, 81);
      assert.equal(sudoku.conflicts(solution).size, 0);
      assert.equal(sudoku.solutionCount(puzzle), 1, `${level} puzzle must be unique`);
      puzzle.forEach((value, index) => {
        if (value !== 0) assert.equal(value, solution[index]);
      });
    }
  }
});

test('Sudoku puzzle selection is bounded off the input path', () => {
  const durations = [];
  for (let i = 0; i < 100; i++) {
    const started = performance.now();
    sudoku.generate('expert');
    durations.push(performance.now() - started);
  }
  durations.sort((a, b) => a - b);
  assert.ok(durations[94] < 100, `Expert selection p95 was ${durations[94].toFixed(2)} ms`);
});

test('Sudoku commits the incremented hint count before final-cell completion', () => {
  assert.equal(sudoku.nextSudokuHintCount(0, 3), 1);
  assert.equal(sudoku.nextSudokuHintCount(2, 3), 3);
  assert.equal(sudoku.nextSudokuHintCount(3, 3), null);
});

test('Go / No-Go shares the DST-safe challenge calendar', () => {
  const epoch = calendar.calendarOrdinalFromParts(2024, 0, 1);
  const today = calendar.localCalendarOrdinal();
  assert.equal(inhibition.challengeDayNumber(), today - epoch);
});

test('Go / No-Go resumes a cancelled final-life timer as a terminal result', () => {
  assert.equal(inhibition.pausedRoundResumeAction(0, true), 'finish');
  assert.equal(inhibition.pausedRoundResumeAction(0, false), 'finish');
  assert.equal(inhibition.pausedRoundResumeAction(2, false), 'countdown');
});

test('Blocks placement, simultaneous line clear, scoring, and no-move are deterministic', () => {
  const one = { cells: [[0, 0]], w: 1, h: 1, size: 1 };
  const grid = blocks.emptyGrid();
  assert.equal(blocks.canPlace(grid, one, 7, 7), true);
  assert.equal(blocks.canPlace(grid, one, 8, 7), false);
  const placed = blocks.place(grid, one, 7, 7, 2);
  assert.equal(placed[63], 2);

  const cross = blocks.emptyGrid();
  for (let i = 0; i < blocks.SIZE; i++) {
    cross[i] = 1;
    cross[i * blocks.SIZE] = 1;
  }
  const cleared = blocks.clearLines(cross);
  assert.equal(cleared.lines, 2);
  assert.equal(cleared.grid.every((cell) => cell === 0), true);
  assert.equal(blocks.scorePlacement(4, 2, 3), 124);

  const full = new Array(blocks.SIZE * blocks.SIZE).fill(1);
  assert.equal(blocks.hasAnyMove(full, [{ id: 'one', shape: one, color: 1 }]), false);
});

test('Blocks rejects callbacks queued by a cancelled drag generation', () => {
  const startedGeneration = 12;
  const cancelledGeneration = blocks.nextInteractionGeneration(startedGeneration);
  assert.equal(cancelledGeneration, 13);
  assert.equal(blocks.acceptsInteractionCallback(startedGeneration, cancelledGeneration, false), false);
  assert.equal(blocks.acceptsInteractionCallback(cancelledGeneration, cancelledGeneration, true), false);
  assert.equal(blocks.acceptsInteractionCallback(cancelledGeneration, cancelledGeneration, false), true);
});
