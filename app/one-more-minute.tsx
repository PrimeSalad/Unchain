/**
 * One More Minute - Pomodoro-inspired recovery timer.
 * Route: /one-more-minute
 *
 * A universal recovery tool for all addiction types. Helps users redirect
 * attention away from urges by committing to focused recovery time.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
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

function fmtClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// ── Circular progress ─────────────────────────────────────────────────────

function CircularProgress({ progress, size, color, bgColor }: {
  progress: number; size: number; color: string; bgColor: string;
}) {
  const theme = useTheme();
  const circumference = 2 * Math.PI * ((size - 12) / 2);
  const strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background circle */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 6, borderColor: bgColor,
      }} />
      {/* Progress circle - using a simple border approach */}
      <View style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        borderWidth: 6, borderColor: 'transparent',
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

export default function OneMoreMinute() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const addPoints = useStore((s) => s.addPoints);
  const pushTimeline = useStore((s) => s.pushTimeline);
  const completeOmmSession = useStore((s) => s.completeOmmSession);
  const ommSessions = useStore((s) => s.ommSessions);
  const ommAchievements = useStore((s) => s.ommAchievements);
  const healthyHabitsCount = useStore((s) => s.healthyHabitsCount);

  const stats = computeStats(ommSessions);

  // ── Phase state ─────────────────────────────────────────────────────────
  type Phase = 'setup' | 'running' | 'paused' | 'done';
  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25);
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  // Timer state
  const [remaining, setRemaining] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [message, setMessage] = useState(randomMotivationalMessage());
  const [sessionStartedAt, setSessionStartedAt] = useState(0);

  // Completion state
  const [completedSessionsToday, setCompletedSessionsToday] = useState(stats.todaySessions);
  const [showCelebration, setShowCelebration] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<OneMoreMinuteAchievement[]>([]);

  // Refs for wall-clock accuracy
  const endAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const messageRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ── Timer logic (wall-clock based) ──────────────────────────────────────
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

  // ── Message rotation ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') {
      if (messageRef.current) clearInterval(messageRef.current);
      return;
    }
    messageRef.current = setInterval(() => {
      setMessage(randomMotivationalMessage());
    }, 90_000); // every 90 seconds
    return () => { if (messageRef.current) clearInterval(messageRef.current); };
  }, [phase]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const startSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const mins = customMinutes ?? selectedMinutes;
    const secs = mins * 60;
    endAtRef.current = Date.now() + secs * 1000;
    setTotalSeconds(secs);
    setRemaining(secs);
    setSessionStartedAt(Date.now());
    setMessage(randomMotivationalMessage());
    setPhase('running');
  };

  const pause = () => {
    Haptics.selectionAsync().catch(() => {});
    // Save remaining time
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
    const actualSeconds = totalSeconds;
    const startedAt = sessionStartedAt;
    const endedAt = Date.now();

    completeOmmSession({
      startedAt,
      endedAt,
      plannedSeconds: totalSeconds,
      actualSeconds,
      completed: true,
    });

    // Check for new achievements
    const allSessions = [{ id: 'temp', startedAt, endedAt, plannedSeconds: totalSeconds, actualSeconds, completed: true }, ...ommSessions];
    const newStats = computeStats(allSessions);
    const newIds = evaluateOmmAchievements(newStats).filter((id) => !ommAchievements[id]);
    const newAch = newIds.map((id) => ommAchievementById(id)).filter((a): a is OneMoreMinuteAchievement => !!a);
    setUnlockedAchievements(newAch);
    setCompletedSessionsToday(newStats.todaySessions);

    playSound('win', 0.7);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (newAch.length > 0) {
      setShowCelebration(true);
    }
    setPhase('done');
  }, [totalSeconds, sessionStartedAt, ommSessions, ommAchievements, completeOmmSession]);

  const resetToSetup = () => {
    setPhase('setup');
    setRemaining(0);
  };

  // ── Progress ────────────────────────────────────────────────────────────
  const progress = totalSeconds > 0 ? 1 - (remaining / totalSeconds) : 0;

  // ── Render: Setup phase ─────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <Screen edges={['top', 'bottom']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
          <Pressable onPress={safeBack} hitSlop={12} accessibilityRole="button"
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.round, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="chevron-back" size={22} color={theme.color.primary} />
          </Pressable>
          <Text variant="headline" style={{ flex: 1 }}>One More Minute</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="hourglass" size={36} color={theme.color.primary} />
            </View>
          </View>

          {/* Subtitle */}
          <Text variant="callout" dim center style={{ lineHeight: 22, marginBottom: spacing.lg, paddingHorizontal: spacing.md }}>
            Give yourself one more minute. You might be surprised how much stronger you feel when it passes.
          </Text>

          {/* Disclaimer */}
          <View style={{
            backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card,
            padding: spacing.md, marginBottom: spacing.xl,
          }}>
            <Text variant="caption" color={theme.color.textDim} center style={{ lineHeight: 18, fontStyle: 'italic' }}>
              Urges don't last forever. Focus on something healthy for a little while. Every minute you wait is another minute you've chosen recovery.
            </Text>
          </View>

          {/* Duration picker */}
          <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold', marginBottom: spacing.sm }}>
            Choose your session length
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
            {PRESET_DURATIONS.map((m) => {
              const active = !showCustom && selectedMinutes === m;
              return (
                <Pressable key={m} onPress={() => { setSelectedMinutes(m); setShowCustom(false); }}
                  style={({ pressed }) => ({
                    flex: 1, minWidth: 60, height: 48, borderRadius: radius.card,
                    backgroundColor: active ? theme.color.primary : theme.color.surface,
                    borderWidth: 1, borderColor: active ? theme.color.primary : theme.color.hairline,
                    alignItems: 'center', justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Text variant="callout" color={active ? '#FFFFFF' : theme.color.text} style={{ fontFamily: 'Nunito_700Bold' }}>
                    {m}m
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom duration */}
          <Pressable onPress={() => setShowCustom(!showCustom)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              backgroundColor: showCustom ? theme.color.primarySoft : theme.color.surface,
              borderRadius: radius.card, borderWidth: 1,
              borderColor: showCustom ? theme.color.primary : theme.color.hairline,
              padding: spacing.md, marginBottom: spacing.xl,
              opacity: pressed ? 0.8 : 1,
            })}>
            <Ionicons name="time-outline" size={20} color={showCustom ? theme.color.primary : theme.color.textDim} />
            <Text variant="callout" color={showCustom ? theme.color.primary : theme.color.text}>
              {showCustom ? `Custom: ${customMinutes ?? 5} minutes` : 'Custom Duration'}
            </Text>
          </Pressable>

          {showCustom && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl,
              backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md }}>
              <Pressable onPress={() => setCustomMinutes(Math.max(1, (customMinutes ?? 5) - 5))}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="remove" size={20} color={theme.color.primary} />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text variant="title1" style={{ fontFamily: 'Nunito_900Black' }}>{customMinutes ?? 5}</Text>
                <Text variant="caption" dim>minutes</Text>
              </View>
              <Pressable onPress={() => setCustomMinutes(Math.min(120, (customMinutes ?? 5) + 5))}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.color.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={20} color={theme.color.primary} />
              </Pressable>
            </View>
          )}

          {/* Start button */}
          <Button label="Start Session" onPress={startSession} full />

          {/* Stats preview */}
          {stats.completedSessions > 0 && (
            <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
              <Text variant="footnote" style={{ fontFamily: 'Nunito_700Bold' }}>Your Progress</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.sm, alignItems: 'center' }}>
                  <Text variant="headline" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{stats.completedSessions}</Text>
                  <Text variant="caption" dim>Sessions</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.sm, alignItems: 'center' }}>
                  <Text variant="headline" color={theme.color.success} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{fmtDuration(stats.totalSeconds)}</Text>
                  <Text variant="caption" dim>Total Time</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: theme.color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.sm, alignItems: 'center' }}>
                  <Text variant="headline" color={theme.color.celebrateText} style={{ fontFamily: 'Nunito_800ExtraBold' }}>{stats.currentStreak}</Text>
                  <Text variant="caption" dim>Week Streak</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </Screen>
    );
  }

  // ── Render: Running / Paused ────────────────────────────────────────────
  if (phase === 'running' || phase === 'paused') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          {/* Timer circle */}
          <View style={{ marginBottom: spacing.xl }}>
            <CircularProgress progress={progress} size={220} color={theme.color.primary} bgColor={theme.color.surfaceAlt} />
            <View style={{ position: 'absolute', width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="display" style={{ fontSize: 48, fontVariant: ['tabular-nums'], fontFamily: 'Nunito_900Black' }}>
                {fmtClock(remaining)}
              </Text>
              <Text variant="caption" dim style={{ marginTop: 4 }}>
                {phase === 'running' ? 'Stay focused' : 'Paused'}
              </Text>
            </View>
          </View>

          {/* Motivational message */}
          <Animated.View key={message} entering={FadeIn.duration(400)} style={{ marginBottom: spacing.xl }}>
            <Text variant="callout" center color={theme.color.primary} style={{ fontFamily: 'Nunito_700Bold', fontStyle: 'italic' }}>
              "{message}"
            </Text>
          </Animated.View>

          {/* Controls */}
          <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
            {phase === 'running' ? (
              <Button label="Pause" kind="secondary" onPress={pause} full />
            ) : (
              <Button label="Resume" onPress={resume} full />
            )}
            <Button label="Cancel Session" kind="destructive" onPress={cancel} full />
          </View>
        </View>
      </Screen>
    );
  }

  // ── Render: Done ────────────────────────────────────────────────────────
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        {/* Success icon */}
        <Animated.View entering={FadeIn.duration(500)} style={{ marginBottom: spacing.lg }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: theme.color.successSoft,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="checkmark" size={40} color={theme.color.success} />
          </View>
        </Animated.View>

        <Text variant="headline" center style={{ fontFamily: 'Nunito_800ExtraBold', marginBottom: spacing.sm }}>
          Great Job!
        </Text>
        <Text variant="callout" dim center style={{ lineHeight: 22, marginBottom: spacing.xl }}>
          You completed your One More Minute session.
        </Text>

        {/* Stats */}
        <View style={{
          alignSelf: 'stretch', backgroundColor: theme.color.surface, borderRadius: radius.card,
          borderWidth: 1, borderColor: theme.color.hairline, padding: spacing.md, marginBottom: spacing.xl,
        }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.primary} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                {fmtDuration(totalSeconds)}
              </Text>
              <Text variant="caption" dim>Duration</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.success} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                {completedSessionsToday}
              </Text>
              <Text variant="caption" dim>Today</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="headline" color={theme.color.celebrateText} style={{ fontFamily: 'Nunito_800ExtraBold' }}>
                +1
              </Text>
              <Text variant="caption" dim>Habits</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <Button label="Start Another Session" kind="secondary" onPress={resetToSetup} full />
          <Button label="Return to SOS" onPress={safeBack} full />
        </View>
      </View>

      {/* Celebration modal */}
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

// ── evaluateOmmAchievements helper ────────────────────────────────────────
function evaluateOmmAchievements(stats: { completedSessions: number; totalSeconds: number; currentStreak: number }): string[] {
  return OMM_ACHIEVEMENTS.filter((a) => a.test(stats as any)).map((a) => a.id);
}
