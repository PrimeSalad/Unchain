import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { BackButton } from '@/presentation/components/BackButton';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { playSound } from '@/application/sound';
import { nextAchievementHint, type GameAchievement } from '@/domain/games/achievements';
import {
  applyMove,
  chooseMove,
  initialBoard,
  legalMoves,
  movesFrom,
  rc,
  status,
  type Board,
  type Difficulty,
  type Move,
  type Piece,
  type Player,
} from '@/domain/games/checkers';

// A crash inside the game must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

const RED = '#E8697A';
const BLACK = '#5A2E7A';
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const HOP_MS = 190;

/** Plain data only — the Animated values live in stable refs. */
interface Flight {
  move: Move;
  nextBoard: Board;
  mover: Player;
  piece: Piece;
}

export default function Checkers() {
  const theme = useTheme();
  const router = useRouter();
  const games = useStore((s) => s.games);
  const recordCheckers = useStore((s) => s.recordCheckers);

  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
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
  const [boardW, setBoardW] = useState(0);
  const recorded = useRef(false);
  const cell = boardW / 8;

  // Stable animation plumbing — values are created once and reused for every
  // move, so no Animated node is ever torn down mid-animation.
  const flightPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const captureFade = useRef(new Animated.Value(1)).current;
  /** Bumped on new game / unmount; stale animation callbacks bail out. */
  const genRef = useRef(0);
  /** false while a flight is uncommitted — makes the commit idempotent. */
  const committedRef = useRef(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      genRef.current += 1;
      try {
        flightPos.stopAnimation();
        captureFade.stopAnimation();
      } catch { /* nothing to stop */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMoves = useMemo(
    () => (selected != null ? movesFrom(board, selected) : []),
    [selected, board],
  );
  const destinations = useMemo(() => new Set(selectedMoves.map((m) => m.to)), [selectedMoves]);

  const movable = useMemo(() => {
    if (turn !== 'r' || over || flight) return new Set<number>();
    return new Set(legalMoves(board, 'r').map((m) => m.from));
  }, [board, turn, over, flight]);

  const newGame = () => {
    // Invalidate any in-flight animation so its callbacks can't touch the new game.
    genRef.current += 1;
    committedRef.current = true;
    try {
      flightPos.stopAnimation();
      captureFade.stopAnimation();
    } catch { /* nothing to stop */ }
    setBoard(initialBoard());
    setTurn('r');
    setSelected(null);
    setLastMove(null);
    setFlight(null);
    setPopIdx(null);
    setWinner(null);
    setOver(false);
    setCelebrate(false);
    setUnlocked([]);
    setThinking(false);
    recorded.current = false;
    playSound('tap', 0.4);
  };

  const finish = (w: Player | null, finalBoard: Board) => {
    setOver(true);
    setWinner(w);
    if (!recorded.current) {
      recorded.current = true;
      const piecesLeft = finalBoard.filter((p) => p?.player === 'r').length;
      const newly = recordCheckers(w === 'r' ? 'win' : 'loss', { difficulty, piecesLeft });
      setUnlocked(newly);
      playSound(w === 'r' ? 'win' : 'lose', 0.8);
      Haptics.notificationAsync(
        w === 'r' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      setTimeout(() => setCelebrate(true), 650);
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
        setTimeout(() => { if (mountedRef.current) setPopIdx(null); }, 700);
      }

      const opponentOf: Player = mover === 'r' ? 'b' : 'r';
      const st = status(nextBoard, opponentOf);
      if (st.over) return finish(st.winner, nextBoard);
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
    const gen = genRef.current;
    committedRef.current = false;
    setSelected(null);

    try {
      if (cell <= 0) throw new Error('board not measured yet');
      const [fr, fc] = rc(move.from);
      flightPos.setValue({ x: fc * cell, y: fr * cell });
      captureFade.setValue(1);
      setFlight({ move, nextBoard, mover, piece });

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
        setTimeout(() => playSound('capture', 0.7), HOP_MS / 2);
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
      // Animation setup failed — play the move instantly instead of crashing.
      commitFlight(gen, move, nextBoard, mover, promoted);
    }
  };

  // AI turn — brief natural "thinking" beat, then an animated reply.
  useEffect(() => {
    if (turn !== 'b' || over || flight) return;
    setThinking(true);
    const t = setTimeout(() => {
      const move = chooseMove(board, 'b', difficulty);
      setThinking(false);
      if (!move) return finish('r', board);
      doMove(move, 'b');
    }, 550);
    return () => clearTimeout(t);
  }, [turn, over, flight]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCell = (idx: number) => {
    if (over || turn !== 'r' || thinking || flight) return;
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

  const played = games.checkersWins + games.checkersLosses;
  const winRate = played ? Math.round((games.checkersWins / played) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <BackButton fallback="/games" />
          <Text variant="title2" style={{ flex: 1 }}>Checkers</Text>
          <Pressable
            onPress={newGame}
            hitSlop={10}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="refresh" size={16} color={theme.color.primary} />
            <Text variant="footnote" color={theme.color.primary}>New game</Text>
          </Pressable>
        </View>

        {/* Difficulty */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {DIFFS.map((d) => {
            const on = difficulty === d;
            return (
              <Pressable
                key={d}
                onPress={() => setDifficulty(d)}
                style={({ pressed }) => ({
                  flex: 1, height: 36, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text variant="footnote" color={on ? theme.color.onPrimary : theme.color.text} style={{ textTransform: 'capitalize' }}>{d}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Status line */}
        <View style={{ alignItems: 'center', paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center' }}>
          {over ? (
            <Text variant="callout" dim>{winner === 'r' ? 'You win! 🎉' : 'AI wins — rematch?'}</Text>
          ) : thinking ? (
            <ThinkingDots />
          ) : (
            <Text variant="callout" dim>{flight ? '…' : 'Your move'}</Text>
          )}
        </View>

        {/* Board */}
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.lg }}>
          <View
            onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}
            style={{ width: '100%', maxWidth: 380, aspectRatio: 1, borderRadius: radius.card, overflow: 'hidden', borderWidth: 2, borderColor: theme.color.hairline }}
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
                      style={{
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: dark ? (theme.mode === 'dark' ? '#2A2233' : '#E4D7EE') : (theme.mode === 'dark' ? '#1F1926' : '#F7F1FA'),
                      }}
                    >
                      {/* last-move tint */}
                      {isLast && (
                        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: theme.color.primary, opacity: 0.16 }} />
                      )}
                      {/* selection ring */}
                      {isSel && <PulseRing color={theme.color.accent} />}
                      {/* legal destination dot */}
                      {isDest && !piece && (
                        <View style={{ width: '26%', height: '26%', borderRadius: 999, backgroundColor: theme.color.success, opacity: 0.85 }} />
                      )}
                      {/* piece (hidden while it flies; fading while captured) */}
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

            {/* Flying piece overlay — native-driver transforms, stable values */}
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
                  <PieceDot piece={flight.piece} highlight={false} shadow />
                </View>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Record strip */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg }}>
          <MiniStat label="Wins" value={`${games.checkersWins}`} />
          <MiniStat label="Losses" value={`${games.checkersLosses}`} />
          <MiniStat label="Win rate" value={`${winRate}%`} />
        </View>
      </SafeAreaView>

      {/* Victory / defeat celebration */}
      <GameCelebration
        visible={celebrate}
        tone={winner === 'r' ? 'win' : 'lose'}
        title={winner === 'r' ? 'Victory!' : 'The AI takes it'}
        subtitle={
          winner === 'r'
            ? `You beat the ${difficulty} AI. Well played.`
            : 'A calm rematch is one tap away.'
        }
        stats={[
          { label: 'Wins', value: `${games.checkersWins}` },
          { label: 'Losses', value: `${games.checkersLosses}` },
          { label: 'Win rate', value: `${winRate}%` },
        ]}
        unlocked={unlocked}
        hint={nextAchievementHint('checkers', games, games.achievements)}
        primary={{ label: 'Play again', onPress: newGame }}
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

  // Promotion pop — a proud little swell when a man becomes a king.
  useEffect(() => {
    if (!pop) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 260, easing: Easing.bounce, useNativeDriver: true }),
    ]).start();
  }, [pop, scale]);

  return (
    <Animated.View
      style={{
        flex: 1, borderRadius: 999,
        backgroundColor: piece.player === 'r' ? RED : BLACK,
        borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center', justifyContent: 'center',
        opacity: highlight || piece.player === 'b' ? 1 : 0.92,
        transform: [{ scale }],
        ...(shadow
          ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 8 }
          : null),
      }}
    >
      {piece.king && <Ionicons name="star" size={16} color="#FFFFFF" />}
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

function MiniStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="headline" color={theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text variant="caption" dim>{label}</Text>
    </View>
  );
}
