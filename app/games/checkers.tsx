import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Animated, Easing, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons, Foundation } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { BackButton } from '@/presentation/components/BackButton';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { GameLoadingScreen, useGameLoading } from '@/presentation/components/games/GameLoadingScreen';
import { GameTutorial, TutorialInfoButton, useGameTutorial } from '@/presentation/components/games/GameTutorial';
import { useSquareBoardSize } from '@/presentation/components/games/useGameLayout';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { playSound } from '@/application/sound';
import { nextAchievementHint, type GameAchievement } from '@/domain/games/achievements';
import { useReducedMotion } from '@/presentation/hooks/useReducedMotion';
import {
  applyMove,
  advanceCheckersDrawTracker,
  chooseMoveAsync,
  createCheckersDrawTracker,
  initialBoard,
  legalMoves,
  moveResetsCheckersDrawClock,
  movesFrom,
  rc,
  status,
  type Board,
  type CheckersDrawReason,
  type Difficulty,
  type Move,
  type Piece,
  type Player,
} from '@/domain/games/checkers';

// A crash inside the game must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const HOP_MS = 190;

/** Plain data only - the Animated values live in stable refs. */
interface Flight {
  move: Move;
  nextBoard: Board;
  mover: Player;
  piece: Piece;
  /** The piece as it will look after landing (may be promoted to king). */
  landingPiece: Piece;
}

type BlockingConfirmation =
  | { kind: 'surrender' }
  | { kind: 'difficulty'; next: Difficulty };

export default function Checkers() {
  const theme = useTheme();
  const router = useRouter();
  const games = useStore((s) => s.games);
  const recordCheckers = useStore((s) => s.recordCheckers);
  const completeMission = useStore((s) => s.completeMission);
  const isFocused = useIsFocused();

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [roundDifficulty, setRoundDifficulty] = useState<Difficulty>('medium');
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [turn, setTurn] = useState<Player>('r');
  const [selected, setSelected] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [popIdx, setPopIdx] = useState<number | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [over, setOver] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [unlocked, setUnlocked] = useState<GameAchievement[]>([]);
  const [thinking, setThinking] = useState(false);
  const [drawReason, setDrawReason] = useState<CheckersDrawReason | null>(null);
  const [confirmation, setConfirmation] = useState<BlockingConfirmation | null>(null);
  const [exitConfirmationVisible, setExitConfirmationVisible] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState == null || AppState.currentState === 'active',
  );
  const [boardW, setBoardW] = useState(0);
  const recorded = useRef(false);
  const cell = boardW / 8;
  const tutorial = useGameTutorial('checkers');
  const reduceMotion = useReducedMotion();
  const layout = useSquareBoardSize({ reservedHeight: 352, horizontalPadding: spacing.lg * 2, max: 332 });

  // Stable animation plumbing - values are created once and reused for every
  // move, so no Animated node is ever torn down mid-animation.
  const flightPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const captureFade = useRef(new Animated.Value(1)).current;
  /** Bumped on new game / unmount; stale animation callbacks bail out. */
  const genRef = useRef(0);
  /** false while a flight is uncommitted - makes the commit idempotent. */
  const committedRef = useRef(true);
  const mountedRef = useRef(true);
  const aiGenerationRef = useRef(0);
  const drawTrackerRef = useRef(createCheckersDrawTracker(board, 'r'));

  const cancelAiSearch = () => {
    aiGenerationRef.current += 1;
    if (mountedRef.current) setThinking(false);
  };

  /** Cancel an animation without committing its prepared next board. The
   * unchanged turn will restart normally when the app/screen becomes active. */
  const cancelUncommittedFlight = () => {
    if (committedRef.current) return;
    genRef.current += 1;
    committedRef.current = true;
    try {
      flightPos.stopAnimation();
      captureFade.stopAnimation();
      captureFade.setValue(1);
    } catch { /* nothing to stop */ }
    if (mountedRef.current) setFlight(null);
  };

  const pauseGameWork = () => {
    cancelAiSearch();
    cancelUncommittedFlight();
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      aiGenerationRef.current += 1;
      genRef.current += 1;
      try {
        flightPos.stopAnimation();
        captureFade.stopAnimation();
      } catch { /* nothing to stop */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      if (!active) pauseGameWork();
      if (mountedRef.current) setAppActive(active);
    });
    return () => subscription.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isFocused) pauseGameWork();
  }, [isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMoves = useMemo(
    () => (selected != null ? movesFrom(board, selected) : []),
    [selected, board],
  );
  const destinations = useMemo(() => new Set(selectedMoves.map((m) => m.to)), [selectedMoves]);

  const movable = useMemo(() => {
    if (
      turn !== 'r'
      || over
      || flight
      || confirmation
      || exitConfirmationVisible
      || tutorial.visible
      || !isFocused
      || !appActive
    ) return new Set<number>();
    return new Set(legalMoves(board, 'r').map((m) => m.from));
  }, [
    appActive,
    board,
    confirmation,
    exitConfirmationVisible,
    flight,
    isFocused,
    over,
    turn,
    tutorial.visible,
  ]);

  const newGame = (nextDifficulty?: Difficulty) => {
    const selectedDifficulty = nextDifficulty ?? difficulty;
    cancelAiSearch();
    // Invalidate any in-flight animation so its callbacks can't touch the new game.
    genRef.current += 1;
    committedRef.current = true;
    try {
      flightPos.stopAnimation();
      captureFade.stopAnimation();
    } catch { /* nothing to stop */ }
    const freshBoard = initialBoard();
    drawTrackerRef.current = createCheckersDrawTracker(freshBoard, 'r');
    setBoard(freshBoard);
    setTurn('r');
    setSelected(null);
    setLastMove(null);
    setFlight(null);
    setPopIdx(null);
    setWinner(null);
    setDrawReason(null);
    setOver(false);
    setCelebrate(false);
    setUnlocked([]);
    setThinking(false);
    setConfirmation(null);
    setDifficulty(selectedDifficulty);
    setRoundDifficulty(selectedDifficulty);
    recorded.current = false;
    playSound('tap', 0.4);
  };

  const finish = (
    w: Player | null,
    finalBoard: Board,
    reason: CheckersDrawReason | null = null,
  ) => {
    cancelAiSearch();
    setOver(true);
    setWinner(w);
    setDrawReason(w == null ? reason : null);
    setConfirmation(null);
    if (!recorded.current) {
      recorded.current = true;
      const piecesLeft = finalBoard.filter((p) => p?.player === 'r').length;
      const newly = w == null
        ? []
        : recordCheckers(w === 'r' ? 'win' : 'loss', { difficulty: roundDifficulty, piecesLeft });
      setUnlocked(newly);
      completeMission('play_game');
      playSound(w == null ? 'clear' : w === 'r' ? 'win' : 'lose', 0.8);
      Haptics.notificationAsync(
        w == null
          ? Haptics.NotificationFeedbackType.Warning
          : w === 'r'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      const generation = genRef.current;
      setTimeout(() => {
        if (mountedRef.current && generation === genRef.current) setCelebrate(true);
      }, reduceMotion ? 0 : 650);
    }
  };

  /**
   * Commit a finished move. Idempotent (the animation callback AND a failsafe
   * timer both call it), generation-guarded (a new game or unmount voids it),
   * and wrapped so an error can never strand the game or the navigator.
   */
  const commitFlight = (gen: number, move: Move, nextBoard: Board, mover: Player, promoted: boolean) => {
    if (!mountedRef.current || gen !== genRef.current || committedRef.current) return;
    committedRef.current = true;
    try {
      setBoard(nextBoard);
      setLastMove(move);
      setFlight(null);
      playSound('place', 0.7);
      Haptics.selectionAsync().catch(() => {});
      if (promoted) {
        setPopIdx(move.to);
        playSound('clear', 0.5);
        const generation = genRef.current;
        setTimeout(() => {
          if (mountedRef.current && generation === genRef.current) setPopIdx(null);
        }, reduceMotion ? 0 : 700);
      }

      const opponentOf: Player = mover === 'r' ? 'b' : 'r';
      const st = status(nextBoard, opponentOf);
      if (st.over) return finish(st.winner, nextBoard);
      const drawUpdate = advanceCheckersDrawTracker(
        drawTrackerRef.current,
        nextBoard,
        opponentOf,
        moveResetsCheckersDrawClock(board, move, nextBoard),
      );
      drawTrackerRef.current = drawUpdate.tracker;
      if (drawUpdate.reason) return finish(null, nextBoard, drawUpdate.reason);
      setTurn(opponentOf);
    } catch {
      // Force a consistent state rather than leaving a half-applied move.
      setFlight(null);
      setBoard(nextBoard);
      setTurn(mover === 'r' ? 'b' : 'r');
    }
  };

  /** Animate a move (player or AI), then commit it and hand over the turn. */
  const doMove = (move: Move, mover: Player) => {
    const piece = board[move.from];
    if (!piece || !committedRef.current) return; // no piece, or a flight is already running
    const nextBoard = applyMove(board, move);
    const promoted = !piece.king && !!nextBoard[move.to]?.king;
    const landingPiece: Piece = promoted
      ? { player: piece.player, king: true }
      : piece;
    const gen = genRef.current;
    committedRef.current = false;
    setSelected(null);

    if (reduceMotion) {
      commitFlight(gen, move, nextBoard, mover, promoted);
      return;
    }

    try {
      if (cell <= 0) throw new Error('board not measured yet');
      const [fr, fc] = rc(move.from);
      flightPos.setValue({ x: fc * cell, y: fr * cell });
      captureFade.setValue(1);
      setFlight({ move, nextBoard, mover, piece, landingPiece });

      // Slide through every hop of the path; fade captured pieces along the way.
      const hops = move.path.map((idx) => {
        const [r, c] = rc(idx);
        return Animated.timing(flightPos, {
          toValue: { x: c * cell, y: r * cell },
          duration: HOP_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        });
      });
      if (move.captures.length > 0) {
        setTimeout(() => {
          if (mountedRef.current && gen === genRef.current) playSound('capture', 0.7);
        }, HOP_MS / 2);
        Animated.timing(captureFade, {
          toValue: 0,
          duration: HOP_MS * move.path.length,
          useNativeDriver: true,
        }).start();
      }

      Animated.sequence(hops).start(() => commitFlight(gen, move, nextBoard, mover, promoted));
      // Failsafe: even if the animation callback is dropped, the move lands.
      setTimeout(() => commitFlight(gen, move, nextBoard, mover, promoted), HOP_MS * move.path.length + 450);
    } catch {
      // Animation setup failed - play the move instantly instead of crashing.
      commitFlight(gen, move, nextBoard, mover, promoted);
    }
  };

  /** Concede the game - recorded as a real loss, behind a confirmation.
   *  Guarded against a mid-flight animation so the board can't half-commit. */
  const surrender = () => {
    if (over || flight || confirmation || exitConfirmationVisible) return;
    cancelAiSearch();
    Haptics.selectionAsync().catch(() => {});
    setConfirmation({ kind: 'surrender' });
  };

  // AI turn - brief natural "thinking" beat, then cancellable root chunks.
  useEffect(() => {
    if (
      turn !== 'b'
      || over
      || flight
      || tutorial.visible
      || confirmation
      || exitConfirmationVisible
      || !isFocused
      || !appActive
    ) return;

    let disposed = false;
    const run = ++aiGenerationRef.current;
    const isCancelled = () => (
      disposed
      || !mountedRef.current
      || run !== aiGenerationRef.current
    );
    setThinking(true);
    const timer = setTimeout(() => {
      void (async () => {
        let move: Move | null;
        try {
          move = await chooseMoveAsync(board, 'b', roundDifficulty, { isCancelled });
        } catch {
          // A search failure must not strand the board. Use the first legal
          // move, but only if this run still owns the turn.
          move = legalMoves(board, 'b')[0] ?? null;
        }
        if (isCancelled()) return;
        setThinking(false);
        if (!move) return finish('r', board);
        doMove(move, 'b');
      })();
    }, 550);
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (aiGenerationRef.current === run) aiGenerationRef.current += 1;
      if (mountedRef.current) setThinking(false);
    };
  }, [
    appActive,
    board,
    confirmation,
    exitConfirmationVisible,
    flight,
    isFocused,
    over,
    roundDifficulty,
    turn,
    tutorial.visible,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCell = (idx: number) => {
    if (
      over
      || turn !== 'r'
      || thinking
      || flight
      || tutorial.visible
      || confirmation
      || exitConfirmationVisible
      || !isFocused
      || !appActive
    ) return;
    const piece = board[idx];
    if (selected != null && destinations.has(idx)) {
      const move = selectedMoves
        .filter((m) => m.to === idx)
        .sort((a, b) => b.captures.length - a.captures.length)[0];
      if (move) doMove(move, 'r');
      return;
    }
    if (piece && piece.player === 'r' && movable.has(idx)) {
      playSound('tap', 0.35);
      Haptics.selectionAsync().catch(() => {});
      setSelected(idx === selected ? null : idx);
    } else {
      if (selected != null) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setSelected(null);
    }
  };

  const selectDifficulty = (next: Difficulty) => {
    if (next === difficulty) return;
    const started = lastMove != null || turn !== 'r' || thinking || flight != null;
    if (!started || over) {
      setDifficulty(next);
      setRoundDifficulty(next);
      return;
    }
    if (flight || confirmation || exitConfirmationVisible) return;
    cancelAiSearch();
    setConfirmation({ kind: 'difficulty', next });
  };

  const played = games.checkersWins + games.checkersLosses;
  const winRate = played ? Math.round((games.checkersWins / played) * 100) : 0;
  const loading = useGameLoading();
  const lightSquare = theme.mode === 'dark' ? '#201828' : '#F3EAF8';
  const darkSquare = theme.mode === 'dark' ? '#3A2B47' : '#B995D0';
  const controlsBlocked = Boolean(
    flight
    || confirmation
    || exitConfirmationVisible
    || !isFocused
    || !appActive,
  );

  if (loading) {
    return <GameLoadingScreen title="Checkers" subtitle="Setting up the board" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg, overflow: 'hidden' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: layout.compact ? 2 : spacing.sm }}>
          <BackButton
            fallback="/games"
            confirmExit
            onConfirmVisibilityChange={(visible) => {
              if (visible) pauseGameWork();
              setExitConfirmationVisible(visible);
            }}
          />
          <Text variant="headline" style={{ flex: 1 }}>Checkers</Text>
          <TutorialInfoButton
            onPress={() => {
              pauseGameWork();
              tutorial.open();
            }}
          />
        </View>

        {/* Difficulty */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: layout.compact ? spacing.xs : spacing.md }}>
          {DIFFS.map((d) => {
            const on = difficulty === d;
            return (
              <Pressable
                key={d}
                onPress={() => selectDifficulty(d)}
                disabled={controlsBlocked}
                accessibilityRole="button"
                accessibilityLabel={`${d} difficulty`}
                accessibilityState={{ selected: on, disabled: controlsBlocked }}
                style={({ pressed }) => ({
                  flex: 1, minHeight: 44, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
                  opacity: controlsBlocked ? 0.5 : 1,
                  transform: [{ scale: pressed && !controlsBlocked ? 0.97 : 1 }],
                })}
              >
                <Text variant="footnote" color={on ? theme.color.onPrimary : theme.color.text} style={{ textTransform: 'capitalize' }}>{d}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Stats bar — Wins | Win Rate | Losses */}
        <View style={{
          flexDirection: 'row',
          marginHorizontal: spacing.lg,
          marginTop: layout.compact ? spacing.xs : spacing.sm,
          borderRadius: radius.chip,
          backgroundColor: theme.color.surfaceAlt,
          overflow: 'hidden',
        }}>
          {/* Wins */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: layout.compact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Wins</Text>
            <Text variant="headline" color={games.checkersWins > 0 ? theme.color.success : theme.color.text}>{games.checkersWins}</Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: layout.compact ? 6 : 8 }} />

          {/* Win Rate */}
          <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center', paddingVertical: layout.compact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Win Rate</Text>
            <Text variant="headline" color={theme.color.text}>{winRate}%</Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: layout.compact ? 6 : 8 }} />

          {/* Losses */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: layout.compact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Losses</Text>
            <Text variant="headline" color={games.checkersLosses > 0 ? theme.color.danger : theme.color.text}>{games.checkersLosses}</Text>
          </View>
        </View>

        {/* Board */}
        <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingTop: layout.compact ? spacing.xs : spacing.sm }}>
          <View
            onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}
            style={{ width: layout.boardSize, height: layout.boardSize, borderRadius: radius.input, overflow: 'hidden', borderWidth: 2, borderColor: theme.color.hairline, backgroundColor: theme.color.hairline }}
          >
            {Array.from({ length: 8 }).map((_, r) => (
              <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
                {Array.from({ length: 8 }).map((__, c) => {
                  const idx = r * 8 + c;
                  const dark = (r + c) % 2 === 1;
                  const piece = board[idx];
                  const isSel = selected === idx;
                  const isDest = destinations.has(idx);
                  const canMove = movable.has(idx);
                  const isLast = !flight && lastMove != null && (lastMove.from === idx || lastMove.to === idx);
                  const flying = flight != null && flight.move.from === idx;
                  const captured = flight != null && flight.move.captures.includes(idx);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => onCell(idx)}
                      accessible={dark}
                      accessibilityRole="button"
                      accessibilityLabel={dark ? `Row ${r + 1}, column ${c + 1}, ${piece ? `${piece.player === 'r' ? 'your' : 'AI'} ${piece.king ? 'king' : 'piece'}` : isDest ? 'available destination' : 'empty'}` : undefined}
                      accessibilityHint={isDest ? 'Moves the selected piece here.' : canMove ? 'Selects this piece.' : undefined}
                      accessibilityState={{ selected: isSel, disabled: !isDest && !canMove }}
                      style={{
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: dark ? darkSquare : lightSquare,
                      }}
                    >
                      {isLast && (
                        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: theme.color.primary, opacity: 0.16 }} />
                      )}
                      {isSel && <PulseRing color={theme.color.accent} />}
                      {isDest && !piece && (
                        <View style={{ width: '26%', height: '26%', borderRadius: 999, backgroundColor: theme.color.success, opacity: 0.85 }} />
                      )}
                      {piece && !flying && (
                        captured && flight ? (
                          <Animated.View style={{ width: '74%', height: '74%', opacity: captureFade }}>
                            <PieceDot piece={piece} highlight={false} />
                          </Animated.View>
                        ) : (
                          <View style={{ width: '74%', height: '74%' }}>
                            <PieceDot piece={piece} highlight={canMove && piece.player === 'r'} pop={popIdx === idx} />
                          </View>
                        )
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {flight && cell > 0 && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute', left: 0, top: 0, width: cell, height: cell,
                  alignItems: 'center', justifyContent: 'center',
                  transform: [{ translateX: flightPos.x }, { translateY: flightPos.y }],
                }}
              >
                <View style={{ width: cell * 0.74, height: cell * 0.74 }}>
                  <PieceDot piece={flight.landingPiece} highlight={false} shadow />
                </View>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Status line */}
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', paddingVertical: layout.compact ? spacing.xs : spacing.sm, minHeight: layout.compact ? 30 : 36, justifyContent: 'center' }}>
          {over ? (
            <Text variant="callout" dim>
              {winner === 'r'
                ? 'You win.'
                : winner === 'b'
                  ? 'AI wins - rematch?'
                  : drawReason === 'threefold_repetition'
                    ? 'Draw by repetition.'
                    : 'Draw — no progress.'}
            </Text>
          ) : thinking ? (
            <ThinkingDots />
          ) : popIdx != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFD70022', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.input }}>
              <Foundation name="crown" size={15} color="#FFD700" />
              <Text variant="callout" color="#C8A000">King!</Text>
            </View>
          ) : (
            <Text variant="callout" dim>{flight ? '…' : 'Your move'}</Text>
          )}
        </View>

        {/* Action row */}
        <View style={{
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: layout.compact ? spacing.xs : spacing.sm,
          paddingBottom: layout.compact ? spacing.xs : spacing.md,
        }}>
          {/* Surrender — only shown mid-game */}
          {!over && (
            <Pressable
              onPress={surrender}
              disabled={controlsBlocked}
              accessibilityRole="button"
              accessibilityLabel="Surrender this game"
              accessibilityState={{ disabled: controlsBlocked }}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: radius.round,
                borderWidth: 1,
                borderColor: theme.color.danger + '60',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: spacing.xs,
                opacity: controlsBlocked ? 0.45 : pressed ? 0.7 : 1,
                backgroundColor: theme.color.surface,
              })}
            >
              <Ionicons name="flag-outline" size={15} color={theme.color.danger} />
              <Text variant="footnote" color={theme.color.danger}>Surrender</Text>
            </Pressable>
          )}
          {/* New game — always available */}
          <Pressable
            onPress={() => newGame()}
            accessibilityRole="button"
            accessibilityLabel="Start a new game"
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: radius.round,
              backgroundColor: theme.color.primary,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.xs,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="refresh" size={15} color={theme.color.onPrimary} />
            <Text variant="footnote" color={theme.color.onPrimary}>New game</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* How to play */}
      <GameTutorial game="checkers" visible={tutorial.visible} showOptOut={tutorial.auto} onClose={tutorial.close} />

      {/* Blocking game decisions. Unlike a native Alert, opening this sheet
          cancels the current AI generation before any action can be hidden
          behind the confirmation. */}
      <ActionSheet
        visible={confirmation !== null}
        onClose={() => setConfirmation(null)}
        closeLabel="Keep playing"
        title={confirmation?.kind === 'difficulty'
          ? `Restart on ${confirmation.next}?`
          : 'Surrender this game?'}
        description={confirmation?.kind === 'difficulty'
          ? `This ${roundDifficulty} round will end without being recorded.`
          : 'The AI takes the win and it counts as a loss.'}
      >
        <Pressable
          onPress={() => {
            if (!confirmation) return;
            if (confirmation.kind === 'difficulty') {
              newGame(confirmation.next);
            } else {
              finish('b', board);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={confirmation?.kind === 'difficulty'
            ? `Restart on ${confirmation.next}`
            : 'Confirm surrender'}
          style={({ pressed }) => ({
            minHeight: 52,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: radius.input,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: confirmation?.kind === 'surrender'
              ? theme.color.danger
              : theme.color.primary,
            opacity: pressed ? 0.76 : 1,
          })}
        >
          <Text variant="headline" color={theme.color.onPrimary} center>
            {confirmation?.kind === 'difficulty'
              ? `Restart on ${confirmation.next}`
              : 'Surrender'}
          </Text>
        </Pressable>
      </ActionSheet>

      {/* Victory / defeat celebration */}
      <GameCelebration
        visible={celebrate}
        tone={winner === 'r' ? 'win' : winner === 'b' ? 'lose' : 'neutral'}
        title={winner === 'r' ? 'Victory!' : winner === 'b' ? 'The AI takes it' : 'Draw'}
        subtitle={
          winner === 'r'
            ? `You beat the ${roundDifficulty} AI. Well played.`
            : winner === 'b'
              ? 'A calm rematch is one tap away.'
              : drawReason === 'threefold_repetition'
                ? 'The same position appeared three times. A fresh round is ready.'
                : 'No capture or promotion happened for 40 moves each. A fresh round is ready.'
        }
        stats={[
          { label: 'Wins', value: `${games.checkersWins}` },
          { label: 'Losses', value: `${games.checkersLosses}` },
          { label: 'Win rate', value: `${winRate}%` },
        ]}
        unlocked={unlocked}
        hint={nextAchievementHint('checkers', games, games.achievements)}
        primary={{ label: 'Play again', onPress: () => newGame() }}
        secondary={{ label: 'View board', onPress: () => setCelebrate(false) }}
        onShareAchievement={(a) => {
          setCelebrate(false);
          router.push({ pathname: '/share-achievement', params: { id: a.id } });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pieces & indicators
// ---------------------------------------------------------------------------

function PieceDot({ piece, highlight, pop, shadow }: { piece: Piece; highlight: boolean; pop?: boolean; shadow?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const crownScale = useRef(new Animated.Value(piece.king ? 1 : 0)).current;

  // Promotion pop - a proud swell when a man becomes a king.
  useEffect(() => {
    if (!pop) return;
    scale.setValue(1);
    crownScale.setValue(0);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 300, easing: Easing.bounce, useNativeDriver: true }),
        Animated.timing(crownScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [pop, scale, crownScale]);

  const isKing = piece.king;
  const isRed = piece.player === 'r';
  const bodyColor = isRed ? '#F17789' : '#9E7CBC';
  const rimColor = isRed ? '#B23A4B' : '#5A3B72';
  const borderColor = isKing ? '#D0A070' : rimColor;
  const borderWidth = isKing ? 3 : 2;

  return (
    <Animated.View
      style={{
        flex: 1, borderRadius: 999,
        backgroundColor: bodyColor,
        borderWidth, borderColor,
        alignItems: 'center', justifyContent: 'center',
        opacity: highlight || piece.player === 'b' ? 1 : 0.92,
        transform: [{ scale }],
        ...(shadow
          ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 8 }
          : undefined),
        ...(isKing
          ? { shadowColor: '#D0A070', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 6, elevation: 6 }
          : undefined),
      }}
    >
      <View
        style={{
          position: 'absolute', top: 5, left: 5, right: 5, bottom: 5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.34)',
        }}
        pointerEvents="none"
      />

      {/* King crown - animates in on promotion */}
      {isKing && (
        <Animated.View style={{ transform: [{ scale: crownScale.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}>
          <Foundation name="crown" size={18} color="#FFF2BF" />
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** Soft pulsing ring around the selected piece. */
function PulseRing({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 2, right: 2, top: 2, bottom: 2,
        borderRadius: radius.chip, borderWidth: 2, borderColor: color,
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.02] }) }],
      }}
    />
  );
}

/** "AI is thinking" with three softly cycling dots. */
function ThinkingDots() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text variant="callout" dim>AI is thinking</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 180} />
        ))}
      </View>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 340, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return (
    <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color.primary, opacity: anim }} />
  );
}
