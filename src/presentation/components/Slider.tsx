import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, spacing, motion } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

interface SliderProps {
  value: number;   // 1..max
  onChange: (v: number) => void;
  max?: number;
  label?: string;
  kind?: 'mood' | 'urge';
}

function moodEmoji(v: number): string {
  if (v <= 1) return '😔';
  if (v <= 2) return '😞';
  if (v <= 3) return '😕';
  if (v <= 4) return '😐';
  if (v <= 5) return '🙂';
  if (v <= 6) return '😊';
  if (v <= 7) return '😄';
  if (v <= 8) return '😁';
  if (v <= 9) return '🥰';
  return '🤩';
}

function moodLabel(v: number): string {
  if (v <= 2) return 'Very low';
  if (v <= 4) return 'Low';
  if (v <= 6) return 'Okay';
  if (v <= 8) return 'Good';
  return 'Great';
}

function moodColor(v: number, danger: string, celebrate: string, primary: string, success: string): string {
  if (v <= 3) return danger;
  if (v <= 5) return celebrate;
  if (v <= 7) return primary;
  return success;
}

function urgeEmoji(v: number): string {
  if (v <= 1) return '😌';
  if (v <= 2) return '🙂';
  if (v <= 3) return '😐';
  if (v <= 4) return '😟';
  if (v <= 5) return '😬';
  if (v <= 6) return '😣';
  if (v <= 7) return '😖';
  if (v <= 8) return '😤';
  if (v <= 9) return '😫';
  return '😵';
}

function urgeLabel(v: number): string {
  if (v <= 2) return 'Very mild';
  if (v <= 4) return 'Mild';
  if (v <= 6) return 'Moderate';
  if (v <= 8) return 'Strong';
  return 'Very strong';
}

function urgeColor(v: number, danger: string, celebrate: string, primary: string, success: string): string {
  if (v <= 3) return success;
  if (v <= 5) return primary;
  if (v <= 7) return celebrate;
  return danger;
}

interface SegmentProps {
  n: number;
  value: number;
  label: string;
  max: number;
  onChange: (v: number) => void;
  activeColor: string;
  inactiveColor: string;
}

function Segment({ n, value, label, max, onChange, activeColor, inactiveColor }: SegmentProps) {
  const pressed = useSharedValue(0);
  const isActive = n <= value;
  const isCurrent = n === value;

  const barStyle = useAnimatedStyle(() => ({
    height: withSpring(isCurrent ? 18 : isActive ? 14 : 10, motion.spring),
    backgroundColor: withTiming(isActive ? activeColor : inactiveColor, { duration: 200 }),
    transform: [{ scaleY: withSpring(pressed.value ? 1.15 : 1, motion.spring) }],
    opacity: withTiming(isActive ? 1 : 0.35, { duration: 200 }),
  }));

  const onIn  = useCallback(() => { pressed.value = 1; }, [pressed]);
  const onOut = useCallback(() => { pressed.value = 0; }, [pressed]);
  const handle = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onChange(n);
  }, [n, onChange]);

  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={handle}
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} ${n} of ${max}`}
      style={{ flex: 1, height: 48, justifyContent: 'center', alignItems: 'center' }}
      hitSlop={2}
    >
      <Animated.View style={[{ width: '100%', borderRadius: radius.chip }, barStyle]} />
    </Pressable>
  );
}

/**
 * Segmented mood selector — tap or swipe.
 *
 * Swipe logic — strictly one step at a time:
 * ───────────────────────────────────────────
 * We use a "leftover bucket" approach:
 *   • `bucket` accumulates unspent pixels across frames.
 *   • Each frame we add (currentTranslation - prevTranslation) to the bucket.
 *   • We only advance ONE step when the bucket crosses ±stepPx, then subtract
 *     exactly one stepPx from the bucket.
 *   • We never advance more than one step per frame, no matter how large the
 *     delta is — that cap is the key line:
 *       if (Math.abs(bucket) >= stepPx) → advance 1, subtract stepPx, stop.
 *
 * This means even the fastest swipe on any device advances exactly one
 * segment per ~stepPx of travel, never jumping multiple steps at once.
 */
export function Slider({ value, onChange, max = 10, label, kind = 'mood' }: SliderProps) {
  const theme = useTheme();
  const c = theme.color;
  const color = kind === 'urge'
    ? urgeColor(value, c.danger, c.celebrate, c.primary, c.success)
    : moodColor(value, c.danger, c.celebrate, c.primary, c.success);

  const barRowWidth = useSharedValue(0);

  // Worklet-side mirror of the current value (updated by JS after each change).
  const currentValue = useSharedValue(value);
  currentValue.value = value;

  // Unspent pixels that haven't yet triggered a step.
  const bucket = useSharedValue(0);
  // translationX from the previous frame — used to compute per-frame delta.
  const prevTx = useSharedValue(0);

  const emitValue = useCallback(
    (next: number) => {
      onChange(next);
      Haptics.selectionAsync().catch(() => {});
    },
    [onChange],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      'worklet';
      bucket.value = 0;
      prevTx.value = 0;
    })
    .onUpdate((e) => {
      'worklet';
      const w = barRowWidth.value;
      if (w <= 0) return;

      // Pixels for one step.
      const stepPx = w / max;

      // Delta since the last frame (not since gesture start).
      const delta = e.translationX - prevTx.value;
      prevTx.value = e.translationX;

      // Add this frame's movement to the bucket.
      bucket.value += delta;

      // Only fire if the bucket has crossed one full step threshold.
      if (Math.abs(bucket.value) >= stepPx) {
        const direction = bucket.value > 0 ? 1 : -1;
        const next = Math.max(1, Math.min(max, currentValue.value + direction));

        // Subtract exactly one step from the bucket — remainder carries over.
        bucket.value -= direction * stepPx;

        if (next !== currentValue.value) {
          currentValue.value = next;
          runOnJS(emitValue)(next);
        }
      }
    })
    .onEnd(() => {
      'worklet';
      bucket.value = 0;
      prevTx.value = 0;
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View collapsable={false}>
        {/* Emoji + label — swiping here also works */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          {kind === 'mood' && <Text style={{ fontSize: 52, lineHeight: 60 }}>{moodEmoji(value)}</Text>}
          {kind === 'urge' && <Text style={{ fontSize: 52, lineHeight: 60 }}>{urgeEmoji(value)}</Text>}
          <Text variant="title2" color={color} style={{ marginTop: spacing.sm, fontFamily: 'Nunito_700Bold' }}>
            {value} / {max}
          </Text>
          <Text variant="footnote" dim style={{ marginTop: spacing.xs }}>
            {kind === 'urge' ? urgeLabel(value) : moodLabel(value)}
          </Text>
        </View>

        {/* Bars */}
        <View
          collapsable={false}
          onLayout={(e) => { barRowWidth.value = e.nativeEvent.layout.width; }}
          style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-end' }}
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <Segment
              key={n}
              n={n}
              value={value}
              label={label ?? (kind === 'urge' ? 'Urge intensity' : 'Mood')}
              max={max}
              onChange={onChange}
              activeColor={color}
              inactiveColor={c.surfaceAlt}
            />
          ))}
        </View>

        {/* Scale labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <Text variant="caption" dim>1</Text>
          <Text variant="caption" dim>{max}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}
