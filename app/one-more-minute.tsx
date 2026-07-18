/**
 * Pomodoro - recovery focus timer.
 * Route: /one-more-minute
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
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

const { width: SCREEN_W } = Dimensions.get('window');
const RING_SIZE = Math.min(260, SCREEN_W * 0.65);
const TIMER_FONT = Math.min(56, SCREEN_W * 0.14);

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
  const router = useRouter();
  const safeBack = useSafeBack();
  const completeOmmSession = useStore((s) => s.completeOmmSession);
  const ommSessions = useStore((s) => s.ommSessions);
  const ommAchievements = useStore((s) => s.ommAchievements);

  const stats = computeStats(ommSessions);

  type Phase = 'setup' | 'running' | 'paused' | 'done';
  const [phase, setPhase] = useState<Phase>('setup');
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
    playSound('win', 0.7);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (newAch.length > 0) setShowCelebration(true);
    setPhase('done');
  }, [totalSeconds, sessionStartedAt, ommSessions, ommAchievements, completeOmmSession]);

  const progress = totalSeconds > 0 ? 1 - (remaining / totalSeconds) : 0;

  // ── Setup ────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl }}>
            <Pressable onPress={safeBack} hitSlop={12}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
            </Pressable>
            <Text variant="headline" style={{ flex: 1, marginLeft: spacing.md }}>Pomodoro</Text>
          </View>

          {/* Session count */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
            <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{completedToday}</Text>
              <Text variant="caption" dim>Today</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.success} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{fmtDuration(stats.totalSeconds)}</Text>
              <Text variant="caption" dim>Total</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.celebrateText} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{stats.currentStreak}</Text>
              <Text variant="caption" dim>Weeks</Text>
            </View>
          </View>

          {/* Duration picker */}
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.md }}>
            Focus duration
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
            {PRESET_DURATIONS.map((m) => (
              <Pressable key={m} onPress={() => { setSelectedMinutes(m); Haptics.selectionAsync().catch(() => {}); }}
                style={({ pressed }) => ({
                  flex: 1, height: 56, borderRadius: radius.card,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: selectedMinutes === m ? theme.color.primary : theme.color.surface,
                  borderWidth: 1, borderColor: selectedMinutes === m ? theme.color.primary : theme.color.hairline,
                  opacity: pressed ? 0.8 : 1,
                })}>
                <Text variant="headline" color={selectedMinutes === m ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                  {m}
                </Text>
                <Text variant="caption" color={selectedMinutes === m ? '#FFFFFF' : theme.color.textDim}>min</Text>
              </Pressable>
            ))}
          </View>

          <Button label="Start Focus" onPress={startSession} full />
        </ScrollView>
      </Screen>
    );
  }

  // ── Running / Paused ─────────────────────────────────────────────────────
  if (phase === 'running' || phase === 'paused') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <View style={{ marginBottom: spacing.xl, alignItems: 'center' }}>
            <PomodoroRing progress={progress} size={RING_SIZE} color={phase === 'running' ? theme.color.primary : theme.color.textDim} />
            <View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="display" style={{ fontSize: TIMER_FONT, fontVariant: ['tabular-nums'], fontFamily: 'Nunito_900Black' }}>
                {fmtClock(remaining)}
              </Text>
              <Text variant="caption" dim style={{ marginTop: 4 }}>
                {phase === 'running' ? 'Focus time' : 'Paused'}
              </Text>
            </View>
          </View>

          <Animated.View key={message} entering={FadeIn.duration(400)} style={{ marginBottom: spacing.xl, paddingHorizontal: spacing.lg }}>
            <Text variant="callout" center color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold', fontStyle: 'italic' }}>
              "{message}"
            </Text>
          </Animated.View>

          <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
            {phase === 'running' ? (
              <Button label="Pause" kind="secondary" onPress={pause} full />
            ) : (
              <Button label="Resume" onPress={resume} full />
            )}
            <Button label="Cancel" kind="tertiary" onPress={cancel} full />
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
          Focus complete
        </Text>
        <Text variant="footnote" dim center style={{ lineHeight: 20, marginBottom: spacing.xl }}>
          Great job! You stayed focused for {fmtDuration(totalSeconds)}.
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
              <Text variant="headline" color={theme.color.celebrateText} style={{ fontFamily: 'Nunito_800ExtraBold' }}>+1</Text>
              <Text variant="caption" dim>Habits</Text>
            </View>
          </View>
        </View>

        <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <Button label="Start Another" kind="secondary" onPress={() => setPhase('setup')} full />
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
