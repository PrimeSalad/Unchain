/**
 * Pomodoro - recovery focus timer.
 * Route: /one-more-minute
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore } from '@/application/store';
import { playSound } from '@/application/sound';
import {
  PRESET_DURATIONS,
  randomMotivationalMessage,
  computeStats,
  OMM_ACHIEVEMENTS,
  ommAchievementById,
  type OneMoreMinuteAchievement,
} from '@/domain/oneMoreMinute';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ── Helpers ───────────────────────────────────────────────────────────────

type TimerMode = 'focus' | 'short_break' | 'long_break';

const TIMER_MODES: Array<{ id: TimerMode; label: string; minutes: number; icon: string }> = [
  { id: 'focus', label: 'Focus', minutes: 25, icon: 'flash' },
  { id: 'short_break', label: 'Short break', minutes: 5, icon: 'cafe' },
  { id: 'long_break', label: 'Long break', minutes: 15, icon: 'leaf' },
];

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// ── Circular progress ─────────────────────────────────────────────────────

function PomodoroRing({ progress, size, color }: { progress: number; size: number; color: string }) {
  const theme = useTheme();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: theme.color.surfaceAlt,
      }} />
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 8, borderColor: 'transparent',
        borderTopColor: color,
        borderRightColor: progress > 0.25 ? color : 'transparent',
        borderBottomColor: progress > 0.5 ? color : 'transparent',
        borderLeftColor: progress > 0.75 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────

export default function PomodoroTimer() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const safeBack = useSafeBack();
  const completeOmmSession = useStore((s) => s.completeOmmSession);
  const ommSessions = useStore((s) => s.ommSessions);
  const ommAchievements = useStore((s) => s.ommAchievements);

  const stats = computeStats(ommSessions);

  type Phase = 'setup' | 'running' | 'paused' | 'done';
  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<TimerMode>('focus');
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [remaining, setRemaining] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [message, setMessage] = useState(randomMotivationalMessage());
  const [sessionStartedAt, setSessionStartedAt] = useState(0);
  const [completedToday, setCompletedToday] = useState(stats.todaySessions);
  const [showCelebration, setShowCelebration] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<OneMoreMinuteAchievement[]>([]);

  const endAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const messageRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const modeMeta = TIMER_MODES.find((item) => item.id === mode) ?? TIMER_MODES[0];
  const ringSize = Math.max(176, Math.min(280, width - spacing.huge, height * 0.36));
  const timerFont = Math.max(42, Math.min(62, width * 0.15));
  const durationOptions = Array.from(new Set([modeMeta.minutes, ...PRESET_DURATIONS])).sort((a, b) => a - b);

  const chooseMode = (next: TimerMode) => {
    const selected = TIMER_MODES.find((item) => item.id === next) ?? TIMER_MODES[0];
    Haptics.selectionAsync().catch(() => {});
    setMode(next);
    setSelectedMinutes(selected.minutes);
  };

  useEffect(() => {
    if (phase !== 'running') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        handleComplete();
      }
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running') {
      if (messageRef.current) clearInterval(messageRef.current);
      return;
    }
    messageRef.current = setInterval(() => setMessage(randomMotivationalMessage()), 90_000);
    return () => { if (messageRef.current) clearInterval(messageRef.current); };
  }, [phase]);

  const startSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const secs = selectedMinutes * 60;
    endAtRef.current = Date.now() + secs * 1000;
    setTotalSeconds(secs);
    setRemaining(secs);
    setSessionStartedAt(Date.now());
    setMessage(randomMotivationalMessage());
    setPhase('running');
  };

  const pause = () => {
    Haptics.selectionAsync().catch(() => {});
    const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setRemaining(left);
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('paused');
  };

  const resume = () => {
    Haptics.selectionAsync().catch(() => {});
    endAtRef.current = Date.now() + remaining * 1000;
    setPhase('running');
  };

  const cancel = () => {
    Haptics.selectionAsync().catch(() => {});
    if (timerRef.current) clearInterval(timerRef.current);
    if (messageRef.current) clearInterval(messageRef.current);
    setPhase('setup');
    setRemaining(0);
  };

  const handleComplete = useCallback(() => {
    if (messageRef.current) clearInterval(messageRef.current);
    if (mode === 'focus') {
      completeOmmSession({
        startedAt: sessionStartedAt,
        endedAt: Date.now(),
        plannedSeconds: totalSeconds,
        actualSeconds: totalSeconds,
        completed: true,
      });
      const allSessions = [{ id: 't', startedAt: sessionStartedAt, endedAt: Date.now(), plannedSeconds: totalSeconds, actualSeconds: totalSeconds, completed: true }, ...ommSessions];
      const newStats = computeStats(allSessions);
      const newIds = OMM_ACHIEVEMENTS.filter((a) => a.test(newStats) && !ommAchievements[a.id]).map((a) => a.id);
      const newAch = newIds.map((id) => ommAchievementById(id)).filter((a): a is OneMoreMinuteAchievement => !!a);
      setUnlockedAchievements(newAch);
      setCompletedToday(newStats.todaySessions);
      if (newAch.length > 0) setShowCelebration(true);
    } else {
      setUnlockedAchievements([]);
    }
    playSound('win', 0.7);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPhase('done');
  }, [totalSeconds, sessionStartedAt, ommSessions, ommAchievements, completeOmmSession, mode]);

  const progress = totalSeconds > 0 ? 1 - (remaining / totalSeconds) : 0;

  // ── Setup ────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <ScrollView
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
            <Pressable onPress={safeBack} hitSlop={12}
              accessibilityRole="button" accessibilityLabel="Back"
              style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.round, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="headline">Pomodoro</Text>
              <Text variant="caption" dim>Choose a session and settle in</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg }}>
            {TIMER_MODES.map((item) => {
              const selected = item.id === mode;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => chooseMode(item.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({
                    flex: 1, minHeight: 48, borderRadius: radius.input,
                    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs,
                    backgroundColor: selected ? theme.color.primarySoft : 'transparent',
                    borderWidth: 1, borderColor: selected ? theme.color.primary : theme.color.hairline,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text variant="caption" color={selected ? theme.color.primary : theme.color.textDim} center>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ alignItems: 'center', marginVertical: spacing.xl }}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <PomodoroRing progress={0} size={ringSize} color={theme.color.primary} />
              <View style={{ position: 'absolute', width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                  <Ionicons name={modeMeta.icon as any} size={14} color={theme.color.primary} />
                  <Text variant="caption" color={theme.color.primary} style={{ textTransform: 'uppercase' }}>{modeMeta.label}</Text>
                </View>
                <Text variant="display" style={{ fontSize: timerFont, lineHeight: timerFont + 6, fontVariant: ['tabular-nums'], fontFamily: 'Nunito_900Black' }}>
                  {fmtClock(selectedMinutes * 60)}
                </Text>
                <Text variant="caption" dim>Ready when you are</Text>
              </View>
            </View>
          </View>

          <Text variant="caption" dim center style={{ marginBottom: spacing.sm }}>Session length</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
            {durationOptions.map((minutes) => {
              const selected = selectedMinutes === minutes;
              return (
                <Pressable key={minutes} onPress={() => { setSelectedMinutes(minutes); Haptics.selectionAsync().catch(() => {}); }}
                  style={({ pressed }) => ({
                    minWidth: 58, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.round,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? theme.color.primary : theme.color.surface,
                    borderWidth: 1, borderColor: selected ? theme.color.primary : theme.color.hairline,
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Text variant="footnote" color={selected ? theme.color.onPrimary : theme.color.text}>{minutes} min</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: spacing.lg }}>
            <Button label={`Start ${modeMeta.label}`} onPress={startSession} full />
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: theme.color.hairline }}>
            {[
              { value: completedToday, label: 'Today' },
              { value: fmtDuration(stats.totalSeconds), label: 'Focused' },
              { value: stats.currentStreak, label: 'Week streak' },
            ].map((item, index) => (
              <View key={item.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: index === 0 ? 0 : 1, borderLeftColor: theme.color.hairline }}>
                <Text variant="callout" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{item.value}</Text>
                <Text variant="caption" dim>{item.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // ── Running / Paused ─────────────────────────────────────────────────────
  if (phase === 'running' || phase === 'paused') {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
            <Pressable onPress={cancel} hitSlop={12} accessibilityRole="button" accessibilityLabel="Reset timer"
              style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.round, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.hairline, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="caption" dim>Current session</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name={modeMeta.icon as any} size={14} color={theme.color.primary} />
                <Text variant="callout" color={theme.color.primary}>{modeMeta.label}</Text>
              </View>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ alignItems: 'center' }}>
              <PomodoroRing progress={progress} size={ringSize} color={phase === 'running' ? theme.color.primary : theme.color.textDim} />
              <View style={{ position: 'absolute', width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="display" style={{ fontSize: timerFont, lineHeight: timerFont + 6, fontVariant: ['tabular-nums'], fontFamily: 'Nunito_900Black' }}>
                {fmtClock(remaining)}
              </Text>
              <Text variant="footnote" color={phase === 'paused' ? theme.color.celebrateText : theme.color.textDim} style={{ marginTop: 4 }}>
                {phase === 'running' ? `${modeMeta.label} in progress` : 'Paused'}
              </Text>
            </View>
          </View>

            <View style={{ alignSelf: 'stretch', marginTop: spacing.xl }}>
              <ProgressBar progress={progress} height={6} color={phase === 'running' ? theme.color.primary : theme.color.textDim} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                <Text variant="caption" dim>{Math.round(progress * 100)}%</Text>
                <Text variant="caption" dim>{selectedMinutes} minute session</Text>
              </View>
            </View>

            <Animated.View key={message} entering={FadeIn.duration(400)} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' }}>
              <Text variant="callout" center color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold' }}>
                {mode === 'focus' ? message : 'Give your mind a little room to reset.'}
              </Text>
            </Animated.View>
          </View>

          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            {phase === 'running' ? (
              <Button label="Pause" onPress={pause} full />
            ) : (
              <Button label="Resume" onPress={resume} full />
            )}
            <Button label="Reset timer" kind="tertiary" onPress={cancel} full />
          </View>
        </View>
      </Screen>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <ScrollView contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(500)}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: theme.color.successSoft,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing.lg,
          }}>
            <Ionicons name="checkmark" size={40} color={theme.color.success} />
          </View>
        </Animated.View>

        <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.xs }}>
          {modeMeta.label} complete
        </Text>
        <Text variant="footnote" dim center style={{ lineHeight: 20, marginBottom: spacing.xl }}>
          {mode === 'focus'
            ? `Great job! You stayed focused for ${fmtDuration(totalSeconds)}.`
            : `You gave yourself ${fmtDuration(totalSeconds)} to reset.`}
        </Text>

        <View style={{
          alignSelf: 'stretch', backgroundColor: theme.color.surface, borderRadius: radius.card,
          borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, marginBottom: spacing.xl,
        }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{fmtDuration(totalSeconds)}</Text>
              <Text variant="caption" dim>Duration</Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.color.hairline }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.success} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{completedToday}</Text>
              <Text variant="caption" dim>Today</Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.color.hairline }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.celebrateText} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{mode === 'focus' ? '+1' : 'Ready'}</Text>
              <Text variant="caption" dim>{mode === 'focus' ? 'Habits' : 'Status'}</Text>
            </View>
          </View>
        </View>

        <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <Button label="Start another" kind="secondary" onPress={() => setPhase('setup')} full />
          <Button label="Back to SOS" onPress={safeBack} full />
        </View>
      </ScrollView>

      <Modal visible={showCelebration} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setShowCelebration(false)}>
        <GameCelebration
          visible={showCelebration}
          tone="win"
          title="Achievement unlocked"
          subtitle="Your focus is building lasting habits."
          unlocked={unlockedAchievements.map((a) => ({ id: a.id, title: a.title, desc: a.desc, icon: a.icon }))}
          primary={{ label: 'Keep going', onPress: () => setShowCelebration(false) }}
          onShareAchievement={() => setShowCelebration(false)}
        />
      </Modal>
    </Screen>
  );
}
