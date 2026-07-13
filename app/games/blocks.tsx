import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { BackButton } from '@/presentation/components/BackButton';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { GameLoadingScreen, useGameLoading } from '@/presentation/components/games/GameLoadingScreen';
import { GameTutorial, TutorialInfoButton, useGameTutorial } from '@/presentation/components/games/GameTutorial';
import { useSquareBoardSize } from '@/presentation/components/games/useGameLayout';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { playSound } from '@/application/sound';
import { nextAchievementHint, type GameAchievement } from '@/domain/games/achievements';
import {
  SIZE,
  canPlace,
  canPlaceAnywhere,
  clearLines,
  emptyGrid,
  hasAnyMove,
  newTray,
  place,
  scorePlacement,
  type Grid,
  type Piece,
} from '@/domain/games/blocks';

// A crash inside the game must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

const BLOCK_COLORS = ['#5A2E7A', '#E8697A', '#D0A070', '#4E7A5A', '#4A6FA5', '#3E9C9C'];
interface Drag {
  index: number;
  row: number;
  col: number;
  left: number;
  top: number;
  valid: boolean;
}

export default function Blocks() {
  const theme = useTheme();
  const router = useRouter();
  const games = useStore((s) => s.games);
  const recordBlocks = useStore((s) => s.recordBlocks);
  const completeMission = useStore((s) => s.completeMission);
  const best = useStore((s) => s.games.blocksBest);

  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [pieces, setPieces] = useState<(Piece | null)[]>(() => newTray(0));
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [over, setOver] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [unlocked, setUnlocked] = useState<GameAchievement[]>([]);
  const [newBest, setNewBest] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [gridFrame, setGridFrame] = useState<{ x: number; y: number; cell: number } | null>(null);
  const [flashCells, setFlashCells] = useState<Set<number>>(new Set());
  const [scorePop, setScorePop] = useState<{ amount: number; key: number } | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const maxComboRef = useRef(0);
  const maxLinesRef = useRef(0);

  const gridBoxRef = useRef<View>(null);
  const tutorial = useGameTutorial('blocks');
  const layout = useSquareBoardSize({ reservedHeight: 378, horizontalPadding: spacing.lg * 2, max: 328 });
  const trayCell = layout.compact ? 18 : 22;

  // Refs so the gesture handlers always read the latest state.
  const gridRef = useRef(grid); gridRef.current = grid;
  const piecesRef = useRef(pieces); piecesRef.current = pieces;
  const frameRef = useRef(gridFrame); frameRef.current = gridFrame;
  const scoreRef = useRef(score); scoreRef.current = score;
  const comboRef = useRef(combo); comboRef.current = combo;
  const overRef = useRef(over); overRef.current = over;
  // Written synchronously alongside setDrag so drop logic never runs inside a
  // state updater (side effects there crash React) and onEnd/onFinalize can't
  // double-place a piece.
  const dragRef = useRef<Drag | null>(null);

  const measure = useCallback(() => {
    gridBoxRef.current?.measureInWindow((x, y, w) => setGridFrame({ x, y, cell: w / SIZE }));
  }, []);

  const cellFor = useCallback((absX: number, absY: number, i: number) => {
    const f = frameRef.current;
    const p = piecesRef.current[i];
    if (!f || !p) return null;
    const pieceW = p.shape.w * f.cell;
    const pieceH = p.shape.h * f.cell;
    const left = absX - pieceW / 2;
    const top = absY - pieceH - 28; // lift above the finger
    const col = Math.round((left - f.x) / f.cell);
    const row = Math.round((top - f.y) / f.cell);
    return { row, col, left, top };
  }, []);

  const beginDrag = useCallback((i: number, absX: number, absY: number) => {
    if (overRef.current) return;
    const p = piecesRef.current[i];
    if (!p) return;
    const c = cellFor(absX, absY, i);
    if (!c) return;
    const next: Drag = { index: i, ...c, valid: canPlace(gridRef.current, p.shape, c.row, c.col) };
    dragRef.current = next;
    setDrag(next);
  }, [cellFor]);

  const moveDrag = useCallback((i: number, absX: number, absY: number) => {
    const p = piecesRef.current[i];
    if (!p) return;
    const c = cellFor(absX, absY, i);
    if (!c) return;
    const next: Drag = { index: i, ...c, valid: canPlace(gridRef.current, p.shape, c.row, c.col) };
    dragRef.current = next;
    setDrag(next);
  }, [cellFor]);

  const finishGame = useCallback((finalScore: number) => {
    setOver(true);
    const wasBest = finalScore > (useStore.getState().games.blocksBest || 0);
    setNewBest(wasBest);
    const newly = recordBlocks(finalScore, {
      maxCombo: maxComboRef.current,
      maxLines: maxLinesRef.current,
    });
    setUnlocked(newly);
    completeMission('play_game');
    playSound(wasBest ? 'win' : 'lose', wasBest ? 0.8 : 0.5);
    Haptics.notificationAsync(
      wasBest ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {});
    setTimeout(() => setCelebrate(true), 550);
  }, [recordBlocks, completeMission]);

  const dropDrag = useCallback((i: number) => {
    // Claim the drag synchronously: onEnd AND onFinalize both call this, and
    // the second call must find nothing to do.
    const d = dragRef.current;
    if (!d || d.index !== i) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.valid) return;
    const piece = piecesRef.current[i];
    if (!piece) return;

    // Place, then clear full lines.
    const placed = place(gridRef.current, piece.shape, d.row, d.col, piece.color);
    const { grid: cleared, lines } = clearLines(placed);
    const nextCombo = lines > 0 ? comboRef.current + 1 : 0;
    const gained = scorePlacement(piece.shape.size, lines, nextCombo);
    const nextScore = scoreRef.current + gained;
    maxComboRef.current = Math.max(maxComboRef.current, nextCombo);
    maxLinesRef.current = Math.max(maxLinesRef.current, lines);

    Haptics.impactAsync(lines > 0 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    playSound(lines > 0 ? 'clear' : 'place', lines > 0 ? 0.8 : 0.7);

    // Flash the cells that just cleared.
    if (lines > 0) {
      const clearedSet = new Set<number>();
      for (let k = 0; k < placed.length; k++) if (placed[k] !== 0 && cleared[k] === 0) clearedSet.add(k);
      setFlashCells(clearedSet);
      flashAnim.setValue(0.9);
      Animated.timing(flashAnim, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: false })
        .start(() => setFlashCells(new Set()));
    }
    // Floating score pop.
    if (gained > 0) setScorePop({ amount: gained, key: Date.now() });

    // Remove the used piece; refill the tray when all three are gone.
    let nextPieces = piecesRef.current.map((p, idx) => (idx === i ? null : p));
    if (nextPieces.every((p) => p == null)) nextPieces = newTray(nextScore);

    setGrid(cleared);
    setPieces(nextPieces);
    setScore(nextScore);
    setCombo(nextCombo);

    // Game over the moment no remaining piece fits anywhere.
    if (!hasAnyMove(cleared, nextPieces)) finishGame(nextScore);
  }, [finishGame, flashAnim]);

  // Three stable gestures (indices are fixed).
  const gestures = useMemo(
    () =>
      [0, 1, 2].map((i) =>
        Gesture.Pan()
          .onBegin((e) => { runOnJS(beginDrag)(i, e.absoluteX, e.absoluteY); })
          .onUpdate((e) => { runOnJS(moveDrag)(i, e.absoluteX, e.absoluteY); })
          .onEnd(() => { runOnJS(dropDrag)(i); })
          .onFinalize(() => { runOnJS(dropDrag)(i); }),
      ),
    [beginDrag, moveDrag, dropDrag],
  );

  const reset = () => {
    setGrid(emptyGrid());
    setPieces(newTray(0));
    setScore(0);
    setCombo(0);
    setOver(false);
    setCelebrate(false);
    setUnlocked([]);
    setNewBest(false);
    dragRef.current = null;
    setDrag(null);
    setFlashCells(new Set());
    setScorePop(null);
    maxComboRef.current = 0;
    maxLinesRef.current = 0;
    playSound('tap', 0.4);
  };

  // Cells that would be filled by the current (valid) drag - for the ghost preview.
  const hoverCells = useMemo(() => {
    const set = new Set<number>();
    if (drag && drag.valid) {
      const p = piecesRef.current[drag.index];
      if (p) for (const [dr, dc] of p.shape.cells) set.add((drag.row + dr) * SIZE + (drag.col + dc));
    }
    return set;
  }, [drag]);
  const loading = useGameLoading();
  const boardFrame = theme.mode === 'dark' ? '#17101D' : '#D9C7E5';
  const emptyCell = theme.mode === 'dark' ? '#21182A' : '#FFF9F2';
  const emptyBorder = theme.mode === 'dark' ? '#33263F' : '#E5D9ED';
  const ghostBg = theme.mode === 'dark' ? '#B98FD6' : '#5A2E7A';

  if (loading) {
    return <GameLoadingScreen title="Block Puzzle" subtitle="Preparing the tray" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg, overflow: 'hidden' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: layout.compact ? 2 : spacing.sm }}>
          <BackButton fallback="/games" confirmExit />
          <Text variant="headline" style={{ flex: 1 }}>Block Puzzle</Text>
          <TutorialInfoButton onPress={tutorial.open} />
        </View>

        {/* Stats bar — Score | Best | Combo */}
        <View style={{
          flexDirection: 'row',
          marginHorizontal: spacing.lg,
          marginTop: layout.compact ? spacing.xs : spacing.sm,
          borderRadius: radius.chip,
          backgroundColor: theme.color.surfaceAlt,
          overflow: 'hidden',
        }}>
          {/* Score */}
          <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center', paddingVertical: layout.compact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Score</Text>
            <Text variant="headline" color={theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>{score.toLocaleString()}</Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: layout.compact ? 6 : 8 }} />

          {/* Best */}
          <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center', paddingVertical: layout.compact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Best</Text>
            <Text variant="headline" color={theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>{Math.max(best, score).toLocaleString()}</Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: layout.compact ? 6 : 8 }} />

          {/* Combo */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: layout.compact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Combo</Text>
            <Text variant="headline" color={combo > 1 ? theme.color.accent : theme.color.textDim}>{combo > 1 ? `×${combo}` : '—'}</Text>
          </View>
        </View>

        {/* Board */}
        <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingTop: layout.compact ? spacing.xs : spacing.sm }}>
          <View
            ref={gridBoxRef}
            onLayout={measure}
            style={{
              width: layout.boardSize,
              height: layout.boardSize,
              borderRadius: radius.card,
              overflow: 'hidden',
              backgroundColor: boardFrame,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              padding: layout.compact ? 4 : 5,
            }}
          >
            {Array.from({ length: SIZE }).map((_, r) => (
              <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
                {Array.from({ length: SIZE }).map((__, c) => {
                  const idx = r * SIZE + c;
                  const v = grid[idx];
                  const ghost = hoverCells.has(idx);
                  const flashing = flashCells.has(idx);
                  return (
                    <View key={c} style={{ flex: 1, padding: layout.compact ? 1.5 : 2 }}>
                      <View
                        style={{
                          flex: 1,
                          borderRadius: layout.compact ? 5 : 6,
                          backgroundColor: v ? BLOCK_COLORS[v - 1] : ghost ? ghostBg : emptyCell,
                          borderWidth: v ? 0 : 1,
                          borderColor: ghost ? theme.color.primary : emptyBorder,
                          opacity: ghost && !v ? 0.5 : 1,
                          overflow: 'hidden',
                        }}
                      >
                        {v ? (
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              left: 2,
                              right: 2,
                              top: 2,
                              height: '34%',
                              borderRadius: 5,
                              backgroundColor: '#FFFFFF',
                              opacity: 0.16,
                            }}
                          />
                        ) : null}
                        {ghost && !v ? (
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              left: 3,
                              right: 3,
                              top: 3,
                              bottom: 3,
                              borderRadius: 4,
                              borderWidth: 1,
                              borderColor: '#FFFFFF',
                              opacity: 0.35,
                            }}
                          />
                        ) : null}
                        {flashing && (
                          <Animated.View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: 0,
                              bottom: 0,
                              borderRadius: layout.compact ? 5 : 6,
                              backgroundColor: '#FFFFFF',
                              opacity: flashAnim,
                            }}
                          />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Floating "+N" score pop */}
            {scorePop && <ScoreFloat key={scorePop.key} amount={scorePop.amount} />}
          </View>
        </View>

        {/* Tray */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: layout.compact ? spacing.sm : spacing.lg, minHeight: layout.compact ? 88 : 112, paddingBottom: layout.compact ? spacing.xs : spacing.md }}>
          {pieces.map((p, i) => {
            // A piece with no legal placement reads as clearly "stuck".
            const stuck = p != null && !canPlaceAnywhere(grid, p.shape);
            return (
              <View key={i} style={{ width: layout.compact ? 92 : 112, height: layout.compact ? 92 : 112, alignItems: 'center', justifyContent: 'center' }}>
                {p && !over && (
                  <GestureDetector gesture={gestures[i]}>
                    <View style={{ opacity: drag?.index === i ? 0.25 : stuck ? 0.3 : 1 }}>
                      <TrayPopIn key={p.id} index={i}>
                        <PiecePreview piece={p} cell={trayCell} />
                      </TrayPopIn>
                    </View>
                  </GestureDetector>
                )}
              </View>
            );
          })}
        </View>

        {over && (
          <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
            <Text variant="title2" color={theme.color.text}>Game over</Text>
            <Text variant="callout" dim style={{ marginTop: 2 }}>Score {score.toLocaleString()} · Best {Math.max(best, score).toLocaleString()}</Text>
          </View>
        )}
      </SafeAreaView>

      {/* How to play */}
      <GameTutorial game="blocks" visible={tutorial.visible} showOptOut={tutorial.auto} onClose={tutorial.close} />

      {/* Game-over celebration */}
      <GameCelebration
        visible={celebrate}
        tone={newBest ? 'win' : 'neutral'}
        title={newBest ? 'New best score!' : 'Game over'}
        subtitle={newBest ? 'Your calmest run yet.' : 'Every board teaches your next one.'}
        score={{ label: 'Final score', value: score }}
        stats={[
          { label: 'Best', value: Math.max(best, score).toLocaleString() },
          { label: 'Max combo', value: maxComboRef.current > 1 ? `×${maxComboRef.current}` : '-' },
          { label: 'Games', value: `${games.blocksGames}` },
        ]}
        unlocked={unlocked}
        hint={nextAchievementHint('blocks', games, games.achievements)}
        primary={{ label: 'Play again', onPress: reset }}
        secondary={{ label: 'View board', onPress: () => setCelebrate(false) }}
        onShareAchievement={(a) => {
          setCelebrate(false);
          router.push({ pathname: '/share-achievement', params: { id: a.id } });
        }}
      />

      {/* Floating drag preview (window-coordinate overlay) */}
      {drag && frameRef.current && (() => {
        const p = piecesRef.current[drag.index];
        if (!p) return null;
        return (
          <View pointerEvents="none" style={{ position: 'absolute', left: drag.left, top: drag.top }}>
            <PiecePreview piece={p} cell={frameRef.current.cell} dim={!drag.valid} />
          </View>
        );
      })()}
    </View>
  );
}

/** New tray pieces spring in with a small stagger. */
function TrayPopIn({ index, children }: { index: number; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1, useNativeDriver: true, damping: 13, stiffness: 220, delay: index * 60,
    }).start();
  }, [scale, index]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function PiecePreview({ piece, cell, dim }: { piece: Piece; cell: number; dim?: boolean }) {
  const color = BLOCK_COLORS[piece.color - 1];
  return (
    <View style={{ width: piece.shape.w * cell, height: piece.shape.h * cell }}>
      {piece.shape.cells.map(([r, c], k) => (
        <View
          key={k}
          style={{
            position: 'absolute',
            left: c * cell,
            top: r * cell,
            width: cell,
            height: cell,
            padding: cell > 14 ? 1.5 : 1,
          }}
        >
          <View style={{ flex: 1, borderRadius: cell > 14 ? 5 : 3, backgroundColor: color, opacity: dim ? 0.4 : 1 }} />
        </View>
      ))}
    </View>
  );
}

/** "+N" that drifts up from the board centre and fades. */
function ScoreFloat({ amount }: { amount: number }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center',
        opacity: anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) }],
      }}
    >
      <Text variant="title1" color={theme.color.primary} style={{ fontVariant: ['tabular-nums'] }}>
        +{amount.toLocaleString()}
      </Text>
    </Animated.View>
  );
}
