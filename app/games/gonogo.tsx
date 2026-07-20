/**
 * Go / No-Go Challenge - evidence-based inhibitory-control training wrapped
 * in an arcade shell. Green circle = tap fast; red circle = hold back. The
 * response window shrinks and the pacing gets less predictable as levels
 * climb. Combos, focus hearts, a daily challenge, and achievements keep it a
 * game rather than a clinical task.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/presentation/components/Text';
import { BackButton } from '@/presentation/components/BackButton';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { GameLoadingScreen, useGameLoading } from '@/presentation/components/games/GameLoadingScreen';
import { GameTutorial, TutorialInfoButton, useGameTutorial } from '@/presentation/components/games/GameTutorial';
import {
  ChallengeChip,
  ComboBadge,
  Countdown,
  LivesRow,
  PointsFloat,
} from '@/presentation/components/games/InhibitionHUD';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useStore } from '@/application/store';
import { playSound } from '@/application/sound';
import { nextAchievementHint, type GameAchievement } from '@/domain/games/achievements';
import { useReducedMotion } from '@/presentation/hooks/useReducedMotion';
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
  pausedRoundResumeAction,
  summarize,
} from '@/domain/games/inhibition';

// A crash inside the game must never take navigation down with it.
export { GamesErrorBoundary as ErrorBoundary } from '@/presentation/components/games/GamesErrorBoundary';

const GO_COLOR = '#4E9B5E';
const NOGO_COLOR = '#D9534F';
const GO_SOFT = '#E4F2E7';
const NOGO_SOFT = '#F8E4E2';

type Phase = 'idle' | 'countdown' | 'playing' | 'paused' | 'over';
type Mode = 'standard' | 'extreme';

interface Trial {
  isGo: boolean;
  shownAt: number;
  windowMs: number;
  handled: boolean;
}

const MODE_CONFIG: Record<Mode, {
  label: string;
  sublabel: string;
  startLevel: number;
  windowShiftMs: number;
  gapShiftMs: number;
  noGoProbability: number;
  scoreBoost: number;
}> = {
  standard: {
    label: 'Standard',
    sublabel: 'Normal timing',
    startLevel: 1,
    windowShiftMs: 0,
    gapShiftMs: 0,
    noGoProbability: NOGO_PROBABILITY,
    scoreBoost: 1,
  },
  extreme: {
    label: 'Extreme',
    sublabel: 'Faster timing',
    startLevel: 4,
    windowShiftMs: -170,
    gapShiftMs: -130,
    noGoProbability: 0.38,
    scoreBoost: 1.35,
  },
};

export default function GoNoGo() {
  const theme = useTheme();
  const router = useRouter();
  const games = useStore((s) => s.games);
  const recordInhibition = useStore((s) => s.recordInhibition);
  const completeMission = useStore((s) => s.completeMission);
  const tutorial = useGameTutorial('gonogo');
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const isCompact = width < 380 || height < 700;
  const isTiny = width < 340 || height < 620;
  const circleSize = Math.floor(Math.min(isTiny ? 132 : isCompact ? 156 : 208, width * 0.5, height * 0.24));
  const previewHeight = isTiny ? 76 : isCompact ? 86 : 106;
  const goSoft = theme.mode === 'dark' ? '#203428' : GO_SOFT;
  const noGoSoft = theme.mode === 'dark' ? '#3A2428' : NOGO_SOFT;

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [level, setLevel] = useState(1);
  const [mode, setMode] = useState<Mode>('standard');
  const [stimulus, setStimulus] = useState<'go' | 'nogo' | null>(null);
  const [float, setFloat] = useState<{ amount: number; id: number } | null>(null);
  const [verdict, setVerdict] = useState<'good' | 'bad' | null>(null);
  const [status, setStatus] = useState('Choose a mode.');
  const [celebrate, setCelebrate] = useState(false);
  const [result, setResult] = useState<{
    unlocked: GameAchievement[]; pointsEarned: number; newBest: boolean; challengeCompleted: boolean;
    accuracy: number; avgReactionMs: number; maxCombo: number; finalScore: number;
  } | null>(null);

  // Round bookkeeping in refs - timers read these without stale closures.
  const trialRef = useRef<Trial | null>(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const livesRef = useRef(LIVES);
  const trialsRef = useRef(0);
  const correctRef = useRef(0);
  const maxComboRef = useRef(0);
  const reactionsRef = useRef<number[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const generationRef = useRef(0);
  const overRef = useRef(false);
  const terminalResultPendingRef = useRef(false);
  const modeRef = useRef<Mode>('standard');
  const phaseRef = useRef<Phase>('idle');
  const shouldResumeRef = useRef(false);

  // Stimulus entrance / verdict flash animation plumbing (stable values).
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const windowMeter = useRef(new Animated.Value(0)).current;

  const clearTimers = useCallback(() => {
    generationRef.current += 1;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  const after = useCallback((ms: number, fn: () => void) => {
    const generation = generationRef.current;
    const timer = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== timer);
      if (generation === generationRef.current) fn();
    }, ms);
    timersRef.current.push(timer);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const endRound = useCallback(() => {
    if (overRef.current) return;
    overRef.current = true;
    terminalResultPendingRef.current = false;
    shouldResumeRef.current = false;
    clearTimers();
    setStimulus(null);
    setStatus('Round complete.');
    setPhase('over');
    phaseRef.current = 'over';
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
    after(reduceMotion ? 0 : 550, () => setCelebrate(true));
  }, [after, clearTimers, recordInhibition, completeMission, reduceMotion]);

  /** Verdict flash: green pulse for correct, red shake-ish flash for wrong. */
  const flashVerdict = useCallback((good: boolean) => {
    setVerdict(good ? 'good' : 'bad');
    if (reduceMotion) {
      ring.setValue(0);
      return;
    }
    ring.setValue(1);
    Animated.timing(ring, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [ring, reduceMotion]);

  const loseLife = useCallback(() => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    comboRef.current = 0;
    setCombo(0);
    playSound('lose', 0.45);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    flashVerdict(false);
    if (livesRef.current <= 0) {
      terminalResultPendingRef.current = true;
      after(500, endRound);
    }
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
    windowMeter.stopAnimation();
    windowMeter.setValue(0);
    setStimulus(null);
    trialRef.current = null;
  }, [windowMeter]);

  const scheduleNext = useCallback(() => {
    if (overRef.current || livesRef.current <= 0) return;
    const config = MODE_CONFIG[modeRef.current];
    const lvl = levelForTrial(trialsRef.current) + config.startLevel - 1;
    setLevel(lvl);
    setStatus('Watch the center.');
    const gap = Math.max(240, gonogoGapMs(lvl) + config.gapShiftMs) + Math.random() * GAP_JITTER_MS;
    after(gap, () => {
      if (overRef.current) return;
      const activeConfig = MODE_CONFIG[modeRef.current];
      const isGo = Math.random() > activeConfig.noGoProbability;
      const windowMs = Math.max(420, gonogoWindowMs(lvl) + activeConfig.windowShiftMs);
      trialRef.current = { isGo, shownAt: Date.now(), windowMs, handled: false };
      setStimulus(isGo ? 'go' : 'nogo');
      setStatus(isGo ? 'Tap.' : 'Do not tap.');
      pop.setValue(reduceMotion ? 1 : 0.3);
      if (!reduceMotion) {
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 260 }).start();
      }
      windowMeter.setValue(1);
      Animated.timing(windowMeter, {
        toValue: 0,
        duration: windowMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      // Window closes: a missed GO costs a life; a withheld NO-GO scores.
      after(windowMs, () => {
        const t = trialRef.current;
        if (!t || t.handled || overRef.current) return;
        t.handled = true;
        trialsRef.current += 1;
        if (t.isGo) {
          setStatus('Miss.');
          loseLife();
        } else {
          const points = Math.round(holdPoints(comboRef.current) * MODE_CONFIG[modeRef.current].scoreBoost);
          setStatus('Correct hold.');
          scoreCorrect(points, 'clear');
        }
        hideStimulus();
        scheduleNext();
      });
    });
  }, [after, hideStimulus, loseLife, pop, scoreCorrect, reduceMotion]);

  const onTap = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const t = trialRef.current;
    if (!t || t.handled) return; // taps between stimuli are simply ignored
    windowMeter.stopAnimation();
    t.handled = true;
    trialsRef.current += 1;
    if (t.isGo) {
      const rt = Date.now() - t.shownAt;
      reactionsRef.current.push(rt);
      const points = Math.round(goPoints(rt, t.windowMs, comboRef.current) * MODE_CONFIG[modeRef.current].scoreBoost);
      setStatus('Correct tap.');
      scoreCorrect(points, 'place');
    } else {
      setStatus('Wrong tap.');
      loseLife();
    }
    hideStimulus();
    scheduleNext();
  }, [hideStimulus, loseLife, scheduleNext, scoreCorrect]);

  const start = () => {
    clearTimers();
    overRef.current = false;
    terminalResultPendingRef.current = false;
    shouldResumeRef.current = false;
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
    setStatus('Get ready.');
    setCelebrate(false);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPhase('countdown');
    phaseRef.current = 'countdown';
  };

  const pauseSession = useCallback(() => {
    if (phaseRef.current !== 'playing' && phaseRef.current !== 'countdown') return;
    shouldResumeRef.current = true;
    clearTimers();
    hideStimulus();
    pop.stopAnimation();
    ring.stopAnimation();
    setStatus('Paused. Get ready to resume.');
    setPhase('paused');
    phaseRef.current = 'paused';
  }, [clearTimers, hideStimulus, pop, ring]);

  const resumeSession = useCallback(() => {
    if (!shouldResumeRef.current || phaseRef.current !== 'paused' || tutorial.visible) return;
    shouldResumeRef.current = false;
    if (pausedRoundResumeAction(livesRef.current, terminalResultPendingRef.current) === 'finish') {
      endRound();
      return;
    }
    setStatus('Get ready.');
    setPhase('countdown');
    phaseRef.current = 'countdown';
  }, [endRound, tutorial.visible]);

  useEffect(() => {
    if (tutorial.visible) pauseSession();
    else resumeSession();
  }, [tutorial.visible, pauseSession, resumeSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') resumeSession();
      else pauseSession();
    });
    return () => subscription.remove();
  }, [pauseSession, resumeSession]);

  useFocusEffect(
    useCallback(() => {
      resumeSession();
      return pauseSession;
    }, [pauseSession, resumeSession]),
  );

  const day = challengeDayNumber();
  const target = dailyChallengeTarget(games.gonogoBest, day);
  const challengeDone = (games.challengeDoneDay['gonogo'] ?? -1) === day;

  const ringStyle = {
    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }],
  };
  const meterStyle = {
    width: windowMeter.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    backgroundColor: stimulus === 'nogo' ? NOGO_COLOR : GO_COLOR,
  };
  const activeColor = stimulus === 'nogo' ? NOGO_COLOR : GO_COLOR;
  const activeSoft = stimulus === 'nogo' ? noGoSoft : goSoft;
  const modeConfig = MODE_CONFIG[mode];
  const loading = useGameLoading();

  if (loading) {
    return <GameLoadingScreen title="Go / No-Go" subtitle="Calibrating the round" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg, overflow: 'hidden' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: isCompact ? 2 : spacing.sm, paddingBottom: isCompact ? spacing.xs : spacing.sm }}>
          <BackButton fallback="/games" confirmExit />
          <View style={{ flex: 1 }}>
            <Text variant="headline">Go / No-Go</Text>
            <Text variant="caption" dim>{modeConfig.label} reflex round</Text>
          </View>
          <TutorialInfoButton onPress={tutorial.open} />
        </View>

        {/* Stats bar — Score | Level | Focus */}
        <View style={{
          flexDirection: 'row',
          marginHorizontal: spacing.lg,
          marginTop: isCompact ? 2 : spacing.xs,
          borderRadius: radius.chip,
          backgroundColor: theme.color.surfaceAlt,
          overflow: 'hidden',
        }}>
          {/* Score */}
          <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center', paddingVertical: isCompact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Score</Text>
            <Text variant="headline" color={theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>{score.toLocaleString()}</Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: isCompact ? 6 : 8 }} />

          {/* Level */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: isCompact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Level</Text>
            <Text variant="headline" color={theme.color.text}>{level}</Text>
          </View>

          {/* Divider */}
          <View style={{ width: 1, backgroundColor: theme.color.hairline, marginVertical: isCompact ? 6 : 8 }} />

          {/* Focus */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: isCompact ? 6 : 10 }}>
            <Text variant="caption" dim style={{ marginBottom: 2 }}>Focus</Text>
            <LivesRow lives={lives} />
          </View>
        </View>
        <View style={{ paddingTop: isCompact ? spacing.xs : spacing.sm, gap: spacing.xs }}>
          <ComboBadge combo={combo} />
          <ChallengeChip target={target} done={challengeDone} />
        </View>

        <Pressable
          onPress={onTap}
          disabled={phase !== 'playing'}
          accessibilityRole="button"
          accessibilityState={{ disabled: phase !== 'playing' }}
          accessibilityHint="Tap only when the visible command says TAP."
          accessibilityLabel={
            stimulus === 'go' ? 'Green circle - tap now'
            : stimulus === 'nogo' ? 'Red circle - do not tap'
            : 'Play area'
          }
          style={{ flex: 1 }}
        >
          {phase === 'countdown' ? (
            <Countdown onDone={() => { setPhase('playing'); phaseRef.current = 'playing'; scheduleNext(); }} />
          ) : phase === 'playing' ? (
            <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: isCompact ? spacing.xs : spacing.md, paddingBottom: isCompact ? spacing.xs : spacing.lg }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.sheet,
                  backgroundColor: theme.color.surface,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isCompact ? spacing.md : spacing.lg,
                  overflow: 'hidden',
                }}
              >
                <View style={{ width: '100%', gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                    <Text variant="footnote" color={activeColor} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                      {stimulus === 'nogo' ? 'NO-GO' : stimulus === 'go' ? 'GO' : 'WAIT'}
                    </Text>
                    <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
                      Best {games.gonogoBest.toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 999, backgroundColor: theme.color.surfaceAlt, overflow: 'hidden' }}>
                    <Animated.View style={[{ height: '100%', borderRadius: 999 }, meterStyle]} />
                  </View>
                </View>

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

                <View style={{ alignItems: 'center', justifyContent: 'center', gap: isCompact ? spacing.md : spacing.lg }}>
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      width: circleSize * 1.55,
                      height: circleSize * 1.55,
                      borderRadius: circleSize,
                      backgroundColor: stimulus ? activeSoft : theme.color.surfaceAlt,
                      opacity: theme.mode === 'dark' ? 0.18 : 1,
                    }}
                  />
                  <Animated.View
                  style={{
                    width: circleSize, height: circleSize, borderRadius: circleSize / 2,
                    backgroundColor: stimulus ? activeColor : theme.color.surfaceAlt,
                    alignItems: 'center', justifyContent: 'center',
                    transform: [{ scale: stimulus ? pop : 1 }],
                    shadowColor: stimulus ? activeColor : theme.color.text,
                    shadowOffset: { width: 0, height: 10 }, shadowOpacity: stimulus ? 0.32 : 0.08, shadowRadius: 20, elevation: stimulus ? 10 : 2,
                  }}
                >
                    <Ionicons name={stimulus === 'go' ? 'radio-button-on' : stimulus === 'nogo' ? 'close' : 'ellipse-outline'} size={isCompact ? 40 : 58} color={stimulus ? '#FFFFFF' : theme.color.textDim} />
                    <Text variant="headline" color={stimulus ? '#FFFFFF' : theme.color.textDim} style={{ marginTop: 4, fontFamily: 'Nunito_900Black' }}>
                    {stimulus === 'go' ? 'TAP' : stimulus === 'nogo' ? 'HOLD' : 'WAIT'}
                  </Text>
                </Animated.View>
                </View>

                <View style={{ width: '100%', gap: spacing.md }}>
                  <View
                    style={{
                      minHeight: isCompact ? 44 : 54,
                      borderRadius: radius.button,
                      backgroundColor: stimulus ? activeSoft : theme.color.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: spacing.lg,
                    }}
                  >
                    <Text variant="callout" color={stimulus ? activeColor : theme.color.textDim} center style={{ fontFamily: 'Nunito_700Bold' }}>
                      {status}
                    </Text>
                  </View>
                  <Text variant="caption" dim center>
                    Tap anywhere for green. Do nothing for red.
                  </Text>
                </View>
              {float && <PointsFloat amount={float.amount} id={float.id} />}
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: isCompact ? spacing.xs : spacing.md, paddingBottom: isCompact ? spacing.xs : spacing.lg, justifyContent: 'space-between', gap: isCompact ? spacing.sm : spacing.lg }}>
              <View style={{ gap: isCompact ? spacing.sm : spacing.md }}>
                <View style={{ alignItems: 'center', gap: spacing.xs }}>
                  <Text variant="headline" center style={{ fontSize: isCompact ? 23 : 28, lineHeight: isCompact ? 28 : 34, fontFamily: 'Nunito_900Black' }}>
                    Reflex Control
                  </Text>
                  <Text variant="footnote" dim center style={{ maxWidth: 340, lineHeight: 19 }}>
                    Fast on green. Still on red. Keep your focus points alive.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <CommandPreview
                    height={previewHeight}
                    bg={goSoft}
                    color={GO_COLOR}
                    icon="radio-button-on"
                    label="GREEN"
                    command="TAP"
                  />
                  <CommandPreview
                    height={previewHeight}
                    bg={noGoSoft}
                    color={NOGO_COLOR}
                    icon="close"
                    label="RED"
                    command="HOLD"
                  />
                </View>
              </View>

              <View style={{ gap: isCompact ? spacing.sm : spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {(Object.keys(MODE_CONFIG) as Mode[]).map((m) => {
                    const selected = mode === m;
                    const hard = m === 'extreme';
                    return (
                      <Pressable
                        key={m}
                        onPress={() => {
                          setMode(m);
                          setStatus(`${MODE_CONFIG[m].label} selected.`);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${MODE_CONFIG[m].label} mode`}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: isCompact ? 74 : 98,
                          borderRadius: radius.card,
                          backgroundColor: selected ? (hard ? noGoSoft : goSoft) : theme.color.surface,
                          borderWidth: 2,
                          borderColor: selected ? (hard ? NOGO_COLOR : GO_COLOR) : theme.color.hairline,
                          padding: isCompact ? spacing.sm : spacing.md,
                          justifyContent: 'space-between',
                          opacity: pressed ? 0.78 : 1,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                          <Ionicons name={hard ? 'speedometer' : 'radio-button-on'} size={20} color={hard ? NOGO_COLOR : GO_COLOR} />
                          {selected && <Ionicons name="checkmark-circle" size={18} color={hard ? NOGO_COLOR : GO_COLOR} />}
                        </View>
                        <View>
                          <Text variant="callout" color={hard ? NOGO_COLOR : GO_COLOR} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{MODE_CONFIG[m].label}</Text>
                          <Text variant="caption" dim>{MODE_CONFIG[m].sublabel}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <SignalKey color={GO_COLOR} icon="radio-button-on" label="Tap green" />
                  <SignalKey color={NOGO_COLOR} icon="close" label="Hold red" />
                  <SignalKey color={theme.color.primary} icon="heart" label="3 focus" />
                </View>
              </View>

              <Pressable
                onPress={start}
                accessibilityRole="button"
                accessibilityLabel="Start round"
                style={({ pressed }) => ({
                  minHeight: isCompact ? 50 : 58, paddingHorizontal: spacing.xxl, borderRadius: radius.button,
                  backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: spacing.sm,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Ionicons name="play" size={18} color={theme.color.onPrimary} />
                <Text variant="callout" color={theme.color.onPrimary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                  {phase === 'over' ? 'Play again' : `Start ${modeConfig.label}`}
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
          { label: 'Avg reaction', value: result?.avgReactionMs ? `${result.avgReactionMs} ms` : '-' },
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

function SignalKey({
  color,
  icon,
  label,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <Text variant="caption" dim center>{label}</Text>
    </View>
  );
}

function CommandPreview({
  height,
  bg,
  color,
  icon,
  label,
  command,
}: {
  height: number;
  bg: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  command: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: height,
        borderRadius: radius.card,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: color + '55',
        padding: spacing.md,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="caption" color={color} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
          {label}
        </Text>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text variant="headline" color={color} style={{ fontFamily: 'Nunito_900Black' }}>
        {command}
      </Text>
    </View>
  );
}
