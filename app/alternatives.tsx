/**
 * Healthy Alternatives - interactive recovery actions.
 *
 * Every activity is a real action with its own native-feeling flow (sheet,
 * timer, or confirmation) instead of a static suggestion. Completions persist
 * offline, count once per calendar day, and reset automatically at local
 * midnight (state stores a timestamp; "done today" is derived with sameDay).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated as RNAnimated, Easing, Modal, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/presentation/components/Screen';
import { Text } from '@/presentation/components/Text';
import { Button } from '@/presentation/components/Button';
import { ActionSheet } from '@/presentation/components/ActionSheet';
import { ProgressBar } from '@/presentation/components/ProgressBar';
import { BreathingOrb } from '@/presentation/components/BreathingOrb';
import { GameCelebration } from '@/presentation/components/games/GameCelebration';
import { StretchFigure } from '@/presentation/components/StretchFigure';
import { radius, spacing } from '@/presentation/theme/tokens';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { useSafeBack } from '@/presentation/hooks/useSafeBack';
import { useProfile, useStore, useTodayAnyJournal } from '@/application/store';
import { startCalmMusic, stopCalmMusic } from '@/application/sound';
import {
  ALT_ACHIEVEMENTS,
  ALTERNATIVES,
  BREATHE_MAX_MINUTES,
  BREATHE_MIN_MINUTES,
  BREATHE_MINUTES,
  MUSIC_GOAL_SECONDS,
  STRETCH_COUNT_OPTIONS,
  STRETCH_SECONDS_OPTIONS,
  STRETCH_STEPS,
  WATER_GOAL_GLASSES,
  type AltAchievement,
  type AltCounts,
  type Alternative,
  type AlternativeId,
  type StretchStep,
} from '@/domain/alternatives';
import { localDayKey } from '@/domain/quotes';
import {
  GPS_MAX_ACCURACY_M,
  WALK_MIN_SECONDS,
  formatDistance,
  formatPace,
  gpsDelta,
} from '@/domain/walk';
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

/** Lifetime durations as a compact human total: 45s → "45s", 12m, 1h 35m. */
function fmtTotalDur(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Live walk metrics handed to the store + share card when a walk ends. */
interface WalkMetrics {
  seconds: number;
  steps: number;
  meters: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Completed state - shared success view inside sheets
// ─────────────────────────────────────────────────────────────────────────────

function SheetDone({
  title,
  message,
  stats,
  onShare,
  onClose,
}: {
  title: string;
  message: string;
  /** Session summary tiles (duration, finish time, …) - the Strava moment. */
  stats?: { label: string; value: string }[];
  /** Opens the shareable session card. */
  onShare?: () => void;
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
      {stats && stats.length > 0 && (
        <View
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            backgroundColor: theme.color.surfaceAlt,
            borderRadius: radius.card,
            padding: spacing.md,
          }}
        >
          {stats.map((st) => (
            <View key={st.label} style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>{st.value}</Text>
              <Text variant="caption" dim style={{ marginTop: 2 }} center>{st.label}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
        {onShare && <Button label="Share this session" kind="secondary" onPress={onShare} full />}
        <Button label="Done" onPress={onClose} full />
      </View>
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
// 1. Walk - open-ended Strava-style session: live stopwatch, real step count
// (pedometer) and GPS distance. The user decides when to stop. Sensors are
// requested only when the walk starts and everything stays on-device.
// ─────────────────────────────────────────────────────────────────────────────

type WalkPhase = 'idle' | 'running' | 'paused' | 'done';

/** Soft pulsing halo behind the live stopwatch - the "recording" heartbeat. */
function WalkPulse({ active, children }: { active: boolean; children: React.ReactNode }) {
  const theme = useTheme();
  const anim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(anim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        RNAnimated.timing(anim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);

  return (
    <View style={{ width: 190, height: 190, alignItems: 'center', justifyContent: 'center' }}>
      <RNAnimated.View
        pointerEvents="none"
        style={{
          position: 'absolute', width: 190, height: 190, borderRadius: 95,
          backgroundColor: theme.color.success,
          opacity: active ? anim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] }) : 0.06,
          transform: [{ scale: active ? anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.05] }) : 0.92 }],
        }}
      />
      <View
        style={{
          width: 158, height: 158, borderRadius: 79,
          backgroundColor: theme.color.successSoft,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Live metric tile - springs on every value change so the numbers feel alive. */
function LiveStat({ label, value, on }: { label: string; value: string; on: boolean }) {
  const theme = useTheme();
  const scale = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    scale.setValue(1.12);
    RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 220 }).start();
  }, [value, scale]);

  return (
    <View
      style={{
        flex: 1, alignItems: 'center', paddingVertical: spacing.md,
        backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card,
      }}
    >
      <RNAnimated.View style={{ transform: [{ scale }] }}>
        <Text variant="headline" color={on ? theme.color.text : theme.color.textDim} style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      </RNAnimated.View>
      <Text variant="caption" dim style={{ marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SensorBadge({ icon, label, on }: { icon: keyof typeof Ionicons.glyphMap; label: string; on: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? theme.color.success : theme.color.hairline }} />
      <Ionicons name={icon} size={12} color={on ? theme.color.success : theme.color.textDim} />
      <Text variant="caption" color={on ? theme.color.success : theme.color.textDim}>{label}</Text>
    </View>
  );
}

function WalkSheet({
  visible,
  onClose,
  onComplete,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: (m: WalkMetrics) => void;
  onShare: (m: WalkMetrics) => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<WalkPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [meters, setMeters] = useState(0);
  const [hasSteps, setHasSteps] = useState(false);
  const [hasGps, setHasGps] = useState(false);

  // Wall-clock elapsed, pause-aware - locking the phone stays honest.
  const startAtRef = useRef(0);
  const accumRef = useRef(0);
  // Each pedometer watch counts from its own start; the base carries totals
  // across pause/resume cycles.
  const stepBaseRef = useRef(0);
  const stepsRef = useRef(0);
  const metersRef = useRef(0);
  const lastFixRef = useRef<{ lat: number; lon: number } | null>(null);
  const stepSubRef = useRef<{ remove(): void } | null>(null);
  const locSubRef = useRef<{ remove(): void } | null>(null);
  // Bumped on stop/unmount so a late async sensor grant can't leak a watcher.
  const sensorGenRef = useRef(0);

  const stopSensors = useCallback(() => {
    sensorGenRef.current += 1;
    stepSubRef.current?.remove();
    stepSubRef.current = null;
    locSubRef.current?.remove();
    locSubRef.current = null;
    // A GPS gap while paused must never count as distance walked.
    lastFixRef.current = null;
  }, []);

  const startSensors = useCallback(async () => {
    const gen = sensorGenRef.current;

    // Steps - Motion & Fitness permission, requested only now, in context.
    try {
      if (await Pedometer.isAvailableAsync()) {
        const perm = await Pedometer.requestPermissionsAsync();
        if (perm.granted && gen === sensorGenRef.current) {
          setHasSteps(true);
          stepSubRef.current = Pedometer.watchStepCount((r) => {
            stepsRef.current = stepBaseRef.current + r.steps;
            setSteps(stepsRef.current);
          });
        }
      }
    } catch {
      /* step counting is a bonus - the walk still works without it */
    }

    // Distance - while-in-use location, requested only now, in context.
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (loc) => {
            const next = {
              lat: loc.coords.latitude,
              lon: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
            };
            const d = gpsDelta(lastFixRef.current, next);
            if (d > 0) {
              metersRef.current += d;
              setMeters(metersRef.current);
            }
            if (next.accuracy == null || next.accuracy <= GPS_MAX_ACCURACY_M) {
              lastFixRef.current = { lat: next.lat, lon: next.lon };
            }
          },
        );
        if (gen === sensorGenRef.current) {
          setHasGps(true);
          locSubRef.current = sub;
        } else {
          sub.remove(); // the session ended while the OS was granting
        }
      }
    } catch {
      /* distance is a bonus - the walk still works without it */
    }
  }, []);

  // Fresh state on open; hard cleanup on close/unmount.
  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setElapsed(0);
      setSteps(0);
      setMeters(0);
      setHasSteps(false);
      setHasGps(false);
      accumRef.current = 0;
      stepBaseRef.current = 0;
      stepsRef.current = 0;
      metersRef.current = 0;
    } else {
      stopSensors();
    }
  }, [visible, stopSensors]);
  useEffect(() => () => stopSensors(), [stopSensors]);

  // Stopwatch - derived from the wall clock, never drift-prone increments.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      setElapsed(Math.floor(accumRef.current + (Date.now() - startAtRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startAtRef.current = Date.now();
    setPhase('running');
    startSensors();
  };

  const pause = () => {
    Haptics.selectionAsync().catch(() => {});
    accumRef.current += (Date.now() - startAtRef.current) / 1000;
    setElapsed(Math.floor(accumRef.current));
    stepBaseRef.current = stepsRef.current;
    stopSensors();
    setPhase('paused');
  };

  const resume = () => {
    Haptics.selectionAsync().catch(() => {});
    startAtRef.current = Date.now();
    setPhase('running');
    startSensors();
  };

  const finish = () => {
    const secs =
      phase === 'paused'
        ? Math.floor(accumRef.current)
        : Math.floor(accumRef.current + (Date.now() - startAtRef.current) / 1000);
    stopSensors();
    setElapsed(secs);
    setPhase('done');
    successHaptic();
    onComplete({ seconds: secs, steps: stepsRef.current, meters: Math.round(metersRef.current) });
  };

  const cancel = () => {
    stopSensors();
    setPhase('idle');
    onClose();
  };

  const canFinish = elapsed >= WALK_MIN_SECONDS;
  const pace = formatPace(elapsed, meters);
  const status =
    phase === 'running' ? 'Walking - stay with it' : phase === 'paused' ? 'Paused' : 'Ready when you are';

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase === 'idle'}>
      {phase === 'done' ? (
        <SheetDone
          title="Great walk."
          message="Every healthy choice strengthens your recovery."
          stats={[
            { label: 'Time', value: fmtClock(elapsed) },
            { label: 'Steps', value: hasSteps ? steps.toLocaleString() : '-' },
            { label: 'Distance', value: hasGps && meters > 0 ? formatDistance(meters) : '-' },
          ]}
          onShare={() => onShare({ seconds: elapsed, steps: stepsRef.current, meters: Math.round(metersRef.current) })}
          onClose={onClose}
        />
      ) : phase === 'idle' ? (
        <View style={{ gap: spacing.md }}>
          <SheetHeading
            title="Take a Walk"
            subtitle="Walk as long as you like - you decide when to stop. Time, steps, and distance are tracked live, all on this device."
          />
          <View style={{ gap: spacing.sm }}>
            {([
              ['stopwatch', 'Live stopwatch - walk at your own pace'],
              ['footsteps', 'Step counting via your phone’s motion sensor'],
              ['navigate', 'GPS distance & pace, only while walking'],
            ] as [keyof typeof Ionicons.glyphMap, string][]).map(([icon, text]) => (
              <View
                key={text}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md,
                }}
              >
                <Ionicons name={icon} size={18} color={theme.color.success} />
                <Text variant="callout" style={{ flex: 1 }}>{text}</Text>
              </View>
            ))}
          </View>
          <Button label="Start Walking" onPress={start} full style={{ marginTop: spacing.sm }} />
          <Button label="Cancel" kind="tertiary" onPress={onClose} full />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <SheetHeading title="Recovery Walk" subtitle={status} />

          <WalkPulse active={phase === 'running'}>
            <Text
              variant="display"
              style={{ fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] }}
              accessibilityLabel={`${fmtClock(elapsed)} elapsed`}
            >
              {fmtClock(elapsed)}
            </Text>
            <Text variant="footnote" dim>elapsed</Text>
          </WalkPulse>

          {/* Live metrics */}
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: spacing.sm }}>
            <LiveStat label="Steps" value={hasSteps ? steps.toLocaleString() : '-'} on={hasSteps} />
            <LiveStat label="Distance" value={hasGps ? formatDistance(meters) : '-'} on={hasGps} />
            <LiveStat label="Pace" value={pace ?? '-'} on={pace != null} />
          </View>

          {/* Sensor status */}
          <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: -spacing.sm }}>
            <SensorBadge icon="footsteps" label={hasSteps ? 'Steps on' : 'Steps off'} on={hasSteps} />
            <SensorBadge icon="navigate" label={hasGps ? 'GPS on' : 'GPS off'} on={hasGps} />
          </View>

          <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            {phase === 'running' ? (
              <Button label="Pause" kind="secondary" onPress={pause} full />
            ) : (
              <Button label="Resume" onPress={resume} full />
            )}
            <Button label="Finish Walk" onPress={finish} disabled={!canFinish} full />
            <Button label="Cancel Session" kind="destructive" onPress={cancel} full />
          </View>
          {!canFinish && (
            <Text variant="caption" dim center style={{ marginTop: -spacing.sm }}>
              Walk at least a minute for it to count.
            </Text>
          )}
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Water - small confirmation sheet
// ─────────────────────────────────────────────────────────────────────────────

/** Round +/- stepper button shared by the water and breathe configurators. */
function StepBtn({ icon, onPress, label, disabled }: {
  icon: 'add' | 'remove';
  onPress: () => void;
  label: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 48, height: 48, borderRadius: radius.round,
        backgroundColor: theme.color.surfaceAlt,
        alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={theme.color.primary} />
    </Pressable>
  );
}

function WaterSheet({
  visible,
  onClose,
  onComplete,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  /** Logs `glasses` and completes today's activity. */
  onComplete: (glasses: number) => void;
  onShare: () => void;
}) {
  const theme = useTheme();
  const waterToday = useStore((s) => s.waterToday);
  const waterGlassesTotal = useStore((s) => s.waterGlassesTotal);
  const glassesToday = waterToday.day === localDayKey() ? waterToday.glasses : 0;

  const [glasses, setGlasses] = useState(1);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (visible) {
      setDone(false);
      setGlasses(1);
    }
  }, [visible]);

  const log = () => {
    successHaptic();
    onComplete(glasses);
    setDone(true);
  };

  const goalPct = Math.min(1, glassesToday / WATER_GOAL_GLASSES);

  return (
    <ActionSheet visible={visible} onClose={onClose}>
      {done ? (
        <SheetDone
          title={glassesToday >= WATER_GOAL_GLASSES ? 'Hydration goal reached!' : 'Nicely done.'}
          message={
            glassesToday >= WATER_GOAL_GLASSES
              ? `${WATER_GOAL_GLASSES} glasses today - your body thanks you.`
              : 'Hydration helps your body recover.'
          }
          stats={[
            { label: 'Logged', value: `+${glasses}` },
            { label: 'Today', value: `${glassesToday}/${WATER_GOAL_GLASSES}` },
            { label: 'Lifetime', value: waterGlassesTotal.toLocaleString() },
          ]}
          onShare={onShare}
          onClose={onClose}
        />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <SheetHeading
            title="Drink Water"
            subtitle="A small reset for your body - and a pause for your mind."
          />

          {/* Today's goal */}
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="footnote" dim>Today's goal</Text>
              <Text variant="footnote" color={glassesToday >= WATER_GOAL_GLASSES ? theme.color.success : theme.color.textDim} style={{ fontVariant: ['tabular-nums'] }}>
                {glassesToday} of {WATER_GOAL_GLASSES} glasses
              </Text>
            </View>
            <ProgressBar progress={goalPct} height={8} color={theme.color.success} />
          </View>

          {/* How many glasses */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
              backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card,
              padding: spacing.lg, justifyContent: 'center',
            }}
          >
            <StepBtn icon="remove" label="One glass fewer" onPress={() => setGlasses((g) => Math.max(1, g - 1))} disabled={glasses <= 1} />
            <View style={{ alignItems: 'center', minWidth: 96 }}>
              <Text variant="display" style={{ fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] }}>
                {glasses}
              </Text>
              <Text variant="caption" dim>{glasses === 1 ? 'glass' : 'glasses'}</Text>
            </View>
            <StepBtn icon="add" label="One glass more" onPress={() => setGlasses((g) => Math.min(12, g + 1))} disabled={glasses >= 12} />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button label={`Log ${glasses} ${glasses === 1 ? 'glass' : 'glasses'}`} onPress={log} full />
            <Button label="Not Yet" kind="tertiary" onPress={onClose} full />
          </View>
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Stretch - the user builds the routine: how many stretches, how long each
// ─────────────────────────────────────────────────────────────────────────────

type StretchPhase = 'idle' | 'running' | 'done';

/** Fisher–Yates copy - sessions draw a fresh mix from the stretch library. */
function shuffled<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Selection chip row shared by the stretch configurator. */
function ChipRow<T extends number>({
  options, value, onChange, format,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o);
            }}
            accessibilityRole="button"
            accessibilityLabel={format(o)}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flex: 1, height: 40, borderRadius: radius.round,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text variant="footnote" color={on ? theme.color.onPrimary : theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>
              {format(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StretchSheet({
  visible,
  onClose,
  onComplete,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: (m: { seconds: number; stretches: number }) => void;
  onShare: (m: { seconds: number; stretches: number }) => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<StretchPhase>('idle');
  const [count, setCount] = useState<number>(5);
  const [perStep, setPerStep] = useState<number>(30);
  const [routine, setRoutine] = useState<StretchStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [remaining, setRemaining] = useState(30);
  const [sessionSecs, setSessionSecs] = useState(0);
  const endAtRef = useRef(0);
  // Refs mirror the config so timer callbacks never read stale state.
  const routineRef = useRef<StretchStep[]>([]);
  const perStepRef = useRef(30);
  // Wall-clock session start - the shared card reports real time spent.
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setStepIdx(0);
    }
  }, [visible]);

  const finish = useCallback(() => {
    const secs = startedAtRef.current
      ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 0;
    setSessionSecs(secs);
    setPhase('done');
    successHaptic();
    onComplete({ seconds: secs, stretches: routineRef.current.length });
  }, [onComplete]);

  const advance = useCallback(() => {
    setStepIdx((i) => {
      const next = i + 1;
      if (next >= routineRef.current.length) {
        finish();
        return i;
      }
      Haptics.selectionAsync().catch(() => {});
      endAtRef.current = Date.now() + perStepRef.current * 1000;
      setRemaining(perStepRef.current);
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
    const picked = shuffled(STRETCH_STEPS).slice(0, Math.min(count, STRETCH_STEPS.length));
    routineRef.current = picked;
    perStepRef.current = perStep;
    setRoutine(picked);
    startedAtRef.current = Date.now();
    endAtRef.current = Date.now() + perStep * 1000;
    setStepIdx(0);
    setRemaining(perStep);
    setPhase('running');
  };

  const step = routine[stepIdx];
  const overall =
    phase === 'running' && routine.length > 0
      ? (stepIdx + 1 - remaining / perStep) / routine.length
      : phase === 'done'
        ? 1
        : 0;
  const estMinutes = Math.max(1, Math.round((count * perStep) / 60));

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase !== 'running'}>
      {phase === 'done' ? (
        <SheetDone
          title="You showed up for your body."
          message="Tension released is stress your recovery no longer carries."
          stats={[
            { label: 'Stretched', value: fmtClock(sessionSecs) },
            { label: 'Stretches', value: `${routine.length}` },
            { label: 'Finished', value: fmtTime(Date.now()) },
          ]}
          onShare={() => onShare({ seconds: sessionSecs, stretches: routine.length })}
          onClose={onClose}
        />
      ) : phase === 'idle' ? (
        <View style={{ gap: spacing.lg }}>
          <SheetHeading
            title="Stretch Your Body"
            subtitle="Build your own routine - pick how many stretches and how long each one runs."
          />

          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" dim>How many stretches?</Text>
            <ChipRow
              options={STRETCH_COUNT_OPTIONS}
              value={count as (typeof STRETCH_COUNT_OPTIONS)[number]}
              onChange={setCount}
              format={(v) => `${v}`}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" dim>Seconds per stretch</Text>
            <ChipRow
              options={STRETCH_SECONDS_OPTIONS}
              value={perStep as (typeof STRETCH_SECONDS_OPTIONS)[number]}
              onChange={setPerStep}
              format={(v) => `${v}s`}
            />
          </View>

          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card, padding: spacing.md,
            }}
          >
            <Ionicons name="shuffle" size={18} color={theme.color.primary} />
            <Text variant="callout" style={{ flex: 1 }}>
              {count} stretches · about {estMinutes} minute{estMinutes === 1 ? '' : 's'} - a fresh mix from {STRETCH_STEPS.length} moves
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button label="Begin stretching" onPress={start} full />
            <Button label="Cancel" kind="tertiary" onPress={onClose} full />
          </View>
        </View>
      ) : step == null ? null : (
        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <SheetHeading title={step.title} />
          {/* Animated demo - move along with the figure. */}
          <StretchFigure title={step.title} size={132} />
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
              Stretch {stepIdx + 1} of {routine.length}
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
// 5. Breathing - orb-guided session with selectable duration
// ─────────────────────────────────────────────────────────────────────────────

type BreathePhase = 'idle' | 'running' | 'done';

function BreatheSheet({
  visible,
  onClose,
  onComplete,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: (seconds: number) => void;
  onShare: (seconds: number) => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<BreathePhase>('idle');
  const [remaining, setRemaining] = useState(0);
  const [sessionSecs, setSessionSecs] = useState(0);
  /** User-chosen session length in minutes - chips for quick picks, stepper
   *  for anything from 1 to 30. */
  const [minutes, setMinutes] = useState(3);
  const endAtRef = useRef(0);
  /** Chosen session length in seconds - elapsed = chosen − remaining. */
  const chosenRef = useRef(0);

  useEffect(() => {
    if (visible) setPhase('idle');
  }, [visible]);

  const finish = useCallback((secondsLeft: number) => {
    const breathed = Math.max(0, chosenRef.current - Math.max(0, secondsLeft));
    setSessionSecs(breathed);
    setPhase('done');
    successHaptic();
    onComplete(breathed);
  }, [onComplete]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) finish(0);
    }, 500);
    return () => clearInterval(id);
  }, [phase, finish]);

  const start = (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    endAtRef.current = Date.now() + minutes * 60_000;
    chosenRef.current = minutes * 60;
    setRemaining(minutes * 60);
    setPhase('running');
  };

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase !== 'running'}>
      {phase === 'done' ? (
        <SheetDone
          title="Breath by breath."
          message="Your nervous system just got a real reset. The urge is smaller than it was."
          stats={[
            { label: 'Breathed', value: fmtClock(sessionSecs) },
            { label: 'Cycles', value: `${Math.max(1, Math.round(sessionSecs / 12))}` },
            { label: 'Finished', value: fmtTime(Date.now()) },
          ]}
          onShare={() => onShare(sessionSecs)}
          onClose={onClose}
        />
      ) : phase === 'idle' ? (
        <View style={{ gap: spacing.lg }}>
          <SheetHeading
            title="Practice Deep Breathing"
            subtitle="Inhale, hold, exhale - the orb sets the pace. Set any length you like."
          />

          {/* Quick picks */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {BREATHE_MINUTES.map((m) => {
              const on = minutes === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMinutes(m);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${m} minute${m === 1 ? '' : 's'}`}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flex: 1, height: 40, borderRadius: radius.round,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: on ? theme.color.primary : theme.color.surfaceAlt,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text variant="footnote" color={on ? theme.color.onPrimary : theme.color.text} style={{ fontVariant: ['tabular-nums'] }}>
                    {m}m
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Free stepper - 1 to 30 minutes */}
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
              backgroundColor: theme.color.surfaceAlt, borderRadius: radius.card,
              padding: spacing.lg, justifyContent: 'center',
            }}
          >
            <StepBtn
              icon="remove"
              label="One minute less"
              onPress={() => setMinutes((m) => Math.max(BREATHE_MIN_MINUTES, m - 1))}
              disabled={minutes <= BREATHE_MIN_MINUTES}
            />
            <View style={{ alignItems: 'center', minWidth: 110 }}>
              <Text variant="display" style={{ fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] }}>
                {minutes}
              </Text>
              <Text variant="caption" dim>minute{minutes === 1 ? '' : 's'}</Text>
            </View>
            <StepBtn
              icon="add"
              label="One minute more"
              onPress={() => setMinutes((m) => Math.min(BREATHE_MAX_MINUTES, m + 1))}
              disabled={minutes >= BREATHE_MAX_MINUTES}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Button label={`Breathe for ${minutes} minute${minutes === 1 ? '' : 's'}`} onPress={() => start(minutes)} full />
            <Button label="Cancel" kind="tertiary" onPress={onClose} full />
          </View>
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
          <Button label="Finish Early" kind="tertiary" onPress={() => finish(remaining)} full />
          <Button label="Cancel Session" kind="destructive" onPress={onClose} full />
        </View>
      )}
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Calming music - built-in audio; completes after a meaningful session
// ─────────────────────────────────────────────────────────────────────────────

type MusicPhase = 'idle' | 'playing' | 'done';

function MusicSheet({
  visible,
  onClose,
  onComplete,
  onSessionEnd,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  /** Fires once at the goal mark - unlocks the daily completion. */
  onComplete: () => void;
  /** Fires at Stop with the FULL listening time (incl. beyond the goal). */
  onSessionEnd: (seconds: number) => void;
  onShare: (seconds: number) => void;
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
    if (completedRef.current) {
      // Log the whole listen - minutes past the goal count toward lifetime.
      onSessionEnd(Math.floor((Date.now() - startAtRef.current) / 1000));
      setPhase('done');
    } else {
      setPhase('idle');
      onClose();
    }
  };

  const goal = Math.min(1, elapsed / MUSIC_GOAL_SECONDS);

  return (
    <ActionSheet visible={visible} onClose={onClose} dismissable={phase !== 'playing'}>
      {phase === 'done' ? (
        <SheetDone
          title="A calmer mind."
          message="A few quiet minutes can carry you through the loudest urge."
          stats={[
            { label: 'Listened', value: fmtClock(elapsed) },
            { label: 'Goal', value: fmtClock(MUSIC_GOAL_SECONDS) },
            { label: 'Finished', value: fmtTime(Date.now()) },
          ]}
          onShare={() => onShare(elapsed)}
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
                ? 'Session complete - keep listening as long as you like'
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
// 2. Journal already done - info sheet
// ─────────────────────────────────────────────────────────────────────────────

function JournalDoneSheet({
  visible,
  onClose,
  onView,
  onShare,
  completedAt,
}: {
  visible: boolean;
  onClose: () => void;
  onView: () => void;
  onShare: () => void;
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
          One honest entry per day - you already did the work.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button label="View Today's Journal" onPress={onView} full />
          <Button label="Share this session" kind="secondary" onPress={onShare} full />
          <Button label="Close" kind="tertiary" onPress={onClose} full />
        </View>
      </View>
    </ActionSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Metrics - the on-device health dashboard. Everything is measured by
// this phone (pedometer, GPS, session timers, water logs) and never uploaded.
// ─────────────────────────────────────────────────────────────────────────────

function MetricTile({
  icon, label, value, tint, index,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint: string;
  index: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18)}
      style={{ flexBasis: '30%', flexGrow: 1 }}
    >
      <View
        style={{
          backgroundColor: theme.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.sm,
          alignItems: 'center',
          gap: 3,
        }}
      >
        <View
          style={{
            width: 30, height: 30, borderRadius: 15,
            backgroundColor: tint + '18',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={15} color={tint} />
        </View>
        <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
          {value}
        </Text>
        <Text variant="caption" dim numberOfLines={1}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function HealthMetrics() {
  const theme = useTheme();
  const altSeconds = useStore((s) => s.altSeconds);
  const walkSteps = useStore((s) => s.walkSteps);
  const walkMeters = useStore((s) => s.walkMeters);
  const waterToday = useStore((s) => s.waterToday);
  const glassesToday = waterToday.day === localDayKey() ? waterToday.glasses : 0;

  const activeSeconds =
    (altSeconds.walk ?? 0) + (altSeconds.stretch ?? 0) + (altSeconds.breathe ?? 0) + (altSeconds.music ?? 0);

  const tiles: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tint: string }[] = [
    { icon: 'footsteps', label: 'Steps', value: walkSteps > 0 ? walkSteps.toLocaleString() : '-', tint: theme.color.success },
    { icon: 'navigate', label: 'Distance', value: walkMeters > 0 ? formatDistance(walkMeters) : '-', tint: theme.color.success },
    { icon: 'time', label: 'Active time', value: activeSeconds > 0 ? fmtTotalDur(activeSeconds) : '-', tint: theme.color.primary },
    { icon: 'water', label: 'Water today', value: `${glassesToday}/${WATER_GOAL_GLASSES}`, tint: '#4A6FA5' },
    { icon: 'leaf', label: 'Breathing', value: (altSeconds.breathe ?? 0) > 0 ? fmtTotalDur(altSeconds.breathe ?? 0) : '-', tint: theme.color.primary },
    { icon: 'body', label: 'Stretching', value: (altSeconds.stretch ?? 0) > 0 ? fmtTotalDur(altSeconds.stretch ?? 0) : '-', tint: theme.color.celebrateText },
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm }}>
        <Text variant="headline" style={{ flex: 1 }}>Health Metrics</Text>
        <Text variant="caption" dim>All measured on this device</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {tiles.map((t, i) => (
          <MetricTile key={t.label} {...t} index={i} />
        ))}
      </View>
    </View>
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
    <View>
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
    </View>
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
  const recordAltSession = useStore((s) => s.recordAltSession);
  const recordWalkMetrics = useStore((s) => s.recordWalkMetrics);
  const logWater = useStore((s) => s.logWater);
  const altCounts = useStore((s) => s.altCounts);
  const altAchievements = useStore((s) => s.altAchievements);
  const journalCount = useStore((s) => s.journal.length);
  const profile = useProfile();
  // Any addiction type's entry counts as "journaled today" here; the wizard
  // route below still picks the correct addiction-specific flow.
  const todayJournal = useTodayAnyJournal();
  const journalRoute = profile?.addictionType === 'pornography' ? '/porn-journal-entry' : '/journal-entry';

  const [sheet, setSheet] = useState<AlternativeId | null>(null);
  // Achievements unlocked mid-sheet are celebrated after the sheet closes -
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

  /** Complete today's activity. When `seconds` is given the session is also
   *  logged to lifetime stats - music omits it here because its full length
   *  is only known at Stop (see onSessionEnd), and logging twice would
   *  double-count the session. */
  const handleComplete = (id: AlternativeId, seconds?: number) => {
    if (seconds != null) recordAltSession(id, seconds);
    const unlocked = completeAlternative(id);
    if (unlocked.length > 0) pendingUnlocks.current = unlocked;
  };

  /** Open the Strava-style session card. Closes the sheet WITHOUT flushing
   *  pending achievement unlocks - a visible RN Modal would float above the
   *  pushed share screen. They celebrate on refocus instead (below). */
  const shareSession = (id: AlternativeId, seconds: number, extra?: Record<string, string>) => {
    setSheet(null);
    router.push({
      pathname: '/share-activity',
      params: { id, seconds: String(Math.max(0, Math.round(seconds))), ...extra },
    });
  };

  // Celebrate deferred unlocks when the user returns from the share screen.
  useFocusEffect(
    useCallback(() => {
      if (sheet == null && celebrating == null && pendingUnlocks.current.length > 0) {
        setCelebrating(pendingUnlocks.current);
        pendingUnlocks.current = [];
      }
    }, [sheet, celebrating]),
  );

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
      else router.push(journalRoute as Parameters<typeof router.push>[0]);
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
            Real actions that outlast an urge - each counts once a day.
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

      {/* Health metrics dashboard */}
      <View style={{ marginBottom: spacing.xl }}>
        <HealthMetrics />
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
      <WalkSheet
        visible={sheet === 'walk'}
        onClose={close}
        onComplete={(m) => {
          recordWalkMetrics(m.steps, m.meters);
          handleComplete('walk', m.seconds);
        }}
        onShare={(m) =>
          shareSession('walk', m.seconds, { steps: String(m.steps), meters: String(m.meters) })
        }
      />
      <WaterSheet
        visible={sheet === 'water'}
        onClose={close}
        onComplete={(glasses) => {
          logWater(glasses);
          handleComplete('water', 0);
        }}
        onShare={() => {
          const w = useStore.getState().waterToday;
          const today = w.day === localDayKey() ? w.glasses : 0;
          shareSession('water', 0, { glasses: String(today) });
        }}
      />
      <StretchSheet
        visible={sheet === 'stretch'}
        onClose={close}
        onComplete={(m) => handleComplete('stretch', m.seconds)}
        onShare={(m) => shareSession('stretch', m.seconds, { stretches: String(m.stretches) })}
      />
      <BreatheSheet
        visible={sheet === 'breathe'}
        onClose={close}
        onComplete={(secs) => handleComplete('breathe', secs)}
        onShare={(secs) => shareSession('breathe', secs)}
      />
      <MusicSheet
        visible={sheet === 'music'}
        onClose={close}
        onComplete={() => handleComplete('music')}
        onSessionEnd={(secs) => recordAltSession('music', secs)}
        onShare={(secs) => shareSession('music', secs)}
      />
      <JournalDoneSheet
        visible={sheet === 'journal'}
        onClose={close}
        onShare={() => shareSession('journal', 0)}
        completedAt={todayJournal?.at}
        onView={() => {
          close();
          router.push('/(tabs)/journal');
        }}
      />

      {/* Achievement unlock celebration - same confetti card as the games.
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
// Achievement row - progress while locked, share when unlocked
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
