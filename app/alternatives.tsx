/**
 * Healthy Alternatives — interactive recovery actions.
 *
 * Every activity is a real action with its own native-feeling flow (sheet,
 * timer, or confirmation) instead of a static suggestion. Completions persist
 * offline, count once per calendar day, and reset automatically at local
 * midnight (state stores a timestamp; "done today" is derived with sameDay).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { TimerRing } from '@/presentation/components/TimerRing';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { BreathingOrb } from '@/presentation/components/BreathingOrb';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useTodayJournal } from '@/application/store';
import { startCalmMusic, stopCalmMusic } from '@/application/sound';
import {
  ALT_ACHIEVEMENTS,
  ALTERNATIVES,
  BREATHE_MINUTES,
  MUSIC_GOAL_SECONDS,
  STRETCH_STEPS,
  WALK_SECONDS,
  type AltAchievement,
  type AltCounts,
  type Alternative,
  type AlternativeId,
} from '@/domain/alternatives';
import { sameDay } from '@/domain/records';

export { AppErrorBoundary as ErrorBoundary } from '@/presentation/components/AppErrorBoundary';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Schedule the walk-complete notification. Returns null when not permitted —
 *  the in-app completion still works; the notification is a bonus. */
async function scheduleWalkNotification(seconds: number): Promise<string | null> {
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (!perm.granted || seconds <= 0) return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Walk complete',
        body: 'Great job — every healthy choice strengthens your recovery.',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}

function cancelNotification(id: string | null) {
  if (!id) return;
  Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Completed state — shared success view inside sheets
// ─────────────────────────────────────────────────────────────────────────────

function SheetDone({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
      <Animated.View entering={FadeInDown.springify().damping(14)}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: theme.color.successSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={38} color={theme.color.success} />
        </View>
      </Animated.View>
      <Text variant="title2" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
        {title}
      </Text>
      <Text variant="callout" dim center style={{ lineHeight: 22, paddingHorizontal: spacing.md }}>
        {message}
      </Text>
      <Button label="Done" onPress={onClose} full style={{ marginTop: spacing.md }} />
    </View>
  );
}

function SheetHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text variant="title2" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="callout" dim center style={{ marginTop: spacing.xs, lineHeight: 22 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Walk — timed session with progress ring + optional local notification
// ─────────────────────────────────────────────────────────────────────────────

type WalkPhase = 'idle' | 'running' | 'paused' | 'done';

function WalkSheet({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { width } = useWindowDimensions();
  // Ring shrinks gracefully on compact devices (iPhone SE) so the sheet's
  // controls always stay on screen.
  const ringSize = Math.max(160, Math.min(210, width - 120));
  const [phase, setPhase] = useState<WalkPhase>('idle');
  const [remaining, setRemaining] = useState(WALK_SECONDS);
  // Wall-clock deadline — backgrounding or locking the device never stretches
  // the session; remaining time is recomputed from the clock on every tick.
  const endAtRef = useRef(0);
  const notifRef = useRef<string | null>(null);

  const finish = useCallback(() => {
    setPhase('done');
    cancelNotification(notifRef.current);
    notifRef.current = null;
    successHaptic();
    onComplete();
  }, [onComplete]);

  // Reset for a fresh session each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setRemaining(WALK_SECONDS);
    } else {
      cancelNotification(notifRef.current);
      notifRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) finish();
    }, 500);
    return () => clearInterval(id);
  }, [phase, finish]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    endAtRef.current = Date.now() + WALK_SECONDS * 1000;
    setRemaining(WALK_SECONDS);
    setPhase('running');
    scheduleWalkNotification(WALK_SECONDS).then((id) => (notifRef.current = id));
  };

  const pause = () => {
    Haptics.selectionAsync().catch(() => {});
    setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    setPhase('paused');
    cancelNotification(notifRef.current);
    notifRef.current = null;
  };

  const resume = () => {
    Haptics.selectionAsync().catch(() => {});
    endAtRef.current = Date.now() + remaining * 1000;
    setPhase('running');
    scheduleWalkNotification(remaining).then((id) => (notifRef.current = id));
  };

  const cancel = () => {
    cancelNotification(notifRef.current);
    notifRef.current = null;
    setPhase('idle');
    onClose();
  };

  const elapsed = WALK_SECONDS - remaining;
  const status =
    phase === 'running' ? 'Walking — stay with it' : phase === 'paused' ? 'Paused' : 'Ready when you are';

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase === 'idle'}>
      {phase === 'done' ? (
        <SheetDone
          title="Great job."
          message="Every healthy choice strengthens your recovery."
          onClose={onClose}
        />
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <SheetHeading title="Take a 10-Minute Walk" subtitle={status} />
          <TimerRing progress={remaining / WALK_SECONDS} size={ringSize}>
            <Text
              variant="display"
              style={{ fontSize: 44, lineHeight: 50, fontVariant: ['tabular-nums'] }}
              accessibilityLabel={`${fmtClock(remaining)} remaining`}
            >
              {fmtClock(remaining)}
            </Text>
            <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>
              {phase === 'idle' ? 'remaining' : `${fmtClock(elapsed)} elapsed`}
            </Text>
          </TimerRing>

          <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
            {phase === 'idle' && (
              <>
                <Button label="Start" onPress={start} full />
                <Button label="Cancel" kind="tertiary" onPress={onClose} full />
              </>
            )}
            {phase === 'running' && (
              <>
                <Button label="Pause" kind="secondary" onPress={pause} full />
                <Button label="Finish Early" kind="tertiary" onPress={finish} full />
                <Button label="Cancel Session" kind="destructive" onPress={cancel} full />
              </>
            )}
            {phase === 'paused' && (
              <>
                <Button label="Resume" onPress={resume} full />
                <Button label="Finish Early" kind="tertiary" onPress={finish} full />
                <Button label="Cancel Session" kind="destructive" onPress={cancel} full />
              </>
            )}
          </View>
          {phase === 'idle' && (
            <Text variant="caption" dim center style={{ marginTop: -spacing.sm }}>
              The timer keeps counting if you lock your phone.
            </Text>
          )}
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Water — small confirmation sheet
// ─────────────────────────────────────────────────────────────────────────────

function WaterSheet({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (visible) setDone(false);
  }, [visible]);

  const yes = () => {
    successHaptic();
    onComplete();
    setDone(true);
  };

  return (
    <ActionSheet visible={visible} onClose={onClose}>
      {done ? (
        <SheetDone
          title="Nicely done."
          message="Hydration helps your body recover."
          onClose={onClose}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <SheetHeading
            title="Did you drink a glass of water?"
            subtitle="A small reset for your body — and a pause for your mind."
          />
          <Button label="Yes" onPress={yes} full />
          <Button label="Not Yet" kind="secondary" onPress={onClose} full />
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Stretch — guided steps, each on its own timer
// ─────────────────────────────────────────────────────────────────────────────

type StretchPhase = 'idle' | 'running' | 'done';

function StretchSheet({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<StretchPhase>('idle');
  const [stepIdx, setStepIdx] = useState(0);
  const [remaining, setRemaining] = useState(STRETCH_STEPS[0].seconds);
  const endAtRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setStepIdx(0);
      setRemaining(STRETCH_STEPS[0].seconds);
    }
  }, [visible]);

  const finish = useCallback(() => {
    setPhase('done');
    successHaptic();
    onComplete();
  }, [onComplete]);

  const beginStep = (idx: number) => {
    endAtRef.current = Date.now() + STRETCH_STEPS[idx].seconds * 1000;
    setStepIdx(idx);
    setRemaining(STRETCH_STEPS[idx].seconds);
  };

  const advance = useCallback(() => {
    setStepIdx((i) => {
      const next = i + 1;
      if (next >= STRETCH_STEPS.length) {
        finish();
        return i;
      }
      Haptics.selectionAsync().catch(() => {});
      endAtRef.current = Date.now() + STRETCH_STEPS[next].seconds * 1000;
      setRemaining(STRETCH_STEPS[next].seconds);
      return next;
    });
  }, [finish]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) advance();
    }, 500);
    return () => clearInterval(id);
  }, [phase, advance]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    beginStep(0);
    setPhase('running');
  };

  const step = STRETCH_STEPS[stepIdx];
  const overall =
    phase === 'running'
      ? (stepIdx + 1 - remaining / step.seconds) / STRETCH_STEPS.length
      : phase === 'done'
        ? 1
        : 0;

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase !== 'running'}>
      {phase === 'done' ? (
        <SheetDone
          title="You showed up for your body."
          message="Tension released is stress your recovery no longer carries."
          onClose={onClose}
        />
      ) : phase === 'idle' ? (
        <View style={{ gap: spacing.md }}>
          <SheetHeading
            title="Stretch Your Body"
            subtitle={`${STRETCH_STEPS.length} gentle stretches · about ${Math.round(
              STRETCH_STEPS.reduce((s, x) => s + x.seconds, 0) / 60,
            )} minutes`}
          />
          {STRETCH_STEPS.map((s) => (
            <View
              key={s.title}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: theme.color.surfaceAlt,
                borderRadius: radius.card,
                padding: spacing.md,
              }}
            >
              <Ionicons name={s.icon as any} size={18} color={theme.color.primary} />
              <Text variant="callout" style={{ flex: 1 }}>{s.title}</Text>
              <Text variant="footnote" dim style={{ fontVariant: ['tabular-nums'] }}>{s.seconds}s</Text>
            </View>
          ))}
          <Button label="Begin stretching" onPress={start} full style={{ marginTop: spacing.sm }} />
        </View>
      ) : (
        <View style={{ gap: spacing.lg, alignItems: 'center' }}>
          <SheetHeading title={step.title} />
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={step.icon as any} size={34} color={theme.color.primary} />
          </View>
          <Text variant="callout" dim center style={{ lineHeight: 22, paddingHorizontal: spacing.md }}>
            {step.instruction}
          </Text>
          <Text
            variant="display"
            style={{ fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] }}
            accessibilityLabel={`${remaining} seconds remaining`}
          >
            {fmtClock(remaining)}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            <ProgressBar progress={overall} height={8} />
            <Text variant="caption" dim center style={{ fontVariant: ['tabular-nums'] }}>
              Stretch {stepIdx + 1} of {STRETCH_STEPS.length}
            </Text>
          </View>
          <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            <Button label="Next stretch" kind="secondary" onPress={advance} full />
            <Button label="Cancel Session" kind="destructive" onPress={onClose} full />
          </View>
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Breathing — orb-guided session with selectable duration
// ─────────────────────────────────────────────────────────────────────────────

type BreathePhase = 'idle' | 'running' | 'done';

function BreatheSheet({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<BreathePhase>('idle');
  const [remaining, setRemaining] = useState(0);
  const endAtRef = useRef(0);

  useEffect(() => {
    if (visible) setPhase('idle');
  }, [visible]);

  const finish = useCallback(() => {
    setPhase('done');
    successHaptic();
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) finish();
    }, 500);
    return () => clearInterval(id);
  }, [phase, finish]);

  const start = (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    endAtRef.current = Date.now() + minutes * 60_000;
    setRemaining(minutes * 60);
    setPhase('running');
  };

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase !== 'running'}>
      {phase === 'done' ? (
        <SheetDone
          title="Breath by breath."
          message="Your nervous system just got a real reset. The urge is smaller than it was."
          onClose={onClose}
        />
      ) : phase === 'idle' ? (
        <View style={{ gap: spacing.md }}>
          <SheetHeading
            title="Practice Deep Breathing"
            subtitle="Inhale, hold, exhale — the orb sets the pace. Choose a length."
          />
          {BREATHE_MINUTES.map((m) => (
            <Pressable
              key={m}
              onPress={() => start(m)}
              accessibilityRole="button"
              accessibilityLabel={`Breathe for ${m} minute${m === 1 ? '' : 's'}`}
              style={({ pressed }) => ({
                height: 54,
                borderRadius: radius.button,
                backgroundColor: theme.color.surfaceAlt,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="leaf" size={16} color={theme.color.primary} />
              <Text variant="headline">{m} minute{m === 1 ? '' : 's'}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <BreathingOrb size={200} />
          <Text
            variant="display"
            style={{ fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] }}
            accessibilityLabel={`${fmtClock(remaining)} remaining`}
          >
            {fmtClock(remaining)}
          </Text>
          <Button label="Finish Early" kind="tertiary" onPress={finish} full />
          <Button label="Cancel Session" kind="destructive" onPress={onClose} full />
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Calming music — built-in audio; completes after a meaningful session
// ─────────────────────────────────────────────────────────────────────────────

type MusicPhase = 'idle' | 'playing' | 'done';

function MusicSheet({
  visible,
  onClose,
  onComplete,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<MusicPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const startAtRef = useRef(0);
  const completedRef = useRef(false);

  // Whatever happens (close, unmount, navigation) the loop must stop.
  useEffect(() => {
    if (!visible) stopCalmMusic();
    if (visible) {
      setPhase('idle');
      setElapsed(0);
      completedRef.current = false;
    }
  }, [visible]);
  useEffect(() => () => stopCalmMusic(), []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - startAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MUSIC_GOAL_SECONDS && !completedRef.current) {
        completedRef.current = true;
        successHaptic();
        onComplete();
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase, onComplete]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startAtRef.current = Date.now();
    setElapsed(0);
    setPhase('playing');
    startCalmMusic();
  };

  const stop = () => {
    stopCalmMusic();
    setPhase(completedRef.current ? 'done' : 'idle');
    if (!completedRef.current) onClose();
  };

  const goal = Math.min(1, elapsed / MUSIC_GOAL_SECONDS);

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase !== 'playing'}>
      {phase === 'done' ? (
        <SheetDone
          title="A calmer mind."
          message="A few quiet minutes can carry you through the loudest urge."
          onClose={onClose}
        />
      ) : phase === 'idle' ? (
        <View style={{ gap: spacing.md }}>
          <SheetHeading
            title="Listen to Calming Music"
            subtitle={`A gentle built-in loop, fully offline. ${Math.round(
              MUSIC_GOAL_SECONDS / 60,
            )} minutes counts as a session.`}
          />
          <Button label="Start Listening" onPress={start} full />
          <Button label="Cancel" kind="tertiary" onPress={onClose} full />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <SheetHeading title="Listening…" subtitle="Let it play. Slow your shoulders down." />
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: theme.color.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="musical-notes" size={36} color={theme.color.primary} />
          </View>
          <Text
            variant="display"
            style={{ fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] }}
            accessibilityLabel={`${fmtClock(elapsed)} listened`}
          >
            {fmtClock(elapsed)}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: spacing.xs }}>
            <ProgressBar progress={goal} height={8} />
            <Text variant="caption" dim center>
              {completedRef.current
                ? 'Session complete — keep listening as long as you like'
                : `${Math.max(0, MUSIC_GOAL_SECONDS - elapsed)}s until this counts as a session`}
            </Text>
          </View>
          <Button
            label={completedRef.current ? 'Stop & Finish' : 'Stop Listening'}
            kind="secondary"
            onPress={stop}
            full
          />
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Journal already done — info sheet
// ─────────────────────────────────────────────────────────────────────────────

function JournalDoneSheet({
  visible,
  onClose,
  onView,
  completedAt,
}: {
  visible: boolean;
  onClose: () => void;
  onView: () => void;
  completedAt?: number;
}) {
  const theme = useTheme();
  return (
    <ActionSheet visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.color.successSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={28} color={theme.color.success} />
        </View>
        <Text variant="title2" center style={{ fontFamily: 'Nunito_800ExtraBold' }}>
          Today's journal is complete
        </Text>
        <Text variant="callout" dim center style={{ lineHeight: 22 }}>
          {completedAt ? `Written at ${fmtTime(completedAt)}. ` : ''}
          One honest entry per day — you already did the work.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button label="View Today's Journal" onPress={onView} full />
          <Button label="Close" kind="secondary" onPress={onClose} full />
        </View>
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity card
// ─────────────────────────────────────────────────────────────────────────────

function ActivityCard({
  alt,
  index,
  done,
  completedAt,
  onPress,
}: {
  alt: Alternative;
  index: number;
  done: boolean;
  completedAt?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tintColor =
    alt.tint === 'success'
      ? theme.color.success
      : alt.tint === 'accent'
        ? theme.color.accentText
        : alt.tint === 'celebrate'
          ? theme.color.celebrateText
          : theme.color.primary;
  const tintSoft =
    alt.tint === 'success'
      ? theme.color.successSoft
      : alt.tint === 'accent'
        ? theme.color.accentSoft
        : alt.tint === 'celebrate'
          ? theme.color.celebrateSoft
          : theme.color.primarySoft;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).springify().damping(18)}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={alt.title}
        accessibilityHint={done ? 'Completed today. Opens the activity again.' : 'Opens this recovery activity.'}
        accessibilityState={{ checked: done }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            backgroundColor: done ? theme.color.successSoft : theme.color.surface,
            borderRadius: radius.card,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: done ? theme.color.success + '40' : theme.color.hairline,
          }}
        >
          {/* Icon chip */}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: done ? theme.color.success + '22' : tintSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={alt.icon as any} size={22} color={done ? theme.color.success : tintColor} />
          </View>

          {/* Labels */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="headline" numberOfLines={2}>{alt.title}</Text>
            <Text variant="footnote" dim style={{ marginTop: 2 }} numberOfLines={2}>
              {done && completedAt != null
                ? `Completed today · ${fmtTime(completedAt)}`
                : alt.subtitle}
            </Text>
          </View>

          {/* Status */}
          {done ? (
            <Animated.View entering={FadeInDown.springify().damping(14)}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: theme.color.success,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={17} color="#FFFFFF" />
              </View>
            </Animated.View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={theme.color.textDim} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function Alternatives() {
  const theme = useTheme();
  const router = useRouter();
  const safeBack = useSafeBack();
  const completions = useStore((s) => s.alternatives);
  const completeAlternative = useStore((s) => s.completeAlternative);
  const altCounts = useStore((s) => s.altCounts);
  const altAchievements = useStore((s) => s.altAchievements);
  const journalCount = useStore((s) => s.journal.length);
  const todayJournal = useTodayJournal();

  const [sheet, setSheet] = useState<AlternativeId | null>(null);
  // Achievements unlocked mid-sheet are celebrated after the sheet closes —
  // a RN Modal always paints above sibling overlays, so the confetti card
  // has to wait its turn.
  const pendingUnlocks = useRef<AltAchievement[]>([]);
  const [celebrating, setCelebrating] = useState<AltAchievement[] | null>(null);

  const close = () => {
    setSheet(null);
    if (pendingUnlocks.current.length > 0) {
      setCelebrating(pendingUnlocks.current);
      pendingUnlocks.current = [];
    }
  };

  const handleComplete = (id: AlternativeId) => {
    const unlocked = completeAlternative(id);
    if (unlocked.length > 0) pendingUnlocks.current = unlocked;
  };

  /** Counts including the derived journal total, for progress displays. */
  const counts: AltCounts = { ...altCounts, journal: journalCount };

  const isDone = (id: AlternativeId): boolean =>
    id === 'journal'
      ? todayJournal != null
      : completions[id] != null && sameDay(completions[id]!, Date.now());

  const doneAt = (id: AlternativeId): number | undefined =>
    id === 'journal' ? todayJournal?.at : completions[id];

  const open = (id: AlternativeId) => {
    if (id === 'journal') {
      if (todayJournal) setSheet('journal');
      else router.push('/journal-entry');
      return;
    }
    setSheet(id);
  };

  const doneCount = ALTERNATIVES.filter((a) => isDone(a.id)).length;

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1">Healthy Alternatives</Text>
          <Text variant="footnote" dim style={{ marginTop: 2 }}>
            Real actions that outlast an urge — each counts once a day.
          </Text>
        </View>
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radius.round,
            backgroundColor: theme.color.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="close" size={22} color={theme.color.primary} />
        </Pressable>
      </View>

      {/* Daily progress */}
      <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm }}>
        <ProgressBar progress={doneCount / ALTERNATIVES.length} height={8} />
        <Text variant="caption" dim style={{ fontVariant: ['tabular-nums'] }}>
          {doneCount} of {ALTERNATIVES.length} completed today
        </Text>
      </View>

      {/* Activity cards */}
      <View style={{ gap: spacing.md }}>
        {ALTERNATIVES.map((alt, i) => (
          <ActivityCard
            key={alt.id}
            alt={alt}
            index={i}
            done={isDone(alt.id)}
            completedAt={isDone(alt.id) ? doneAt(alt.id) : undefined}
            onPress={() => open(alt.id)}
          />
        ))}
      </View>

      {/* Habit achievements */}
      <Text variant="headline" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Achievements · {Object.keys(altAchievements).length}/{ALT_ACHIEVEMENTS.length}
      </Text>
      <View
        style={{
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          marginBottom: spacing.xl,
        }}
      >
        {ALT_ACHIEVEMENTS.map((a, i) => (
          <AchievementRow
            key={a.id}
            a={a}
            first={i === 0}
            counts={counts}
            unlockedAt={altAchievements[a.id]}
            onShare={() => router.push({ pathname: '/share-achievement', params: { id: a.id } })}
          />
        ))}
      </View>

      {/* Activity sheets */}
      <WalkSheet visible={sheet === 'walk'} onClose={close} onComplete={() => handleComplete('walk')} />
      <WaterSheet visible={sheet === 'water'} onClose={close} onComplete={() => handleComplete('water')} />
      <StretchSheet visible={sheet === 'stretch'} onClose={close} onComplete={() => handleComplete('stretch')} />
      <BreatheSheet visible={sheet === 'breathe'} onClose={close} onComplete={() => handleComplete('breathe')} />
      <MusicSheet visible={sheet === 'music'} onClose={close} onComplete={() => handleComplete('music')} />
      <JournalDoneSheet
        visible={sheet === 'journal'}
        onClose={close}
        completedAt={todayJournal?.at}
        onView={() => {
          close();
          router.push('/(tabs)/journal');
        }}
      />

      {/* Achievement unlock celebration — same confetti card as the games.
          Hosted in a Modal so it overlays the whole viewport (this screen
          scrolls; an absolute overlay would scroll with the content). */}
      <Modal
        visible={celebrating != null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setCelebrating(null)}
      >
        <GameCelebration
          visible={celebrating != null}
          tone="win"
          title="Achievement unlocked"
          subtitle="Your healthy habits are stacking up."
          unlocked={celebrating ?? []}
          primary={{ label: 'Keep going', onPress: () => setCelebrating(null) }}
          onShareAchievement={(a) => {
            setCelebrating(null);
            router.push({ pathname: '/share-achievement', params: { id: a.id } });
          }}
        />
      </Modal>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Achievement row — progress while locked, share when unlocked
// ─────────────────────────────────────────────────────────────────────────────

function AchievementRow({
  a,
  first,
  counts,
  unlockedAt,
  onShare,
}: {
  a: AltAchievement;
  first: boolean;
  counts: AltCounts;
  unlockedAt?: number;
  onShare: () => void;
}) {
  const theme = useTheme();
  const unlocked = unlockedAt != null;
  const prog = !unlocked && a.progress ? a.progress(counts) : null;

  return (
    <Pressable
      disabled={!unlocked}
      onPress={onShare}
      accessibilityRole="button"
      accessibilityLabel={`${a.title}${unlocked ? ', unlocked. Share' : ', locked'}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.color.hairline,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: unlocked ? '#E3B34C' : theme.color.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={a.icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={unlocked ? '#FFFFFF' : theme.color.textDim}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" color={unlocked ? theme.color.text : theme.color.textDim}>
          {a.title}
        </Text>
        <Text variant="caption" dim style={{ marginTop: 2 }}>{a.desc}</Text>
        {prog && (
          <View
            style={{
              marginTop: spacing.sm,
              height: 5,
              borderRadius: 3,
              backgroundColor: theme.color.surfaceAlt,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.min(100, Math.max(0, Math.round((prog.current / prog.target) * 100)))}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: theme.color.primary,
              }}
            />
          </View>
        )}
        {unlocked && (
          <Text variant="caption" color={theme.color.primary} style={{ marginTop: 2 }}>
            {new Date(unlockedAt).toLocaleDateString()}
          </Text>
        )}
      </View>
      {unlocked && <Ionicons name="share-outline" size={18} color={theme.color.primary} />}
    </Pressable>
  );
}
