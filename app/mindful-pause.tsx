import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BreathingOrb } from '@/presentation/components/BreathingOrb';
import { Text } from '@/presentation/components/Text';
import { palette, radius, spacing } from '@/presentation/theme/tokens';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useStore, useProfile } from '@/application/store';
import { playSound, setCalmMusicPaused, startCalmMusic, stopCalmMusic } from '@/application/sound';
import { DEFAULT_CURRENCY, moneySaved, formatMoney, currentStreakStart } from '@/domain/gambling';
import { BREATHING_TIPS } from '@/domain/content';

const DURATIONS = [5, 10, 15, 20, 30];

/**
 * Mindful Pause - a guided breathing session the user commits to. Once started,
 * the session locks (no close button, hardware-back blocked) until the chosen
 * duration completes, so the pause is protected from distraction.
 */
export default function MindfulPause() {
  const safeBack = useSafeBack();
  const profile = useProfile();
  const pushTimeline = useStore((s) => s.pushTimeline);
  const addPoints = useStore((s) => s.addPoints);
  const completeMission = useStore((s) => s.completeMission);

  const [minutes, setMinutes] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [finished, setFinished] = useState(false);
  const [tip, setTip] = useState(0);
  const [muted, setMuted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Absolute end time - remaining is derived from the clock, not decremented,
  // so backgrounding the app never stretches the session.
  const endAtRef = useRef(0);

  const relapses = useStore((s) => s.relapses);
  const journal = useStore((s) => s.journal);

  const active = minutes != null && !finished;
  // Money saved counts from the current streak window (event-derived, same as
  // Home) so the completion screen never overstates progress after a relapse.
  const money = profile
    ? moneySaved({ ...profile, startedAt: currentStreakStart(profile.startedAt, relapses, journal) })
    : ({ total: 0 } as ReturnType<typeof moneySaved>);
  const currency = profile?.currency ?? DEFAULT_CURRENCY;

  // Countdown - driven by the wall clock so time spent backgrounded counts.
  useEffect(() => {
    if (minutes == null || finished) return;
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        setFinished(true);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [minutes, finished]);

  // Rotate calming tips while breathing.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTip((i) => (i + 1) % BREATHING_TIPS.length), 11000);
    return () => clearInterval(id);
  }, [active]);

  // Award once, on completion.
  useEffect(() => {
    if (finished && minutes != null) {
      pushTimeline('breathing', `Completed a ${minutes}-minute Mindful Pause`);
      addPoints(minutes >= 15 ? 15 : 10);
      // Auto-complete both breathing and mindful_pause daily missions.
      completeMission('mindful_pause');
      completeMission('breathing');
      stopCalmMusic();
      playSound('win', 0.7);
    }
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the music if the screen unmounts mid-session for any reason.
  useEffect(() => () => stopCalmMusic(), []);

  // Lock the session: block Android hardware-back while active.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => active);
    return () => sub.remove();
  }, [active]);

  const start = (m: number) => {
    endAtRef.current = Date.now() + m * 60_000;
    setMinutes(m);
    setRemaining(m * 60);
    setMuted(false);
    startCalmMusic();
  };

  const toggleMusic = () => {
    setMuted((v) => {
      setCalmMusicPaused(!v);
      return !v;
    });
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View style={{ flex: 1, backgroundColor: palette.night }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Close is only available before the session starts; music toggle while active. */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.lg, minHeight: 44 }}>
          {minutes == null && (
            <Pressable onPress={safeBack} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={palette.fogDim} />
            </Pressable>
          )}
          {active && (
            <Pressable onPress={toggleMusic} hitSlop={16} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute music' : 'Mute music'}>
              <Ionicons name={muted ? 'volume-mute' : 'volume-medium'} size={24} color={palette.fogDim} />
            </Pressable>
          )}
        </View>

        {/* ── Duration selection ─────────────────────────────────────── */}
        {minutes == null && (
          <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
            <Text variant="title1" center color={palette.fog}>Mindful Pause</Text>
            <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.md, marginBottom: spacing.xxl, paddingHorizontal: spacing.md }}>
              Choose how long to breathe. Once you begin, stay with it until the timer ends - no exits, just you and your breath.
            </Text>
            <View style={{ gap: spacing.md }}>
              {DURATIONS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => start(m)}
                  accessibilityRole="button"
                  accessibilityLabel={`Breathe for ${m} minutes`}
                  style={({ pressed }) => ({
                    height: 58, borderRadius: radius.button, backgroundColor: palette.nightRaised,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons name="leaf" size={18} color={palette.grape300} />
                  <Text variant="headline" color={palette.fog}>{m} minutes</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Active session (locked) ────────────────────────────────── */}
        {active && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
            <BreathingOrb size={230} />
            <Text variant="display" color={palette.fog} style={{ marginTop: spacing.xl, fontSize: 44, fontVariant: ['tabular-nums'] }}>
              {mm}:{ss}
            </Text>
            <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
              {BREATHING_TIPS[tip]}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xl }}>
              <Ionicons name="lock-closed" size={13} color={palette.fogDim} />
              <Text variant="caption" color={palette.fogDim}>Stay with your breath - the pause is protected</Text>
            </View>
          </View>
        )}

        {/* ── Completion ─────────────────────────────────────────────── */}
        {finished && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            <Ionicons name="checkmark-circle" size={72} color={palette.grape300} />
            <Text variant="title1" center color={palette.fog} style={{ marginTop: spacing.lg }}>
              You stayed with it.
            </Text>
            <Text variant="body" center color={palette.fogDim} style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
              {minutes} minutes of calm - the urge you felt earlier has already softened. That's the skill.
            </Text>
            <Text variant="callout" center color={palette.fogDim} style={{ marginTop: spacing.lg }}>
              Money saved so far: {formatMoney(money.total, currency)}
            </Text>
            <Pressable
              onPress={safeBack}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={({ pressed }) => ({ marginTop: spacing.xxxl, alignSelf: 'stretch', height: 52, borderRadius: radius.button, backgroundColor: palette.grape, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
            >
              <Text variant="headline" color="#FFFFFF">Done</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
