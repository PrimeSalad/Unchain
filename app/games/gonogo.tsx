/**
 * Go / No-Go Challenge — evidence-based inhibitory-control training wrapped
 * in an arcade shell. Green circle = tap fast; red circle = hold back. The
 * response window shrinks and the pacing gets less predictable as levels
 * climb. Combos, focus hearts, a daily challenge, and achievements keep it a
 * game rather than a clinical task.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { BackButton } from '@/presentation/components/BackButton';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { GameTutorial, TutorialInfoButton, useGameTutorial } from '@/presentation/components/games/GameTutorial';
import {
  ChallengeChip,
  ComboBadge,
  Countdown,
  HudStat,
  LivesRow,
  PointsFloat,
} from '@/presentation/components/games/InhibitionHUD';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { playSound } from '@/application/sound';
import { nextAchievementHint, type GameAchievement } from '@/domain/games/achievements';
import {
  GAP_JITTER_MS,
  LIVES,
  NOGO_PROBABILITY,
  challengeDayNumber,
  dailyChallengeTarget,
  goPoints,
  gonogoGapMs,
  gonogoWindowMs,
  levelForTrial,
  holdPoints,
  summarize,
} from '@/domain/games/inhibition';

// A crash inside the game must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

const GO_COLOR = '#4E9B5E';
const NOGO_COLOR = '#D9534F';

type Phase = 'idle' | 'countdown' | 'playing' | 'over';

interface Trial {
  isGo: boolean;
  shownAt: number;
  windowMs: number;
  handled: boolean;
}

export default function GoNoGo() {
  const theme = useTheme();
  const router = useRouter();
  const games = useStore((s) => s.games);
  const recordInhibition = useStore((s) => s.recordInhibition);
  const completeMission = useStore((s) => s.completeMission);
  const tutorial = useGameTutorial('gonogo');
  const { width } = useWindowDimensions();
  const circleSize = Math.min(190, width * 0.46);

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [level, setLevel] = useState(1);
  const [stimulus, setStimulus] = useState<'go' | 'nogo' | null>(null);
  const [float, setFloat] = useState<{ amount: number; id: number } | null>(null);
  const [verdict, setVerdict] = useState<'good' | 'bad' | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [result, setResult] = useState<{
    unlocked: GameAchievement[]; pointsEarned: number; newBest: boolean; challengeCompleted: boolean;
    accuracy: number; avgReactionMs: number; maxCombo: number; finalScore: number;
  } | null>(null);

  // Round bookkeeping in refs — timers read these without stale closures.
  const trialRef = useRef<Trial | null>(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const livesRef = useRef(LIVES);
  const trialsRef = useRef(0);
  const correctRef = useRef(0);
  const maxComboRef = useRef(0);
  const reactionsRef = useRef<number[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const overRef = useRef(false);

  // Stimulus entrance / verdict flash animation plumbing (stable values).
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  const after = useCallback((ms: number, fn: () => void) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const endRound = useCallback(() => {
    if (overRef.current) return;
    overRef.current = true;
    clearTimers();
    setStimulus(null);
    setPhase('over');
    const summary = summarize(
      scoreRef.current, trialsRef.current, correctRef.current, maxComboRef.current, reactionsRef.current,
    );
    const r = recordInhibition('gonogo', summary);
    completeMission('play_game');
    setResult({
      ...r,
      accuracy: summary.accuracy,
      avgReactionMs: summary.avgReactionMs,
      maxCombo: summary.maxCombo,
      finalScore: summary.score,
    });
    playSound(r.newBest ? 'win' : 'lose', r.newBest ? 0.8 : 0.5);
    Haptics.notificationAsync(
      r.newBest ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    setTimeout(() => setCelebrate(true), 550);
  }, [clearTimers, recordInhibition, completeMission]);

  /** Verdict flash: green pulse for correct, red shake-ish flash for wrong. */
  const flashVerdict = useCallback((good: boolean) => {
    setVerdict(good ? 'good' : 'bad');
    ring.setValue(1);
    Animated.timing(ring, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [ring]);

  const loseLife = useCallback(() => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    comboRef.current = 0;
    setCombo(0);
    playSound('lose', 0.45);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    flashVerdict(false);
    if (livesRef.current <= 0) after(500, endRound);
  }, [after, endRound, flashVerdict]);

  const scoreCorrect = useCallback((points: number, sound: 'place' | 'clear') => {
    comboRef.current += 1;
    setCombo(comboRef.current);
    maxComboRef.current = Math.max(maxComboRef.current, comboRef.current);
    correctRef.current += 1;
    scoreRef.current += points;
    setScore(scoreRef.current);
    setFloat({ amount: points, id: Date.now() });
    playSound(sound, 0.6);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    flashVerdict(true);
  }, [flashVerdict]);

  const hideStimulus = useCallback(() => {
    setStimulus(null);
    trialRef.current = null;
  }, []);

  const scheduleNext = useCallback(() => {
    if (overRef.current || livesRef.current <= 0) return;
    const lvl = levelForTrial(trialsRef.current);
    setLevel(lvl);
    const gap = gonogoGapMs(lvl) + Math.random() * GAP_JITTER_MS;
    after(gap, () => {
      if (overRef.current) return;
      const isGo = Math.random() > NOGO_PROBABILITY;
      const windowMs = gonogoWindowMs(lvl);
      trialRef.current = { isGo, shownAt: Date.now(), windowMs, handled: false };
      setStimulus(isGo ? 'go' : 'nogo');
      pop.setValue(0.3);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 260 }).start();

      // Window closes: a missed GO costs a life; a withheld NO-GO scores.
      after(windowMs, () => {
        const t = trialRef.current;
        if (!t || t.handled || overRef.current) return;
        t.handled = true;
        trialsRef.current += 1;
        if (t.isGo) {
          loseLife();
        } else {
          scoreCorrect(holdPoints(comboRef.current), 'clear');
        }
        hideStimulus();
        scheduleNext();
      });
    });
  }, [after, hideStimulus, loseLife, pop, scoreCorrect]);

  const onTap = useCallback(() => {
    if (phase !== 'playing') return;
    const t = trialRef.current;
    if (!t || t.handled) return; // taps between stimuli are simply ignored
    t.handled = true;
    trialsRef.current += 1;
    if (t.isGo) {
      const rt = Date.now() - t.shownAt;
      reactionsRef.current.push(rt);
      scoreCorrect(goPoints(rt, t.windowMs, comboRef.current), 'place');
    } else {
      loseLife();
    }
    hideStimulus();
    scheduleNext();
  }, [phase, hideStimulus, loseLife, scheduleNext, scoreCorrect]);

  const start = () => {
    clearTimers();
    overRef.current = false;
    trialRef.current = null;
    scoreRef.current = 0; setScore(0);
    comboRef.current = 0; setCombo(0);
    livesRef.current = LIVES; setLives(LIVES);
    trialsRef.current = 0;
    correctRef.current = 0;
    maxComboRef.current = 0;
    reactionsRef.current = [];
    setLevel(1);
    setStimulus(null);
    setFloat(null);
    setVerdict(null);
    setCelebrate(false);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase('countdown');
  };

  const day = challengeDayNumber();
  const target = dailyChallengeTarget(games.gonogoBest, day);
  const challengeDone = (games.challengeDoneDay['gonogo'] ?? -1) === day;

  const ringStyle = {
    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }],
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <BackButton fallback="/games" />
          <Text variant="title2" style={{ flex: 1 }}>Go / No-Go</Text>
          <TutorialInfoButton onPress={tutorial.open} />
          <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>
            Best {games.gonogoBest.toLocaleString()}
          </Text>
        </View>

        {/* HUD */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <HudStat label="Score" value={score.toLocaleString()} />
          <HudStat label="Level" value={`${level}`} />
          <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, padding: spacing.md, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Text variant="footnote" dim>Focus</Text>
            <LivesRow lives={lives} />
          </View>
        </View>
        <View style={{ paddingTop: spacing.sm, gap: spacing.xs }}>
          <ComboBadge combo={combo} />
          <ChallengeChip target={target} done={challengeDone} />
        </View>

        {/* Play area */}
        <Pressable
          onPress={onTap}
          disabled={phase !== 'playing'}
          accessibilityLabel={
            stimulus === 'go' ? 'Green circle — tap now'
            : stimulus === 'nogo' ? 'Red circle — do not tap'
            : 'Play area'
          }
          style={{ flex: 1 }}
        >
          {phase === 'countdown' ? (
            <Countdown onDone={() => { setPhase('playing'); scheduleNext(); }} />
          ) : phase === 'playing' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {/* Verdict ring */}
              {verdict && (
                <Animated.View
                  pointerEvents="none"
                  style={[{
                    position: 'absolute',
                    width: circleSize * 1.5, height: circleSize * 1.5, borderRadius: circleSize,
                    borderWidth: 4,
                    borderColor: verdict === 'good' ? theme.color.success : theme.color.danger,
                  }, ringStyle]}
                />
              )}
              {stimulus ? (
                <Animated.View
                  style={{
                    width: circleSize, height: circleSize, borderRadius: circleSize / 2,
                    backgroundColor: stimulus === 'go' ? GO_COLOR : NOGO_COLOR,
                    alignItems: 'center', justifyContent: 'center',
                    transform: [{ scale: pop }],
                    shadowColor: stimulus === 'go' ? GO_COLOR : NOGO_COLOR,
                    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
                  }}
                >
                  <Ionicons name={stimulus === 'go' ? 'flash' : 'close'} size={54} color="#FFFFFF" />
                  <Text variant="headline" color="#FFFFFF" style={{ marginTop: 2 }}>
                    {stimulus === 'go' ? 'TAP!' : "DON'T"}
                  </Text>
                </Animated.View>
              ) : (
                <Text variant="callout" dim>Get ready…</Text>
              )}
              {float && <PointsFloat amount={float.amount} id={float.id} />}
            </View>
          ) : (
            /* Idle / over — start panel */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg }}>
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: GO_COLOR, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="flash" size={30} color="#FFF" />
                  </View>
                  <Text variant="footnote" color={theme.color.success}>Green — tap</Text>
                </View>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: NOGO_COLOR, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={30} color="#FFF" />
                  </View>
                  <Text variant="footnote" color={theme.color.danger}>Red — hold back</Text>
                </View>
              </View>
              <Text variant="callout" dim center style={{ lineHeight: 22 }}>
                Tap green the instant it appears. When red shows, do nothing — even mid-reach.
                The pace climbs every level.
              </Text>
              <Pressable
                onPress={start}
                accessibilityRole="button"
                accessibilityLabel="Start round"
                style={({ pressed }) => ({
                  height: 54, paddingHorizontal: spacing.xxl, borderRadius: radius.button,
                  backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: spacing.sm,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Ionicons name="play" size={18} color={theme.color.onPrimary} />
                <Text variant="headline" color={theme.color.onPrimary}>
                  {phase === 'over' ? 'Play again' : 'Start'}
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </SafeAreaView>

      {/* How to play */}
      <GameTutorial game="gonogo" visible={tutorial.visible} showOptOut={tutorial.auto} onClose={tutorial.close} />

      {/* Results */}
      <GameCelebration
        visible={celebrate}
        tone={result?.newBest ? 'win' : 'neutral'}
        title={result?.newBest ? 'New best score!' : 'Round complete'}
        subtitle={
          result
            ? `+${result.pointsEarned} Recovery Points${result.challengeCompleted ? ' · Daily challenge complete!' : ''}`
            : undefined
        }
        score={{ label: 'Final score', value: result?.finalScore ?? score }}
        stats={[
          { label: 'Accuracy', value: `${Math.round((result?.accuracy ?? 0) * 100)}%` },
          { label: 'Avg reaction', value: result?.avgReactionMs ? `${result.avgReactionMs} ms` : '—' },
          { label: 'Best combo', value: `${result?.maxCombo ?? 0}` },
        ]}
        unlocked={result?.unlocked ?? []}
        hint={nextAchievementHint('gonogo', games, games.achievements)}
        primary={{ label: 'Play again', onPress: () => { setCelebrate(false); start(); } }}
        secondary={{ label: 'Done', onPress: () => setCelebrate(false) }}
        onShareAchievement={(a) => {
          setCelebrate(false);
          router.push({ pathname: '/share-achievement', params: { id: a.id } });
        }}
      />
    </View>
  );
}
