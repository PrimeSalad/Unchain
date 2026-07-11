import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { BackButton } from '@/presentation/components/BackButton';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { GameTutorial, TutorialInfoButton, useGameTutorial } from '@/presentation/components/games/GameTutorial';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { playSound } from '@/application/sound';
import { nextAchievementHint, type GameAchievement } from '@/domain/games/achievements';
import { conflicts, generate, type Grid, type SudokuLevel } from '@/domain/games/sudoku';

// A crash inside the game must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

const LEVELS: SudokuLevel[] = ['easy', 'medium', 'hard', 'expert'];
/** Hard cap on hints per puzzle. */
const HINT_LIMIT = 3;

const fmt = (totalSeconds: number) =>
  `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;

export default function Sudoku() {
  const theme = useTheme();
  const router = useRouter();
  const games = useStore((s) => s.games);
  const recordSudoku = useStore((s) => s.recordSudoku);
  const completeMission = useStore((s) => s.completeMission);

  const [level, setLevel] = useState<SudokuLevel>('easy');
  const [{ puzzle, solution }, setPuzzle] = useState(() => generate('easy'));
  const [grid, setGrid] = useState<Grid>(() => puzzle.slice());
  const [notes, setNotes] = useState<number[]>(() => new Array(81).fill(0));
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [unlocked, setUnlocked] = useState<GameAchievement[]>([]);
  const [popCell, setPopCell] = useState<number | null>(null);
  const [unitFlashCells, setUnitFlashCells] = useState<Set<number>>(new Set());
  const unitFlashAnim = useRef(new Animated.Value(0)).current;
  const recorded = useRef(false);
  // Synchronous hint counter — state alone can be raced by rapid taps.
  const hintsRef = useRef(0);
  const tutorial = useGameTutorial('sudoku');

  const givens = useMemo(() => new Set(puzzle.map((v, i) => (v !== 0 ? i : -1)).filter((i) => i >= 0)), [puzzle]);
  const bad = useMemo(() => conflicts(grid), [grid]);

  // Timer.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [done]);

  const newGame = (lvl: SudokuLevel) => {
    const p = generate(lvl);
    setLevel(lvl);
    setPuzzle(p);
    setGrid(p.puzzle.slice());
    setNotes(new Array(81).fill(0));
    setSelected(null);
    setMistakes(0);
    setHints(0);
    hintsRef.current = 0;
    setSeconds(0);
    setDone(false);
    setCelebrate(false);
    setUnlocked([]);
    setPopCell(null);
    setUnitFlashCells(new Set());
    setNotesMode(false);
    recorded.current = false;
    playSound('tap', 0.4);
  };

  const finish = () => {
    setDone(true);
    if (!recorded.current) {
      recorded.current = true;
      const newly = recordSudoku(level, seconds * 1000, { mistakes, hints });
      setUnlocked(newly);
      completeMission('play_game');
      playSound('win', 0.8);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setCelebrate(true), 500);
    }
  };

  const checkDone = (g: Grid) => {
    if (g.every((v, i) => v === solution[i])) finish();
  };

  const input = (val: number) => {
    if (selected == null || done || givens.has(selected)) return;
    Haptics.selectionAsync().catch(() => {});
    if (notesMode && val !== 0) {
      playSound('flip', 0.4);
      setNotes((n) => {
        const next = n.slice();
        next[selected] = next[selected] ^ (1 << (val - 1));
        return next;
      });
      return;
    }
    const g = grid.slice();
    g[selected] = val;
    setGrid(g);
    setNotes((n) => { const next = n.slice(); next[selected] = 0; return next; });
    if (val !== 0 && val !== solution[selected]) {
      setMistakes((m) => m + 1);
      playSound('capture', 0.3);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      if (val !== 0) {
        playSound('tap', 0.45);
        flashCompletedUnits(g, selected);
      }
      setPopCell(selected);
      checkDone(g);
    }
  };

  /** Briefly glow any row/column/box the placement just completed. */
  const flashCompletedUnits = (g: Grid, at: number) => {
    const r = Math.floor(at / 9);
    const c = at % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    const units = [
      Array.from({ length: 9 }, (_, k) => r * 9 + k),
      Array.from({ length: 9 }, (_, k) => k * 9 + c),
      Array.from({ length: 9 }, (_, k) => (br + Math.floor(k / 3)) * 9 + bc + (k % 3)),
    ];
    const completed = units.filter((u) => u.every((i) => g[i] === solution[i]));
    if (completed.length === 0) return;
    setUnitFlashCells(new Set(completed.flat()));
    playSound('clear', 0.45);
    unitFlashAnim.setValue(0.65);
    Animated.timing(unitFlashAnim, { toValue: 0, duration: 600, useNativeDriver: true })
      .start(() => setUnitFlashCells(new Set()));
  };

  const hintsLeft = HINT_LIMIT - hints;

  const hint = () => {
    // Ref-based guard: immune to rapid-tap races that could exceed the cap.
    if (done || hintsRef.current >= HINT_LIMIT) return;
    const target =
      selected != null && grid[selected] === 0 && !givens.has(selected)
        ? selected
        : grid.findIndex((v, i) => v !== solution[i]);
    if (target < 0) return;
    hintsRef.current += 1;
    const g = grid.slice();
    g[target] = solution[target];
    setGrid(g);
    setNotes((n) => { const next = n.slice(); next[target] = 0; return next; });
    setHints(hintsRef.current);
    setSelected(target);
    setPopCell(target);
    playSound('flip', 0.5);
    flashCompletedUnits(g, target);
    checkDone(g);
  };

  const selVal = selected != null ? grid[selected] : 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <BackButton fallback="/games" />
          <Text variant="title2" style={{ flex: 1 }}>Sudoku</Text>
          <TutorialInfoButton onPress={tutorial.open} />
          <Text variant="callout" dim style={{ fontVariant: ['tabular-nums'] }}>{mm}:{ss}</Text>
        </View>

        {/* Difficulty */}
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {LEVELS.map((l) => {
            const on = level === l;
            return (
              <Pressable key={l} onPress={() => newGame(l)} style={{ flex: 1, height: 34, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt }}>
                <Text variant="caption" color={on ? theme.color.onPrimary : theme.color.text} style={{ textTransform: 'capitalize' }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text variant="footnote" dim>Mistakes: {mistakes}</Text>
          <Text variant="footnote" dim>Hints: {hints}/{HINT_LIMIT}</Text>
        </View>

        {/* Board */}
        <View style={{ alignItems: 'center', paddingHorizontal: spacing.lg }}>
          <View style={{ width: '100%', maxWidth: 380, aspectRatio: 1, borderRadius: radius.chip, overflow: 'hidden', borderWidth: 2, borderColor: theme.color.text }}>
            {Array.from({ length: 9 }).map((_, r) => (
              <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
                {Array.from({ length: 9 }).map((__, c) => {
                  const idx = r * 9 + c;
                  const v = grid[idx];
                  const given = givens.has(idx);
                  const isSel = selected === idx;
                  const sameRowCol = selected != null && (Math.floor(selected / 9) === r || selected % 9 === c || box(selected) === box(idx));
                  const sameNum = selVal !== 0 && v === selVal;
                  const conflict = bad.has(idx);
                  const noteMask = notes[idx];
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setSelected(idx)}
                      style={{
                        flex: 1, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSel
                          ? theme.color.primarySoft
                          : sameNum
                            ? theme.color.accentSoft
                            : sameRowCol
                              ? (theme.mode === 'dark' ? '#241C2E' : '#F1EAF6')
                              : theme.color.surface,
                        borderRightWidth: c % 3 === 2 && c !== 8 ? 2 : 0.5,
                        borderBottomWidth: r % 3 === 2 && r !== 8 ? 2 : 0.5,
                        borderColor: theme.color.hairline,
                      }}
                    >
                      {unitFlashCells.has(idx) && (
                        <Animated.View
                          pointerEvents="none"
                          style={{
                            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                            backgroundColor: theme.color.success, opacity: unitFlashAnim,
                          }}
                        />
                      )}
                      {v !== 0 ? (
                        <CellValue
                          value={v}
                          color={conflict ? theme.color.danger : given ? theme.color.text : theme.color.primary}
                          pop={popCell === idx && !given}
                        />
                      ) : noteMask ? (
                        <View style={{ width: '92%', height: '92%', flexDirection: 'row', flexWrap: 'wrap' }}>
                          {Array.from({ length: 9 }).map((___, d) => (
                            <View key={d} style={{ width: '33.3%', height: '33.3%', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 9, color: theme.color.textDim }}>
                                {noteMask & (1 << d) ? d + 1 : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Completion strip (celebration popup carries the details) */}
        {done && (
          <View style={{ alignItems: 'center', marginTop: spacing.md }}>
            <Text variant="headline" color={theme.color.success}>Solved in {fmt(seconds)} 🎉</Text>
            <Pressable
              onPress={() => newGame(level)}
              style={({ pressed }) => ({
                marginTop: spacing.md, height: 46, paddingHorizontal: spacing.xxl, borderRadius: radius.button,
                backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center',
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Text variant="headline" color={theme.color.onPrimary}>New puzzle</Text>
            </Pressable>
          </View>
        )}

        {/* Controls */}
        {!done && (
          <View style={{ marginTop: 'auto', padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Pressable key={n} onPress={() => input(n)} style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: 8, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                  <Text variant="title2" color={theme.color.text} style={{ fontSize: 20 }}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Control icon="backspace-outline" label="Erase" onPress={() => input(0)} />
              <Control icon={notesMode ? 'pencil' : 'pencil-outline'} label="Notes" active={notesMode} onPress={() => setNotesMode((v) => !v)} />
              <Control
                icon="bulb-outline"
                label={hintsLeft > 0 ? `Hint (${hintsLeft})` : 'No hints'}
                onPress={hint}
                disabled={hintsLeft <= 0}
              />
              <Control icon="refresh" label="New" onPress={() => newGame(level)} />
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* How to play */}
      <GameTutorial game="sudoku" visible={tutorial.visible} showOptOut={tutorial.auto} onClose={tutorial.close} />

      {/* Solved celebration */}
      <GameCelebration
        visible={celebrate}
        tone="win"
        title="Puzzle solved!"
        subtitle={`A ${level} grid, untangled with a clear head.`}
        stats={[
          { label: 'Time', value: fmt(seconds) },
          { label: 'Mistakes', value: `${mistakes}` },
          { label: 'Hints', value: `${hints}` },
          {
            label: 'Best',
            value: games.sudokuBestMs[level] != null ? fmt(Math.round((games.sudokuBestMs[level] as number) / 1000)) : '—',
          },
        ]}
        unlocked={unlocked}
        hint={nextAchievementHint('sudoku', games, games.achievements)}
        primary={{ label: 'New puzzle', onPress: () => newGame(level) }}
        secondary={{ label: 'View board', onPress: () => setCelebrate(false) }}
        onShareAchievement={(a) => {
          setCelebrate(false);
          router.push({ pathname: '/share-achievement', params: { id: a.id } });
        }}
      />
    </View>
  );
}

/** Cell number that pops in when the player places it. */
function CellValue({ value, color, pop }: { value: number; color: string; pop: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pop) return;
    scale.setValue(0.55);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 260 }).start();
  }, [pop, value, scale]);

  return (
    <Animated.View style={{ transform: [{ scale: pop ? scale : 1 }] }}>
      <Text variant="title2" color={color} style={{ fontSize: 22 }}>
        {value}
      </Text>
    </Animated.View>
  );
}

const box = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);

function Control({ icon, label, onPress, active, disabled }: { icon: any; label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1, height: 52, borderRadius: 10,
        backgroundColor: active ? theme.color.primary : theme.color.surfaceAlt,
        alignItems: 'center', justifyContent: 'center', gap: 2,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
      })}
    >
      <Ionicons name={icon} size={18} color={active ? theme.color.onPrimary : disabled ? theme.color.textDim : theme.color.primary} />
      <Text variant="caption" color={active ? theme.color.onPrimary : theme.color.text}>{label}</Text>
    </Pressable>
  );
}
