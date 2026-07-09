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
  MAX_GUESSES,
  WORD_LENGTH,
  dailyAnswer,
  evaluate,
  isValidWord,
  mergeKeyStates,
  randomAnswer,
  type TileState,
} from '@/domain/games/clarity';

// Vivid, unmistakable feedback colours (classic word-game palette).
const GREEN = '#6AAA64';
const YELLOW = '#C9B458';
const GRAY_DARK = '#3A3A3C';
const GRAY_LIGHT = '#787C7E';

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const FLIP_STAGGER = 240;
const FLIP_DURATION = 340;
const REVEAL_TOTAL = FLIP_STAGGER * (WORD_LENGTH - 1) + FLIP_DURATION + 80;

export default function Clarity() {
  const router = useRouter();
  const theme = useTheme();
  const games = useStore((s) => s.games);
  const saveProgress = useStore((s) => s.saveClarityProgress);
  const recordResult = useStore((s) => s.recordClarityResult);
  const recordPractice = useStore((s) => s.recordClarityPractice);

  const [mode, setMode] = useState<'daily' | 'practice'>('daily');
  const daily = useMemo(() => dailyAnswer(), []);

  const [answer, setAnswer] = useState(daily.word);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [revealed, setRevealed] = useState(0);
  const [message, setMessage] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [unlocked, setUnlocked] = useState<GameAchievement[]>([]);
  const recorded = useRef(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Initialise per mode (and resume the daily from storage, fully revealed).
  useEffect(() => {
    if (mode === 'daily') {
      setAnswer(daily.word);
      if (games.clarityDay === daily.day) {
        setGuesses(games.clarityGuesses);
        setRevealed(games.clarityGuesses.length);
        recorded.current = games.clarityStatus !== 'playing';
      } else {
        setGuesses([]);
        setRevealed(0);
        recorded.current = false;
      }
    } else {
      setAnswer(randomAnswer(answer));
      setGuesses([]);
      setRevealed(0);
      recorded.current = false;
    }
    setCurrent('');
    setMessage('');
    setCelebrate(false);
    setUnlocked([]);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(
    () => guesses.map((g) => ({ word: g, states: evaluate(g, answer) })),
    [guesses, answer],
  );
  // Keyboard colours only include rows the player has SEEN revealed.
  const keyStates = useMemo(() => {
    let map: Record<string, TileState> = {};
    for (const r of rows.slice(0, revealed)) map = mergeKeyStates(map, r.word, r.states);
    return map;
  }, [rows, revealed]);

  const won = guesses.length > 0 && guesses[guesses.length - 1] === answer;
  const lost = !won && guesses.length >= MAX_GUESSES;
  const done = won || lost;
  const doneRevealed = done && revealed >= guesses.length;

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.timing(shakeAnim, {
      toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: true,
    }).start();
  };

  const flash = (msg: string) => {
    setMessage(msg);
    shake();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setTimeout(() => setMessage(''), 1600);
  };

  const onKey = (k: string) => {
    if (done || current.length >= WORD_LENGTH) return;
    playSound('tap', 0.3);
    Haptics.selectionAsync().catch(() => {});
    setCurrent((c) => c + k);
  };
  const onDelete = () => {
    if (done) return;
    playSound('tap', 0.2);
    setCurrent((c) => c.slice(0, -1));
  };

  const onEnter = () => {
    if (done) return;
    if (current.length < WORD_LENGTH) return flash('Not enough letters');
    if (!isValidWord(current)) return flash('Not in word list');

    const next = [...guesses, current];
    const didWin = current === answer;
    const didLose = !didWin && next.length >= MAX_GUESSES;
    setGuesses(next);
    setCurrent('');
    playSound('flip', 0.5);

    // Record the result immediately (persistence + achievements)…
    let newly: GameAchievement[] = [];
    if (mode === 'daily') {
      saveProgress(daily.day, next);
      if ((didWin || didLose) && !recorded.current) {
        recorded.current = true;
        newly = recordResult(daily.day, next, didWin);
      }
    } else if ((didWin || didLose) && !recorded.current) {
      recorded.current = true;
      newly = recordPractice(didWin, next.length);
    }
    if (newly.length) setUnlocked(newly);

    // …but let the player watch the flip before the outcome lands.
    setTimeout(() => {
      setRevealed(next.length);
      if (didWin) {
        playSound('win', 0.8);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setMessage(pickWinLine(next.length));
        setTimeout(() => setCelebrate(true), 500);
      } else if (didLose) {
        playSound('lose', 0.6);
        setMessage(`The word was ${answer.toUpperCase()}`);
        setTimeout(() => setCelebrate(true), 500);
      }
    }, REVEAL_TOTAL);
  };

  /** Restart — only offered once the round is complete; never repeats the word. */
  const newRound = () => {
    const fresh = randomAnswer(answer);
    setAnswer(fresh);
    setGuesses([]);
    setRevealed(0);
    setCurrent('');
    setMessage('');
    setCelebrate(false);
    setUnlocked([]);
    recorded.current = false;
    if (mode === 'daily') setMode('practice');
    playSound('tap', 0.4);
  };

  const playedTotal = games.clarityPlayed + games.clarityPracticePlayed;
  const wonTotal = games.clarityWon + games.clarityPracticeWon;
  const winRate = playedTotal ? Math.round((wonTotal / playedTotal) * 100) : 0;

  const shakeX = shakeAnim.interpolate({
    inputRange: [0, 0.15, 0.35, 0.55, 0.75, 0.9, 1],
    outputRange: [0, -9, 8, -6, 5, -3, 0],
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <BackButton />
          <Text variant="title2" style={{ flex: 1 }}>Clarity</Text>
          {mode === 'daily' ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="caption" dim>Daily #{daily.day}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="flame" size={11} color={theme.color.primary} />
                <Text variant="caption" color={theme.color.primary}>Streak {games.clarityStreak}</Text>
              </View>
            </View>
          ) : doneRevealed ? (
            <Pressable
              onPress={newRound}
              hitSlop={10}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="refresh" size={16} color={theme.color.primary} />
              <Text variant="footnote" color={theme.color.primary}>New word</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Mode toggle */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md }}>
          {(['daily', 'practice'] as const).map((m) => {
            const on = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => mode !== m && setMode(m)}
                style={({ pressed }) => ({
                  flex: 1, height: 38, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text variant="footnote" color={on ? theme.color.onPrimary : theme.color.text}>
                  {m === 'daily' ? 'Daily' : 'Practice'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Board */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg }}>
          <View style={{ width: '100%', maxWidth: 340, gap: 6 }}>
            {Array.from({ length: MAX_GUESSES }).map((_, r) => {
              const submitted = rows[r];
              const isCurrentRow = r === guesses.length && !done;
              const rowRevealed = r < revealed;
              const isWinRow = doneRevealed && won && r === guesses.length - 1;
              return (
                <Animated.View
                  key={r}
                  style={{
                    flexDirection: 'row', gap: 6,
                    transform: [{ translateX: isCurrentRow ? shakeX : 0 }],
                  }}
                >
                  {Array.from({ length: WORD_LENGTH }).map((__, c) => {
                    if (submitted) {
                      return (
                        <FlipTile
                          key={`${r}-${c}`}
                          letter={submitted.word[c]}
                          state={submitted.states[c]}
                          delay={c * FLIP_STAGGER}
                          instant={rowRevealed}
                          bounce={isWinRow ? c : null}
                        />
                      );
                    }
                    return (
                      <TypeTile key={`${r}-${c}`} letter={isCurrentRow ? current[c] ?? '' : ''} />
                    );
                  })}
                </Animated.View>
              );
            })}
          </View>

          {/* Message */}
          <View style={{ height: 30, justifyContent: 'center', marginTop: spacing.md }}>
            {message ? (
              <Text variant="callout" color={won ? theme.color.success : theme.color.text}>{message}</Text>
            ) : null}
          </View>
        </View>

        {/* Keyboard — swapped for round actions once the round completes */}
        {doneRevealed ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginBottom: spacing.sm }}>
              <MiniStat label="Streak" value={`${games.clarityStreak}`} />
              <MiniStat label="Win rate" value={`${winRate}%`} />
              <MiniStat label="Solved" value={`${wonTotal}`} />
            </View>
            <Pressable
              onPress={newRound}
              style={({ pressed }) => ({
                height: 52, borderRadius: radius.button, backgroundColor: theme.color.primary,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Ionicons name="refresh" size={18} color={theme.color.onPrimary} />
              <Text variant="headline" color={theme.color.onPrimary}>
                {mode === 'daily' ? 'Keep playing — practice word' : 'New word'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.md, gap: 6 }}>
            {KEYS.map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
                {ri === 2 && <Key label="ENTER" flex={1.6} onPress={onEnter} />}
                {row.split('').map((k) => (
                  <Key key={k} label={k} state={keyStates[k]} onPress={() => onKey(k)} />
                ))}
                {ri === 2 && <Key label="⌫" flex={1.6} onPress={onDelete} />}
              </View>
            ))}
          </View>
        )}
      </SafeAreaView>

      {/* End-of-round celebration */}
      <GameCelebration
        visible={celebrate}
        tone={won ? 'win' : 'neutral'}
        title={won ? pickWinLine(guesses.length) : 'So close'}
        subtitle={won ? `You found ${answer.toUpperCase()} in ${guesses.length}/${MAX_GUESSES}.` : `The word was ${answer.toUpperCase()}. Every guess sharpens you.`}
        stats={[
          { label: 'Guesses', value: `${guesses.length}/${MAX_GUESSES}` },
          { label: 'Streak', value: `${games.clarityStreak}` },
          { label: 'Win rate', value: `${winRate}%` },
        ]}
        unlocked={unlocked}
        hint={nextAchievementHint('clarity', games, games.achievements)}
        primary={{ label: mode === 'daily' ? 'Practice a new word' : 'New word', onPress: newRound }}
        secondary={{ label: 'View board', onPress: () => setCelebrate(false) }}
        onShareAchievement={(a) => {
          setCelebrate(false);
          router.push({ pathname: '/share-achievement', params: { id: a.id } });
        }}
      />
    </View>
  );
}

function pickWinLine(tries: number): string {
  return ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][Math.min(tries - 1, 5)];
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function tileBg(state: TileState, dark: boolean): string {
  if (state === 'correct') return GREEN;
  if (state === 'present') return YELLOW;
  return dark ? GRAY_DARK : GRAY_LIGHT;
}

/** Empty/typing tile — pops softly when a letter lands in it. */
function TypeTile({ letter }: { letter: string }) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!letter) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.09, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [letter, scale]);

  return (
    <Animated.View
      style={{
        flex: 1, aspectRatio: 1, borderRadius: radius.chip,
        backgroundColor: theme.color.surface,
        borderWidth: 2,
        borderColor: letter ? theme.color.textDim : theme.color.hairline,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale }],
      }}
    >
      <Text variant="title2" color={theme.color.text} style={{ textTransform: 'uppercase', fontSize: 26 }}>
        {letter}
      </Text>
    </Animated.View>
  );
}

/** Submitted tile — flips to reveal its colour (instant when resuming). */
function FlipTile({
  letter, state, delay, instant, bounce,
}: {
  letter: string;
  state: TileState;
  delay: number;
  instant: boolean;
  /** Column index for the win bounce, or null. */
  bounce: number | null;
}) {
  const theme = useTheme();
  const dark = theme.mode === 'dark';
  const [shown, setShown] = useState(instant);
  const flip = useRef(new Animated.Value(instant ? 1 : 0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const bounced = useRef(false);

  useEffect(() => {
    if (instant || shown) return;
    Animated.timing(flip, {
      toValue: 0.5, duration: FLIP_DURATION / 2, delay,
      easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => {
      setShown(true);
      Animated.timing(flip, {
        toValue: 1, duration: FLIP_DURATION / 2,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gentle staggered hop for the winning row.
  useEffect(() => {
    if (bounce == null || bounced.current) return;
    bounced.current = true;
    Animated.sequence([
      Animated.delay(120 + bounce * 90),
      Animated.timing(jump, { toValue: -12, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(jump, { toValue: 0, duration: 200, easing: Easing.bounce, useNativeDriver: true }),
    ]).start();
  }, [bounce, jump]);

  const rotateX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] });

  return (
    <Animated.View
      style={{
        flex: 1, aspectRatio: 1, borderRadius: radius.chip,
        backgroundColor: shown ? tileBg(state, dark) : theme.color.surface,
        borderWidth: shown ? 0 : 2,
        borderColor: theme.color.textDim,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ perspective: 500 }, { rotateX }, { translateY: jump }],
      }}
    >
      <Text
        variant="title2"
        color={shown ? '#FFFFFF' : theme.color.text}
        style={{ textTransform: 'uppercase', fontSize: 26 }}
      >
        {letter}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

function Key({ label, state, onPress, flex = 1 }: { label: string; state?: TileState; onPress: () => void; flex?: number }) {
  const theme = useTheme();
  const dark = theme.mode === 'dark';
  const bg =
    state === 'correct' ? GREEN
    : state === 'present' ? YELLOW
    : state === 'absent' ? (dark ? '#26202E' : '#B9AFC2')
    : theme.color.surfaceAlt;
  const color = state ? '#FFFFFF' : theme.color.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex, height: 52, borderRadius: 8, backgroundColor: bg,
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Text variant={label.length > 1 ? 'caption' : 'headline'} color={color} style={{ textTransform: 'uppercase' }}>{label}</Text>
    </Pressable>
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
